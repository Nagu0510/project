"""Coding practice judge: problem data, verdicts, hidden-case behaviour and comparison. The provider is always mocked."""
import base64
import subprocess
import sys
from pathlib import Path

import httpx
import pytest

from app.config import settings
from app.data.coding_problems import EXPANDED_CODING_PROBLEMS, RETIRED_PROBLEM_SLUGS
from app.seed import seed_collections
from app.services.code_execution_service import _normalise, run_tests_async
from tests.conftest import bearer
from tests.test_online_compiler import FakeProvider, judge0

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from reference_solutions import REFERENCE_SOLUTIONS  # noqa: E402

LANGS = ("python", "javascript", "java", "c", "cpp")
BY_SLUG = {p["slug"]: p for p in EXPANDED_CODING_PROBLEMS}


# --------------------------------------------------------------------------- the data itself
def test_twelve_problems_with_the_requested_mix():
    counts = {d: sum(1 for p in EXPANDED_CODING_PROBLEMS if p["difficulty"] == d) for d in ("Easy", "Medium", "Hard")}
    assert counts == {"Easy": 4, "Medium": 5, "Hard": 3}
    assert len(BY_SLUG) == 12 and len({p["id"] for p in EXPANDED_CODING_PROBLEMS}) == 12
    assert not set(BY_SLUG) & set(RETIRED_PROBLEM_SLUGS)


@pytest.mark.parametrize("slug", sorted(BY_SLUG))
def test_problem_is_complete(slug):
    p = BY_SLUG[slug]
    cases = p["test_cases"]
    assert 4 <= len(cases) <= 5
    assert sum(1 for c in cases if not c["is_hidden"]) == 2 and any(c["is_hidden"] for c in cases)
    assert p["input_format"] and p["output_format"] and p["constraints"] and p["tags"] and p["description"]
    assert set(p["starter_code"]) == set(LANGS)
    assert "public class Main" in p["starter_code"]["java"]
    for lang, code in p["starter_code"].items():
        assert code.strip(), lang
        assert "print(" not in code and "System.out" not in code and "printf(" not in code.replace("scanf(", "") and "cout <<" not in code and "console.log" not in code, f"{lang} starter must not print anything"
    assert len(p["examples"]) == 2
    assert all(len(c["input"]) < 400 for c in cases)  # small inputs: every run is fast


@pytest.mark.parametrize("slug", sorted(BY_SLUG))
def test_reference_solution_passes_every_case(slug):
    """Proves the expected outputs are right, using a plain local python (no provider)."""
    for i, tc in enumerate(BY_SLUG[slug]["test_cases"], 1):
        out = subprocess.run([sys.executable, "-c", REFERENCE_SOLUTIONS[slug]], input=tc["input"], capture_output=True, text=True, timeout=30)
        assert out.returncode == 0, out.stderr
        assert _normalise(out.stdout) == _normalise(tc["expected_output"]), f"case {i}"


def test_python_starter_runs_and_prints_nothing():
    for slug, p in BY_SLUG.items():
        out = subprocess.run([sys.executable, "-c", p["starter_code"]["python"]], input=p["test_cases"][0]["input"], capture_output=True, text=True, timeout=30)
        assert out.returncode == 0 and out.stdout == "", slug


def test_comparison_ignores_trailing_whitespace_only():
    assert _normalise("1 2 3  \n\n") == _normalise("1 2 3")
    assert _normalise("a  \r\nb\r\n") == _normalise("a\nb")
    assert _normalise("1 2 3") != _normalise("1  2 3")  # inner spacing still matters
    assert _normalise("YES") != _normalise("yes")


# --------------------------------------------------------------------------- the judge, provider mocked
@pytest.fixture
def judge(monkeypatch):
    """Install a fake provider that answers each call with respond(call_number, stdin, source)."""
    from app.services import online_compiler

    monkeypatch.setattr(settings, "SANDBOX_MODE", "online")
    monkeypatch.setattr(settings, "CODE_PROVIDER", "judge0_ce")
    monkeypatch.setattr(settings, "CODE_API_URL", None)
    monkeypatch.setattr(settings, "CODE_API_KEY", None)

    def install(respond):
        calls = {"n": 0}

        def wrapped(lid, src, stdin):
            calls["n"] += 1
            return respond(calls["n"], stdin, src)

        fake = FakeProvider(wrapped)
        monkeypatch.setattr(online_compiler, "make_client", lambda timeout: httpx.AsyncClient(transport=httpx.MockTransport(fake), timeout=timeout))
        fake.calls = calls
        return fake

    return install


def right_answer(slug):
    """A provider that answers every case of `slug` correctly (it looks the answer up by stdin)."""
    answers = {c["input"]: c["expected_output"] for c in BY_SLUG[slug]["test_cases"]}
    return lambda n, stdin, src: judge0(stdout=answers[stdin] + "\n")


async def submit(client, student, slug="sum-two-numbers", language="python", code="x"):
    return await client.post("/api/practice/code/submit", json={"language": language, "source_code": code, "problem_slug": slug}, headers=bearer(student["token"]))


@pytest.fixture
async def seeded(db):
    await seed_collections(db)
    return db


async def test_accepted_runs_every_case_and_saves_the_attempt(client, student, seeded, judge):
    fake = judge(right_answer("sum-two-numbers"))
    r = await submit(client, student)
    body = r.json()
    assert r.status_code == 200 and body["status"] == "Accepted"
    assert body["passed_count"] == body["total_count"] == 5 and body["failed_case"] is None
    assert fake.calls["n"] == 5
    saved = await seeded["practice_attempts"].find_one({"user_id": student["user"]["id"], "problem_slug": "sum-two-numbers"})
    assert saved["verdict"] == "Accepted" and saved["is_correct"] is True and saved["language"] == "python" and saved["runtime_ms"] is not None


async def test_runtime_ms_comes_from_the_provider(client, student, seeded, judge):
    answers = {c["input"]: c["expected_output"] for c in BY_SLUG["sum-two-numbers"]["test_cases"]}
    judge(lambda n, stdin, src: judge0(stdout=answers[stdin] + "\n", time="0.250"))
    assert (await submit(client, student)).json()["runtime_ms"] == 250


async def test_wrong_answer_on_a_shown_case_reveals_input_and_expected(client, student, seeded, judge):
    judge(lambda n, stdin, src: judge0(stdout="999\n"))
    body = (await submit(client, student)).json()
    assert body["status"] == "Wrong Answer" and body["failed_case"] == 1 and body["passed_count"] == 0
    failing = body["test_results"][-1]
    assert failing["passed"] is False and failing["is_hidden"] is False
    assert failing["input"] == "3 4" and failing["expected"] == "7" and failing["actual"] == "999"
    assert len(body["test_results"]) == 1  # stopped at the first failure


async def test_wrong_answer_on_a_hidden_case_hides_input_and_expected(client, student, seeded, judge):
    answers = {c["input"]: c["expected_output"] for c in BY_SLUG["sum-two-numbers"]["test_cases"]}
    hidden_inputs = {c["input"] for c in BY_SLUG["sum-two-numbers"]["test_cases"] if c["is_hidden"]}
    judge(lambda n, stdin, src: judge0(stdout=("0\n" if stdin == "100000 250000" else answers[stdin] + "\n")))
    r = await submit(client, student)
    body = r.json()
    assert "100000 250000" in hidden_inputs and body["status"] == "Wrong Answer"
    assert body["failed_case"] == 4 and body["passed_count"] == 3
    failing = body["test_results"][-1]
    assert failing["is_hidden"] is True and "100000" not in str(failing) and "350000" not in str(failing)
    assert "350000" not in r.text and "100000 250000" not in r.text  # nothing about a hidden case in the response


async def test_comparison_trims_trailing_whitespace(client, student, seeded, judge):
    answers = {c["input"]: c["expected_output"] for c in BY_SLUG["sum-two-numbers"]["test_cases"]}
    judge(lambda n, stdin, src: judge0(stdout=answers[stdin] + "   \n\n"))
    assert (await submit(client, student)).json()["status"] == "Accepted"


async def test_runtime_error_verdict(client, student, seeded, judge):
    judge(lambda n, stdin, src: judge0(status=11, stderr="Traceback: ZeroDivisionError", exit_code=1))
    body = (await submit(client, student)).json()
    assert body["status"] == "Runtime Error" and body["failed_case"] == 1
    assert (await seeded["practice_attempts"].find_one({"verdict": "Runtime Error"})) is not None


async def test_time_limit_exceeded_verdict(client, student, seeded, judge):
    judge(lambda n, stdin, src: judge0(status=5, time="5.0"))
    body = (await submit(client, student)).json()
    assert body["status"] == "Time Limit Exceeded" and body["failed_case"] == 1


async def test_compile_error_verdict_shows_the_compiler_output(client, student, seeded, judge):
    fake = judge(lambda n, stdin, src: judge0(status=6, compile_output="Main.java:3: error: ';' expected"))
    body = (await submit(client, student, language="java")).json()
    assert body["status"] == "Compile Error" and "expected" in body["compile_output"]
    assert fake.calls["n"] == 1  # no point compiling again for every case
    assert (await seeded["practice_attempts"].find_one({"verdict": "Compile Error"})) is not None


async def test_judge_unavailable_is_never_wrong_answer_and_is_not_recorded(client, student, seeded, judge):
    judge(lambda n, stdin, src: judge0(stdout="7\n") if n == 1 else httpx.Response(503))
    r = await submit(client, student)
    body = r.json()
    assert r.status_code == 200 and body["status"] == "Judge unavailable"
    assert "busy" in body["message"].lower() and body["failed_case"] is None
    assert await seeded["practice_attempts"].count_documents({}) == 0


async def test_judge_unavailable_when_rate_limited(client, student, seeded, judge):
    judge(lambda n, stdin, src: httpx.Response(429))
    body = (await submit(client, student)).json()
    assert body["status"] == "Judge unavailable" and "busy" in body["message"].lower()


async def test_stops_after_five_cases(client, student, seeded, judge):
    """A problem with more than five cases is judged on the first five only."""
    await seeded["practice_problems"].update_one({"slug": "sum-two-numbers"}, {"$push": {"test_cases": {"input": "1 1", "expected_output": "2", "is_hidden": True}}})
    fake = judge(lambda n, stdin, src: judge0(stdout={"3 4": "7", "10\n20": "30", "-5 5": "0", "100000 250000": "350000", "2000000000 2000000000": "4000000000"}[stdin] + "\n"))
    body = (await submit(client, student)).json()
    assert body["status"] == "Accepted" and body["total_count"] == 5 and fake.calls["n"] == 5


# --------------------------------------------------------------------------- API surface
async def test_problems_api_serves_the_seeded_twelve_and_hides_hidden_cases(client, seeded):
    r = await client.get("/api/practice/problems")
    problems = r.json()
    assert r.status_code == 200 and len(problems) == 12
    assert {p["slug"] for p in problems} == set(BY_SLUG)
    for p in problems:
        assert set(p["starter_code"]) == set(LANGS)
        assert p["hidden_test_cases"] == [] and all(not c["is_hidden"] for c in p["test_cases"]) and len(p["test_cases"]) == 2
    single = (await client.get("/api/practice/problems/subset-sum-count")).json()
    assert single["slug"] == "subset-sum-count" and single["input_format"] and single["constraints"]
    assert all(c["is_hidden"] is False for c in single["test_cases"])


async def test_filters(client, seeded):
    easy = (await client.get("/api/practice/problems", params={"difficulty": "Easy"})).json()
    assert len(easy) == 4 and {p["difficulty"] for p in easy} == {"Easy"}
    dp = (await client.get("/api/practice/problems", params={"topic": "DP"})).json()
    assert {p["slug"] for p in dp} == {"staircase-ways", "longest-increasing-subsequence", "fewest-coins", "subset-sum-count"}


async def test_unknown_slug_is_404(client, seeded, student):
    assert (await client.get("/api/practice/problems/does-not-exist")).status_code == 404
    assert (await submit(client, student, slug="does-not-exist")).status_code == 404


async def test_empty_database_returns_an_empty_list_not_a_fallback(client, db):
    assert (await client.get("/api/practice/problems")).json() == []


async def test_solved_endpoint_lists_only_accepted_problems(client, student, seeded, judge):
    h = bearer(student["token"])
    assert (await client.get("/api/practice/solved", headers=h)).json() == {"solved": []}
    judge(lambda n, stdin, src: judge0(stdout="nope\n"))
    await submit(client, student)
    assert (await client.get("/api/practice/solved", headers=h)).json() == {"solved": []}  # Wrong Answer is not solved
    judge(right_answer("sum-two-numbers"))
    await submit(client, student)
    assert (await client.get("/api/practice/solved", headers=h)).json() == {"solved": ["sum-two-numbers"]}
    assert (await client.get("/api/practice/solved")).status_code == 401


async def test_seed_is_idempotent_removes_retired_problems_and_keeps_admin_edits(db):
    for slug in ("two-sum", "lru-cache"):
        await db["practice_problems"].insert_one({"id": slug, "slug": slug, "title": "old", "difficulty": "Easy", "category": "x", "topic": "x", "description": "old"})
    await db["practice_problems"].insert_one({"id": "valid-palindrome", "slug": "valid-palindrome", "title": "mine", "edited_by_admin": True})
    first = await seed_collections(db)
    assert first["practice_problems"]["inserted"] == 12 and first["practice_problems"]["removed"] == 2
    assert await db["practice_problems"].find_one({"slug": "valid-palindrome"})  # admin-edited: untouched
    assert not await db["practice_problems"].find_one({"slug": "two-sum"})
    second = await seed_collections(db)
    assert second["practice_problems"]["inserted"] == 0 and second["practice_problems"]["removed"] == 0
    await db["practice_problems"].update_one({"slug": "count-vowels"}, {"$set": {"title": "Edited", "edited_by_admin": True}})
    await seed_collections(db)
    assert (await db["practice_problems"].find_one({"slug": "count-vowels"}))["title"] == "Edited"
    assert await db["practice_problems"].count_documents({}) == 13  # 12 + the admin-edited legacy one
