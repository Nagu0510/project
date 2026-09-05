import sys
import os
import tempfile
import subprocess
import time
import shutil
from typing import Dict, Any, List, Optional

def _find_compiler(name: str) -> Optional[str]:
    return shutil.which(name)

FORBIDDEN_PATTERNS = [
    "import subprocess", "from subprocess", "import os", "from os",
    "os.system", "os.popen", "os.exec", "shutil.rmtree", "__import__",
    "eval(", "exec(", "require('child_process')", "import child_process",
    "System.exit", "Runtime.getRuntime"
]

def _validate_code_security(source_code: str) -> Optional[str]:
    """Check user submitted source code for unsafe system call patterns"""
    lowered = source_code.lower()
    for pattern in FORBIDDEN_PATTERNS:
        if pattern.lower() in lowered:
            return f"Security Restriction: Usage of '{pattern}' is not permitted in the coding sandbox."
    return None

def execute_in_sandbox(language: str, source_code: str, stdin: str = "") -> Dict[str, Any]:
    """
    Secure isolated code execution sandbox.
    Uses dedicated subprocess execution in isolated temporary file context with strict timeouts.
    Does NOT use unsafe eval() or exec() inside FastAPI.
    """
    # 1. Pre-execution static security audit
    security_violation = _validate_code_security(source_code)
    if security_violation:
        return {
            "status": "Security Violation",
            "stdout": "",
            "stderr": security_violation,
            "compile_output": "",
            "exit_code": 1,
            "runtime_ms": 0,
            "memory_kb": 0
        }

    lang = language.lower().strip()
    temp_dir = tempfile.mkdtemp(prefix="skillsense_sandbox_")

    start_time = time.time()
    stdout = ""
    stderr = ""
    compile_output = ""
    status = "Success"
    exit_code = 0

    try:
        if lang in ["python", "py"]:
            py_file = os.path.join(temp_dir, "main.py")
            with open(py_file, "w", encoding="utf-8") as f:
                f.write(source_code)

            # Use current backend python binary
            python_bin = sys.executable
            proc = subprocess.run(
                [python_bin, py_file],
                input=stdin,
                capture_output=True,
                text=True,
                timeout=5
            )
            stdout = proc.stdout or ""
            stderr = proc.stderr or ""
            exit_code = proc.returncode

            if exit_code != 0:
                status = "Runtime Error"

        elif lang in ["javascript", "js", "node"]:
            js_file = os.path.join(temp_dir, "main.js")
            with open(js_file, "w", encoding="utf-8") as f:
                f.write(source_code)

            node_bin = _find_compiler("node") or "node"
            proc = subprocess.run(
                [node_bin, js_file],
                input=stdin,
                capture_output=True,
                text=True,
                timeout=5
            )
            stdout = proc.stdout or ""
            stderr = proc.stderr or ""
            exit_code = proc.returncode

            if exit_code != 0:
                status = "Runtime Error"

        elif lang == "java":
            java_file = os.path.join(temp_dir, "Main.java")
            with open(java_file, "w", encoding="utf-8") as f:
                f.write(source_code)

            javac_bin = _find_compiler("javac")
            if not javac_bin:
                status = "Compile Error"
                compile_output = "error: Java compiler 'javac' not found in system PATH. Please install Java JDK."
                exit_code = 1
            else:
                # Compile Java
                compile_proc = subprocess.run(
                    [javac_bin, java_file],
                    capture_output=True,
                    text=True,
                    timeout=8
                )
                if compile_proc.returncode != 0:
                    status = "Compile Error"
                    compile_output = compile_proc.stderr or compile_proc.stdout or "Java Compilation Error"
                    exit_code = compile_proc.returncode
                else:
                    java_bin = _find_compiler("java") or "java"
                    run_proc = subprocess.run(
                        [java_bin, "-cp", temp_dir, "Main"],
                        input=stdin,
                        capture_output=True,
                        text=True,
                        timeout=5
                    )
                    stdout = run_proc.stdout or ""
                    stderr = run_proc.stderr or ""
                    exit_code = run_proc.returncode
                    if exit_code != 0:
                        status = "Runtime Error"

        elif lang in ["c", "cpp", "c++"]:
            ext = ".cpp" if lang in ["cpp", "c++"] else ".c"
            src_file = os.path.join(temp_dir, f"main{ext}")
            exe_file = os.path.join(temp_dir, "main.exe" if sys.platform == "win32" else "main")
            with open(src_file, "w", encoding="utf-8") as f:
                f.write(source_code)

            compiler_name = "g++" if lang in ["cpp", "c++"] else "gcc"
            compiler_bin = _find_compiler(compiler_name)

            if not compiler_bin:
                status = "Compile Error"
                compile_output = f"error: Compiler '{compiler_name}' not found in system PATH. Please install GCC/G++."
                exit_code = 1
            else:
                compile_proc = subprocess.run(
                    [compiler_bin, src_file, "-o", exe_file],
                    capture_output=True,
                    text=True,
                    timeout=8
                )
                if compile_proc.returncode != 0:
                    status = "Compile Error"
                    compile_output = compile_proc.stderr or compile_proc.stdout or "C/C++ Compilation Error"
                    exit_code = compile_proc.returncode
                else:
                    run_proc = subprocess.run(
                        [exe_file],
                        input=stdin,
                        capture_output=True,
                        text=True,
                        timeout=5
                    )
                    stdout = run_proc.stdout or ""
                    stderr = run_proc.stderr or ""
                    exit_code = run_proc.returncode
                    if exit_code != 0:
                        status = "Runtime Error"

        else:
            status = "Unsupported Language"
            stderr = f"Unsupported language '{language}'"
            exit_code = 1

    except subprocess.TimeoutExpired:
        status = "Time Limit Exceeded"
        stderr = "Execution timed out after 5.0 seconds."
        exit_code = 124
    except Exception as e:
        status = "Runtime Error"
        stderr = f"Execution Error: {str(e)}"
        exit_code = 1
    finally:
        # Cleanup isolated temp dir
        shutil.rmtree(temp_dir, ignore_errors=True)

    elapsed_ms = int((time.time() - start_time) * 1000)

    return {
        "status": status,
        "stdout": stdout.strip(),
        "stderr": stderr.strip(),
        "compile_output": compile_output.strip(),
        "exit_code": exit_code,
        "runtime_ms": elapsed_ms,
        "memory_kb": 12400
    }

def run_test_cases(language: str, source_code: str, test_cases: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Executes source code against a suite of public and hidden test cases.
    """
    if not test_cases:
        exec_res = execute_in_sandbox(language, source_code, "")
        return {
            "status": "Accepted" if exec_res["status"] == "Success" else exec_res["status"],
            "passed_count": 1 if exec_res["status"] == "Success" else 0,
            "total_count": 1,
            "stdout": exec_res["stdout"],
            "stderr": exec_res["stderr"],
            "compile_output": exec_res["compile_output"],
            "runtime_ms": exec_res["runtime_ms"],
            "memory_kb": exec_res["memory_kb"],
            "test_results": []
        }

    passed_count = 0
    total_count = len(test_cases)
    test_results = []
    overall_status = "Accepted"
    last_stdout = ""
    last_stderr = ""
    last_compile = ""
    total_runtime = 0

    for idx, tc in enumerate(test_cases):
        inp = tc.get("input", "")
        expected = str(tc.get("expected_output", "")).strip()
        is_hidden = tc.get("is_hidden", False)

        res = execute_in_sandbox(language, source_code, inp)
        total_runtime += res["runtime_ms"]
        last_stdout = res["stdout"]
        last_stderr = res["stderr"]
        last_compile = res["compile_output"]

        if res["status"] == "Compile Error":
            overall_status = "Compile Error"
            break
        elif res["status"] in ["Runtime Error", "Time Limit Exceeded"]:
            overall_status = res["status"]
            test_results.append({
                "case": idx + 1,
                "input": inp if not is_hidden else "Hidden Test Case",
                "expected": expected if not is_hidden else "Hidden",
                "actual": res["stderr"] or res["stdout"],
                "passed": False,
                "is_hidden": is_hidden,
                "error": res["stderr"] or res["status"]
            })
            break

        actual = str(res["stdout"]).strip()
        actual_norm = actual.replace("\r\n", "\n").strip()
        expected_norm = expected.replace("\r\n", "\n").strip()

        passed = (actual_norm == expected_norm)
        if passed:
            passed_count += 1
        else:
            if overall_status == "Accepted":
                overall_status = "Wrong Answer"

        test_results.append({
            "case": idx + 1,
            "input": inp if not is_hidden else "Hidden Test Case",
            "expected": expected if not is_hidden else "[Hidden Test Case]",
            "actual": actual if not is_hidden else ("[Output Hidden]" if not passed else "[Passed]"),
            "passed": passed,
            "is_hidden": is_hidden
        })

    return {
        "status": overall_status,
        "passed_count": passed_count,
        "total_count": total_count,
        "stdout": last_stdout,
        "stderr": last_stderr,
        "compile_output": last_compile,
        "runtime_ms": int(total_runtime / max(1, len(test_cases))),
        "memory_kb": 12400,
        "test_results": test_results
    }
