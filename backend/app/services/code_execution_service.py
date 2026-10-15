"""Run untrusted student code.

SANDBOX_MODE=online      Default. A hosted compiler API (Judge0 CE by default) runs the code, called from the
                         backend only. Needs internet, no Docker and no local compilers.
SANDBOX_MODE=docker      Real isolation: one throw-away container per run (no network, read-only root,
                         128 MB, 0.5 CPU, 64 pids, all capabilities dropped, hard wall-clock kill).
SANDBOX_MODE=subprocess  LOCAL DEVELOPMENT ONLY. Empty environment, fresh temp dir, CPU/memory/process
                         limits (rlimits on POSIX, a Job Object on Windows) and a process-tree kill on
                         timeout. It is NOT a security boundary: the child still runs as the backend's
                         OS user, so it can read files by absolute path and open sockets. Use docker
                         anywhere the code is not your own.
"""
import asyncio
import ctypes
import logging
import os
import shutil
import signal
import subprocess
import sys
import tempfile
import threading
import time
import uuid
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

from app.config import settings
from app.services import online_compiler
from app.services.sandbox_errors import SandboxRateLimited, SandboxUnavailable  # noqa: F401  (re-exported)

logger = logging.getLogger("skillsense_sandbox")

IS_WINDOWS = sys.platform == "win32"
RUN_TIMEOUT_S = 6          # wall clock for the program itself
COMPILE_TIMEOUT_S = 10     # compiling is limited separately
MAX_OUTPUT_BYTES = 64 * 1024
MAX_SOURCE_BYTES = 20 * 1024
OUTPUT_TRUNCATED_NOTE = "\n[output truncated at 64 KB]"


# ---------------------------------------------------------------------------
# Languages
# ---------------------------------------------------------------------------
@dataclass(frozen=True)
class Lang:
    key: str
    filename: str
    image: str
    compiler: Optional[str]      # executable that must exist on the host (subprocess mode)
    display: str
    memory_mb: int               # per-process memory ceiling in subprocess mode


LANGS: Dict[str, Lang] = {
    "python": Lang("python", "main.py", "python:3.11-alpine", None, "Python", 256),
    "javascript": Lang("javascript", "main.js", "node:20-alpine", "node", "Node.js", 768),
    "java": Lang("java", "Main.java", "eclipse-temurin:17-jdk-alpine", "javac", "Java compiler (javac)", 768),
    "c": Lang("c", "main.c", "gcc:13", "gcc", "C compiler (gcc)", 256),
    "cpp": Lang("cpp", "main.cpp", "gcc:13", "g++", "C++ compiler (g++)", 256),
}
ALIASES = {"py": "python", "js": "javascript", "node": "javascript", "c++": "cpp"}

# Friendly pre-check only. It is trivially bypassed (and also rejects some harmless programs),
# so isolation never depends on it: the sandbox below is what actually contains the code.
FORBIDDEN_PATTERNS = [
    "import subprocess", "from subprocess", "import os", "from os",
    "os.system", "os.popen", "os.exec", "shutil.rmtree", "__import__",
    "eval(", "exec(", "require('child_process')", "import child_process",
    "System.exit", "Runtime.getRuntime",
]


def _validate_code_security(source_code: str) -> Optional[str]:
    lowered = source_code.lower()
    for pattern in FORBIDDEN_PATTERNS:
        if pattern.lower() in lowered:
            return f"Security Restriction: Usage of '{pattern}' is not permitted in the coding sandbox."
    return None


def _result(status: str, stdout: str = "", stderr: str = "", compile_output: str = "", exit_code: int = 0, runtime_ms: int = 0) -> Dict[str, Any]:
    return {
        "status": status,
        "stdout": stdout.strip(),
        "stderr": stderr.strip(),
        "compile_output": compile_output.strip(),
        "exit_code": exit_code,
        "runtime_ms": runtime_ms,
        "memory_kb": None,  # not measured: never report a made-up number
    }


def _text(raw: bytes, truncated: bool) -> str:
    out = raw.decode("utf-8", errors="replace")
    return out + OUTPUT_TRUNCATED_NOTE if truncated else out


# ---------------------------------------------------------------------------
# Process runner shared by both backends: bounded output, wall-clock kill
# ---------------------------------------------------------------------------
@dataclass
class Limits:
    memory_mb: int = 256
    cpu_s: int = 8
    processes: Optional[int] = None  # None = unlimited (compilers spawn helpers)
    fsize_mb: int = 10


@dataclass
class Completed:
    returncode: int
    stdout: bytes
    stderr: bytes
    out_truncated: bool
    err_truncated: bool
    timed_out: bool
    elapsed_ms: int


class _JobBasicLimits(ctypes.Structure):
    _fields_ = [
        ("PerProcessUserTimeLimit", ctypes.c_int64), ("PerJobUserTimeLimit", ctypes.c_int64),
        ("LimitFlags", ctypes.c_uint32), ("MinimumWorkingSetSize", ctypes.c_size_t),
        ("MaximumWorkingSetSize", ctypes.c_size_t), ("ActiveProcessLimit", ctypes.c_uint32),
        ("Affinity", ctypes.c_size_t), ("PriorityClass", ctypes.c_uint32), ("SchedulingClass", ctypes.c_uint32),
    ]


class _JobIoCounters(ctypes.Structure):
    _fields_ = [(n, ctypes.c_uint64) for n in (
        "ReadOperationCount", "WriteOperationCount", "OtherOperationCount",
        "ReadTransferCount", "WriteTransferCount", "OtherTransferCount")]


class _JobExtendedLimits(ctypes.Structure):
    _fields_ = [
        ("BasicLimitInformation", _JobBasicLimits), ("IoInfo", _JobIoCounters),
        ("ProcessMemoryLimit", ctypes.c_size_t), ("JobMemoryLimit", ctypes.c_size_t),
        ("PeakProcessMemoryUsed", ctypes.c_size_t), ("PeakJobMemoryUsed", ctypes.c_size_t),
    ]


class _WinJob:
    """Windows Job Object: memory ceiling, CPU time, process-count cap, kill-on-close."""

    _LIMIT_PROCESS_TIME = 0x2
    _LIMIT_ACTIVE_PROCESS = 0x8
    _LIMIT_PROCESS_MEMORY = 0x100
    _LIMIT_KILL_ON_CLOSE = 0x2000

    def __init__(self, limits: Limits):
        k32 = ctypes.windll.kernel32
        k32.CreateJobObjectW.restype = ctypes.c_void_p
        k32.AssignProcessToJobObject.argtypes = [ctypes.c_void_p, ctypes.c_void_p]
        k32.TerminateJobObject.argtypes = [ctypes.c_void_p, ctypes.c_uint]
        k32.CloseHandle.argtypes = [ctypes.c_void_p]
        k32.SetInformationJobObject.argtypes = [ctypes.c_void_p, ctypes.c_int, ctypes.c_void_p, ctypes.c_uint32]
        self._k32 = k32
        self.handle = k32.CreateJobObjectW(None, None)
        info = _JobExtendedLimits()
        flags = self._LIMIT_KILL_ON_CLOSE | self._LIMIT_PROCESS_TIME
        if limits.memory_mb:
            flags |= self._LIMIT_PROCESS_MEMORY
        info.BasicLimitInformation.PerProcessUserTimeLimit = limits.cpu_s * 10_000_000  # 100 ns units
        if limits.processes:
            flags |= self._LIMIT_ACTIVE_PROCESS
            info.BasicLimitInformation.ActiveProcessLimit = limits.processes
        info.BasicLimitInformation.LimitFlags = flags
        info.ProcessMemoryLimit = limits.memory_mb * 1024 * 1024
        if not k32.SetInformationJobObject(self.handle, 9, ctypes.byref(info), ctypes.sizeof(info)):
            raise OSError("SetInformationJobObject failed")

    def assign(self, popen: subprocess.Popen) -> None:
        if not self._k32.AssignProcessToJobObject(self.handle, int(popen._handle)):
            raise OSError("AssignProcessToJobObject failed")

    def terminate(self) -> None:
        self._k32.TerminateJobObject(self.handle, 1)

    def close(self) -> None:
        self._k32.CloseHandle(self.handle)


def _posix_preexec(limits: Limits):
    import resource

    def apply():
        os.setsid()
        resource.setrlimit(resource.RLIMIT_CPU, (limits.cpu_s, limits.cpu_s))
        resource.setrlimit(resource.RLIMIT_FSIZE, (limits.fsize_mb << 20, limits.fsize_mb << 20))
        resource.setrlimit(resource.RLIMIT_CORE, (0, 0))
        if limits.memory_mb:
            # JVM/V8 reserve huge address ranges, so those languages pass memory_mb=0 and use heap flags
            resource.setrlimit(resource.RLIMIT_AS, (limits.memory_mb << 20, limits.memory_mb << 20))
        if limits.processes is not None:
            resource.setrlimit(resource.RLIMIT_NPROC, (limits.processes, limits.processes))

    return apply


def _drain(stream, sink: bytearray, flag: List[bool]) -> None:
    """Keep the first MAX_OUTPUT_BYTES, discard the rest, so a chatty program can't exhaust memory."""
    while True:
        chunk = stream.read(65536)
        if not chunk:
            return
        room = MAX_OUTPUT_BYTES - len(sink)
        if room > 0:
            sink.extend(chunk[:room])
        if len(chunk) > room:
            flag[0] = True


def _run_limited(cmd: List[str], *, cwd: str, env: Dict[str, str], stdin: str, timeout: float, limits: Limits) -> Completed:
    kwargs: Dict[str, Any] = {}
    job = None
    if IS_WINDOWS:
        kwargs["creationflags"] = subprocess.CREATE_NEW_PROCESS_GROUP | subprocess.CREATE_NO_WINDOW
    else:
        kwargs["preexec_fn"] = _posix_preexec(limits)

    started = time.monotonic()
    proc = subprocess.Popen(
        cmd, cwd=cwd, env=env, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
        close_fds=True, **kwargs,
    )
    if IS_WINDOWS:
        try:
            job = _WinJob(limits)
            job.assign(proc)
        except OSError:
            if proc.poll() is None:  # a program that already finished can't be (and needn't be) assigned
                proc.kill()
                raise SandboxUnavailable("The code sandbox is unavailable: could not apply resource limits to the process.")

    out, err = bytearray(), bytearray()
    out_flag, err_flag = [False], [False]
    threads = [
        threading.Thread(target=_drain, args=(proc.stdout, out, out_flag), daemon=True),
        threading.Thread(target=_drain, args=(proc.stderr, err, err_flag), daemon=True),
    ]

    def feed():
        try:
            proc.stdin.write(stdin.encode("utf-8", errors="replace"))
            proc.stdin.close()
        except (BrokenPipeError, OSError):
            pass  # the program exited without reading its input

    threads.append(threading.Thread(target=feed, daemon=True))
    for t in threads:
        t.start()

    timed_out = False
    try:
        proc.wait(timeout=timeout)
    except subprocess.TimeoutExpired:
        timed_out = True
        _kill_tree(proc, job)
        proc.wait()
    finally:
        # kill leftovers (e.g. grandchildren still holding the pipes) before joining the readers
        if job is not None:
            job.terminate()
        elif not IS_WINDOWS:
            _kill_group(proc)
        for t in threads:
            t.join(timeout=3)
        if job is not None:
            job.close()

    return Completed(
        returncode=proc.returncode, stdout=bytes(out), stderr=bytes(err),
        out_truncated=out_flag[0], err_truncated=err_flag[0], timed_out=timed_out,
        elapsed_ms=int((time.monotonic() - started) * 1000),
    )


def _kill_group(proc: subprocess.Popen) -> None:
    try:
        os.killpg(proc.pid, signal.SIGKILL)
    except (ProcessLookupError, PermissionError, OSError):
        pass


def _kill_tree(proc: subprocess.Popen, job: Optional["_WinJob"]) -> None:
    if job is not None:
        job.terminate()
    elif not IS_WINDOWS:
        _kill_group(proc)
    try:
        proc.kill()
    except OSError:
        pass


# ---------------------------------------------------------------------------
# Subprocess backend (development)
# ---------------------------------------------------------------------------
_node_permission_flag: Optional[List[str]] = None
_warned_unisolated = False


def _clean_env(tool_dir: Optional[str] = None) -> Dict[str, str]:
    """Nothing from the backend's environment is passed on: PATH (tool dir only) and, on Windows, SystemRoot."""
    env: Dict[str, str] = {"PATH": tool_dir or ""}
    if IS_WINDOWS:
        root = os.environ.get("SystemRoot", r"C:\Windows")
        env["SystemRoot"] = root
        env["PATH"] = os.pathsep.join(p for p in (tool_dir, os.path.join(root, "System32")) if p)
    return env


def _node_flags(workdir: str) -> List[str]:
    """Node's permission model (when available) confines file access to the work dir and blocks child processes."""
    global _node_permission_flag
    node = shutil.which("node")
    if _node_permission_flag is None:
        _node_permission_flag = []
        for flag in ("--permission", "--experimental-permission"):
            probe = subprocess.run([node, flag, "-e", "0"], capture_output=True, timeout=10)
            if probe.returncode == 0:
                _node_permission_flag = [flag]
                break
    if not _node_permission_flag:
        return []
    return [*_node_permission_flag, f"--allow-fs-read={workdir}", f"--allow-fs-write={workdir}"]


def _python_executable() -> str:
    return getattr(sys, "_base_executable", None) or sys.executable  # the base interpreter, not the venv with backend packages


def _run_subprocess(lang: Lang, source: str, stdin: str) -> Dict[str, Any]:
    global _warned_unisolated
    if IS_WINDOWS and not _warned_unisolated:
        _warned_unisolated = True
        logger.warning(
            "SANDBOX_MODE=subprocess on Windows: memory/process limits use a Job Object but file and "
            "network access are NOT isolated. Development only; use SANDBOX_MODE=docker for real isolation."
        )
    if lang.compiler and not shutil.which(lang.compiler):
        return _result("Compiler Not Installed", compile_output=f"The {lang.display} is not installed on this server, so {lang.key} cannot be run here.", exit_code=1)

    workdir = tempfile.mkdtemp(prefix="skillsense_sandbox_")
    try:
        src = os.path.join(workdir, lang.filename)
        with open(src, "w", encoding="utf-8", newline="\n") as fh:
            fh.write(source)
        exe = os.path.join(workdir, "main.exe" if IS_WINDOWS else "main")
        compile_limits = Limits(memory_mb=1024 if IS_WINDOWS else 0, cpu_s=COMPILE_TIMEOUT_S, processes=None)

        if lang.key == "java":
            javac = shutil.which("javac")
            done = _run_limited([javac, "-J-Xmx128m", src], cwd=workdir, env=_clean_env(os.path.dirname(javac)), stdin="", timeout=COMPILE_TIMEOUT_S, limits=compile_limits)
            if done.timed_out or done.returncode != 0:
                return _compile_failure(done)
            java = shutil.which("java") or os.path.join(os.path.dirname(javac), "java")
            cmd = [java, "-Xmx96m", "-Xss512k", "-XX:MaxMetaspaceSize=64m", "-XX:+UseSerialGC", "-XX:-UsePerfData", "-cp", workdir, "Main"]
            run_env, run_limits = _clean_env(os.path.dirname(java)), Limits(memory_mb=0 if not IS_WINDOWS else lang.memory_mb, cpu_s=RUN_TIMEOUT_S, processes=1 if IS_WINDOWS else None)
        elif lang.key in ("c", "cpp"):
            gcc = shutil.which(lang.compiler)
            std = ["-std=c++17"] if lang.key == "cpp" else []
            done = _run_limited([gcc, *std, "-O1", src, "-o", exe, "-lm"], cwd=workdir, env=_clean_env(os.path.dirname(gcc)), stdin="", timeout=COMPILE_TIMEOUT_S, limits=compile_limits)
            if done.timed_out or done.returncode != 0:
                return _compile_failure(done)
            cmd, run_env = [exe], _clean_env(os.path.dirname(gcc))
            run_limits = Limits(memory_mb=lang.memory_mb, cpu_s=RUN_TIMEOUT_S, processes=1 if IS_WINDOWS else 64)
        elif lang.key == "javascript":
            node = shutil.which("node")
            cmd = [node, "--max-old-space-size=96", *_node_flags(workdir), src]
            run_env = _clean_env(os.path.dirname(node))
            run_limits = Limits(memory_mb=lang.memory_mb if IS_WINDOWS else 0, cpu_s=RUN_TIMEOUT_S, processes=1 if IS_WINDOWS else None)
        else:  # python
            cmd = [_python_executable(), "-I", "-S", "-B", src]
            run_env = _clean_env(os.path.dirname(_python_executable()))
            run_limits = Limits(memory_mb=lang.memory_mb, cpu_s=RUN_TIMEOUT_S, processes=1 if IS_WINDOWS else 64)

        try:
            done = _run_limited(cmd, cwd=workdir, env=run_env, stdin=stdin, timeout=RUN_TIMEOUT_S, limits=run_limits)
        except OSError as exc:  # e.g. Windows Application Control refusing to start a freshly compiled program
            logger.warning("Could not start the program (%s)", type(exc).__name__)
            raise SandboxUnavailable("The operating system blocked the program from starting (application control policy).")
        return _finish(done)
    finally:
        shutil.rmtree(workdir, ignore_errors=True)


def _compile_failure(done: Completed) -> Dict[str, Any]:
    if done.timed_out:
        return _result("Compile Error", compile_output="Compilation timed out.", exit_code=124)
    text = _text(done.stderr or done.stdout, done.err_truncated)
    return _result("Compile Error", compile_output=text or "Compilation failed.", exit_code=done.returncode)


def _finish(done: Completed) -> Dict[str, Any]:
    stdout = _text(done.stdout, done.out_truncated)
    stderr = _text(done.stderr, done.err_truncated)
    if done.timed_out:
        return _result("Time Limit Exceeded", stdout, stderr or f"Execution timed out after {RUN_TIMEOUT_S} seconds.", exit_code=124, runtime_ms=done.elapsed_ms)
    status = "Success" if done.returncode == 0 else "Runtime Error"
    return _result(status, stdout, stderr, exit_code=done.returncode, runtime_ms=done.elapsed_ms)


# ---------------------------------------------------------------------------
# Docker backend (real isolation)
# ---------------------------------------------------------------------------
COMPILE_FAILED = 200  # exit code used inside the container to signal "compiler rejected the source"

_DOCKER_SCRIPTS = {
    "python": f"timeout {RUN_TIMEOUT_S} python -I -B /src/main.py",
    "javascript": f"timeout {RUN_TIMEOUT_S} node --max-old-space-size=64 /src/main.js",
    "java": (
        "cp /src/Main.java /work/ && cd /work && "
        f"{{ javac -J-Xmx64m Main.java > cerr 2>&1 || {{ cat cerr; exit {COMPILE_FAILED}; }}; }} && "
        f"timeout {RUN_TIMEOUT_S} java -Xmx64m -Xss512k -XX:MaxMetaspaceSize=48m -XX:+UseSerialGC -XX:-UsePerfData -cp /work Main"
    ),
    "c": (
        "cp /src/main.c /work/ && cd /work && "
        f"{{ gcc -O1 main.c -o main -lm > cerr 2>&1 || {{ cat cerr; exit {COMPILE_FAILED}; }}; }} && "
        f"timeout {RUN_TIMEOUT_S} ./main"
    ),
    "cpp": (
        "cp /src/main.cpp /work/ && cd /work && "
        f"{{ g++ -std=c++17 -O1 main.cpp -o main -lm > cerr 2>&1 || {{ cat cerr; exit {COMPILE_FAILED}; }}; }} && "
        f"timeout {RUN_TIMEOUT_S} ./main"
    ),
}


def _run_docker(lang: Lang, source: str, stdin: str) -> Dict[str, Any]:
    docker = shutil.which("docker")
    if not docker:
        raise SandboxUnavailable("The code sandbox is unavailable: SANDBOX_MODE=docker but Docker is not installed on the server.")

    workdir = tempfile.mkdtemp(prefix="skillsense_src_")
    name = f"skillsense-{uuid.uuid4().hex[:12]}"
    try:
        with open(os.path.join(workdir, lang.filename), "w", encoding="utf-8", newline="\n") as fh:
            fh.write(source)
        cmd = [
            docker, "run", "--rm", "-i", "--init", "--name", name, "--pull", "never",  # --init: PID 1 must reap/forward signals or `timeout` hangs
            "--network", "none", "--read-only", "--memory", "128m", "--memory-swap", "128m",
            "--cpus", "0.5", "--pids-limit", "64", "--cap-drop", "ALL",
            "--security-opt", "no-new-privileges", "--user", "65534:65534",
            "--tmpfs", "/work:rw,exec,size=16m",  # `exec`: compiled programs run from here (docker's default tmpfs is noexec)
            "-e", "TMPDIR=/work",  # no -w: docker would pre-create /work root-owned and break the tmpfs permissions
            "--mount", f"type=bind,source={workdir},target=/src,readonly",
            lang.image, "sh", "-c", _DOCKER_SCRIPTS[lang.key],
        ]
        budget = RUN_TIMEOUT_S + (COMPILE_TIMEOUT_S if lang.key in ("java", "c", "cpp") else 0) + 4  # + container start-up
        done = _run_limited(cmd, cwd=workdir, env=_docker_client_env(), stdin=stdin, timeout=budget, limits=Limits(memory_mb=0, cpu_s=budget + 5))
        if done.timed_out:  # killing the CLI does not stop the container
            subprocess.run([docker, "kill", name], capture_output=True, timeout=15)

        err_text = done.stderr.decode("utf-8", errors="replace")
        if done.returncode in (125, 126, 127) and (err_text.startswith("docker:") or "docker daemon" in err_text.lower()):
            raise SandboxUnavailable(_docker_failure_message(lang, err_text))
        if done.timed_out:
            return _result("Time Limit Exceeded", _text(done.stdout, done.out_truncated), f"Execution timed out after {RUN_TIMEOUT_S} seconds.", exit_code=124, runtime_ms=done.elapsed_ms)
        if done.returncode == COMPILE_FAILED:
            return _result("Compile Error", compile_output=_text(done.stdout, done.out_truncated), exit_code=1)
        if done.returncode in (124, 137, 143):
            if done.returncode == 124 or done.elapsed_ms >= RUN_TIMEOUT_S * 900:
                return _result("Time Limit Exceeded", _text(done.stdout, done.out_truncated), f"Execution timed out after {RUN_TIMEOUT_S} seconds.", exit_code=124, runtime_ms=done.elapsed_ms)
            return _result("Runtime Error", _text(done.stdout, done.out_truncated), "The program was killed (it probably exceeded the 128 MB memory limit).", exit_code=done.returncode, runtime_ms=done.elapsed_ms)
        return _finish(done)
    finally:
        shutil.rmtree(workdir, ignore_errors=True)


def _docker_client_env() -> Dict[str, str]:
    """The docker CLI needs a few host variables to find its daemon; none of them reach the container."""
    keep = ("PATH", "SystemRoot", "USERPROFILE", "HOME", "APPDATA", "LOCALAPPDATA", "DOCKER_HOST", "DOCKER_CONTEXT", "DOCKER_CONFIG", "TEMP", "TMP")
    return {k: v for k, v in os.environ.items() if k in keep}


def _docker_failure_message(lang: Lang, stderr: str) -> str:
    low = stderr.lower()
    if "unable to find image" in low or "no such image" in low or "pull access denied" in low:
        return f"The code sandbox is unavailable: image '{lang.image}' is not installed on the server (docker pull {lang.image})."
    if "daemon" in low or "pipe" in low or "connect" in low:
        return "The code sandbox is unavailable: the Docker daemon is not running on the server."
    return "The code sandbox is unavailable: Docker could not start the container."


# ---------------------------------------------------------------------------
# Async entry points (the event loop must never wait on a child process)
# ---------------------------------------------------------------------------
_slots = asyncio.Semaphore(settings.SANDBOX_MAX_CONCURRENT)
MAX_JUDGED_CASES = 5  # per submit, to respect the online provider's rate limits
JUDGE_UNAVAILABLE = "Judge unavailable"


async def execute_async(language: str, source_code: str, stdin: str = "") -> Dict[str, Any]:
    """Run one program with whichever runner SANDBOX_MODE selects."""
    key = ALIASES.get(language.lower().strip(), language.lower().strip())
    if settings.SANDBOX_MODE == "online":
        if key not in LANGS:
            return _result("Unsupported Language", stderr=f"Unsupported language '{language}'", exit_code=1)
        async with _slots:
            return await online_compiler.run_online(key, source_code, stdin)
    async with _slots:
        return await asyncio.to_thread(execute_in_sandbox, language, source_code, stdin)


def _normalise(text: str) -> str:
    """Compare outputs ignoring trailing whitespace on every line and at the end."""
    return "\n".join(line.rstrip() for line in text.replace("\r\n", "\n").split("\n")).rstrip()


async def run_tests_async(language: str, source_code: str, test_cases: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Judge a submission: run up to 5 test cases one after another and stop at the first failure.

    A provider failure ends the run with the verdict "Judge unavailable"; it is never reported as Wrong Answer.
    A problem with no test cases still raises SandboxUnavailable (HTTP 503).
    """
    cases = list(test_cases or [])[:MAX_JUDGED_CASES]
    if not cases:
        raise SandboxUnavailable("This problem has no test cases yet, so it cannot be judged.")

    results: List[Dict[str, Any]] = []
    passed = 0
    verdict = "Accepted"
    failed_case: Optional[int] = None
    message = ""
    last = {"stdout": "", "stderr": "", "compile_output": ""}
    total_ms = 0

    for idx, tc in enumerate(cases, start=1):
        stdin = tc.get("input", "")
        expected = str(tc.get("expected_output", ""))
        hidden = bool(tc.get("is_hidden", False))

        try:
            res = await execute_async(language, source_code, stdin)
        except (SandboxUnavailable, SandboxRateLimited) as exc:
            # The provider failed, the student's code did not: never a Wrong Answer, and nothing is recorded.
            return {
                "status": JUDGE_UNAVAILABLE, "passed_count": passed, "total_count": len(cases), "failed_case": None,
                "message": str(exc), "stdout": "", "stderr": "", "compile_output": "", "runtime_ms": 0,
                "memory_kb": None, "test_results": results,
            }
        total_ms += res["runtime_ms"]
        last = {k: res[k] for k in ("stdout", "stderr", "compile_output")}

        if res["status"] in ("Unsupported Language", "Compile Error", "Compiler Not Installed", "Security Violation"):
            verdict, failed_case = res["status"], idx
            message = res["compile_output"] or res["stderr"]
            break

        ok = res["status"] == "Success" and _normalise(res["stdout"]) == _normalise(expected)
        results.append({
            "case": idx,
            "input": stdin if not hidden else "Hidden Test Case",
            "expected": expected.strip() if not hidden else "[Hidden Test Case]",
            "actual": (res["stdout"] if not hidden else ("[Passed]" if ok else "[Output Hidden]")),
            "passed": ok,
            "is_hidden": hidden,
            **({"error": res["stderr"] or res["status"]} if res["status"] != "Success" else {}),
        })
        if ok:
            passed += 1
            continue

        failed_case = idx
        verdict = res["status"] if res["status"] in ("Runtime Error", "Time Limit Exceeded") else "Wrong Answer"
        message = f"Failed on test case {idx}" + (" (hidden)." if hidden else ".")
        break

    if verdict == "Accepted":
        total_in_problem = len(test_cases)
        message = f"Passed all {len(cases)} judged test cases" + (f" (first {MAX_JUDGED_CASES} of {total_in_problem})." if total_in_problem > MAX_JUDGED_CASES else ".")

    return {
        "status": verdict,
        "passed_count": passed,
        "total_count": len(cases),
        "failed_case": failed_case,
        "message": message,
        **last,
        "runtime_ms": int(total_ms / max(1, len(results) or 1)),
        "memory_kb": None,
        "test_results": results,
    }


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------
def execute_in_sandbox(language: str, source_code: str, stdin: str = "", precheck: bool = True) -> Dict[str, Any]:
    """Run one program LOCALLY (docker if SANDBOX_MODE=docker, otherwise a subprocess).

    The online mode goes through execute_async instead. `precheck=False` skips the friendly text blocklist; tests use it to prove the sandbox contains
    code on its own. Raises SandboxUnavailable when the configured sandbox cannot run at all.
    """
    key = ALIASES.get(language.lower().strip(), language.lower().strip())
    lang = LANGS.get(key)
    if lang is None:
        return _result("Unsupported Language", stderr=f"Unsupported language '{language}'", exit_code=1)

    if precheck:
        violation = _validate_code_security(source_code)
        if violation:
            return _result("Security Violation", stderr=violation, exit_code=1)

    if settings.SANDBOX_MODE == "docker":
        return _run_docker(lang, source_code, stdin)
    return _run_subprocess(lang, source_code, stdin)
