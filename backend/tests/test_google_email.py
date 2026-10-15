import hashlib
import logging

import pytest
from google.oauth2 import id_token

from app.config import settings
from app.services import email_service
from app.utils.timeutil import utcnow
from tests.conftest import PASSWORD, bearer, link_in, register, token_in

GOOGLE_CLIENT = "test-client.apps.googleusercontent.com"


@pytest.fixture
def google(monkeypatch):
    """Fake Google verification that still enforces what the real library enforces: the audience."""
    monkeypatch.setattr(settings, "GOOGLE_CLIENT_ID", GOOGLE_CLIENT)
    issued = {}

    def fake_verify(credential, request, audience=None):
        claims = issued.get(credential)
        if claims is None:
            raise ValueError("Could not verify token signature.")
        if claims["aud"] != audience:
            raise ValueError("Token has wrong audience")
        return claims

    monkeypatch.setattr(id_token, "verify_oauth2_token", fake_verify)

    def make(sub="g-100", email="gstu@example.com", verified=True, aud=GOOGLE_CLIENT, name="Gina Student"):
        credential = f"google-credential-{len(issued)}-" + "x" * 24
        issued[credential] = {
            "sub": sub, "email": email, "email_verified": verified, "aud": aud,
            "name": name, "picture": "https://lh3.googleusercontent.com/a/photo",
        }
        return credential

    return make


async def google_login(client, credential):
    return await client.post("/api/auth/google", json={"credential": credential})


# ---- Google sign-in ---------------------------------------------------------

async def test_google_creates_student_with_zero_progress(client, db, google, outbox):
    r = await google_login(client, google())
    assert r.status_code == 200, r.text
    user = r.json()["user"]
    assert user["role"] == "student" and user["email"] == "gstu@example.com"
    assert user["auth_provider"] == "google" and user["email_verified"] is True and user["has_password"] is False
    assert user["picture"].startswith("https://")
    assert user["readiness_score"] == 0 and user["assessments_completed"] == 0
    assert user["strong_skills"] == [] and user["gap_skills"] == []
    stored = await db["users"].find_one({"email": "gstu@example.com"})
    assert stored["password"] is None and stored["google_sub"] == "g-100"
    assert client.cookies.get("skillsense_refresh")
    assert [m["subject"] for m in outbox] == ["Welcome to SkillSense AI"]
    # same Google account again: signs in, doesn't create a second user
    assert (await google_login(client, google())).status_code == 200
    assert await db["users"].count_documents({"email": "gstu@example.com"}) == 1


async def test_google_wrong_audience_rejected(client, google):
    r = await google_login(client, google(aud="someone-elses-client-id"))
    assert r.status_code == 401
    assert (await google_login(client, "not-a-real-credential-" + "x" * 20)).status_code == 401


async def test_google_unverified_email_rejected(client, db, google):
    r = await google_login(client, google(verified=False))
    assert r.status_code == 401
    assert await db["users"].count_documents({}) == 0


async def test_google_cannot_sign_into_admin(client, admin, google, db):
    r = await google_login(client, google(sub="g-admin", email="admin@example.com"))
    assert r.status_code == 403
    assert "google_sub" not in (await db["users"].find_one({"id": "usr-admin-t"}))  # nothing was linked


async def test_google_links_existing_password_account(client, student, db, google):
    r = await google_login(client, google(sub="g-777", email=student["email"].upper()))
    assert r.status_code == 200
    user = r.json()["user"]
    assert user["id"] == student["user"]["id"]  # same account, not a duplicate
    assert user["auth_provider"] == "both" and user["email_verified"] is True and user["has_password"] is True
    assert (await db["users"].find_one({"id": user["id"]}))["google_sub"] == "g-777"
    assert (await client.post("/api/auth/login", json={"email": student["email"], "password": PASSWORD})).status_code == 200
    # a different Google account claiming the same email is refused
    assert (await google_login(client, google(sub="g-other", email=student["email"]))).status_code == 403


async def test_google_respects_lockout(client, student, db, google):
    from datetime import timedelta

    await db["users"].update_one({"email": student["email"]}, {"$set": {"locked_until": utcnow() + timedelta(minutes=10)}})
    r = await google_login(client, google(email=student["email"]))
    assert r.status_code == 429


async def test_google_not_configured(client, monkeypatch):
    monkeypatch.setattr(settings, "GOOGLE_CLIENT_ID", None)
    assert (await google_login(client, "x" * 30)).status_code == 503


async def test_google_only_account_has_no_password_login_and_can_set_one(client, google):
    token = (await google_login(client, google())).json()["access_token"]
    h = bearer(token)
    generic = await client.post("/api/auth/login", json={"email": "gstu@example.com", "password": PASSWORD})
    unknown = await client.post("/api/auth/login", json={"email": "nobody@example.com", "password": PASSWORD})
    assert generic.status_code == 401 and generic.json() == unknown.json()

    weak = await client.post("/api/auth/change-password", headers=h, json={"new_password": "short"})
    assert weak.status_code == 422
    ok = await client.post("/api/auth/change-password", headers=h, json={"new_password": "Fresh1Password"})
    assert ok.status_code == 200
    me = (await client.get("/api/auth/me", headers=bearer(ok.json()["access_token"]))).json()
    assert me["has_password"] is True and me["auth_provider"] == "both"
    assert (await client.post("/api/auth/login", json={"email": "gstu@example.com", "password": "Fresh1Password"})).status_code == 200


async def test_password_account_still_needs_current_password(client, student):
    r = await client.post("/api/auth/change-password", headers=bearer(student["token"]), json={"new_password": "N3wSecret99"})
    assert r.status_code == 400


# ---- email service ----------------------------------------------------------

async def test_email_disabled_does_nothing_but_log(monkeypatch, caplog):
    calls = []
    monkeypatch.setattr(email_service, "_smtp_send", lambda *a: calls.append(a))
    caplog.set_level(logging.INFO)
    assert settings.EMAIL_ENABLED is False
    assert await email_service.send_email("a@example.com", "welcome", name="A", link="http://x") is False
    assert calls == [] and "welcome" in caplog.text


async def test_email_disabled_prints_link_in_development_only(monkeypatch, capsys):
    monkeypatch.setattr(settings, "ENV", "development")
    await email_service.send_email("a@example.com", "reset_password", name="A", link="http://app/reset?token=abc")
    assert "http://app/reset?token=abc" in capsys.readouterr().out
    monkeypatch.setattr(settings, "ENV", "production")
    await email_service.send_email("a@example.com", "reset_password", name="A", link="http://app/reset?token=abc")
    assert capsys.readouterr().out == ""


async def test_email_failure_is_logged_without_secrets(monkeypatch, caplog):
    from pydantic import SecretStr

    monkeypatch.setattr(settings, "EMAIL_ENABLED", True)
    monkeypatch.setattr(settings, "SMTP_APP_PASSWORD", SecretStr("super-secret-app-password"))

    def boom(*args):
        raise ConnectionRefusedError("login with super-secret-app-password failed")

    monkeypatch.setattr(email_service, "_smtp_send", boom)
    assert await email_service.send_email("a@example.com", "welcome", name="A", link="http://x") is False
    assert "ConnectionRefusedError" in caplog.text and "super-secret-app-password" not in caplog.text


async def test_email_templates_are_self_contained_and_escaped():
    subject, html_body, text = email_service.render(
        "verify_email", name="<script>alert(1)</script>", link="https://app.example/verify?token=a&b=2", expires="24 hours"
    )
    assert "<script>" not in html_body and "&lt;script&gt;" in html_body
    assert "<img" not in html_body and "src=" not in html_body  # nothing is fetched from the internet
    assert 'name="viewport"' in html_body and "max-width: 600px" in html_body
    assert "https://app.example/verify?token=a&b=2" in text and subject.startswith("Confirm")
    for kind in ("welcome", "reset_password"):
        assert email_service.render(kind, name="N", link="http://x", expires="1h")[1].startswith("<!doctype html>")


async def test_email_sent_through_smtp_when_enabled(outbox):
    assert await email_service.send_email("a@example.com", "welcome", name="Asha", link="http://x") is True
    assert outbox[0]["to"] == "a@example.com" and "Asha" in outbox[0]["html"]


# ---- email verification -----------------------------------------------------

async def test_register_sends_verification_and_link_verifies_once(client, db, outbox):
    r = await register(client)
    assert r.status_code == 201 and r.json()["user"]["email_verified"] is False
    assert [m["subject"] for m in outbox] == ["Confirm your email for SkillSense AI"]
    raw = token_in(outbox[0])
    assert "/verify-email?token=" in link_in(outbox[0])
    stored = await db["email_verifications"].find_one({})
    assert stored["token_hash"] == hashlib.sha256(raw.encode()).hexdigest() and raw not in str(stored)

    ok = await client.get("/api/auth/verify-email", params={"token": raw})
    assert ok.status_code == 200
    assert (await db["users"].find_one({"email": "stu@example.com"}))["email_verified"] is True
    assert outbox[-1]["subject"] == "Welcome to SkillSense AI"
    assert (await client.get("/api/auth/verify-email", params={"token": raw})).status_code == 400  # single use


async def test_verification_token_expires_after_24_hours(client, student, db):
    from datetime import timedelta

    record = await db["email_verifications"].find_one({})
    assert timedelta(hours=23) < record["expires_at"] - utcnow() <= timedelta(hours=24)

    raw = "expired-token-" + "y" * 30
    await db["email_verifications"].insert_one({
        "user_id": student["user"]["id"], "token_hash": hashlib.sha256(raw.encode()).hexdigest(),
        "expires_at": utcnow() - timedelta(seconds=1),
    })
    r = await client.get("/api/auth/verify-email", params={"token": raw})
    assert r.status_code == 400
    assert (await db["users"].find_one({"email": student["email"]}))["email_verified"] is False


async def test_send_verification_resends_then_reports_verified(client, student, outbox, db):
    h = bearer(student["token"])
    assert (await client.post("/api/auth/send-verification")).status_code == 401
    assert (await client.post("/api/auth/send-verification", headers=h)).status_code == 200
    assert len(outbox) == 1 and await db["email_verifications"].count_documents({}) == 1  # old token replaced
    assert (await client.get("/api/auth/verify-email", params={"token": token_in(outbox[0])})).status_code == 200
    again = await client.post("/api/auth/send-verification", headers=h)
    assert "already verified" in again.json()["message"] and len(outbox) == 2  # only the welcome mail was added


async def test_unverified_users_get_no_placement_emails(student, db):
    unverified = await db["users"].find_one({"email": student["email"]})
    assert email_service.may_send_placement_email(unverified) is False
    assert email_service.may_send_placement_email({**unverified, "email_verified": True}) is False  # verified but not opted in (default off)
    assert email_service.may_send_placement_email({**unverified, "email_verified": True, "email_notifications": True}) is True
    assert email_service.may_send_placement_email({**unverified, "email_notifications": True}) is False
