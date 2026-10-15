"""Regression: auth routes answer expected problems with a clean status and message, never a raw 500."""
import httpx
import pytest
from google.oauth2 import id_token

from app.config import settings
from app.database import db_manager
from app.main import app
from tests.conftest import PASSWORD, register


def _no_traceback(r):
    assert "Traceback" not in r.text and "File \"" not in r.text


async def test_register_status_codes(client):
    ok = await register(client, email="reg@example.com")
    assert ok.status_code == 201
    assert (await register(client, email="reg@example.com")).status_code == 400  # duplicate email
    assert (await register(client, email="weak@example.com", password="abc")).status_code == 422
    assert (await client.post("/api/auth/register", json={})).status_code == 422
    assert (await client.post("/api/auth/register")).status_code == 422  # no body at all


async def test_login_status_codes(client, student):
    wrong = await client.post("/api/auth/login", json={"email": student["email"], "password": "Wrong-pass-1"})
    assert wrong.status_code == 401 and wrong.json()["detail"] == "Invalid email or password"
    unknown = await client.post("/api/auth/login", json={"email": "nobody@example.com", "password": PASSWORD})
    assert unknown.status_code == 401 and unknown.json() == wrong.json()  # no account enumeration
    assert (await client.post("/api/auth/login", json={})).status_code == 422
    assert (await client.post("/api/auth/login")).status_code == 422
    assert (await client.post("/api/auth/login", json={"email": student["email"], "password": PASSWORD})).status_code == 200


async def test_admin_login_status_codes(client, student, admin):
    wrong = await client.post("/api/auth/admin/login", json={"email": "admin@example.com", "password": "Wrong-pass-1"})
    assert wrong.status_code == 401
    as_student = await client.post("/api/auth/admin/login", json={"email": student["email"], "password": PASSWORD})
    assert as_student.status_code in (401, 403)
    assert (await client.post("/api/auth/admin/login", json={})).status_code == 422


async def test_google_status_codes(client, monkeypatch):
    monkeypatch.setattr(settings, "GOOGLE_CLIENT_ID", None)
    assert (await client.post("/api/auth/google", json={"credential": "x" * 40})).status_code == 503  # not configured
    monkeypatch.setattr(settings, "GOOGLE_CLIENT_ID", "test-client.apps.googleusercontent.com")

    def bad_token(credential, request, audience=None):
        raise ValueError("Could not verify token signature.")

    monkeypatch.setattr(id_token, "verify_oauth2_token", bad_token)
    r = await client.post("/api/auth/google", json={"credential": "x" * 40})
    assert r.status_code == 401
    _no_traceback(r)
    assert (await client.post("/api/auth/google", json={})).status_code == 422


async def test_refresh_without_cookie_is_401(client):
    assert (await client.post("/api/auth/refresh")).status_code == 401


@pytest.mark.parametrize("path,body", [
    ("/api/auth/register", {"name": "A B", "email": "a@example.com", "password": PASSWORD}),
    ("/api/auth/login", {"email": "a@example.com", "password": PASSWORD}),
    ("/api/auth/admin/login", {"email": "a@example.com", "password": PASSWORD}),
    ("/api/auth/forgot-password", {"email": "a@example.com"}),
])
async def test_database_down_is_503_with_clear_message(client, db, path, body):
    db_manager.is_connected = False
    r = await client.post(path, json=body)
    assert r.status_code == 503
    assert "temporarily unavailable" in r.json()["detail"]
    _no_traceback(r)


async def test_unexpected_error_is_generic_500_and_logged(db, monkeypatch, caplog):
    """A bug must reach the client as a plain JSON message; the traceback stays in the server log."""
    async def boom(*args, **kwargs):
        raise RuntimeError("secret internal detail")

    monkeypatch.setattr("app.routers.auth._authenticate", boom)
    transport = httpx.ASGITransport(app=app, raise_app_exceptions=False)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
        r = await c.post("/api/auth/login", json={"email": "a@example.com", "password": PASSWORD})
    assert r.status_code == 500
    assert r.json() == {"detail": "Something went wrong on our side. Please try again."}
    assert "secret internal detail" not in r.text
    assert any("secret internal detail" in (rec.exc_text or "") or rec.exc_info for rec in caplog.records)


def test_startup_check_lines(monkeypatch):
    from app import startup_check

    assert startup_check.summarize([]).startswith("STARTUP CHECK OK")
    failed = startup_check.summarize(["MongoDB unreachable (ServerSelectionTimeoutError)"])
    assert failed.startswith("STARTUP CHECK FAILED") and "\n" not in failed
    monkeypatch.setattr(settings, "MONGODB_URL", "mongodb://localhost:27017")
    monkeypatch.setattr(settings, "ENV", "development")
    monkeypatch.setattr(settings, "ENABLE_MEMORY_FALLBACK", False)
    assert startup_check.env_problems(settings)  # default URL means "not set"
    assert startup_check.missing_modules() == []  # the test interpreter has every backend dependency
