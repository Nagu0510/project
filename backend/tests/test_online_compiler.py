"""Online compiler runner. The provider is always mocked (conftest blocks real network calls)."""
import base64
import json
import pathlib
import re

import httpx
import pytest
from pydantic import SecretStr

from app.config import settings
from app.data.coding_problems import EXPANDED_CODING_PROBLEMS
from app.seed import seed_collections
from app.services import online_compiler
from app.services.code_execution_service import execute_async, run_tests_async
from app.services.sandbox_errors import SandboxRateLimited, SandboxUnavailable
from tests.conftest import bearer

LANG_IDS = {"python": 100, "javascript": 97, "java": 91, "c": 103, "cpp": 105}
SUM_CASES = next(p for p in EXPANDED_CODING_PROBLEMS if p["slug"] == "sum-two-numbers")["test_cases"]


def b64(text):
    return base64.b64encode(text.encode()).decode()


def judge0(stdout="", stderr="", compile_output="", status=3, time="0.012", exit_code=0, message=None):
    """A finished Judge0 submission, encoded the way base64_encoded=true returns it."""
    return {
        "stdout": b64(stdout) if stdout else None, "stderr": b64(stderr) if stderr else None,
        "compile_output": b64(compile_output) if compile_output else None,
        "message": b64(message) if message else None, "time": time, "exit_code": exit_code,
        "status": {"id": status, "description": "x"}, "token": "tok-1",
    }


class FakeProvider:
    """Stands in for Judge0: records what was sent and answers with `respond(language_id, source, stdin)`."""

    def __init__(self, respond):
        self.respond = respond
        self.requests = []

    def __call__(self, request: httpx.Request) -> httpx.Response:
        body = json.loads(request.content) if request.content else {}
        self.requests.append({"url": str(request.url), "method": request.method, "headers": dict(request.headers), "body": body})
        if request.method == "POST":
            out = self.respond(body["language_id"], base64.b64decode(body["source_code"]).decode(), base64.b64decode(body["stdin"]).decode())
            if isinstance(out, httpx.Response):
                return out
            return httpx.Response(200, json=out)
        return httpx.Response(404)


@pytest.fixture
def online(monkeypatch):
    monkeypatch.setattr(settings, "SANDBOX_MODE", "online")
    monkeypatch.setattr(settings, "CODE_PROVIDER", "judge0_ce")
    monkeypatch.setattr(settings, "CODE_API_URL", None)
    monkeypatch.setattr(settings, "CODE_API_KEY", None)

    def install(respond):
        fake = FakeProvider(respond)
        transport = httpx.MockTransport(fake)
        monkeypatch.setattr(online_compiler, "make_client", lambda timeout: httpx.AsyncClient(transport=transport, timeout=timeout))
        return fake

    return install


def summing(language_id, source, stdin):
    return judge0(stdout=f"{sum(int(x) for x in stdin.split())}\n")


# ---- every language, hello + stdin ---------------------------------------------------------------

@pytest.mark.parametrize("lang", list(LANG_IDS))
async def test_hello_and_stdin_in_every_language(online, lang):
    fake = online(lambda lid, src, stdin: judge0(stdout="hello\n") if "hello" in src else summing(lid, src, stdin))
    hello = await execute_async(lang, "print hello")
    assert hello["status"] == "Success" and hello["stdout"] == "hello" and hello["memory_kb"] is None
    reads = await execute_async(lang, "read numbers", "3 4")
    assert reads["stdout"] == "7"
    assert {r["body"]["language_id"] for r in fake.requests} == {LANG_IDS[lang]}  # right Judge0 language per language


async def test_java_public_class_main_is_sent_untouched(online):
    fake = online(lambda *a: judge0(stdout="ok\n"))
    code = "public class Main { public static void main(String[] a) { System.out.println(\"ok\"); } }"
    await execute_async("java", code)
    assert base64.b64decode(fake.requests[0]["body"]["source_code"]).decode() == code
    assert fake.requests[0]["body"]["language_id"] == 91


# ---- status mapping -------------------------------------------------------------------------------

async def test_status_codes_map_to_our_statuses(online):
    cases = {
        "compile": (judge0(status=6, compile_output="main.c:1: error: expected ')'"), "Compile Error"),
        "runtime": (judge0(status=11, stderr="Segmentation fault", exit_code=139), "Runtime Error"),
        "nzec": (judge0(status=12, stderr="Traceback...", exit_code=3), "Runtime Error"),
        "timeout": (judge0(status=5, time="5.0"), "Time Limit Exceeded"),
    }
    online(lambda lid, src, stdin: cases[src][0])
    for src, (_, expected) in cases.items():
        res = await execute_async("python", src)
        assert res["status"] == expected, src
    assert (await execute_async("python", "compile"))["compile_output"].startswith("main.c:1")
    nz = await execute_async("python", "nzec")
    assert nz["exit_code"] == 3 and "Traceback" in nz["stderr"]
    assert (await execute_async("python", "timeout"))["runtime_ms"] == 5000


async def test_queued_response_is_polled_until_finished(online):
    calls = {"polls": 0}

    def handler(request: httpx.Request):
        if request.method == "POST":
            return httpx.Response(201, json={"token": "abc", "status": {"id": 1}})
        calls["polls"] += 1
        return httpx.Response(200, json=judge0(stdout="done\n") if calls["polls"] > 1 else {"status": {"id": 2}, "token": "abc"})

    monkey_transport = httpx.MockTransport(handler)
    online(lambda *a: judge0())  # installs the settings; the transport is replaced just below
    online_compiler.make_client = lambda timeout: httpx.AsyncClient(transport=monkey_transport, timeout=timeout)
    res = await execute_async("python", "x")
    assert res["stdout"] == "done" and calls["polls"] == 2


async def test_wait_not_allowed_falls_back_to_submit_and_poll(online):
    seen = []

    def handler(request: httpx.Request):
        seen.append((request.method, request.url.params.get("wait")))
        if request.method == "POST" and request.url.params.get("wait") == "true":
            return httpx.Response(400, json={"error": "wait not allowed"})
        if request.method == "POST":
            return httpx.Response(201, json={"token": "t"})
        return httpx.Response(200, json=judge0(stdout="ok\n"))

    transport = httpx.MockTransport(handler)
    online(lambda *a: judge0())
    online_compiler.make_client = lambda timeout: httpx.AsyncClient(transport=transport, timeout=timeout)
    assert (await execute_async("python", "x"))["stdout"] == "ok"
    assert seen[0] == ("POST", "true") and seen[1] == ("POST", "false")


async def test_output_is_capped_at_64kb(online):
    online(lambda *a: judge0(stdout="A" * 300_000))
    res = await execute_async("python", "x")
    assert len(res["stdout"]) < 70_000 and "[output truncated at 64 KB]" in res["stdout"]


# ---- privacy ----------------------------------------------------------------------------------------

async def test_only_code_language_and_stdin_reach_the_provider(online, monkeypatch):
    monkeypatch.setenv("SKILLSENSE_TEST_SECRET", "env-secret-value")
    fake = online(lambda *a: judge0(stdout="x\n"))
    await execute_async("python", "print(1)", "input")
    sent = fake.requests[0]
    assert set(sent["body"]) == {"language_id", "source_code", "stdin", "cpu_time_limit", "wall_time_limit"}
    blob = json.dumps(sent).lower()
    for forbidden in ("env-secret-value", settings.JWT_SECRET_KEY.lower(), "authorization", "cookie", "callback", "@example.com"):
        assert forbidden not in blob
    assert sent["url"].startswith("https://ce.judge0.com/submissions")


async def test_rapidapi_key_is_sent_only_as_a_provider_header(online, monkeypatch):
    monkeypatch.setattr(settings, "CODE_PROVIDER", "judge0_rapidapi")
    monkeypatch.setattr(settings, "CODE_API_KEY", SecretStr("rapid-key-123"))
    fake = online(lambda *a: judge0(stdout="x\n"))
    res = await execute_async("python", "x")
    h = fake.requests[0]["headers"]
    assert h["x-rapidapi-key"] == "rapid-key-123" and h["x-rapidapi-host"] == "judge0-ce.p.rapidapi.com"
    assert "rapid-key-123" not in json.dumps(res) and "rapid-key-123" not in json.dumps(fake.requests[0]["body"])


def test_rapidapi_without_a_key_refuses_to_start(monkeypatch):
    from app.config import Settings

    monkeypatch.setenv("CODE_PROVIDER", "judge0_rapidapi")
    monkeypatch.setenv("SANDBOX_MODE", "online")
    monkeypatch.delenv("CODE_API_KEY", raising=False)
    with pytest.raises(ValueError, match="CODE_API_KEY"):
        Settings(_env_file=None)


def test_browser_code_never_mentions_the_provider():
    src = pathlib.Path(__file__).resolve().parents[2] / "src"
    hits = [str(p) for p in src.rglob("*") if p.suffix in {".js", ".jsx"} and re.search(r"judge0|CODE_API|rapidapi|piston", p.read_text(encoding="utf-8"), re.I)]
    assert hits == []


# ---- provider failures are errors, never fake successes ------------------------------------------------

@pytest.mark.parametrize("status,exc,text", [
    (429, SandboxRateLimited, "too many requests"),
    (500, SandboxUnavailable, "busy"),
    (502, SandboxUnavailable, "busy"),
    (401, SandboxUnavailable, "not set up correctly"),
    (403, SandboxUnavailable, "not set up correctly"),
])
async def test_http_failures_become_friendly_errors(online, status, exc, text):
    online(lambda *a: httpx.Response(status, json={"message": "secret-host.internal key=abc"}))
    with pytest.raises(exc) as info:
        await execute_async("python", "x")
    assert text in str(info.value).lower()
    assert "secret-host" not in str(info.value) and "abc" not in str(info.value)  # provider body is never echoed


async def test_unreachable_and_slow_provider(online):
    def down(request):
        raise httpx.ConnectError("connection refused")

    online(lambda *a: None)
    online_compiler.make_client = lambda timeout: httpx.AsyncClient(transport=httpx.MockTransport(down), timeout=timeout)
    with pytest.raises(SandboxUnavailable, match="busy"):
        await execute_async("python", "x")

    def slow(request):
        raise httpx.ReadTimeout("read timed out")

    online_compiler.make_client = lambda timeout: httpx.AsyncClient(transport=httpx.MockTransport(slow), timeout=timeout)
    with pytest.raises(SandboxUnavailable, match="taking too long"):
        await execute_async("python", "x")


async def test_provider_internal_error_status_is_not_a_student_error(online):
    online(lambda *a: judge0(status=13, message="Internal Error"))
    with pytest.raises(SandboxUnavailable):
        await execute_async("python", "x")


async def test_request_timeout_is_fifteen_seconds_by_default():
    assert settings.CODE_REQUEST_TIMEOUT == 15


async def test_unsupported_language_is_reported_without_calling_the_provider(online):
    fake = online(lambda *a: judge0())
    assert (await execute_async("cobol", "x"))["status"] == "Unsupported Language"
    assert fake.requests == []


# ---- Piston adapter ----------------------------------------------------------------------------------------

async def test_piston_responses_are_mapped(online, monkeypatch):
    monkeypatch.setattr(settings, "CODE_PROVIDER", "piston")
    monkeypatch.setattr(settings, "CODE_API_URL", "https://piston.example.test/api/v2/piston")
    answers = {
        "ok": {"run": {"stdout": "hi\n", "stderr": "", "code": 0, "signal": None}},
        "compile": {"compile": {"code": 1, "output": "error: bad"}, "run": {"code": None}},
        "crash": {"run": {"stdout": "", "stderr": "boom", "code": 2, "signal": None}},
        "kill": {"run": {"stdout": "", "stderr": "", "code": None, "signal": "SIGKILL"}},
    }

    def handler(request):
        src = json.loads(request.content)["files"][0]["content"]
        return httpx.Response(200, json=answers[src])

    online(lambda *a: None)
    online_compiler.make_client = lambda timeout: httpx.AsyncClient(transport=httpx.MockTransport(handler), timeout=timeout)
    assert (await execute_async("cpp", "ok"))["stdout"] == "hi"
    assert (await execute_async("c", "compile"))["status"] == "Compile Error"
    assert (await execute_async("python", "crash"))["status"] == "Runtime Error"
    assert (await execute_async("python", "kill"))["status"] == "Time Limit Exceeded"


# ---- judging --------------------------------------------------------------------------------------------------

async def test_correct_submission_is_accepted_and_trailing_whitespace_is_ignored(online):
    online(lambda lid, src, stdin: judge0(stdout=f"{sum(int(x) for x in stdin.split())}  \n\n"))
    res = await run_tests_async("python", "sum", SUM_CASES)
    assert res["status"] == "Accepted" and res["passed_count"] == res["total_count"] == len(SUM_CASES)
    assert res["failed_case"] is None


async def test_wrong_answer_reports_the_failing_case_and_stops(online):
    fake = online(lambda lid, src, stdin: judge0(stdout="0\n"))  # always 0: right only for the (-5, 5) case
    res = await run_tests_async("python", "bad", SUM_CASES)
    assert res["status"] == "Wrong Answer" and res["failed_case"] == 1 and res["passed_count"] == 0
    assert len(fake.requests) == 1  # stopped at the first failure
    assert "test case 1" in res["message"]


async def test_hidden_case_failure_does_not_reveal_its_data(online):
    def respond(lid, src, stdin):
        a, b = (int(x) for x in stdin.split())
        return judge0(stdout=f"{a + b + (1 if a == -5 else 0)}\n")

    online(respond)
    res = await run_tests_async("python", "x", SUM_CASES)
    assert res["status"] == "Wrong Answer" and res["failed_case"] == 3
    hidden = res["test_results"][-1]
    assert hidden["is_hidden"] and hidden["input"] == "Hidden Test Case" and hidden["expected"] == "[Hidden Test Case]"


async def test_at_most_five_cases_are_judged(online):
    many = [{"input": f"{i} 1", "expected_output": str(i + 1), "is_hidden": False} for i in range(9)]
    fake = online(summing)
    res = await run_tests_async("python", "x", many)
    assert res["status"] == "Accepted" and res["total_count"] == 5 and len(fake.requests) == 5
    assert "first 5 of 9" in res["message"]


async def test_runtime_error_and_time_limit_name_the_failing_case(online):
    online(lambda lid, src, stdin: judge0(status=11, stderr="crash", exit_code=1) if stdin.startswith("10") else summing(lid, src, stdin))
    res = await run_tests_async("python", "x", SUM_CASES)
    assert res["status"] == "Runtime Error" and res["failed_case"] == 2 and res["passed_count"] == 1
    online(lambda *a: judge0(status=5))
    assert (await run_tests_async("python", "x", SUM_CASES))["status"] == "Time Limit Exceeded"


async def test_compile_error_is_a_compile_error_not_wrong_answer(online):
    online(lambda *a: judge0(status=6, compile_output="error: expected ';'"))
    res = await run_tests_async("c", "x", SUM_CASES)
    assert res["status"] == "Compile Error" and "expected" in res["message"]


async def test_provider_failure_while_judging_is_not_wrong_answer(online):
    state = {"n": 0}

    def respond(lid, src, stdin):
        state["n"] += 1
        return summing(lid, src, stdin) if state["n"] == 1 else httpx.Response(503)

    online(respond)
    res = await run_tests_async("python", "x", SUM_CASES)
    assert res["status"] == "Judge unavailable" and res["status"] != "Wrong Answer"
    assert "busy" in res["message"].lower() and res["failed_case"] is None


async def test_problem_without_cases_cannot_be_judged(online):
    online(summing)
    with pytest.raises(SandboxUnavailable, match="no test cases"):
        await run_tests_async("python", "x", [])


# ---- HTTP API in online mode ----------------------------------------------------------------------------------------

async def test_api_run_and_submit_use_the_provider_and_hide_it(client, student, db, online):
    await seed_collections(db)
    fake = online(summing)
    h = bearer(student["token"])

    run = await client.post("/api/practice/code/run", json={"language": "python", "source_code": "x", "stdin": "3 4"}, headers=h)
    assert run.status_code == 200 and run.json()["stdout"] == "7" and run.json()["status"] == "Success"
    assert "judge0" not in run.text.lower() and "ce.judge0.com" not in run.text

    ok = await client.post("/api/practice/code/submit", json={"language": "python", "source_code": "x", "problem_slug": "sum-two-numbers"}, headers=h)
    body = ok.json()
    assert ok.status_code == 200 and body["status"] == "Accepted" and body["failed_case"] is None and body["total_count"] == 5

    online(lambda *a: judge0(stdout="wrong\n"))
    bad = (await client.post("/api/practice/code/submit", json={"language": "python", "source_code": "x", "problem_slug": "sum-two-numbers"}, headers=h)).json()
    assert bad["status"] == "Wrong Answer" and bad["failed_case"] == 1
    assert len(fake.requests) >= 1


async def test_api_requires_login_and_reports_provider_trouble(client, student, db, online):
    body = {"language": "python", "source_code": "x"}
    online(lambda *a: httpx.Response(500))
    assert (await client.post("/api/practice/code/run", json=body)).status_code == 401  # nothing is sent without a login

    down = await client.post("/api/practice/code/run", json=body, headers=bearer(student["token"]))
    assert down.status_code == 503 and down.json()["detail"] == "Online compiler is busy, try again in a moment."

    online(lambda *a: httpx.Response(429))
    limited = await client.post("/api/practice/code/run", json=body, headers=bearer(student["token"]))
    assert limited.status_code == 429 and "busy" in limited.json()["detail"].lower()


async def test_api_keeps_the_size_limit_in_online_mode(client, student, online):
    fake = online(summing)
    big = "x = 1\n" * 4000
    r = await client.post("/api/practice/code/run", json={"language": "python", "source_code": big}, headers=bearer(student["token"]))
    assert r.status_code == 413 and fake.requests == []
