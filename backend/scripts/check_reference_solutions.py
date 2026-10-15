"""Run ONE correct Python solution per coding problem through the REAL online compiler and print a pass/fail table.

  cd backend
  .venv\\Scripts\\python.exe scripts\\check_reference_solutions.py             # reference solutions, every test case
  .venv\\Scripts\\python.exe scripts\\check_reference_solutions.py --starters  # also: every starter compiles/runs in all 5 languages

Needs internet (calls the provider configured by CODE_PROVIDER in backend/.env) and is NOT part of the normal test suite.
Never prints the provider URL or any key. Exit code 1 if anything fails.
"""
import asyncio
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
sys.path.insert(0, str(HERE))

from app.config import settings  # noqa: E402
from app.data.coding_problems import EXPANDED_CODING_PROBLEMS  # noqa: E402
from app.services import online_compiler  # noqa: E402
from app.services.code_execution_service import _normalise  # noqa: E402
from app.services.sandbox_errors import SandboxRateLimited, SandboxUnavailable  # noqa: E402
from reference_solutions import REFERENCE_SOLUTIONS  # noqa: E402

PAUSE_S = 0.5      # be polite to the free public instance
RETRIES = 4


async def run(language: str, source: str, stdin: str) -> dict:
    """One provider call, retried a few times when the provider is busy."""
    for attempt in range(RETRIES):
        try:
            return await online_compiler.run_online(language, source, stdin)
        except (SandboxUnavailable, SandboxRateLimited) as exc:
            if attempt == RETRIES - 1:
                return {"status": "Judge unavailable", "stdout": "", "stderr": str(exc), "compile_output": "", "runtime_ms": 0}
            await asyncio.sleep(2 + 3 * attempt)
    raise AssertionError("unreachable")


async def check_reference() -> bool:
    print(f"\nReference solutions through the online compiler (provider: {settings.CODE_PROVIDER})\n")
    print(f"{'problem':<34}{'level':<10}{'cases':<8}result")
    print("-" * 70)
    all_ok = True
    for p in EXPANDED_CODING_PROBLEMS:
        passed, note = 0, ""
        for i, tc in enumerate(p["test_cases"], 1):
            res = await run("python", REFERENCE_SOLUTIONS[p["slug"]], tc["input"])
            await asyncio.sleep(PAUSE_S)
            if res["status"] == "Success" and _normalise(res["stdout"]) == _normalise(tc["expected_output"]):
                passed += 1
            else:
                got = (res["stdout"] or res["stderr"] or res["compile_output"] or res["status"]).replace("\n", "\\n")[:60]
                note = f"case {i}: {res['status']}, expected {tc['expected_output']!r}, got {got!r}"
                break
        ok = passed == len(p["test_cases"])
        all_ok &= ok
        print(f"{p['slug']:<34}{p['difficulty']:<10}{passed}/{len(p['test_cases']):<6}{'PASS' if ok else 'FAIL  ' + note}")
    print("-" * 70)
    return all_ok


async def check_starters() -> bool:
    print("\nStarter code: must compile and run on a sample input without printing anything\n")
    langs = ("python", "javascript", "java", "c", "cpp")
    print(f"{'problem':<34}" + "".join(f"{lang:<12}" for lang in langs))
    print("-" * 94)
    all_ok = True
    for p in EXPANDED_CODING_PROBLEMS:
        row = f"{p['slug']:<34}"
        for lang in langs:
            res = await run(lang, p["starter_code"][lang], p["test_cases"][0]["input"])
            await asyncio.sleep(PAUSE_S)
            ok = res["status"] == "Success" and res["stdout"] == ""
            all_ok &= ok
            row += f"{'ok' if ok else res['status'][:10]:<12}"
        print(row)
    print("-" * 94)
    return all_ok


async def main() -> int:
    ok = await check_reference()
    if "--starters" in sys.argv:
        ok = await check_starters() and ok
    print("\nALL PASS" if ok else "\nSOME FAILED")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
