"""Live check of the online compiler provider:  python scripts/check_online_compiler.py   (run from backend/)

Runs hello world and a stdin-reading program in all five languages, a compile error, an infinite loop and
one correct plus one wrong DSA submission through the real provider, and prints PASS/FAIL per check.
Calls the internet (about 20 requests). Never prints the provider URL, keys or any environment value.
"""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.config import settings  # noqa: E402
from app.data.coding_problems import EXPANDED_CODING_PROBLEMS  # noqa: E402
from app.services.code_execution_service import execute_async, run_tests_async  # noqa: E402
from app.services.sandbox_errors import SandboxRateLimited, SandboxUnavailable  # noqa: E402

HELLO = {
    "python": 'print("hello")',
    "javascript": 'console.log("hello");',
    "java": 'public class Main { public static void main(String[] a) { System.out.println("hello"); } }',
    "c": '#include <stdio.h>\nint main(void){ printf("hello\\n"); return 0; }',
    "cpp": '#include <iostream>\nint main(){ std::cout << "hello" << std::endl; return 0; }',
}
SUM = {
    "python": "import sys\na, b = map(int, sys.stdin.read().split())\nprint(a + b)",
    "javascript": "const [a, b] = require('fs').readFileSync(0, 'utf8').trim().split(/\\s+/).map(Number);\nconsole.log(a + b);",
    "java": "import java.util.Scanner;\npublic class Main { public static void main(String[] x) { Scanner s = new Scanner(System.in); long a = s.nextLong(), b = s.nextLong(); System.out.println(a + b); } }",
    "c": '#include <stdio.h>\nint main(void){ long long a, b; scanf("%lld %lld", &a, &b); printf("%lld\\n", a + b); return 0; }',
    "cpp": "#include <iostream>\nint main(){ long long a, b; std::cin >> a >> b; std::cout << a + b << std::endl; return 0; }",
}
BROKEN = {
    "c": "int main( { return 0 }",
    "cpp": "int main( { return 0 }",
    "java": "public class Main { public static void main(String[] a) { int x = ; } }",
}

rows = []


async def check(name, coro_fn):
    try:
        ok, detail = await coro_fn()
    except SandboxRateLimited as exc:
        ok, detail = False, f"provider rate limited: {exc}"
    except SandboxUnavailable as exc:
        ok, detail = False, f"provider unavailable: {exc}"
    rows.append((name, ok, detail))
    print(f"{'PASS' if ok else 'FAIL'}  {name}  {'' if ok else '-> ' + detail}", flush=True)
    await asyncio.sleep(1.0)  # be polite to a free public instance


async def main() -> int:
    print(f"mode={settings.SANDBOX_MODE} provider={settings.CODE_PROVIDER}")
    if settings.SANDBOX_MODE != "online":
        print("SANDBOX_MODE is not 'online'; nothing to check.")
        return 2

    for lang in HELLO:
        async def hello(lang=lang):
            r = await execute_async(lang, HELLO[lang])
            return r["status"] == "Success" and r["stdout"] == "hello", f"{r['status']} stdout={r['stdout']!r} stderr={r['stderr'][:80]!r}"
        await check(f"{lang:<10} hello world", hello)

        async def stdin(lang=lang):
            r = await execute_async(lang, SUM[lang], "3 4")
            return r["status"] == "Success" and r["stdout"] == "7", f"{r['status']} stdout={r['stdout']!r} stderr={r['stderr'][:80]!r}"
        await check(f"{lang:<10} reads stdin (3 4 -> 7)", stdin)

    for lang, code in BROKEN.items():
        async def broken(lang=lang, code=code):
            r = await execute_async(lang, code)
            return r["status"] == "Compile Error" and bool(r["compile_output"]), f"{r['status']} compile_output={r['compile_output'][:60]!r}"
        await check(f"{lang:<10} compile error", broken)

    async def loop():
        r = await execute_async("python", "while True:\n    pass")
        return r["status"] == "Time Limit Exceeded", f"{r['status']}"
    await check("python     infinite loop -> time limit", loop)

    async def runtime():
        r = await execute_async("python", "raise SystemExit(3)")
        return r["status"] == "Runtime Error" and r["exit_code"] == 3, f"{r['status']} exit={r['exit_code']}"
    await check("python     runtime error + exit status", runtime)

    cases = next(p for p in EXPANDED_CODING_PROBLEMS if p["slug"] == "sum-two-numbers")["test_cases"]

    async def correct():
        r = await run_tests_async("python", SUM["python"], cases)
        return r["status"] == "Accepted" and r["passed_count"] == len(cases), f"{r['status']} {r['passed_count']}/{r['total_count']}"
    await check("DSA submit (correct)  -> Accepted", correct)

    async def wrong():
        r = await run_tests_async("python", "import sys\na, b = map(int, sys.stdin.read().split())\nprint(a - b)", cases)
        return r["status"] == "Wrong Answer" and r["failed_case"] == 1, f"{r['status']} failed_case={r['failed_case']}"
    await check("DSA submit (wrong)    -> Wrong Answer, test 1", wrong)

    failed = [r for r in rows if not r[1]]
    print(f"\n{len(rows) - len(failed)}/{len(rows)} checks passed")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
