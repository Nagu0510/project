"""Stage E: real notifications and no links to retired practice problems."""
import pytest

from app.data.coding_problems import EXPANDED_CODING_PROBLEMS, RETIRED_SLUG_REMAP
from app.data.previous_questions import INITIAL_PREVIOUS_QUESTIONS
from app.seed import seed_collections
from tests.conftest import bearer, register


@pytest.fixture
async def seeded(db):
    await seed_collections(db)
    return db


async def test_notifications_start_empty_and_need_login(client, student, seeded):
    h = bearer(student["token"])
    assert (await client.get("/api/notifications", headers=h)).json() == []  # nothing is made up
    assert (await client.get("/api/notifications")).status_code == 401
    assert (await client.post("/api/notifications/read-all")).status_code == 401


async def test_finishing_a_course_creates_one_notification_the_student_can_read(client, student, seeded):
    h = bearer(student["token"])
    modules = (await client.get("/api/courses/c-programming")).json()["modules"]
    for m in modules:
        await client.post("/api/courses/c-programming/progress", json={"module_id": m["id"]}, headers=h)
    items = (await client.get("/api/notifications", headers=h)).json()
    assert len(items) == 1
    n = items[0]
    assert n["type"] == "course_completed" and "C Programming" in n["title"] and n["link"] == "/courses/c-programming" and n["read"] is False

    # re-marking a module of a finished course does not announce it again
    await client.post("/api/courses/c-programming/progress", json={"module_id": modules[0]["id"]}, headers=h)
    assert len((await client.get("/api/notifications", headers=h)).json()) == 1

    assert (await client.post(f"/api/notifications/{n['id']}/read", headers=h)).status_code == 200
    assert (await client.get("/api/notifications", headers=h)).json()[0]["read"] is True
    assert (await client.post("/api/notifications/nope/read", headers=h)).status_code == 404


async def test_notifications_belong_to_one_student(client, student, seeded):
    h = bearer(student["token"])
    for m in (await client.get("/api/courses/c-programming")).json()["modules"]:
        await client.post("/api/courses/c-programming/progress", json={"module_id": m["id"]}, headers=h)
    other = await register(client, email="other@example.com")
    h2 = bearer(other.json()["access_token"])
    assert (await client.get("/api/notifications", headers=h2)).json() == []
    nid = (await client.get("/api/notifications", headers=h)).json()[0]["id"]
    assert (await client.post(f"/api/notifications/{nid}/read", headers=h2)).status_code == 404


def test_previous_question_seed_data_links_only_to_current_problems():
    current = {p["slug"] for p in EXPANDED_CODING_PROBLEMS}
    for q in INITIAL_PREVIOUS_QUESTIONS:
        assert q.get("problem_slug", "") in current | {""}, q["id"]
    assert set(RETIRED_SLUG_REMAP.values()) - {""} <= current


async def test_seed_relinks_stored_previous_questions_by_topic(db):
    await seed_collections(db)
    for i, old in enumerate(("two-sum", "valid-parentheses", "lru-cache")):
        await db["previous_questions"].insert_one({"id": f"old-{i}", "problem_slug": old, "question_text": "kept as is", "status": "published"})
    report = await seed_collections(db)
    assert report["previous_questions"]["relinked"] == 3
    slugs = {d["id"]: d["problem_slug"] for d in await db["previous_questions"].find({"id": {"$regex": "^old-"}}).to_list(10)}
    assert slugs == {"old-0": "pair-sum-exists", "old-1": "balanced-brackets", "old-2": ""}  # lru-cache has no close match: no link
    assert (await db["previous_questions"].find_one({"id": "old-0"}))["question_text"] == "kept as is"
    assert (await seed_collections(db))["previous_questions"]["relinked"] == 0  # idempotent
