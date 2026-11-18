import asyncio
import hashlib

from tests.conftest import PASSWORD, bearer, register, token_in


async def test_register_starts_at_zero_and_ignores_client_role(client):
    r = await register(client, role="admin", readiness_score=99, strong_skills=["Hacking"])
    assert r.status_code == 201
    user = r.json()["user"]
    assert user["role"] == "student"
    assert user["readiness_score"] == 0 and user["assessments_completed"] == 0
    assert user["strong_skills"] == [] and user["gap_skills"] == []
    assert "password" not in user
    assert client.cookies.get("skillsense_refresh")


async def test_weak_passwords_rejected(client):
    for bad in ["short1", "allletters", "12345678", "a1" * 40]:
        assert (await register(client, password=bad)).status_code == 422


async def test_duplicate_email_case_insensitive(client, student):
    assert (await register(client, email="STU@Example.com")).status_code == 400


async def test_login_generic_errors_and_role_separation(client, student, admin):
    bad_pw = await client.post("/api/auth/login", json={"email": student["email"], "password": "Wrong1234"})
    unknown = await client.post("/api/auth/login", json={"email": "nobody@example.com", "password": PASSWORD})
    assert bad_pw.status_code == unknown.status_code == 401
    assert bad_pw.json() == unknown.json()
    # admin credentials don't work on the student endpoint, student credentials not on admin endpoint
    assert (await client.post("/api/auth/login", json={"email": "admin@example.com", "password": PASSWORD})).status_code == 401
    assert (await client.post("/api/auth/admin/login", json={"email": student["email"], "password": PASSWORD})).status_code == 401


async def test_lockout_after_five_failures(client, student):
    for _ in range(5):
        r = await client.post("/api/auth/login", json={"email": student["email"], "password": "Wrong1234"})
        assert r.status_code == 401
    locked = await client.post("/api/auth/login", json={"email": student["email"], "password": PASSWORD})
    assert locked.status_code == 429 and "Retry-After" in locked.headers


async def test_me_requires_valid_token(client, student):
    assert (await client.get("/api/auth/me")).status_code == 401
    assert (await client.get("/api/auth/me", headers=bearer(student["token"]))).json()["email"] == student["email"]
    assert (await client.get("/api/auth/me", headers=bearer("junk"))).status_code == 401


async def test_refresh_cookie_flow_and_token_type_confusion(client, student):
    r = await client.post("/api/auth/refresh")
    assert r.status_code == 200 and r.json()["user"]["email"] == student["email"]
    # a refresh token must not work as an access token
    refresh_cookie = client.cookies.get("skillsense_refresh")
    assert (await client.get("/api/auth/me", headers=bearer(refresh_cookie))).status_code == 401
    client.cookies.clear()
    assert (await client.post("/api/auth/refresh")).status_code == 401


async def test_logout_revokes_both_tokens(client, student):
    r = await client.post("/api/auth/logout", headers=bearer(student["token"]))
    assert r.status_code == 200
    assert (await client.get("/api/auth/me", headers=bearer(student["token"]))).status_code == 401
    assert (await client.post("/api/auth/refresh")).status_code == 401


async def test_change_password_invalidates_old_sessions(client, student):
    await asyncio.sleep(1.1)  # tokens carry second-resolution iat; make "before the change" unambiguous
    new = "N3wSecret99"
    r = await client.post("/api/auth/change-password", headers=bearer(student["token"]),
                          json={"current_password": PASSWORD, "new_password": new})
    assert r.status_code == 200, r.text
    assert (await client.get("/api/auth/me", headers=bearer(student["token"]))).status_code == 401
    assert (await client.get("/api/auth/me", headers=bearer(r.json()["access_token"]))).status_code == 200
    assert (await client.post("/api/auth/login", json={"email": student["email"], "password": PASSWORD})).status_code == 401
    assert (await client.post("/api/auth/login", json={"email": student["email"], "password": new})).status_code == 200


async def test_change_password_wrong_current(client, student):
    r = await client.post("/api/auth/change-password", headers=bearer(student["token"]),
                          json={"current_password": "Nope12345", "new_password": "N3wSecret99"})
    assert r.status_code == 400


async def test_legacy_sha256_hash_is_upgraded_on_login(client, db):
    legacy = hashlib.sha256(("skillsense_ai_salt_2026_" + PASSWORD).encode()).hexdigest()
    await db["users"].insert_one({"id": "usr-old", "name": "Old User", "email": "old@example.com",
                                  "password": legacy, "role": "student"})
    r = await client.post("/api/auth/login", json={"email": "old@example.com", "password": PASSWORD})
    assert r.status_code == 200
    assert (await db["users"].find_one({"id": "usr-old"}))["password"].startswith("$2")
    assert (await client.post("/api/auth/login", json={"email": "old@example.com", "password": PASSWORD})).status_code == 200


async def test_password_reset_single_use_and_no_enumeration(client, student, db, outbox):
    outbox.clear()  # drop the signup verification email
    ok = await client.post("/api/auth/forgot-password", json={"email": student["email"]})
    unknown = await client.post("/api/auth/forgot-password", json={"email": "ghost@example.com"})
    assert ok.status_code == unknown.status_code == 200 and ok.json() == unknown.json()
    assert len(outbox) == 1 and outbox[0]["to"] == student["email"]  # nothing sent for the unknown address

    raw = token_in(outbox[0])
    stored = await db["password_resets"].find_one({})
    assert stored["token_hash"] == hashlib.sha256(raw.encode()).hexdigest() and raw not in str(stored)

    assert (await client.post("/api/auth/reset-password", json={"token": raw, "new_password": "weak"})).status_code == 422
    good = await client.post("/api/auth/reset-password", json={"token": raw, "new_password": "Br4ndNewPass"})
    assert good.status_code == 200
    assert (await client.post("/api/auth/reset-password", json={"token": raw, "new_password": "Another1Pass"})).status_code == 400
    assert (await client.post("/api/auth/login", json={"email": student["email"], "password": "Br4ndNewPass"})).status_code == 200


async def test_database_down_returns_503(client, db):
    from app.database import db_manager

    db_manager.is_connected = False
    r = await client.post("/api/auth/login", json={"email": "a@example.com", "password": PASSWORD})
    assert r.status_code == 503
