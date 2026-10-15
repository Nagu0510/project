"""Run code on an online compiler API, called from the backend only.

Providers (CODE_PROVIDER):
  judge0_ce         the free public Judge0 CE instance (no key)               default
  judge0_rapidapi   Judge0 CE on RapidAPI (needs CODE_API_KEY)
  judge0            your own Judge0 server (CODE_API_URL, optional CODE_API_KEY)
  piston            Piston (CODE_API_URL; the public emkc.org instance is whitelist-only since 2026-02-15)

Privacy: only the source code, the language and the stdin are sent to the provider. No user id, no email,
no environment variables, no callback URL. The provider URL and key never reach the browser.
"""
import asyncio
import base64
import logging
import time
from typing import Any, Dict, Optional
from urllib.parse import urlparse

import httpx

from app.config import settings
from app.services.sandbox_errors import SandboxRateLimited, SandboxUnavailable

logger = logging.getLogger("skillsense_online")

MAX_OUTPUT_BYTES = 64 * 1024
OUTPUT_TRUNCATED_NOTE = "\n[output truncated at 64 KB]"
BUSY_MESSAGE = "Online compiler is busy, try again in a moment."
RATE_LIMITED_MESSAGE = "Online compiler is busy (too many requests), try again in a moment."
SLOW_MESSAGE = "Online compiler is taking too long to respond, try again in a moment."
BAD_CONFIG_MESSAGE = "Online compiler is not set up correctly on the server (the provider rejected the request)."

DEFAULT_URLS = {
    "judge0_ce": "https://ce.judge0.com",
    "judge0_rapidapi": "https://judge0-ce.p.rapidapi.com",
    "piston": "https://emkc.org/api/v2/piston",
}

# Judge0 CE language ids (GET /languages)
JUDGE0_IDS = {"python": 100, "javascript": 97, "java": 91, "c": 103, "cpp": 105}
# Piston language names; version "*" picks the newest installed runtime
PISTON_NAMES = {"python": "python", "javascript": "javascript", "java": "java", "c": "c", "cpp": "c++"}
FILENAMES = {"python": "main.py", "javascript": "main.js", "java": "Main.java", "c": "main.c", "cpp": "main.cpp"}


def make_client(timeout: float) -> httpx.AsyncClient:
    """Indirection so tests can swap in a mock transport; production always uses the real network."""
    return httpx.AsyncClient(timeout=timeout, follow_redirects=False)


def _result(status: str, stdout: str = "", stderr: str = "", compile_output: str = "", exit_code: int = 0, runtime_ms: int = 0) -> Dict[str, Any]:
    return {
        "status": status,
        "stdout": stdout.strip(),
        "stderr": stderr.strip(),
        "compile_output": compile_output.strip(),
        "exit_code": exit_code,
        "runtime_ms": runtime_ms,
        "memory_kb": None,  # providers differ; never report a made-up number
    }


def _cap(text: Optional[str]) -> str:
    text = text or ""
    raw = text.encode("utf-8", errors="replace")
    if len(raw) <= MAX_OUTPUT_BYTES:
        return text
    return raw[:MAX_OUTPUT_BYTES].decode("utf-8", errors="ignore") + OUTPUT_TRUNCATED_NOTE


def _b64(text: str) -> str:
    return base64.b64encode(text.encode("utf-8")).decode("ascii")


def _unb64(value: Optional[str]) -> str:
    if not value:
        return ""
    try:
        return base64.b64decode(value).decode("utf-8", errors="replace")
    except (ValueError, TypeError):
        return value


def provider_name() -> str:
    return settings.CODE_PROVIDER


def _base_url() -> str:
    url = (settings.CODE_API_URL or DEFAULT_URLS.get(settings.CODE_PROVIDER) or "").rstrip("/")
    if not url:
        raise SandboxUnavailable("Online compiler is not configured on the server (CODE_API_URL is missing).")
    return url


def _headers() -> Dict[str, str]:
    key = settings.CODE_API_KEY.get_secret_value() if settings.CODE_API_KEY else ""
    if settings.CODE_PROVIDER == "judge0_rapidapi":
        host = urlparse(_base_url()).hostname or ""
        return {"X-RapidAPI-Key": key, "X-RapidAPI-Host": host}
    if settings.CODE_PROVIDER == "judge0" and key:
        return {"X-Auth-Token": key}
    if settings.CODE_PROVIDER == "piston" and key:
        return {"Authorization": key}
    return {}


def _check_http(resp: httpx.Response) -> None:
    """Turn provider HTTP failures into friendly errors. Never echoes the provider's body (it may name keys/hosts)."""
    code = resp.status_code
    if code < 400:
        return
    logger.warning("Online compiler HTTP %s from provider %s", code, settings.CODE_PROVIDER)
    if code == 429:
        raise SandboxRateLimited(RATE_LIMITED_MESSAGE)
    if code in (401, 403):
        raise SandboxUnavailable(BAD_CONFIG_MESSAGE)
    raise SandboxUnavailable(BUSY_MESSAGE)


# ---------------------------------------------------------------------------
# Judge0
# ---------------------------------------------------------------------------
# Judge0 status ids: 1 queued, 2 processing, 3 accepted (ran fine), 4 wrong answer (not used: no expected output
# is sent), 5 time limit, 6 compile error, 7-12 runtime errors (signals / non-zero exit), 13 internal error, 14 exec format
_JUDGE0_RUNTIME_ERRORS = {7, 8, 9, 10, 11, 12, 14}


def _map_judge0(data: Dict[str, Any]) -> Dict[str, Any]:
    status = (data.get("status") or {}).get("id")
    stdout = _cap(_unb64(data.get("stdout")))
    stderr = _cap(_unb64(data.get("stderr")))
    compile_output = _cap(_unb64(data.get("compile_output")))
    message = _unb64(data.get("message"))
    try:
        runtime_ms = int(float(data.get("time") or 0) * 1000)
    except (TypeError, ValueError):
        runtime_ms = 0
    exit_code = data.get("exit_code")
    exit_code = int(exit_code) if isinstance(exit_code, int) else 0

    if status == 3:
        return _result("Success", stdout, stderr, exit_code=0, runtime_ms=runtime_ms)
    if status == 5:
        return _result("Time Limit Exceeded", stdout, stderr or "Time limit exceeded.", exit_code=124, runtime_ms=runtime_ms)
    if status == 6:
        return _result("Compile Error", compile_output=compile_output or message or "Compilation failed.", exit_code=1)
    if status in _JUDGE0_RUNTIME_ERRORS:
        detail = stderr or message or (data.get("status") or {}).get("description", "Runtime error")
        return _result("Runtime Error", stdout, detail, exit_code=exit_code or 1, runtime_ms=runtime_ms)
    # 13 (internal error) or anything unexpected: the provider failed, the student's code did not
    logger.error("Judge0 returned unusable status %s", status)
    raise SandboxUnavailable(BUSY_MESSAGE)


async def _run_judge0(client: httpx.AsyncClient, language: str, source: str, stdin: str, deadline: float) -> Dict[str, Any]:
    base = _base_url()
    headers = _headers()
    payload = {
        "language_id": JUDGE0_IDS[language],
        "source_code": _b64(source),
        "stdin": _b64(stdin),
        "cpu_time_limit": 5,
        "wall_time_limit": 10,
    }
    params = {"base64_encoded": "true", "fields": "*"}

    resp = await client.post(f"{base}/submissions", params={**params, "wait": "true"}, json=payload, headers=headers)
    if resp.status_code == 400:  # instance disallows wait=true: submit, then poll
        resp = await client.post(f"{base}/submissions", params={**params, "wait": "false"}, json=payload, headers=headers)
    _check_http(resp)
    data = resp.json()

    token = data.get("token")
    while (data.get("status") or {}).get("id") in (None, 1, 2):
        if not token or time.monotonic() > deadline:
            raise SandboxUnavailable(SLOW_MESSAGE)
        await asyncio.sleep(0.6)
        poll = await client.get(f"{base}/submissions/{token}", params=params, headers=headers)
        _check_http(poll)
        data = poll.json()
    return _map_judge0(data)


# ---------------------------------------------------------------------------
# Piston
# ---------------------------------------------------------------------------
def _map_piston(data: Dict[str, Any]) -> Dict[str, Any]:
    compile_part = data.get("compile") or {}
    run = data.get("run") or {}
    if compile_part and compile_part.get("code") not in (0, None):
        return _result("Compile Error", compile_output=_cap(compile_part.get("output") or compile_part.get("stderr")), exit_code=compile_part.get("code") or 1)
    stdout, stderr = _cap(run.get("stdout")), _cap(run.get("stderr"))
    signal = run.get("signal")
    if signal == "SIGKILL":  # Piston kills a run that exceeds its time or memory limit
        return _result("Time Limit Exceeded", stdout, stderr or "Time or memory limit exceeded.", exit_code=124)
    code = run.get("code")
    if code not in (0, None) or signal:
        return _result("Runtime Error", stdout, stderr or f"Program exited with {signal or code}.", exit_code=code if isinstance(code, int) else 1)
    return _result("Success", stdout, stderr)


async def _run_piston(client: httpx.AsyncClient, language: str, source: str, stdin: str, deadline: float) -> Dict[str, Any]:
    payload = {
        "language": PISTON_NAMES[language],
        "version": "*",
        "files": [{"name": FILENAMES[language], "content": source}],
        "stdin": stdin,
        "compile_timeout": 10000,
        "run_timeout": 5000,
    }
    resp = await client.post(f"{_base_url()}/execute", json=payload, headers=_headers())
    _check_http(resp)
    return _map_piston(resp.json())


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
async def run_online(language: str, source: str, stdin: str = "") -> Dict[str, Any]:
    """Run one program on the configured provider. Raises SandboxUnavailable / SandboxRateLimited, never fakes success."""
    runner = _run_piston if settings.CODE_PROVIDER == "piston" else _run_judge0
    timeout = float(settings.CODE_REQUEST_TIMEOUT)
    deadline = time.monotonic() + timeout
    try:
        async with make_client(timeout) as client:
            return await asyncio.wait_for(runner(client, language, source, stdin, deadline), timeout=timeout)
    except (asyncio.TimeoutError, httpx.TimeoutException):
        logger.warning("Online compiler timed out after %ss (provider %s)", timeout, settings.CODE_PROVIDER)
        raise SandboxUnavailable(SLOW_MESSAGE)
    except (httpx.TransportError, ValueError) as exc:  # connection refused/reset, DNS, TLS, or a non-JSON body
        logger.warning("Online compiler unreachable (%s, provider %s)", type(exc).__name__, settings.CODE_PROVIDER)
        raise SandboxUnavailable(BUSY_MESSAGE)
