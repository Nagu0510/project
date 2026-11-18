"""Run the reference solutions through the REAL online compiler and print pass/fail tables.

  cd backend
  .venv\\Scripts\\python.exe scripts\\check_reference_solutions.py                  # every problem x every language (C where offered)
  .venv\\Scripts\\python.exe scripts\\check_reference_solutions.py --slow            # also: a slow brute force per medium / hard problem must end in Time Limit Exceeded
  .venv\\Scripts\\python.exe scripts\\check_reference_solutions.py --sweep           # also: every supported type round-trips in every language
  .venv\\Scripts\\python.exe scripts\\check_reference_solutions.py --starters        # also: every generated starter compiles / runs (the empty function fails cleanly)
  options: --only slug,slug   --langs python,java   (comma separated)

Needs internet (the provider configured by CODE_PROVIDER in backend/.env; the default is the free public Judge0 CE) and is NOT part of
the normal test suite. Never prints the provider URL or any key. Exit code 1 if anything fails. Reference solutions live in
tests/reference_solutions.py: they are never imported by app code and never sent to a browser.
"""
import asyncio
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))

from app.config import settings  # noqa: E402
from app.data.coding_problems import EXPANDED_CODING_PROBLEMS  # noqa: E402
from app.services import function_judge as fj  # noqa: E402
from app.services import judge_drivers as drivers  # noqa: E402
from app.services.sandbox_errors import SandboxRateLimited, SandboxUnavailable  # noqa: E402
from tests.reference_solutions import REFERENCE, SLOW  # noqa: E402

settings.SANDBOX_MODE = "online"  # this script exists to test the provider
LANGS = ("python", "javascript", "java", "cpp", "c")
PAUSE_S = 0.6        # be polite to the free public instance
RETRIES = 4


def arg(name):
    for a in sys.argv:
        if a.startswith(name + "="):
            return a.split("=", 1)[1].split(",")
    if name in sys.argv:
        i = sys.argv.index(name)
        return sys.argv[i + 1].split(",") if i + 1 < len(sys.argv) else None
    return None


ONLY = arg("--only")
ONLY_LANGS = arg("--langs") or list(LANGS)


async def judge(problem, language, code, cases):
    """run_function_cases with retries while the provider is busy. Returns the outcome, or a string naming the provider failure."""
    for attempt in range(RETRIES):
        try:
            out = await fj.run_function_cases(problem, language, code, cases)
            await asyncio.sleep(PAUSE_S)
            return out
        except (SandboxUnavailable, SandboxRateLimited) as exc:
            if attempt == RETRIES - 1:
                return f"provider: {str(exc)[:50]}"
            await asyncio.sleep(2 + 3 * attempt)


def all_cases(problem):
    return [fj.CaseInput(args=c["args"], expected=c["expected"], has_expected=True, shown=not c["hidden"]) for c in problem["test_cases"]]


def cell(out, want="Accepted"):
    if isinstance(out, str):
        return False, out[:18]
    if out.verdict == "Compile Error":
        return False, "CompileErr"
    passed = sum(1 for c in out.cases if c.status == fj.PASSED)
    return out.verdict == want, f"{passed}/{len(out.cases)}" if want == "Accepted" else out.verdict[:12]


async def check_reference() -> bool:
    print(f"\nReference solutions through the online compiler (provider: {settings.CODE_PROVIDER})\n")
    print(f"{'problem':<32}{'level':<8}" + "".join(f"{lang:<13}" for lang in LANGS))
    print("-" * 104)
    all_ok, notes = True, []
    for p in EXPANDED_CODING_PROBLEMS:
        if ONLY and p["slug"] not in ONLY:
            continue
        row = f"{p['slug']:<32}{p['difficulty']:<8}"
        for lang in LANGS:
            if lang not in REFERENCE[p["slug"]]:
                row += f"{'(not offered)':<13}"
                continue
            if lang not in ONLY_LANGS:
                row += f"{'-':<13}"
                continue
            out = await judge(p, lang, REFERENCE[p["slug"]][lang], all_cases(p))
            ok, text = cell(out)
            all_ok &= ok
            row += f"{('ok ' if ok else 'FAIL ') + text:<13}"
            if not ok and not isinstance(out, str):
                detail = out.compile_output[:160] if out.verdict == "Compile Error" else "; ".join(f"case {c.index} {c.status} {c.error or ''}"[:90] for c in out.cases if c.status != fj.PASSED)[:200]
                notes.append(f"  {p['slug']} / {lang}: {out.verdict} {detail}")
        print(row)
    print("-" * 104)
    for n in notes:
        print(n)
    return all_ok


async def check_slow() -> bool:
    print("\nDeliberately slow solutions (Python) must end in Time Limit Exceeded\n")
    print(f"{'problem':<32}{'level':<8}{'verdict':<26}failing case")
    print("-" * 84)
    all_ok = True
    for p in EXPANDED_CODING_PROBLEMS:
        if p["slug"] not in SLOW or (ONLY and p["slug"] not in ONLY):
            continue
        out = await judge(p, "python", SLOW[p["slug"]], all_cases(p))
        if isinstance(out, str):
            all_ok = False
            print(f"{p['slug']:<32}{p['difficulty']:<8}{out}")
            continue
        failing = out.first_failure
        large = {i for i, c in enumerate(p["test_cases"], 1) if c.get("large")}
        ok = out.verdict == "Time Limit Exceeded"
        all_ok &= ok
        print(f"{p['slug']:<32}{p['difficulty']:<8}{('ok ' if ok else 'FAIL ') + out.verdict:<26}case {failing.index if failing else '-'}"
              f"{' (a large case)' if failing and failing.index in large else ''}")
    print("-" * 84)
    return all_ok


async def check_starters() -> bool:
    print("\nGenerated starter code: must compile (Java / C / C++ may report a missing return) and an empty function must fail cleanly\n")
    print(f"{'problem':<32}" + "".join(f"{lang:<14}" for lang in LANGS))
    print("-" * 104)
    all_ok = True
    for p in EXPANDED_CODING_PROBLEMS:
        if ONLY and p["slug"] not in ONLY:
            continue
        row = f"{p['slug']:<32}"
        stubs = fj.starter_code(p)
        for lang in LANGS:
            if lang not in stubs or lang not in ONLY_LANGS:
                row += f"{'-':<14}"
                continue
            out = await judge(p, lang, stubs[lang], all_cases(p)[:2])
            if isinstance(out, str):
                all_ok = False
                row += f"{out[:13]:<14}"
                continue
            # python / javascript: the stub runs and the cases fail ("returned nothing"); java: "missing return statement"; cpp / c: compiles
            good = out.verdict in ("Wrong Answer", "Runtime Error") or (out.verdict == "Compile Error" and "return" in out.compile_output)
            all_ok &= good
            row += f"{('ok ' if good else 'FAIL ') + out.verdict[:9]:<14}"
        print(row)
    print("-" * 104)
    return all_ok


SWEEP_VALUES = None


async def check_sweep() -> bool:
    from tests.test_judge_drivers import C_IDENTITY, IDENTITY, VALUES

    print("\nType sweep: every supported type is echoed back by every language driver\n")
    print(f"{'type':<12}" + "".join(f"{lang:<13}" for lang in ONLY_LANGS))
    print("-" * 80)
    all_ok = True
    for t in drivers.SUPPORTED_TYPES:
        row = f"{t:<12}"
        for lang in ONLY_LANGS:
            if lang == "c" and t not in drivers.C_TYPES:
                row += f"{'(not offered)':<13}"
                continue
            problem = {"function_name": "echo", "params": [{"name": "x", "type": t}], "return_type": t, "time_limit_ms": 2000}
            code = C_IDENTITY[t] if lang == "c" else IDENTITY[lang](t)
            cases = [fj.CaseInput(args=[v], expected=v, has_expected=True) for v in VALUES[t]]
            out = await judge(problem, lang, code, cases)
            ok, text = cell(out)
            all_ok &= ok
            row += f"{('ok ' if ok else 'FAIL ') + text:<13}"
        print(row)
    print("-" * 80)
    return all_ok


async def main() -> int:
    ok = await check_reference()
    if "--slow" in sys.argv:
        ok = await check_slow() and ok
    if "--starters" in sys.argv:
        ok = await check_starters() and ok
    if "--sweep" in sys.argv:
        ok = await check_sweep() and ok
    print("\nALL PASS" if ok else "\nSOME FAILED")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
