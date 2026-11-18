"""`python -m app.create_admin --reset`: a forgotten admin password is replaced safely."""
import asyncio
from datetime import timedelta

import pytest

from app import create_admin
from app.utils.timeutil import utcnow
from tests.conftest import PASSWORD, bearer

NEW = "Br1ght!Lantern-42"  # strong: 17 characters, upper, lower, digit, symbol


@pytest.mark.parametrize("weak", [
    "Sh0rt!pw",                # under 12 characters
    "alllowercase1!x",         # no upper-case letter
    "ALLUPPERCASE1!X",         # no lower-case letter
    "NoDigitsHere!!x",         # no digit
    "NoSymbolsHere123",        # no symbol
    "Admin123!Admin",          # contains admin123
    "Password123!xyz",         # contains password
    "Skillsense#2026x",        # contains skillsense
    "A1!" + "b" * 80,          # longer than bcrypt's 72 bytes
])
def test_weak_passwords_are_rejected_without_echoing_them(weak):
    with pytest.raises(ValueError) as err:
        create_admin.check_admin_password(weak)
    assert weak not in str(err.value)


def test_a_strong_password_is_accepted():
    create_admin.check_admin_password(NEW)


async def test_reset_sets_the_new_password_clears_the_lockout_and_revokes_old_sessions(client, admin, db):
    # the admin is signed in (the fixture logged in: access token + refresh cookie) and is currently locked out
    old_access = admin["token"]
    assert (await client.get("/api/auth/me", headers=bearer(old_access))).status_code == 200
    await db["users"].update_one({"email": "admin@example.com"}, {"$set": {"failed_logins": 4, "locked_until": utcnow() + timedelta(minutes=30)}})
    locked = await client.post("/api/auth/admin/login", json={"email": "admin@example.com", "password": PASSWORD})
    assert locked.status_code == 429

    await asyncio.sleep(1.1)  # token times are whole seconds: make sure the reset is later than the old tokens
    done = await create_admin.reset_admin_account(db, "Admin@Example.com", NEW)
    assert done == "admin@example.com"

    stored = await db["users"].find_one({"email": "admin@example.com"})
    assert stored["role"] == "admin" and stored["failed_logins"] == 0 and stored["locked_until"] is None
    assert stored["password"] != NEW and stored["password"].startswith("$2")  # a bcrypt hash, never the password

    assert (await client.post("/api/auth/admin/login", json={"email": "admin@example.com", "password": PASSWORD})).status_code == 401  # the old one is gone
    fresh = await client.post("/api/auth/admin/login", json={"email": "admin@example.com", "password": NEW})
    assert fresh.status_code == 200 and fresh.json()["user"]["role"] == "admin"

    # every session from before the reset is dead: the old access token and the old refresh cookie
    assert (await client.get("/api/auth/me", headers=bearer(old_access))).status_code == 401
    assert (await client.get("/api/auth/me", headers=bearer(fresh.json()["access_token"]))).status_code == 200


async def test_the_old_refresh_cookie_stops_working(client, admin, db):
    stale_cookie = dict(client.cookies)
    assert stale_cookie, "the admin login should have set the refresh cookie"
    await asyncio.sleep(1.1)
    await create_admin.reset_admin_account(db, "admin@example.com", NEW)
    client.cookies.clear()
    for k, v in stale_cookie.items():
        client.cookies.set(k, v, path="/api/auth")
    assert (await client.post("/api/auth/refresh")).status_code == 401


async def test_reset_refuses_a_student_and_changes_nothing(client, student, db):
    before = (await db["users"].find_one({"email": student["email"]}))["password"]
    with pytest.raises(PermissionError):
        await create_admin.reset_admin_account(db, student["email"], NEW)
    after = await db["users"].find_one({"email": student["email"]})
    assert after["password"] == before and after["role"] == "student"
    assert (await client.post("/api/auth/login", json={"email": student["email"], "password": PASSWORD})).status_code == 200  # the old password still works


async def test_reset_creates_the_admin_when_the_email_is_new(client, db):
    assert await db["users"].find_one({"email": "newadmin@example.com"}) is None
    await create_admin.reset_admin_account(db, "newadmin@example.com", NEW)
    made = await db["users"].find_one({"email": "newadmin@example.com"})
    assert made["role"] == "admin"
    assert (await client.post("/api/auth/admin/login", json={"email": "newadmin@example.com", "password": NEW})).status_code == 200
    assert await db["users"].count_documents({"role": "admin"}) == 1  # only that one admin, nothing else touched


async def test_a_weak_password_changes_nothing(client, admin, db):
    before = (await db["users"].find_one({"email": "admin@example.com"}))["password"]
    with pytest.raises(ValueError):
        await create_admin.reset_admin_account(db, "admin@example.com", "admin123")
    assert (await db["users"].find_one({"email": "admin@example.com"}))["password"] == before


class _FakeClient:
    """Stands in for the Mongo client the command line creates, but points at the test database."""

    def __init__(self, db):
        self._db = db
        self.admin = self

    async def command(self, *_):
        return {"ok": 1}

    def __getitem__(self, _name):
        return self._db

    def close(self):
        pass


def _answers(monkeypatch, email, *passwords):
    monkeypatch.setattr("builtins.input", lambda _prompt="": email)
    given = iter(passwords)
    monkeypatch.setattr(create_admin.getpass, "getpass", lambda _prompt="": next(given))


async def test_the_command_prints_only_the_confirmation_and_never_the_password(client, admin, db, monkeypatch, capsys, caplog):
    monkeypatch.setattr(create_admin, "AsyncIOMotorClient", lambda *a, **k: _FakeClient(db))
    _answers(monkeypatch, "admin@example.com", NEW, NEW)
    with caplog.at_level("DEBUG"):
        await asyncio.to_thread(create_admin._run_reset)  # it calls asyncio.run, so it needs its own thread here
    out = capsys.readouterr()
    assert out.out == "Admin updated for admin@example.com\n" and out.err == ""
    assert NEW not in out.out + out.err + caplog.text
    assert (await client.post("/api/auth/admin/login", json={"email": "admin@example.com", "password": NEW})).status_code == 200


async def test_the_command_refuses_mismatched_and_weak_passwords_and_students(client, admin, student, db, monkeypatch, capsys):
    monkeypatch.setattr(create_admin, "AsyncIOMotorClient", lambda *a, **k: _FakeClient(db))
    before = (await db["users"].find_one({"email": "admin@example.com"}))["password"]

    _answers(monkeypatch, "admin@example.com", NEW, NEW + "x")
    with pytest.raises(SystemExit) as mismatch:
        create_admin._run_reset()
    assert "do not match" in str(mismatch.value) and NEW not in str(mismatch.value)

    _answers(monkeypatch, "admin@example.com", "admin123", "admin123")
    with pytest.raises(SystemExit) as weak:
        await asyncio.to_thread(create_admin._run_reset)
    assert "too weak" in str(weak.value)

    _answers(monkeypatch, student["email"], NEW, NEW)
    with pytest.raises(SystemExit) as refused:
        await asyncio.to_thread(create_admin._run_reset)
    assert "not an administrator" in str(refused.value)

    assert (await db["users"].find_one({"email": "admin@example.com"}))["password"] == before
    assert "Admin updated" not in capsys.readouterr().out
