import os

# Must be set before the app imports its settings.
os.environ["ENV"] = "test"
os.environ["JWT_SECRET_KEY"] = "test-secret-" + "x" * 40
os.environ["BCRYPT_ROUNDS"] = "4"
os.environ["ENABLE_DEMO_ACCOUNTS"] = "false"
os.environ["SANDBOX_MODE"] = "subprocess"  # tests never reach a real online compiler

import httpx
import pytest
from mongomock_motor import AsyncMongoMockClient

from app.database import create_indexes, db_manager
from app.main import app

PASSWORD = "Sup3rSecret1"


@pytest.fixture
async def db():
    client = AsyncMongoMockClient()
    db_manager.client = client
    db_manager.db = client["skillsense_test"]
    db_manager.is_connected = True
    await create_indexes()
    yield db_manager.db
    db_manager.db = None
    db_manager.is_connected = False


@pytest.fixture
async def client(db):
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


async def register(client, email="stu@example.com", name="Stu Dent", password=PASSWORD, **extra):
    return await client.post(
        "/api/auth/register", json={"name": name, "email": email, "password": password, **extra}
    )


def bearer(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
async def student(client):
    r = await register(client)
    assert r.status_code == 201, r.text
    return {"token": r.json()["access_token"], "user": r.json()["user"], "email": "stu@example.com"}


@pytest.fixture
async def admin(client, db):
    from app.services.auth_service import hash_password
    from app.utils.timeutil import utcnow

    await db["users"].insert_one({
        "id": "usr-admin-t", "name": "Admin", "email": "admin@example.com",
        "password": hash_password(PASSWORD), "role": "admin", "created_at": utcnow(),
    })
    r = await client.post("/api/auth/admin/login", json={"email": "admin@example.com", "password": PASSWORD})
    assert r.status_code == 200, r.text
    return {"token": r.json()["access_token"], "user": r.json()["user"]}


@pytest.fixture
def outbox(monkeypatch):
    """Turn email on and capture what would be sent over SMTP."""
    from app.services import email_service

    sent = []
    monkeypatch.setattr(email_service.settings, "EMAIL_ENABLED", True)
    monkeypatch.setattr(
        email_service, "_smtp_send",
        lambda to, subject, html, text: sent.append({"to": to, "subject": subject, "html": html, "text": text}),
    )
    return sent


def link_in(message) -> str:
    import re

    return re.search(r"https?://\S+", message["text"]).group(0)


def token_in(message) -> str:
    return link_in(message).split("token=")[1]


@pytest.fixture(autouse=True)
def _no_real_compiler_requests(monkeypatch):
    """Online-compiler tests must install a mock transport; anything else would call the internet."""
    from app.services import online_compiler

    def blocked(timeout):
        raise AssertionError("test tried to call the real online compiler; mock the provider")

    monkeypatch.setattr(online_compiler, "make_client", blocked)


async def start_session(client, token, assessment_id):
    """POST /assessments/{id}/start as this student; returns the response."""
    return await client.post(f"/api/assessments/{assessment_id}/start", headers=bearer(token))


async def take_assessment(client, token, assessment_id, answers=None, correct=False):
    """Start a session and submit it. `answers` is {question_id: option}; correct=True answers every question from the stored key."""
    from app.data.assessment_bank import ASSESSMENT_QUESTION_BANK

    started = (await start_session(client, token, assessment_id)).json()
    if correct:
        keys = {q["id"]: q["correct_option_index"] for q in ASSESSMENT_QUESTION_BANK}
        answers = {q["id"]: keys[q["id"]] for q in started["questions"]}
    r = await client.post(f"/api/assessments/{assessment_id}/submit", headers=bearer(token),
                          json={"session_id": started["session_id"], "answers": answers or {}})
    return started, r
