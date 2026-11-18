"""Function-style coding judge: problem data, generated starters, the driver protocol, verdicts, hidden-case secrecy, history and hints.

Most tests really run student code through the local subprocess sandbox (Python, Node; Java/C/C++ when a compiler is installed and the
OS lets it start). Provider failures, time limits and crashes are simulated by replacing `execute_program` with a fake that speaks the
driver protocol. Nothing here touches the internet; the real-provider proof is scripts/check_reference_solutions.py.
"""
import copy
import json
import re

import pytest

from app.data.coding_problems import EXPANDED_CODING_PROBLEMS, LEGACY_PROBLEM_FIELDS, RETIRED_PROBLEM_SLUGS
from app.seed import seed_collections
from app.services import code_execution_service as ces
from app.services import function_judge as fj
from app.services import judge_drivers as drivers
from app.services.sandbox_errors import SandboxRateLimited, SandboxUnavailable
from tests.conftest import bearer
from tests.reference_solutions import REFERENCE, SLOW

BY_SLUG = {p["slug"]: p for p in EXPANDED_CODING_PROBLEMS}
LANGS = ("python", "javascript", "java", "cpp", "c")
SUM = BY_SLUG["sum-two-numbers"]

GOOD_SUM = "class Solution:\n    def add_numbers(self, a: int, b: int) -> int:\n        return a + b\n"


# --------------------------------------------------------------------------- the data itself
def test_twelve_problems_in_difficulty_order():
    counts = {d: sum(1 for p in EXPANDED_CODING_PROBLEMS if p["difficulty"] == d) for d in ("Easy", "Medium", "Hard")}
    assert counts == {"Easy": 4, "Medium": 5, "Hard": 3}
    assert [p["difficulty_rank"] for p in EXPANDED_CODING_PROBLEMS] == list(range(1, 13))
    assert len(BY_SLUG) == 12 and not set(BY_SLUG) & set(RETIRED_PROBLEM_SLUGS)
    ranks = {"Easy": 0, "Medium": 1, "Hard": 2}
    assert [ranks[p["difficulty"]] for p in EXPANDED_CODING_PROBLEMS] == sorted(ranks[p["difficulty"]] for p in EXPANDED_CODING_PROBLEMS)


@pytest.mark.parametrize("slug", sorted(BY_SLUG))
def test_problem_data_is_valid(slug):
    p = BY_SLUG[slug]
    assert fj.validate_problem(p) == []
    hidden = [c for c in p["test_cases"] if c["hidden"]]
    assert len(hidden) >= 8 and 2 <= len(p["examples"]) <= 3 and len(p["hints"]) == 3
    if p["difficulty"] != "Easy":
        assert any(c.get("large") for c in hidden)
    for c in p["test_cases"]:  # a provider request carries every case in one body: keep each one a sane size
        assert len(json.dumps(c["args"])) < 300_000
        assert len(fj.compact_json(c["expected"])) < 60_000  # the free provider cuts stdout at 64 KB
    assert p["description"] and p["constraints"] and p["tags"] and p["expected_complexity"]


def test_validation_catches_bad_data():
    bad = copy.deepcopy(SUM)
    bad["test_cases"][3]["args"] = [1.5, 2]                         # not a long
    bad["test_cases"] = [c for c in bad["test_cases"] if not c["hidden"]][:2] + [c for c in bad["test_cases"] if c["hidden"]][:3]
    bad["params"][0]["type"] = "matrix"
    issues = " ".join(fj.validate_problem(bad))
    assert "unsupported parameter type" in issues and "at least 8 hidden" in issues


def python_reference(slug):
    ns: dict = {}
    exec(REFERENCE[slug]["python"], ns)  # noqa: S102 - our own test fixtures
    return getattr(ns["Solution"](), fj.signature_of(BY_SLUG[slug]).snake_name)


@pytest.mark.parametrize("slug", sorted(BY_SLUG))
def test_reference_solution_passes_every_case(slug):
    """Proves the stored expected values are right, with plain local Python (no provider, no driver)."""
    p, fn = BY_SLUG[slug], python_reference(slug)
    for i, c in enumerate(p["test_cases"], 1):
        assert fj.values_equal(fn(*copy.deepcopy(c["args"])), c["expected"], p["return_type"], p.get("order_insensitive")), f"case {i}"


def test_every_problem_has_references_in_each_offered_language_and_a_slow_one_for_medium_and_hard():
    for slug, p in BY_SLUG.items():
        sig = fj.signature_of(p)
        assert set(REFERENCE[slug]) == set(LANGS) if sig.c_available else set(LANGS) - {"c"}, slug
        assert (slug in SLOW) == (p["difficulty"] != "Easy"), slug


# --------------------------------------------------------------------------- starter code
_STATEMENT = re.compile(r"^(return|for|while|if|else)\b")
SOLUTION_LINES = {
    re.sub(r"\s+", " ", line.strip())
    for code in [c for langs in REFERENCE.values() for c in langs.values()] + list(SLOW.values())
    for line in code.splitlines() if len(line.strip()) >= 22 and _STATEMENT.match(line.strip())
}


@pytest.mark.parametrize("slug", sorted(BY_SLUG))
def test_starter_code_is_generated_and_contains_no_solution_or_hint(slug):
    p = BY_SLUG[slug]
    stubs = fj.starter_code(p)
    assert stubs == fj.starter_code(p)  # deterministic: generated, not stored
    sig = fj.signature_of(p)
    assert set(stubs) == set(LANGS)  # every one of the 12 is C-able
    assert "class Solution:" in stubs["python"] and f"def {sig.snake_name}(self" in stubs["python"] and stubs["python"].rstrip().endswith("pass")
    assert f"function {sig.name}(" in stubs["javascript"]
    assert "class Solution {" in stubs["java"] and f" {sig.name}(" in stubs["java"] and "public class Main" not in stubs["java"]
    assert "class Solution {" in stubs["cpp"] and "public:" in stubs["cpp"] and "#include <bits/stdc++.h>" in stubs["cpp"]
    assert f" {sig.snake_name}(" in stubs["c"]
    for lang, code in stubs.items():
        assert not re.search(r"^\s*return\b", code, re.M), lang  # the body is empty
        for line in code.splitlines():
            assert re.sub(r"\s+", " ", line.strip()) not in SOLUTION_LINES, (lang, line)
        assert not any(hint in code for hint in p["hints"]), lang


def test_c_is_only_offered_for_simple_types():
    plain = {"function_name": "f", "params": [{"name": "xs", "type": "int[]"}, {"name": "s", "type": "string"}], "return_type": "int"}
    assert fj.signature_of(plain).c_available and "c" in fj.starter_code(plain)
    for params, ret in (([{"name": "m", "type": "int[][]"}], "int"), ([{"name": "xs", "type": "int"}], "string[]"), ([{"name": "xs", "type": "long[]"}], "int")):
        hard = {"function_name": "f", "params": params, "return_type": ret}
        sig = fj.signature_of(hard)
        assert not sig.c_available and "c" not in fj.starter_code(hard) and "numbers, booleans, text and integer arrays" in sig.c_disabled_reason


def test_return_type_stubs_for_every_supported_type():
    for t in drivers.SUPPORTED_TYPES:
        p = {"function_name": "echoIt", "params": [{"name": "value", "type": t}], "return_type": t}
        stubs = fj.starter_code(p)
        assert "def echo_it(self, value:" in stubs["python"] and "function echoIt(value)" in stubs["javascript"]
        assert f" echoIt({drivers.java_type(t)} value)" in stubs["java"]


# --------------------------------------------------------------------------- the public view never contains a secret
def secrets_of(slug):
    """Strings that must never appear in a response: hidden inputs / outputs, hints 2-3, and every solution line."""
    p = BY_SLUG[slug]
    shown_text = fj.compact_json([p["examples"], [c for c in p["test_cases"] if not c["hidden"]], p["description"], p["constraints"]])
    found = []
    for c in p["test_cases"]:
        if not c["hidden"]:
            continue
        for value in (fj.compact_json(c["args"]), fj.compact_json(c["expected"])):
            if len(value) >= 12 and value not in shown_text:
                found.append(value)
    return found


def assert_no_secrets(text, slug):
    for needle in secrets_of(slug):
        assert needle not in text, f"hidden data leaked: {needle[:40]}"
    for line in SOLUTION_LINES:
        assert line not in re.sub(r"\s+", " ", text.replace("\\n", " ")), f"solution line leaked: {line}"
    for hint in BY_SLUG[slug]["hints"][1:]:
        assert hint not in text


PUBLIC_KEYS = {
    "id", "slug", "title", "difficulty", "difficulty_rank", "category", "topic", "tags", "description", "constraints", "function_name", "params",
    "return_type", "examples", "example_args", "starter_code", "c_available", "c_disabled_reason", "time_limit_ms", "expected_complexity",
    "hint_count", "total_cases", "shown_cases",
}


def test_public_problem_is_an_allow_list():
    for p in EXPANDED_CODING_PROBLEMS:
        view = fj.public_problem(p)
        assert set(view) == PUBLIC_KEYS
        for forbidden in ("test_cases", "hints", "hidden", "expected", "order_insensitive", "sample_test_cases", "hidden_test_cases"):
            assert forbidden not in view
        assert len(view["example_args"]) == view["shown_cases"] == len(view["examples"])


@pytest.fixture
async def seeded(db):
    await seed_collections(db)
    return db


async def solve(client, student, slug, language, code, path="submit", **extra):
    return await client.post(f"/api/practice/code/{path}", json={"problem_slug": slug, "language": language, "source_code": code, **extra}, headers=bearer(student["token"]))


async def test_no_practice_response_contains_a_solution_a_hidden_case_or_a_later_hint(client, student, seeded):
    h = bearer(student["token"])
    leaky = (
        "class Solution:\n    def add_numbers(self, a: int, b: int) -> int:\n        print('ARGS', a, b, flush=True)\n"
        "        raise ValueError('secret ' + str(a) + ' ' + str(b))\n"
    )
    listing = await client.get("/api/practice/problems")
    texts = [("list", listing.text)]
    for slug in BY_SLUG:
        detail = await client.get(f"/api/practice/problems/{slug}")
        assert detail.status_code == 200
        assert_no_secrets(detail.text, slug)
        hint = await client.get(f"/api/practice/problems/{slug}/hints", params={"level": 1}, headers=h)
        assert hint.json()["hint"] == BY_SLUG[slug]["hints"][0]
        assert_no_secrets(hint.text, slug)
    assert_no_secrets(listing.text, "sum-two-numbers")
    for case_set in (None, ["a = 5\nb = 6"]):
        run = await solve(client, student, "sum-two-numbers", "python", leaky, "run", **({"cases": case_set} if case_set else {}))
        assert run.status_code == 200
        texts.append(("run", run.text))
    sub = await solve(client, student, "sum-two-numbers", "python", leaky)
    texts.append(("submit", sub.text))
    texts.append(("history", (await client.get("/api/practice/problems/sum-two-numbers/submissions", headers=h)).text))
    texts.append(("solved", (await client.get("/api/practice/solved", headers=h)).text))
    snap = await client.post("/api/practice/problems/sum-two-numbers/attempt", headers=h, json={"language": "python", "code": "x"})
    texts.append(("attempt", snap.text))
    for name, text in texts:
        assert_no_secrets(text, "sum-two-numbers")
    # the student's own prints for a HIDDEN case never come back (here case 1 is a shown example, so only that one may)
    submit_body = sub.json()
    assert submit_body["status"] == "Runtime Error" and submit_body["failed_case"] == 1 and submit_body["failed_detail"]["input"] == "a = 3\nb = 4"
    assert "250000" not in sub.text and "100000" not in sub.text


async def test_hidden_failures_reveal_only_the_case_number(client, student, seeded):
    sneaky = (
        "class Solution:\n    def add_numbers(self, a: int, b: int) -> int:\n        print('ARGS', a, b)\n"
        "        if a == 100000:\n            raise ValueError('secret input ' + str(b))\n        return a + b\n"
    )
    r = await solve(client, student, "sum-two-numbers", "python", sneaky)
    body = r.json()
    assert r.status_code == 200 and body["status"] == "Runtime Error"
    hidden_index = next(i for i, c in enumerate(SUM["test_cases"], 1) if c["args"][0] == 100000)
    assert body["failed_case"] == hidden_index and body["failed_detail"] is None and body["stdout"] == ""
    assert body["message"] == f"Test case {hidden_index} of {len(SUM['test_cases'])} failed (Runtime Error)."
    for secret in ("250000", "350000", "100000", "secret input", "ARGS 100000"):
        assert secret not in r.text
    hidden_rows = [t for t in body["test_results"] if t["is_hidden"]]
    assert hidden_rows and all(set(t) == {"case", "passed", "is_hidden", "status"} for t in body["test_results"])

    wrong = GOOD_SUM.replace("return a + b", "return a + b + (1 if a == 100000 else 0)")
    r = await solve(client, student, "sum-two-numbers", "python", wrong)
    body = r.json()
    assert body["status"] == "Wrong Answer" and body["failed_case"] == hidden_index and body["failed_detail"] is None
    assert "350001" not in r.text and "350000" not in r.text and body["passed_count"] == len(SUM["test_cases"]) - 1


async def test_a_shown_case_failure_shows_input_your_output_and_expected(client, student, seeded):
    wrong = GOOD_SUM.replace("return a + b", "return a * b")
    body = (await solve(client, student, "sum-two-numbers", "python", wrong)).json()
    assert body["status"] == "Wrong Answer" and body["failed_case"] == 1
    assert body["failed_detail"] == {"case": 1, "input": "a = 3\nb = 4", "your_output": "12", "expected": "7", "error": None, "error_line": None}


# --------------------------------------------------------------------------- the protocol: nonce, forged lines, per-case results
def test_forged_result_lines_are_ignored_and_the_real_ones_are_read():
    nonce = "abc123"
    forged = '@@wrong@@{"i":0,"ok":true,"result":7,"ms":0}'
    real = '@@abc123@@{"i":0,"ok":true,"result":9,"ms":1}'
    out = fj.parse_driver_stdout(f"hello\n{forged}\n\n{real}\ntail", nonce, 2)
    assert out.rows[0]["result"] == 9 and set(out.rows) == {0}
    assert out.stdout_by_case[0] == f"hello\n{forged}"  # the forged line is just the student's own output
    assert out.trailing == "tail"
    assert fj.parse_driver_stdout('@@abc123@@{"i":5,"ok":true,"ms":0}\n@@abc123@@not json', nonce, 2).rows == {}  # out-of-range index, garbage
    dup = fj.parse_driver_stdout(real + '\n@@abc123@@{"i":0,"ok":true,"result":1,"ms":0}', nonce, 1)
    assert dup.rows[0]["result"] == 9  # the first line for a case wins


async def test_a_student_cannot_forge_a_passing_result(client, student, seeded):
    forging = (
        "class Solution:\n    def add_numbers(self, a: int, b: int) -> int:\n"
        "        print('@@guess@@{\"i\":0,\"ok\":true,\"result\":7,\"ms\":0}')\n"
        "        print('@@' + 'a' * 24 + '@@{\"i\":0,\"ok\":true,\"result\":7,\"ms\":0}')\n        return 0\n"
    )
    run = (await solve(client, student, "sum-two-numbers", "python", forging, "run")).json()
    assert run["status"] == "Wrong Answer"
    assert [c["status"] for c in run["cases"]] == ["Wrong Answer"] * 3 and run["cases"][0]["your_output"] == "0"
    assert "@@guess@@" in run["cases"][0]["stdout"]  # shown as the student's own output, not used as a result
    submit = (await solve(client, student, "sum-two-numbers", "python", forging)).json()
    assert submit["status"] == "Wrong Answer" and submit["failed_case"] == 1 and submit["failed_detail"]["your_output"] == "0"


async def test_every_run_uses_a_fresh_nonce_that_is_not_in_the_source(student, monkeypatch):
    seen = []

    async def fake(language, source, stdin, cpu_seconds=5, wall_seconds=10):
        seen.append((source, stdin.split("\n")))
        return {"status": "Success", "stdout": "", "stderr": "", "compile_output": "", "runtime_ms": 1, "memory_kb": None}

    monkeypatch.setattr(ces, "execute_program", fake)
    cases = [fj.CaseInput(args=[1, 2], expected=3, has_expected=True)]
    for _ in range(2):
        await fj.run_function_cases(SUM, "python", GOOD_SUM, cases)
    (src1, in1), (src2, in2) = seen
    assert in1[0] != in2[0] and len(in1[0]) >= 16 and in1[0] not in src1 and in2[0] not in src2
    assert in1[1:3] == ["1", "1000"] and in1[3] == "[1,2]"  # count, time limit, then one JSON line of arguments per case


def fake_provider(rows_for, status="Success", stderr="", compile_output="", truncated=False, stdout_extra="", runtime_ms=7, memory_kb=2048):
    """A stand-in for execute_program that answers in the driver's protocol. rows_for(count) -> list of row dicts to print."""

    async def fake(language, source, stdin, cpu_seconds=5, wall_seconds=10):
        lines = stdin.split("\n")
        nonce, count = lines[0], int(lines[1])
        out = "".join(f"\n@@{nonce}@@{json.dumps(r)}\n" for r in rows_for(count)) + stdout_extra
        return {"status": status, "stdout": out, "stderr": stderr, "compile_output": compile_output, "runtime_ms": runtime_ms,
                "memory_kb": memory_kb, "truncated": truncated}

    return fake


def ok_row(i, result, ms=1):
    return {"i": i, "ok": True, "result": result, "ms": ms}


def sum_cases(slug_problem=SUM):
    return [fj.CaseInput(args=c["args"], expected=c["expected"], has_expected=True, shown=not c["hidden"]) for c in slug_problem["test_cases"]]


async def test_per_case_results_and_totals(monkeypatch):
    cases = sum_cases()
    monkeypatch.setattr(ces, "execute_program", fake_provider(lambda n: [ok_row(i, cases[i].expected, ms=i) for i in range(n)]))
    out = await fj.run_function_cases(SUM, "python", GOOD_SUM, cases)
    assert out.verdict == "Accepted" and all(c.status == "Passed" for c in out.cases) and out.runtime_ms == sum(range(len(cases))) and out.memory_kb == 2048
    assert [c.shown for c in out.cases][:3] == [True] * 3 and not any(c.shown for c in out.cases[3:])
    assert all(c.your_output is None for c in out.cases if not c.shown)  # hidden: nothing is kept


async def test_time_limit_when_the_provider_kills_the_run(monkeypatch):
    cases = sum_cases()
    monkeypatch.setattr(ces, "execute_program", fake_provider(lambda n: [ok_row(0, 7), ok_row(1, -6)], status="Time Limit Exceeded", stderr="Time limit exceeded."))
    out = await fj.run_function_cases(SUM, "python", GOOD_SUM, cases)
    assert out.verdict == "Time Limit Exceeded"
    assert [c.status for c in out.cases][:4] == ["Passed", "Passed", "Time Limit Exceeded", "Not run"] and out.cases[-1].status == "Not run"
    assert out.message == f"Test case 3 of {len(cases)} failed (Time Limit Exceeded)."


async def test_time_limit_when_a_single_case_is_too_slow(monkeypatch):
    cases = sum_cases()
    rows = lambda n: [ok_row(0, 7), ok_row(1, -6), ok_row(2, 4000000000), ok_row(3, 0), {"i": 4, "ok": False, "kind": "tle", "ms": 9000}]  # noqa: E731
    monkeypatch.setattr(ces, "execute_program", fake_provider(rows))
    out = await fj.run_function_cases(SUM, "python", GOOD_SUM, cases)
    assert out.verdict == "Time Limit Exceeded" and out.first_failure.index == 5 and out.cases[5].status == "Not run"


async def test_crash_and_early_exit_name_the_case(monkeypatch):
    cases = sum_cases()
    monkeypatch.setattr(ces, "execute_program", fake_provider(lambda n: [ok_row(0, 7)], status="Runtime Error", stderr="Segmentation fault (SIGSEGV)"))
    out = await fj.run_function_cases(SUM, "cpp", "x", cases)
    assert out.verdict == "Runtime Error" and out.first_failure.index == 2 and "Segmentation" in out.first_failure.error
    # the program ends quietly before case 1: a shown case says why
    monkeypatch.setattr(ces, "execute_program", fake_provider(lambda n: []))
    out = await fj.run_function_cases(SUM, "python", "x", cases)
    assert out.first_failure.index == 1 and out.cases[0].status == "Runtime Error" and "stopped before returning a result" in out.cases[0].error
    # ... and on a HIDDEN case it says nothing at all
    monkeypatch.setattr(ces, "execute_program", fake_provider(lambda n: [ok_row(i, cases[i].expected) for i in range(4)]))
    out = await fj.run_function_cases(SUM, "python", "x", cases)
    assert out.first_failure.index == 5 and out.cases[4].status == "Runtime Error" and out.cases[4].shown is False and out.cases[4].error is None


async def test_output_limit_exceeded(monkeypatch):
    cases = sum_cases()
    monkeypatch.setattr(ces, "execute_program", fake_provider(lambda n: [ok_row(0, 7)], truncated=True, stdout_extra="x" * 50))
    out = await fj.run_function_cases(SUM, "python", "x", cases)
    assert out.verdict == "Output Limit Exceeded" and out.first_failure.index == 2


async def test_function_returned_nothing_is_a_failed_case_never_success(monkeypatch):
    cases = sum_cases()
    nothing = lambda n: [{"i": i, "ok": False, "kind": "nothing", "error": "Your function returned nothing", "ms": 0} for i in range(n)]  # noqa: E731
    monkeypatch.setattr(ces, "execute_program", fake_provider(nothing))
    out = await fj.run_function_cases(SUM, "python", "x", cases)
    assert out.verdict == "Wrong Answer" and all(c.status == "Wrong Answer" and c.passed is False for c in out.cases)
    assert out.cases[0].error == "Your function returned nothing"


async def test_the_empty_starter_returns_nothing_for_real(client, student, seeded):
    stub = fj.starter_code(SUM)["python"]
    run = (await solve(client, student, "sum-two-numbers", "python", stub, "run")).json()
    assert run["status"] == "Wrong Answer" and len(run["cases"]) == 3
    assert all(c["status"] == "Wrong Answer" and c["passed"] is False and c["error"] == "Your function returned nothing" for c in run["cases"])
    assert not any(c["status"] in ("Passed", "Finished") for c in run["cases"])
    submit = (await solve(client, student, "sum-two-numbers", "python", stub)).json()
    assert submit["status"] == "Wrong Answer" and submit["passed_count"] == 0 and submit["failed_detail"]["error"] == "Your function returned nothing"


async def test_float_tolerance_and_order_insensitive_comparison():
    assert fj.values_equal(0.1 + 0.2, 0.3, "double") and not fj.values_equal(0.3002, 0.3, "double") and fj.values_equal(1e9 + 0.0004, 1e9, "double")
    assert not fj.values_equal(True, 1, "int") and not fj.values_equal(1, True, "bool") and fj.values_equal(7.0, 7, "int") and not fj.values_equal(7.5, 7, "int")
    assert fj.values_equal([3, 1, 2], [1, 2, 3], "int[]", True) and not fj.values_equal([3, 1, 2], [1, 2, 3], "int[]", False)
    assert fj.values_equal([[2, 1], [1, 1]], [[1, 1], [2, 1]], "int[][]", True) and not fj.values_equal([[1, 2]], [[2, 1]], "int[][]", True)
    assert not fj.values_equal([1, 2], [1, 2, 3], "int[]", True) and not fj.values_equal("7", 7, "int") and fj.values_equal("a b", "a b", "string")


# --------------------------------------------------------------------------- Run: examples, edited examples, custom cases
async def test_run_reports_each_shown_example(client, student, seeded):
    wrong = GOOD_SUM.replace("return a + b", "return 0 if a == -10 else a + b")
    run = (await solve(client, student, "sum-two-numbers", "python", wrong, "run")).json()
    assert run["status"] == "Wrong Answer" and run["runtime_ms"] >= 0 and "Test case 2" in run["message"]
    assert [(c["index"], c["status"], c["passed"]) for c in run["cases"]] == [(1, "Passed", True), (2, "Wrong Answer", False), (3, "Passed", True)]
    two = run["cases"][1]
    assert two["input"] == "a = -10\nb = 4" and two["your_output"] == "0" and two["expected"] == "-6" and two["custom"] is False
    good = (await solve(client, student, "sum-two-numbers", "python", GOOD_SUM, "run")).json()
    assert good["status"] == "Accepted" and all(c["passed"] for c in good["cases"])


async def test_run_with_edited_and_custom_cases(client, student, seeded):
    body = (await solve(client, student, "sum-two-numbers", "python", GOOD_SUM, "run", cases=["a = 3\nb = 4", "b = 6\na = 5", "a = 1000\nb = 1"])).json()
    first, second, third = body["cases"]
    assert first["custom"] is False and first["expected"] == "7" and first["status"] == "Passed"
    assert second["custom"] is True and second["expected"] is None and second["passed"] is None and second["status"] == "Finished" and second["your_output"] == "11"
    assert third["your_output"] == "1001"
    only_custom = (await solve(client, student, "sum-two-numbers", "python", GOOD_SUM, "run", cases=["a = 1\nb = 1"])).json()
    assert only_custom["status"] == "Finished"  # nothing to compare with, and it says so


async def test_custom_input_errors_are_field_level(client, student, seeded):
    async def errors(cases, slug="sum-two-numbers"):
        r = await solve(client, student, slug, "python", GOOD_SUM, "run", cases=cases)
        assert r.status_code == 422, r.text
        return r.json()["detail"]

    detail = await errors(["a = 3"])
    assert any(e["field"] == "b" and "missing" in e["message"] for e in detail["errors"]) and detail["message"]
    detail = await errors(["a = three\nb = 4", "a = 1\nb = 2\nc = 3", "a = 1.5\nb = 2", "oops"])
    messages = {(e["case"], e["field"]): e["message"] for e in detail["errors"]}
    assert "could not read" in messages[(1, "a")] and "not an input" in messages[(2, "c")] and "whole number" in messages[(3, "a")]
    assert any(e["case"] == 4 and e["field"] is None and "name = value" in e["message"] for e in detail["errors"])
    detail = await errors(["s = hello"], "count-vowels")
    assert 'double quotes' in detail["errors"][0]["message"]
    detail = await errors(["nums = [1,2"], "array-range")
    assert "list like [1,2,3]" in detail["errors"][0]["message"]
    assert (await solve(client, student, "sum-two-numbers", "python", GOOD_SUM, "run", cases=[])).status_code == 422
    many = [f"a = {i}\nb = 1" for i in range(10, 19)]
    assert (await solve(client, student, "sum-two-numbers", "python", GOOD_SUM, "run", cases=many)).status_code == 422  # more than 8 cases
    six_custom = [f"a = {i}\nb = 1" for i in range(10, 16)]
    r = await solve(client, student, "sum-two-numbers", "python", GOOD_SUM, "run", cases=six_custom)
    assert r.status_code == 422 and "at most 5" in r.json()["detail"]["message"]


def test_case_text_round_trips():
    p = BY_SLUG["pair-sum-exists"]
    text = fj.display_args(["nums", "target"], [[2, 7, 11, 15], 9])
    assert text == "nums = [2,7,11,15]\ntarget = 9" and fj.parse_case_text(p, text) == [[2, 7, 11, 15], 9]
    assert fj.parse_case_text(p, "target = 9\n\n nums =[2, 7] ") == [[2, 7], 9]
    s = BY_SLUG["count-vowels"]
    assert fj.parse_case_text(s, 's = "say \\"hi\\"\\n"') == ['say "hi"\n']
    with pytest.raises(fj.CaseInputError) as err:
        fj.parse_case_text(p, "nums = [1,2]\nnums = [3]\ntarget = 1")
    assert "twice" in err.value.errors[0]["message"]


# --------------------------------------------------------------------------- compile errors and line numbers
def test_error_lines_are_mapped_back_to_the_students_code():
    java = "Main.java:9: error: ';' expected\n        int x = 1\n                 ^\nMain.java:150: error: cannot find symbol"
    text, lines = fj.map_error_lines(java, prefix_lines=2, student_lines=12)
    assert "Main.java:7: error: ';' expected" in text and "driver code (not your lines)" in text and lines == [7]
    cpp, lines = fj.map_error_lines("/box/main.cpp:8:13: error: expected ';'", prefix_lines=2, student_lines=10)
    assert cpp == "/box/main.cpp:6:13: error: expected ';'" and lines == [6]
    py, lines = fj.map_error_lines('  File "/box/script.py", line 3\n    return a +\n', 0, 5)
    assert 'line 3' in py and lines == [3]
    js, lines = fj.map_error_lines("/box/script.js:4\nfunction f( {", 0, 6)
    assert lines == [4]
    assert fj.map_error_lines("nothing here", 2, 5) == ("nothing here", [])


async def test_compile_error_from_the_provider_is_mapped_and_hinted(monkeypatch):
    prefix = drivers.prefix_line_count("java")
    out_text = f"Main.java:{prefix + 4}: error: ';' expected\nMain.java:{prefix + 400}: error: cannot find symbol\n  symbol: method addNumbers(long,long)"
    monkeypatch.setattr(ces, "execute_program", fake_provider(lambda n: [], status="Compile Error", compile_output=out_text))
    out = await fj.run_function_cases(SUM, "java", "class Solution {\n    public long addNumbers(long a, long b) {\n        return a + b\n    }\n}\n", sum_cases())
    assert out.verdict == "Compile Error" and out.error_lines == [4] and "Main.java:4: error: ';' expected" in out.compile_output
    assert "Keep the class name Solution" in out.compile_output and out.cases == []


async def test_python_syntax_error_is_a_compile_error_with_its_line(client, student, seeded):
    broken = "class Solution:\n    def add_numbers(self, a, b):\n        return a +\n"
    for path in ("run", "submit"):
        body = (await solve(client, student, "sum-two-numbers", "python", broken, path)).json()
        assert body["status"] == "Compile Error" and body["error_lines"] == [3], body
        assert "SyntaxError" in body["compile_output"]
    saved = await seeded["practice_attempts"].find_one({"user_id": student["user"]["id"], "verdict": "Compile Error"})
    assert saved is not None and saved["is_correct"] is False


async def test_javascript_syntax_error_is_a_compile_error_with_its_line(client, student, seeded):
    broken = "function addNumbers(a, b) {\n  return a +;\n}\n"
    body = (await solve(client, student, "sum-two-numbers", "javascript", broken, "run")).json()
    assert body["status"] == "Compile Error" and body["error_lines"] == [2], body


async def test_runtime_error_points_at_the_students_line(client, student, seeded):
    code = "class Solution:\n    def add_numbers(self, a: int, b: int) -> int:\n        items = []\n        return items[5] + a + b\n"
    body = (await solve(client, student, "sum-two-numbers", "python", code, "run")).json()
    first = body["cases"][0]
    assert body["status"] == "Runtime Error" and first["status"] == "Runtime Error" and first["error_line"] == 4 and "IndexError" in first["error"]


# --------------------------------------------------------------------------- real time limits (local sandbox)
async def test_a_slow_case_is_a_time_limit_exceeded_by_the_driver(client, student, seeded):
    slow = "import time\n\nclass Solution:\n    def add_numbers(self, a: int, b: int) -> int:\n        time.sleep(1.3)\n        return a + b\n"
    body = (await solve(client, student, "sum-two-numbers", "python", slow)).json()  # the example limit is 1000 ms per case
    assert body["status"] == "Time Limit Exceeded" and body["failed_case"] == 1 and body["passed_count"] == 0
    assert body["failed_detail"]["input"] == "a = 3\nb = 4"


async def test_a_brute_force_on_the_large_case_times_out(client, student, seeded):
    body = (await solve(client, student, "staircase-ways", "python", SLOW["staircase-ways"])).json()
    cases = BY_SLUG["staircase-ways"]["test_cases"]
    assert body["status"] == "Time Limit Exceeded" and body["failed_case"] is not None
    assert body["failed_detail"] is None  # it is a hidden case
    assert body["passed_count"] == body["failed_case"] - 1  # the cases before it were fine
    good = (await solve(client, student, "staircase-ways", "python", REFERENCE["staircase-ways"]["python"])).json()
    assert good["status"] == "Accepted" and good["passed_count"] == len(cases)


# --------------------------------------------------------------------------- provider failures
async def test_judge_unavailable_is_never_wrong_answer_and_is_not_recorded(client, student, seeded, monkeypatch):
    async def down(*a, **k):
        raise SandboxUnavailable("Online compiler is busy, try again in a moment.")

    monkeypatch.setattr(ces, "execute_program", down)
    r = await solve(client, student, "sum-two-numbers", "python", GOOD_SUM)
    body = r.json()
    assert r.status_code == 200 and body["status"] == "Judge unavailable" and "busy" in body["message"].lower() and body["failed_case"] is None
    assert await seeded["practice_attempts"].count_documents({}) == 0
    run = await solve(client, student, "sum-two-numbers", "python", GOOD_SUM, "run")
    assert run.status_code == 503 and "busy" in run.json()["detail"].lower()

    async def limited(*a, **k):
        raise SandboxRateLimited("Online compiler is busy (too many requests), try again in a moment.")

    monkeypatch.setattr(ces, "execute_program", limited)
    assert (await solve(client, student, "sum-two-numbers", "python", GOOD_SUM)).json()["status"] == "Judge unavailable"
    assert (await solve(client, student, "sum-two-numbers", "python", GOOD_SUM, "run")).status_code == 429


# --------------------------------------------------------------------------- submissions, solved, acceptance, hints
async def test_accepted_submission_is_saved_and_listed(client, student, seeded):
    h = bearer(student["token"])
    body = (await solve(client, student, "sum-two-numbers", "python", GOOD_SUM)).json()
    total = len(SUM["test_cases"])
    assert body["status"] == "Accepted" and body["passed_count"] == body["total_count"] == total and body["failed_case"] is None
    assert body["expected_complexity"] == SUM["expected_complexity"] and body["runtime_ms"] >= 0 and body["message"] == f"Passed all {total} test cases."
    saved = await seeded["practice_attempts"].find_one({"user_id": student["user"]["id"], "problem_slug": "sum-two-numbers"})
    assert saved["verdict"] == "Accepted" and saved["is_correct"] and saved["language"] == "python" and saved["code"] == GOOD_SUM
    assert saved["created_at"] and saved["passed_count"] == total and "memory_kb" in saved
    history = (await client.get("/api/practice/problems/sum-two-numbers/submissions", headers=h)).json()
    assert len(history) == 1 and history[0]["verdict"] == "Accepted" and history[0]["code"] == GOOD_SUM and history[0]["language"] == "python"
    assert (await client.get("/api/practice/solved", headers=h)).json() == {"solved": ["sum-two-numbers"]}


async def test_submissions_and_hints_belong_to_the_logged_in_user(client, student, seeded):
    other = (await client.post("/api/auth/register", json={"name": "Other One", "email": "o1@example.com", "password": "Sup3rSecret1"})).json()
    ho, hs = bearer(other["access_token"]), bearer(student["token"])
    await solve(client, student, "sum-two-numbers", "python", GOOD_SUM)
    assert len((await client.get("/api/practice/problems/sum-two-numbers/submissions", headers=hs)).json()) == 1
    assert (await client.get("/api/practice/problems/sum-two-numbers/submissions", headers=ho)).json() == []
    assert (await client.get("/api/practice/problems/sum-two-numbers/submissions")).status_code == 401
    assert (await client.get("/api/practice/problems/nope/submissions", headers=hs)).status_code == 404
    # at most the last 20, newest first
    for i in range(25):
        await seeded["practice_attempts"].insert_one({
            "id": f"x{i}", "user_id": student["user"]["id"], "problem_slug": "sum-two-numbers", "language": "python", "code": f"v{i}",
            "verdict": "Wrong Answer", "timestamp": __import__("datetime").datetime(2030, 1, 1, 0, i), "created_at": None,
        })
    history = (await client.get("/api/practice/problems/sum-two-numbers/submissions", headers=hs)).json()
    assert len(history) == 20 and history[0]["code"] == "v24" and history[1]["code"] == "v23"

    for level in (1, 2, 3):
        r = await client.get("/api/practice/problems/sum-two-numbers/hints", params={"level": level}, headers=hs)
        assert r.status_code == 200 and r.json() == {"level": level, "total": 3, "hint": SUM["hints"][level - 1]}
    assert (await client.get("/api/practice/problems/sum-two-numbers/hints", params={"level": 4}, headers=hs)).status_code == 404
    assert (await client.get("/api/practice/problems/sum-two-numbers/hints", params={"level": 0}, headers=hs)).status_code == 422
    assert (await client.get("/api/practice/problems/sum-two-numbers/hints", params={"level": 1})).status_code == 401
    assert (await client.get("/api/practice/problems/nope/hints", params={"level": 1}, headers=hs)).status_code == 404


async def test_acceptance_rate_comes_from_real_submissions(client, student, seeded):
    first = (await client.get("/api/practice/problems/sum-two-numbers")).json()
    assert first["submissions_count"] == 0 and first["acceptance_rate"] is None  # no data, nothing invented
    await solve(client, student, "sum-two-numbers", "python", GOOD_SUM)
    await solve(client, student, "sum-two-numbers", "python", GOOD_SUM.replace("a + b", "a - b"))
    listed = {p["slug"]: p for p in (await client.get("/api/practice/problems")).json()}
    assert listed["sum-two-numbers"]["submissions_count"] == 2 and listed["sum-two-numbers"]["acceptance_rate"] == 50
    assert listed["count-vowels"]["acceptance_rate"] is None


# --------------------------------------------------------------------------- API surface
async def test_problems_api_serves_the_twelve_in_order_and_filters(client, seeded):
    problems = (await client.get("/api/practice/problems")).json()
    assert [p["slug"] for p in problems] == [p["slug"] for p in EXPANDED_CODING_PROBLEMS]
    assert all(set(p["starter_code"]) == set(LANGS) and p["c_available"] for p in problems)
    easy = (await client.get("/api/practice/problems", params={"difficulty": "Easy"})).json()
    assert len(easy) == 4 and {p["difficulty"] for p in easy} == {"Easy"}
    dp = (await client.get("/api/practice/problems", params={"topic": "DP"})).json()
    assert {p["slug"] for p in dp} == {"staircase-ways", "longest-increasing-subsequence", "fewest-coins", "subset-sum-count"}
    assert (await client.get("/api/practice/problems/does-not-exist")).status_code == 404


async def test_empty_database_returns_an_empty_list_not_a_fallback(client, db):
    assert (await client.get("/api/practice/problems")).json() == []


async def test_unknown_problem_and_bad_language(client, student, seeded):
    assert (await solve(client, student, "does-not-exist", "python", GOOD_SUM)).status_code == 404
    assert (await solve(client, student, "does-not-exist", "python", GOOD_SUM, "run")).status_code == 404
    bad = await solve(client, student, "sum-two-numbers", "cobol", GOOD_SUM)
    assert bad.status_code == 400 and "Unsupported language" in bad.json()["detail"]
    big = await solve(client, student, "sum-two-numbers", "python", "x = 1\n" * 4000)
    assert big.status_code == 413 and "20 KB" in big.json()["detail"]


async def test_c_is_refused_for_a_problem_that_does_not_fit(client, student, seeded):
    await seeded["practice_problems"].insert_one({
        **{k: v for k, v in SUM.items() if k != "test_cases"}, "id": "cp-x", "slug": "matrix-x", "function_name": "sumMatrix",
        "params": [{"name": "grid", "type": "int[][]"}], "return_type": "int", "examples": [{"input": "grid = [[1]]", "output": "1", "explanation": ""}],
        "test_cases": [{"args": [[[1]]], "expected": 1, "hidden": False}, {"args": [[[1, 2]]], "expected": 3, "hidden": True}],
    })
    problem = (await client.get("/api/practice/problems/matrix-x")).json()
    assert problem["c_available"] is False and "c" not in problem["starter_code"] and problem["c_disabled_reason"]
    r = await solve(client, student, "matrix-x", "c", "int f() { return 0; }")
    assert r.status_code == 400 and "integer arrays" in r.json()["detail"]


# --------------------------------------------------------------------------- the seed
async def test_seed_replaces_old_format_fields_and_keeps_admin_edits(db):
    for slug in ("two-sum", "lru-cache"):
        await db["practice_problems"].insert_one({"id": slug, "slug": slug, "title": "old", "difficulty": "Easy", "category": "x", "topic": "x", "description": "old"})
    await db["practice_problems"].insert_one({"id": "valid-palindrome", "slug": "valid-palindrome", "title": "mine", "edited_by_admin": True})
    legacy = {name: "old" for name in LEGACY_PROBLEM_FIELDS}
    await db["practice_problems"].insert_one({"id": "cp-02", "slug": "count-vowels", "title": "old stdin version", **legacy})
    first = await seed_collections(db)
    assert first["practice_problems"]["inserted"] == 11 and first["practice_problems"]["updated"] == 1 and first["practice_problems"]["removed"] == 2
    stored = await db["practice_problems"].find_one({"slug": "count-vowels"})
    assert stored["function_name"] == "countVowels" and not any(name in stored for name in LEGACY_PROBLEM_FIELDS)
    assert await db["practice_problems"].find_one({"slug": "valid-palindrome"})  # admin-edited: untouched
    second = await seed_collections(db)
    assert second["practice_problems"]["inserted"] == 0 and second["practice_problems"]["removed"] == 0
    await db["practice_problems"].update_one({"slug": "count-vowels"}, {"$set": {"title": "Edited", "edited_by_admin": True}})
    await seed_collections(db)
    assert (await db["practice_problems"].find_one({"slug": "count-vowels"}))["title"] == "Edited"


async def test_a_stored_problem_in_the_old_format_is_never_served(client, db):
    await db["practice_problems"].insert_one({"id": "old", "slug": "old-style", "title": "x", "difficulty": "Easy", "description": "d", "test_cases": [{"input": "1", "expected_output": "2", "is_hidden": True}]})
    assert (await client.get("/api/practice/problems")).json() == []
    assert (await client.get("/api/practice/problems/old-style")).status_code == 404
