"""Online compiler runner. The provider is always mocked (conftest blocks real network calls)."""
import base64
import json
import pathlib
import re

import httpx
import pytest
from pydantic import SecretStr

from app.config import settings
from app.seed import seed_collections
from app.services import online_compiler
from app.services.code_execution_service import execute_async, execute_program
from app.services.sandbox_errors import SandboxRateLimited, SandboxUnavailable
from tests.conftest import bearer

LANG_IDS = {"python": 100, "javascript": 97, "java": 91, "c": 103, "cpp": 105}


def b64(text):
    return base64.b64encode(text.encode()).decode()


def judge0(stdout="", stderr="", compile_output="", status=3, time="0.012", exit_code=0, message=None, memory=None):
    """A finished Judge0 submission, encoded the way base64_encoded=true returns it."""
    return {
        "stdout": b64(stdout) if stdout else None, "stderr": b64(stderr) if stderr else None,
        "compile_output": b64(compile_output) if compile_output else None,
        "message": b64(message) if message else None, "time": time, "exit_code": exit_code,
        "status": {"id": status, "description": "x"}, "token": "tok-1", **({"memory": memory} if memory else {}),
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


# ---- measurements and flags the function judge needs ------------------------------------------------------------------

async def test_memory_and_truncation_come_from_the_provider(online):
    online(lambda *a: judge0(stdout="hi\n", memory=2048))
    res = await execute_async("python", "x")
    assert res["memory_kb"] == 2048 and res["truncated"] is False
    online(lambda *a: judge0(stdout="hi\n"))
    assert (await execute_async("python", "x"))["memory_kb"] is None  # not reported = not invented
    online(lambda *a: judge0(stdout="A" * 300_000))
    assert (await execute_async("python", "x"))["truncated"] is True


async def test_the_function_judge_asks_for_its_own_time_limits(online):
    fake = online(lambda *a: judge0(stdout="x\n"))
    await execute_program("python", "x", "in", cpu_seconds=10, wall_seconds=15)
    body = fake.requests[0]["body"]
    assert body["cpu_time_limit"] == 10 and body["wall_time_limit"] == 15
    await execute_async("python", "x", "in")
    assert fake.requests[1]["body"]["cpu_time_limit"] == 5  # everything else keeps the old defaults


# ---- HTTP API in online mode ----------------------------------------------------------------------------------------

def sum_driver(language_id, source, stdin):
    """What the real driver would print for add_numbers: one flushed result line per case."""
    lines = stdin.split("\n")
    nonce, count = lines[0], int(lines[1])
    out = ""
    for i in range(count):
        a, b = json.loads(lines[3 + i])
        out += "\n@@%s@@%s\n" % (nonce, json.dumps({"i": i, "ok": True, "result": a + b, "ms": 2}))
    return judge0(stdout=out, memory=4096)


SUM_BODY = {"language": "python", "source_code": "class Solution:\n    pass\n", "problem_slug": "sum-two-numbers"}


async def test_api_run_and_submit_use_the_provider_and_hide_it(client, student, db, online):
    await seed_collections(db)
    fake = online(sum_driver)
    h = bearer(student["token"])

    run = await client.post("/api/practice/code/run", json=SUM_BODY, headers=h)
    body = run.json()
    assert run.status_code == 200 and body["status"] == "Accepted" and len(body["cases"]) == 3 and all(c["passed"] for c in body["cases"])
    assert body["memory_kb"] == 4096 and len(fake.requests) == 1  # all cases in ONE provider call
    assert "judge0" not in run.text.lower() and "ce.judge0.com" not in run.text

    ok = await client.post("/api/practice/code/submit", json=SUM_BODY, headers=h)
    sub = ok.json()
    assert ok.status_code == 200 and sub["status"] == "Accepted" and sub["failed_case"] is None and sub["total_count"] == len(fake.requests[1]["body"]["stdin"] and base64.b64decode(fake.requests[1]["body"]["stdin"]).decode().split("\n")) - 4
    assert len(fake.requests) == 2 and sub["memory_kb"] == 4096 and fake.requests[1]["body"]["cpu_time_limit"] == 10

    def wrong(language_id, source, stdin):
        nonce = stdin.split("\n")[0]
        return judge0(stdout="".join("\n@@%s@@%s\n" % (nonce, json.dumps({"i": i, "ok": True, "result": 0, "ms": 1})) for i in range(int(stdin.split("\n")[1]))))

    online(wrong)
    bad = (await client.post("/api/practice/code/submit", json=SUM_BODY, headers=h)).json()
    assert bad["status"] == "Wrong Answer" and bad["failed_case"] == 1 and bad["failed_detail"]["expected"] == "7"


async def test_api_requires_login_and_reports_provider_trouble(client, student, db, online):
    await seed_collections(db)
    online(lambda *a: httpx.Response(500))
    assert (await client.post("/api/practice/code/run", json=SUM_BODY)).status_code == 401  # nothing is sent without a login

    down = await client.post("/api/practice/code/run", json=SUM_BODY, headers=bearer(student["token"]))
    assert down.status_code == 503 and down.json()["detail"] == "Online compiler is busy, try again in a moment."
    sub = (await client.post("/api/practice/code/submit", json=SUM_BODY, headers=bearer(student["token"]))).json()
    assert sub["status"] == "Judge unavailable" and "busy" in sub["message"].lower()

    online(lambda *a: httpx.Response(429))
    limited = await client.post("/api/practice/code/run", json=SUM_BODY, headers=bearer(student["token"]))
    assert limited.status_code == 429 and "busy" in limited.json()["detail"].lower()


async def test_api_keeps_the_size_limit_in_online_mode(client, student, db, online):
    await seed_collections(db)
    fake = online(sum_driver)
    big = "x = 1\n" * 4000
    r = await client.post("/api/practice/code/run", json={**SUM_BODY, "source_code": big}, headers=bearer(student["token"]))
    assert r.status_code == 413 and fake.requests == []
