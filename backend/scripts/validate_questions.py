"""Validate the question bank, assessment sets and courses. Fails loudly (exit code 1 and a list of every problem).

    cd backend
    .venv\\Scripts\\python.exe scripts\\validate_questions.py             # structure + run Python/JavaScript Code Output snippets locally
    .venv\\Scripts\\python.exe scripts\\validate_questions.py --online    # also compile and run C, C++ and Java snippets on the online compiler

Checks: unique ids, exactly 4 distinct options, a valid answer index, no duplicate question (text + code), known skill, topic and type,
sets that point at real questions, courses that use canonical skill names. Python snippets run with `python -c` and JavaScript
snippets with `node -e` (5 second timeout, a reviewed trusted snippet: no network). Reviewed C / C++ / Java Code Output questions
are confirmed by --online.
"""
import asyncio
import re
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.data.assessment_bank import ASSESSMENT_QUESTION_BANK, ASSESSMENT_SETS, COMPANIES, SKILL_TOPICS  # noqa: E402
from app.data.assessment_extras import QUESTION_TYPES  # noqa: E402
from app.data.courses import COURSES  # noqa: E402
from app.services.content_validation import course_problems, duplicate_key, question_problems  # noqa: E402

FORBIDDEN = ("import socket", "urllib", "requests", "subprocess", "os.system", "http", "require('net')", "require('child_process')", "fetch(")
errors: list = []
notes: list = []


def fail(where: str, message: str) -> None:
    errors.append(f"{where}: {message}")


def norm_output(text: str) -> str:
    return "\n".join(line.rstrip() for line in text.replace("\r\n", "\n").strip().split("\n"))


# ---------------------------------------------------------------------------
def check_questions() -> None:
    """The structural rules are shared with the admin content editor (app/services/content_validation.py)."""
    seen_ids, seen_text = set(), {}
    for q in ASSESSMENT_QUESTION_BANK:
        qid = q.get("id", "<no id>")
        if qid in seen_ids:
            fail(qid, "duplicate id")
        seen_ids.add(qid)
        for problem in question_problems(q):
            fail(qid, problem)
        key = duplicate_key(q)
        if key in seen_text:
            fail(qid, f"duplicate question text (same as {seen_text[key]})")
        seen_text[key] = qid


def check_sets() -> None:
    ids = {q["id"] for q in ASSESSMENT_QUESTION_BANK}
    seen = set()
    for s in ASSESSMENT_SETS:
        sid = s["id"]
        if sid in seen:
            fail(sid, "duplicate set id")
        seen.add(sid)
        qids = s["question_ids"]
        if len(set(qids)) != len(qids):
            fail(sid, "lists the same question twice")
        missing = [i for i in qids if i not in ids]
        if missing:
            fail(sid, f"unknown question ids {missing}")
        if s["questions_count"] != len(qids):
            fail(sid, f"questions_count {s['questions_count']} != {len(qids)} questions")
        if sid.startswith("asm-co-") and len(qids) < 20:
            fail(sid, "company sets need 20 questions")
        if s.get("course_slug") and len(qids) < 8:
            fail(sid, "course sets need at least 8 questions")
        if s.get("course_slug") and s["course_slug"] not in {c["slug"] for c in COURSES}:
            fail(sid, f"unknown course {s['course_slug']}")


def check_courses() -> None:
    slugs = {c["slug"] for c in COURSES}
    for c in COURSES:
        for problem in course_problems(c, slugs):
            fail(c["slug"], problem)


# ---------------------------------------------------------------------------
def snippet_for(q: dict):
    """(language, code) for a Code Output question, from `code` or from the first inline `...` snippet."""
    if q.get("code"):
        return q["language"], q["code"]
    if q["skill"] in ("Python", "JavaScript"):
        inline = [s for s in re.findall(r"`([^`]+)`", q["question_text"]) if "print(" in s or "console.log" in s]
        if inline:
            return ("python" if q["skill"] == "Python" else "javascript"), inline[0]
    return None, None


def run_local(language: str, code: str) -> str:
    cmd = [sys.executable, "-c", code] if language == "python" else ["node", "-e", code]
    done = subprocess.run(cmd, capture_output=True, text=True, timeout=5)
    if done.returncode != 0:
        raise RuntimeError(done.stderr.strip().splitlines()[-1] if done.stderr.strip() else "non-zero exit")
    return done.stdout


def check_outputs(online: bool) -> None:
    local = checked = 0
    remote_jobs = []
    for q in ASSESSMENT_QUESTION_BANK:
        if q.get("question_type") != "Code Output":
            continue
        idx = q.get("correct_option_index")
        if not isinstance(q.get("options"), list) or not isinstance(idx, int) or not 0 <= idx < len(q["options"]):
            continue  # already reported by check_questions
        language, code = snippet_for(q)
        expected = q["options"][idx]
        if language in ("python", "javascript"):
            if any(bad in code for bad in FORBIDDEN):
                fail(q["id"], "snippet uses something that is not allowed in a local check")
                continue
            try:
                actual = run_local(language, code)
            except Exception as exc:  # timeout, missing node, runtime error
                fail(q["id"], f"snippet could not be run: {exc}")
                continue
            local += 1
            if norm_output(actual) != norm_output(expected):
                fail(q["id"], f"stated answer {expected!r} but the snippet prints {norm_output(actual)!r}")
        elif language in ("c", "cpp", "java"):
            remote_jobs.append((q, language, code, expected))
        else:
            notes.append(f"{q['id']}: inline snippet cannot be run automatically (reviewed by hand)")
    if online and remote_jobs:
        checked = asyncio.run(check_online(remote_jobs))
    print(f"Code Output snippets: {local} run locally, {checked} run online, {len(remote_jobs) - checked} C/C++/Java reviewed by hand")


async def check_online(jobs) -> int:
    from app.services import online_compiler
    from app.services.sandbox_errors import SandboxRateLimited, SandboxUnavailable

    done = 0
    for q, language, code, expected in jobs:
        for attempt in range(4):
            try:
                res = await online_compiler.run_online(language, code, "")
                break
            except (SandboxUnavailable, SandboxRateLimited):
                await asyncio.sleep(2 + 3 * attempt)
        else:
            fail(q["id"], "online compiler unavailable")
            continue
        await asyncio.sleep(0.4)
        done += 1
        if res["status"] != "Success":
            fail(q["id"], f"{language} snippet ended with {res['status']}: {(res['compile_output'] or res['stderr'])[:120]}")
        elif norm_output(res["stdout"]) != norm_output(expected):
            fail(q["id"], f"stated answer {expected!r} but the program prints {norm_output(res['stdout'])!r}")
    return done


def main() -> int:
    check_questions()
    check_sets()
    check_courses()
    check_outputs("--online" in sys.argv)

    from collections import Counter

    per_skill = Counter(q["skill"] for q in ASSESSMENT_QUESTION_BANK)
    print(f"{len(ASSESSMENT_QUESTION_BANK)} questions, {len(ASSESSMENT_SETS)} sets, {len(COURSES)} courses")
    print("Questions per skill:", ", ".join(f"{k}: {v}" for k, v in sorted(per_skill.items())))
    for n in notes:
        print("note:", n)
    if errors:
        print(f"\nVALIDATION FAILED: {len(errors)} problem(s)")
        for e in errors:
            print("  -", e)
        return 1
    print("\nVALIDATION PASSED")
    return 0


if __name__ == "__main__":
    sys.exit(main())
