"""Assessment bank, assessment sets and career paths live in MongoDB; answer keys never leak."""
import json

import pytest

from app.data.assessment_bank import ASSESSMENT_QUESTION_BANK, ASSESSMENT_SETS
from app.data.career_config import CAREER_PATHS_CONFIG
from app.repositories import assessment_bank, assessment_sessions, career_paths, courses, notifications
from app.seed import seed_collections
from app.utils.timeutil import utcnow
from tests.conftest import bearer, take_assessment


@pytest.fixture
async def seeded(db):
    await seed_collections(db)
    return db


async def test_seed_loads_content_and_is_idempotent(db):
    first = await seed_collections(db)
    assert first["assessment_questions"]["inserted"] == len(ASSESSMENT_QUESTION_BANK)
    assert first["assessments"]["inserted"] == len(ASSESSMENT_SETS)
    assert first["career_paths"]["inserted"] == len(CAREER_PATHS_CONFIG)

    second = await seed_collections(db)
    assert second["assessment_questions"] == {"inserted": 0, "updated": len(ASSESSMENT_QUESTION_BANK), "skipped": 0}
    assert await db["assessment_questions"].count_documents({}) == len(ASSESSMENT_QUESTION_BANK)
    assert await db["career_paths"].count_documents({}) == len(CAREER_PATHS_CONFIG)


async def test_seed_never_overwrites_admin_edited_documents(seeded):
    await seeded["assessment_questions"].update_one(
        {"id": "py-easy-01"}, {"$set": {"question_text": "Edited by an admin", "edited_by_admin": True}}
    )
    await seeded["career_paths"].update_one({"id": "backend"}, {"$set": {"description": "Custom", "edited_by_admin": True}})
    report = await seed_collections(seeded)
    assert report["assessment_questions"]["skipped"] == 1 and report["career_paths"]["skipped"] == 1
    assert (await seeded["assessment_questions"].find_one({"id": "py-easy-01"}))["question_text"] == "Edited by an admin"
    assert (await seeded["career_paths"].find_one({"id": "backend"}))["description"] == "Custom"


async def test_answer_keys_never_leave_the_repository(seeded):
    sample = ASSESSMENT_QUESTION_BANK[0]
    pub = await assessment_bank.get_public_question(sample["id"])
    assert pub["correct_option_index"] is None and "explanation" not in pub
    for q in await assessment_bank.search_public_questions():
        assert q["correct_option_index"] is None and "explanation" not in q
    for q in await assessment_bank.public_questions_by_ids([sample["id"]]):
        assert q["correct_option_index"] is None and "explanation" not in q
    # only the scoring accessor returns the key
    keyed = (await assessment_bank.scoring_data([sample["id"]]))[sample["id"]]
    assert keyed["correct_option_index"] == sample["correct_option_index"]


async def test_no_endpoint_response_contains_an_answer_key(client, student, seeded):
    h = bearer(student["token"])
    answer_texts = {q["id"]: q["explanation"] for q in ASSESSMENT_QUESTION_BANK}
    bodies = [
        await client.get("/api/assessments/asm-py-med-1", headers=h),
        await client.get("/api/assessments/practice/questions", headers=h),
        await client.get("/api/practice/questions", headers=h),
        await client.get("/api/practice/questions/py-easy-01", headers=h),
        await client.post("/api/assessments/asm-py-med-1/start", headers=h),
    ]
    for r in bodies:
        assert r.status_code == 200, r.text
        text = r.text
        assert not any(expl in text for expl in answer_texts.values())  # explanations reveal answers
    for q in bodies[4].json()["questions"] + bodies[1].json():
        assert q["correct_option_index"] is None
    for q in bodies[2].json():
        assert q["correct_option_index"] is None
    assert json.loads(bodies[3].text)["correct_option_index"] is None


async def test_practice_answer_reveals_key_only_after_answering(client, student, seeded):
    h = bearer(student["token"])
    r = await client.post("/api/practice/questions/py-easy-01/answer", headers=h, json={"selected_option_index": 0})
    body = r.json()
    assert body["correct_option_index"] == 2 and body["is_correct"] is False and body["correct_answer"] == "Tuple"
    verify = await client.post("/api/assessments/practice/verify", headers=h, json={"question_id": "py-easy-01", "selected_option_index": 2})
    assert verify.json()["is_correct"] is True
    assert (await client.post("/api/assessments/practice/verify", headers=h, json={"question_id": "nope", "selected_option_index": 0})).status_code == 404


async def test_scoring_reads_keys_from_mongo(client, student, seeded):
    h = bearer(student["token"])
    _, r = await take_assessment(client, student["token"], "asm-py-med-1", correct=True)
    assert r.status_code == 200 and r.json()["overall_score"] == 100 and r.json()["skill_gaps"] == []
    # an unknown assessment is a 404, never a silent fallback to the first set
    assert (await client.get("/api/assessments/asm-does-not-exist", headers=h)).status_code == 404
    bad = await client.post("/api/assessments/asm-nope/submit", headers=h, json={"session_id": "ses-nope", "answers": {}})
    assert bad.status_code == 404
    assert (await client.post("/api/assessments/asm-nope/start", headers=h)).status_code == 404


async def test_catalog_and_career_paths_come_from_mongo(client, seeded):
    catalog = (await client.get("/api/assessments")).json()
    assert len(catalog) == len(ASSESSMENT_SETS)
    assert all(a["difficulty"] == "Medium" for a in (await client.get("/api/assessments", params={"difficulty": "Medium"})).json())
    paths = (await client.get("/api/career-paths")).json()
    assert [p["title"] for p in paths] == [c["title"] for c in CAREER_PATHS_CONFIG.values()]
    assert (await client.get("/api/career-paths/backend")).json()["title"] == "Backend Developer"
    assert (await client.get("/api/career-paths/unknown")).status_code == 404

    await seeded["career_paths"].delete_many({})  # content now really comes from the database
    assert (await client.get("/api/career-paths")).json() == []


async def test_indexes_exist(db):
    assert "session_id_1" in await db["assessment_sessions"].index_information()
    assert "slug_1" in await db["courses"].index_information()
    assert "slug_1" in await db["career_paths"].index_information()
    assert any("user_id" in k and "read" in k for k in await db["notifications"].index_information())
    assert any(info.get("unique") for info in (await db["assessment_questions"].index_information()).values())
    assert any(info.get("unique") for info in (await db["assessments"].index_information()).values())


async def test_session_repository_marks_submission_once(db):
    from datetime import timedelta

    await assessment_sessions.create({"session_id": "s1", "user_id": "u1", "expires_at": utcnow() + timedelta(minutes=5), "submitted_at": None})
    assert (await assessment_sessions.get("s1"))["user_id"] == "u1"
    assert await assessment_sessions.mark_submitted("s1", utcnow()) is True
    assert await assessment_sessions.mark_submitted("s1", utcnow()) is False  # second submit is refused
    assert await assessment_sessions.delete("s1") is True and await assessment_sessions.get("s1") is None


async def test_notification_and_course_repositories(db):
    await notifications.create({"id": "n1", "user_id": "u1", "title": "Hello"})
    await notifications.create({"id": "n2", "user_id": "u1", "title": "Again"})
    await notifications.create({"id": "n3", "user_id": "u2", "title": "Other user"})
    assert await notifications.unread_count("u1") == 2
    assert await notifications.mark_read("u1", "n1") is True
    assert await notifications.mark_read("u2", "n1") is False  # can't touch someone else's
    assert [n["id"] for n in await notifications.list_for_user("u1", unread_only=True)] == ["n2"]
    assert await notifications.mark_all_read("u1") == 1 and await notifications.unread_count("u1") == 0
    assert await notifications.delete("u1", "n2") is True

    await courses.create({"slug": "py-101", "title": "Python 101", "skills": ["Python"]})
    with pytest.raises(Exception):  # unique slug
        await courses.create({"slug": "py-101", "title": "Duplicate"})
    assert (await courses.get("py-101"))["title"] == "Python 101"
    assert await courses.update("py-101", {"title": "Python Basics"}) and [c["title"] for c in await courses.list_courses("Python")] == ["Python Basics"]
    assert await courses.delete("py-101") and await courses.get("py-101") is None
