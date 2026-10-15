"""Sandbox behaviour. Every escape attempt runs with precheck=False, so the text blocklist can't help:
the sandbox itself has to contain the code.

The same containment tests run in both modes. Checks that need real isolation (file access by absolute
path, network) only run against docker; subprocess mode is documented as development-only.
"""
import shutil
import socket
import subprocess
import threading
import time

import pytest

from app.config import settings
from app.services import code_execution_service as sandbox
from app.services.code_execution_service import SandboxUnavailable, execute_in_sandbox
from tests.conftest import bearer

CANARY = "CANARY-SECRET-9d41f0c2"

HELLO = {
    "python": 'print("hello sandbox")',
    "javascript": 'console.log("hello sandbox");',
    "java": 'public class Main { public static void main(String[] a) { System.out.println("hello sandbox"); } }',
    "c": '#include <stdio.h>\nint main(void){ printf("hello sandbox\\n"); return 0; }',
    "cpp": '#include <iostream>\nint main(){ std::cout << "hello sandbox" << std::endl; return 0; }',
}
COMPILER = {"java": "javac", "c": "gcc", "cpp": "g++", "javascript": "node"}


def _docker_ready() -> str:
    """Empty string when docker + the four images are usable, otherwise the reason to skip."""
    if not shutil.which("docker"):
        return "docker is not installed"
    try:
        have = subprocess.run(["docker", "images", "--format", "{{.Repository}}:{{.Tag}}"], capture_output=True, text=True, timeout=30)
    except (subprocess.TimeoutExpired, OSError):
        return "docker daemon is not responding"
    if have.returncode != 0:
        return "docker daemon is not running"
    missing = {l.image for l in sandbox.LANGS.values()} - set(have.stdout.split())
    return f"docker images missing: {', '.join(sorted(missing))}" if missing else ""


DOCKER_SKIP = _docker_ready()


@pytest.fixture(params=["subprocess", pytest.param("docker", marks=pytest.mark.skipif(bool(DOCKER_SKIP), reason=DOCKER_SKIP))])
def mode(request, monkeypatch):
    monkeypatch.setattr(settings, "SANDBOX_MODE", request.param)
    return request.param


def run(lang, code, stdin=""):
    try:
        return execute_in_sandbox(lang, code, stdin, precheck=False)
    except SandboxUnavailable as exc:
        if "blocked the program" in str(exc):  # this machine's Application Control policy, not the sandbox
            pytest.skip(str(exc))
        raise


# ---- normal programs ----------------------------------------------------------------------------

@pytest.mark.parametrize("lang", list(HELLO))
def test_normal_program_runs(mode, lang):
    needed = COMPILER.get(lang)
    if mode == "subprocess" and needed and not shutil.which(needed):
        pytest.skip(f"{needed} is not installed")
    res = run(lang, HELLO[lang])
    assert res["status"] == "Success", res
    assert res["stdout"] == "hello sandbox"
    assert res["memory_kb"] is None  # never a made-up number
    assert 0 < res["runtime_ms"] < 15000


def test_stdin_reaches_the_program(mode):
    res = run("python", "print(input()[::-1])", "abc")
    assert res["stdout"] == "cba"


def test_compile_error_is_reported_not_run(mode):
    if mode == "subprocess" and not shutil.which("gcc"):
        pytest.skip("gcc is not installed")
    res = run("c", "int main( { return 0 }")
    assert res["status"] == "Compile Error" and res["compile_output"] and res["stdout"] == ""


def test_runtime_error(mode):
    res = run("python", "raise SystemExit(3)")
    assert res["status"] == "Runtime Error" and res["exit_code"] == 3


# ---- containment ----------------------------------------------------------------------------------

def test_backend_environment_is_not_visible(mode, monkeypatch):
    monkeypatch.setenv("SKILLSENSE_TEST_SECRET", CANARY)
    code = 'import importlib; o = importlib.import_module("o" + "s"); print(sorted(o.environ.items()))'
    res = run("python", code)
    assert CANARY not in res["stdout"] + res["stderr"]
    assert "SKILLSENSE_TEST_SECRET" not in res["stdout"]
    assert settings.JWT_SECRET_KEY not in res["stdout"] + res["stderr"]


def test_relative_dotenv_is_not_in_the_working_directory(mode):
    code = (
        "try:\n    print(open('.env').read())\nexcept Exception as e:\n    print('cannot read:', type(e).__name__)\n"
    )
    res = run("python", code)
    assert "cannot read" in res["stdout"]


def test_infinite_loop_is_killed_at_the_time_limit(mode):
    started = time.monotonic()
    res = run("python", "while True:\n    pass")
    assert res["status"] == "Time Limit Exceeded"
    assert time.monotonic() - started < sandbox.RUN_TIMEOUT_S + 8


def test_spawning_many_processes_is_stopped(mode):
    code = (
        "import importlib\nsp = importlib.import_module('sub' + 'process')\nsys = importlib.import_module('sys')\nn = 0\n"
        "try:\n    for _ in range(200):\n        sp.Popen([sys.executable, '-c', 'import time; time.sleep(60)'])\n        n += 1\n"
        "except Exception as e:\n    print('blocked after', n, type(e).__name__)\nprint('spawned', n)\n"
    )
    res = run("python", code)
    assert "spawned 200" not in res["stdout"], res
    # nothing the program started may outlive it
    time.sleep(0.5)


def test_allocating_a_gigabyte_fails(mode):
    res = run("python", "x = bytearray(1 << 30)\nprint('allocated', len(x))")
    assert "allocated" not in res["stdout"]
    assert res["status"] in ("Runtime Error", "Time Limit Exceeded")


def test_allocating_a_gigabyte_fails_in_c(mode):
    if mode == "subprocess" and not shutil.which("gcc"):
        pytest.skip("gcc is not installed")
    # touch every page and print a checksum so the optimiser can't discard the allocation
    code = ('#include <stdio.h>\n#include <stdlib.h>\n'
            'int main(void){ size_t n = (size_t)1 << 30; volatile char *p = malloc(n); if (!p) { puts("malloc failed"); return 1; }\n'
            'unsigned long sum = 0; for (size_t i = 0; i < n; i += 4096) { p[i] = 1; sum += p[i]; }\n'
            'printf("allocated %lu\\n", sum); return 0; }')
    res = run("c", code)
    assert "allocated" not in res["stdout"]


def test_huge_output_is_truncated(mode):
    res = run("python", "print('x' * 1000000)")
    assert len(res["stdout"]) <= sandbox.MAX_OUTPUT_BYTES + 100
    assert "[output truncated at 64 KB]" in res["stdout"]
    assert res["status"] == "Success"


def test_run_leaves_no_temp_files(mode):
    before = {p for p in _tmp_entries()}
    run("python", "print(1)")
    assert {p for p in _tmp_entries()} <= before


def _tmp_entries():
    import os
    import tempfile

    return [n for n in os.listdir(tempfile.gettempdir()) if n.startswith(("skillsense_sandbox_", "skillsense_src_"))]


def _accept_one(server, hits):
    try:
        hits.append(server.accept())
    except OSError:
        pass  # the test closed the socket and nothing ever connected


# ---- docker-only isolation ---------------------------------------------------------------------------

@pytest.mark.skipif(bool(DOCKER_SKIP), reason=DOCKER_SKIP or "docker unavailable")
class TestDockerIsolation:
    @pytest.fixture(autouse=True)
    def _docker(self, monkeypatch):
        monkeypatch.setattr(settings, "SANDBOX_MODE", "docker")

    def test_host_file_is_unreachable_by_absolute_path(self, tmp_path):
        secret = tmp_path / ".env"
        secret.write_text(f"JWT_SECRET_KEY={CANARY}\n")
        code = f"try:\n    print(open({str(secret)!r}).read())\nexcept Exception as e:\n    print('cannot read:', type(e).__name__)\n"
        res = run("python", code)
        assert CANARY not in res["stdout"] + res["stderr"] and "cannot read" in res["stdout"]

    def test_network_is_disabled(self):
        hits = []
        server = socket.socket()
        server.bind(("0.0.0.0", 0))
        server.listen(5)
        port = server.getsockname()[1]
        threading.Thread(target=_accept_one, args=(server, hits), daemon=True).start()
        code = (
            "import socket\ntry:\n"
            f"    for host in ('host.docker.internal', '172.17.0.1', '127.0.0.1'):\n"
            f"        try:\n            socket.create_connection((host, {port}), timeout=2); print('connected', host)\n        except OSError:\n            pass\n"
            "    socket.create_connection(('1.1.1.1', 53), timeout=2); print('connected internet')\n"
            "except OSError as e:\n    print('no network:', type(e).__name__)\n"
        )
        res = run("python", code)
        time.sleep(0.3)
        server.close()
        assert "connected" not in res["stdout"] and "no network" in res["stdout"]
        assert hits == []

    def test_root_filesystem_is_read_only(self):
        res = run("python", "try:\n    open('/etc/pwned', 'w').write('x'); print('written')\nexcept OSError as e:\n    print('read-only:', type(e).__name__)")
        assert "written" not in res["stdout"] and "read-only" in res["stdout"]

    def test_container_is_gone_after_a_timeout(self):
        run("python", "while True:\n    pass")
        time.sleep(1)
        listing = subprocess.run(["docker", "ps", "-q", "--filter", "name=skillsense-"], capture_output=True, text=True).stdout.strip()
        assert listing == ""


# ---- availability messages -----------------------------------------------------------------------------

def test_missing_compiler_only_affects_that_language(monkeypatch):
    monkeypatch.setattr(settings, "SANDBOX_MODE", "subprocess")
    real = shutil.which
    monkeypatch.setattr(sandbox.shutil, "which", lambda name, *a, **k: None if name == "javac" else real(name, *a, **k))
    java = run("java", HELLO["java"])
    assert java["status"] == "Compiler Not Installed" and "javac" in java["compile_output"]
    assert run("python", HELLO["python"])["status"] == "Success"


def test_docker_mode_without_docker_is_unavailable_not_silently_subprocess(monkeypatch):
    monkeypatch.setattr(settings, "SANDBOX_MODE", "docker")
    monkeypatch.setattr(sandbox.shutil, "which", lambda name, *a, **k: None)
    with pytest.raises(SandboxUnavailable, match="Docker is not installed"):
        run("python", HELLO["python"])


def test_unsupported_language_and_friendly_precheck():
    assert execute_in_sandbox("cobol", "x")["status"] == "Unsupported Language"
    res = execute_in_sandbox("python", "import os\nprint(os.getcwd())")
    assert res["status"] == "Security Violation"  # friendly message only; containment never depends on it


# ---- HTTP API --------------------------------------------------------------------------------------------

RUN_BODY = {"language": "python", "source_code": HELLO["python"]}


async def test_code_endpoints_require_a_logged_in_student(client, student, admin):
    for url, body in (("/api/practice/code/run", RUN_BODY), ("/api/practice/code/submit", {**RUN_BODY, "problem_slug": "sum-two-numbers"})):
        assert (await client.post(url, json=body)).status_code == 401
        assert (await client.post(url, json=body, headers={"Authorization": "Bearer expired.or.bad"})).status_code == 401
        assert (await client.post(url, json=body, headers=bearer(admin["token"]))).status_code == 403
    ok = await client.post("/api/practice/code/run", json=RUN_BODY, headers=bearer(student["token"]))
    assert ok.status_code == 200 and ok.json()["stdout"] == "hello sandbox" and ok.json()["memory_kb"] is None


async def test_source_size_limit(client, student):
    big = "x = 1\n" * 4000  # > 20 KB
    r = await client.post("/api/practice/code/run", json={**RUN_BODY, "source_code": big}, headers=bearer(student["token"]))
    assert r.status_code == 413 and "20 KB" in r.json()["detail"]


async def test_run_and_submit_share_a_per_user_rate_limit(client, student, db, monkeypatch):
    from app.limiter import limiter
    from app.seed import seed_collections

    await seed_collections(db)

    async def instant(language, source, stdin=""):
        return {"status": "Success", "stdout": "ok", "stderr": "", "compile_output": "", "exit_code": 0, "runtime_ms": 1, "memory_kb": None}

    monkeypatch.setattr("app.routers.practice.execute_async", instant)
    other = (await client.post("/api/auth/register", json={"name": "Other Dev", "email": "o2@example.com", "password": "Sup3rSecret1"})).json()
    limiter.enabled = True
    limiter.reset()
    try:
        codes = [(await client.post("/api/practice/code/run", json=RUN_BODY, headers=bearer(student["token"]))).status_code for _ in range(10)]
        assert codes == [200] * 10
        blocked = await client.post("/api/practice/code/run", json=RUN_BODY, headers=bearer(student["token"]))
        assert blocked.status_code == 429 and "Too many requests" in blocked.json()["detail"]
        submit = await client.post("/api/practice/code/submit", json={**RUN_BODY, "problem_slug": "sum-two-numbers"}, headers=bearer(student["token"]))
        assert submit.status_code == 429  # one shared budget for run + submit
        assert (await client.post("/api/practice/code/run", json=RUN_BODY, headers=bearer(other["access_token"]))).status_code == 200  # per user
    finally:
        limiter.enabled = False
        limiter.reset()


async def test_sandbox_unavailable_is_a_503_with_a_clear_message(client, student, monkeypatch):
    monkeypatch.setattr(settings, "SANDBOX_MODE", "docker")
    monkeypatch.setattr(sandbox.shutil, "which", lambda name, *a, **k: None)
    r = await client.post("/api/practice/code/run", json=RUN_BODY, headers=bearer(student["token"]))
    assert r.status_code == 503 and "Docker is not installed" in r.json()["detail"]
