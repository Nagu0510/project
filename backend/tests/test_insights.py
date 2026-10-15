"""Company intelligence, topic frequencies and the student list are computed from stored data."""
import pytest

from app.seed import seed_collections
from tests.conftest import bearer


@pytest.fixture
async def seeded(db):
    await seed_collections(db)
    return db


async def test_nothing_published_means_empty_not_invented(client):
    assert (await client.get("/api/question-intelligence/companies")).json() == {}
    r = await client.get("/api/question-intelligence/company/tcs")
    assert r.status_code == 404  # no silent fallback to another company


async def test_company_stats_come_from_the_published_questions(client, seeded):
    companies = (await client.get("/api/question-intelligence/companies")).json()
    assert "tcs" in companies and companies["tcs"]["name"] == "TCS"
    tcs = companies["tcs"]
    total = await seeded["previous_questions"].count_documents({"companies": "TCS", "status": "published"})
    assert tcs["total_questions"] == total > 0
    assert sum(1 for _ in tcs["top_topics"]) >= 1 and all(0 < t["percentage"] <= 100 for t in tcs["top_topics"])
    assert all("TCS TCS" not in p and p.count("2025") <= 1 for p in tcs["exam_patterns"])
    assert (await client.get("/api/question-intelligence/company/TCS")).json()["total_questions"] == total
    assert (await client.get("/api/question-intelligence/company/not-a-company")).status_code == 404


async def test_unpublished_questions_do_not_count(client, seeded):
    await seeded["previous_questions"].update_many({}, {"$set": {"status": "needs_review"}})
    assert (await client.get("/api/question-intelligence/companies")).json() == {}


async def test_admin_analytics_has_real_topic_frequencies_and_students(client, admin, student, seeded):
    h = bearer(admin["token"])
    a = (await client.get("/api/admin/analytics", headers=h)).json()
    assert a["registered_students_count"] == 1
    topics = a["topic_frequencies"]
    assert topics and topics[0]["count"] >= topics[-1]["count"] and all(t["topic"] for t in topics)

    students = (await client.get("/api/admin/students", headers=h)).json()
    assert [s["email"] for s in students] == [student["email"]]
    assert students[0]["readiness_score"] == 0 and "password" not in students[0]
    assert (await client.get("/api/admin/students", headers=bearer(student["token"]))).status_code == 403
