"""Courses, progress and recommendations (stages A and B)."""
import re

import pytest

from app.data.courses import COURSES
from app.data.skills import SKILLS_BY_NAME
from app.seed import seed_collections
from app.services import recommendation_service as recs
from tests.conftest import bearer, register


@pytest.fixture
async def seeded(db):
    await seed_collections(db)
    return db


async def set_path(db, path):
    await db["users"].update_one({"email": "stu@example.com"}, {"$set": {"current_path": path}})


async def recommended(client, student):
    r = await client.get("/api/recommendations/courses", headers=bearer(student["token"]))
    assert r.status_code == 200, r.text
    return r.json()


# --------------------------------------------------------------------------- catalog data
def test_catalog_matches_the_brief():
    titles = {c["title"] for c in COURSES}
    for wanted in ("C Programming", "C++ and Object-Oriented Programming", "Python Programming", "Java Programming", "JavaScript Essentials",
                   "Data Structures and Algorithms", "SQL and DBMS", "Machine Learning", "Deep Learning and AI", "Placement Aptitude",
                   "Data Science with Python (NumPy, Pandas)", "Git, Docker and Cloud Basics", "Web Development (HTML, CSS, React)"):
        assert wanted in titles, wanted
    assert len(COURSES) == 13


@pytest.mark.parametrize("course", COURSES, ids=[c["slug"] for c in COURSES])
def test_every_course_is_complete_and_honest(course):
    assert 6 <= len(course["modules"]) <= 10
    assert all(m["topics"] and m["hours"] > 0 and m["id"].startswith(course["slug"]) for m in course["modules"])
    assert len({m["id"] for m in course["modules"]}) == len(course["modules"])
    assert course["estimated_hours"] == sum(m["hours"] for m in course["modules"])
    assert course["outcomes"] and course["practice_topics"] and course["level"] in ("Beginner", "Intermediate", "Advanced")
    assert all(s in SKILLS_BY_NAME for s in course["skills"]), "skills must be canonical names from skills.py"
    assert 2 <= len(course["resources"]) <= 3
    for r in course["resources"]:  # provider name + home page only: no invented deep links
        assert re.fullmatch(r"https://[^/\s]+/?", r["url"]), r
    assert all(p in {c["slug"] for c in COURSES} for p in course["prerequisites"])


# --------------------------------------------------------------------------- API
async def test_seed_is_idempotent_and_keeps_admin_edits(db):
    first = await seed_collections(db)
    assert first["courses"]["inserted"] == 13
    assert (await seed_collections(db))["courses"]["inserted"] == 0
    await db["courses"].update_one({"slug": "dsa"}, {"$set": {"title": "My DSA", "edited_by_admin": True}})
    assert (await seed_collections(db))["courses"]["skipped"] == 1
    assert (await db["courses"].find_one({"slug": "dsa"}))["title"] == "My DSA"


async def test_course_list_filters_and_detail(client, seeded):
    allc = (await client.get("/api/courses")).json()
    assert [c["slug"] for c in allc][:2] == ["c-programming", "cpp-oop"]  # catalog order
    assert all(c["modules_count"] >= 6 for c in allc)
    python = (await client.get("/api/courses", params={"skill": "python"})).json()
    assert [c["slug"] for c in python] == ["python-programming"]
    begin = (await client.get("/api/courses", params={"level": "Beginner"})).json()
    assert begin and {c["level"] for c in begin} == {"Beginner"}
    detail = (await client.get("/api/courses/machine-learning")).json()
    assert len(detail["modules"]) == 9 and detail["resources"] and detail["outcomes"] and detail["prerequisites"] == ["python-programming"]
    assert (await client.get("/api/courses/nope")).status_code == 404


async def test_progress_is_per_student_and_completes(client, student, seeded):
    h = bearer(student["token"])
    modules = [m["id"] for m in (await client.get("/api/courses/c-programming")).json()["modules"]]
    assert (await client.post("/api/courses/c-programming/progress", json={"module_id": modules[0]})).status_code == 401
    assert (await client.post("/api/courses/c-programming/progress", json={"module_id": "bogus"}, headers=h)).status_code == 404
    assert (await client.post("/api/courses/nope/progress", json={"module_id": "x"}, headers=h)).status_code == 404

    one = (await client.post("/api/courses/c-programming/progress", json={"module_id": modules[0]}, headers=h)).json()
    assert one["modules_done"] == [modules[0]] and one["percent"] == int(100 / len(modules)) and one["completed"] is False
    again = (await client.post("/api/courses/c-programming/progress", json={"module_id": modules[0]}, headers=h)).json()
    assert again["modules_done"] == [modules[0]]  # marking twice does not duplicate
    undone = (await client.post("/api/courses/c-programming/progress", json={"module_id": modules[0], "done": False}, headers=h)).json()
    assert undone["modules_done"] == [] and undone["percent"] == 0

    for m in modules:
        last = (await client.post("/api/courses/c-programming/progress", json={"module_id": m}, headers=h)).json()
    assert last["completed"] is True and last["percent"] == 100

    mine = (await client.get("/api/student/courses", headers=h)).json()
    assert [c["course_slug"] for c in mine] == ["c-programming"] and mine[0]["completed"] is True and mine[0]["title"] == "C Programming"

    other = await register(client, email="other@example.com")
    assert (await client.get("/api/student/courses", headers=bearer(other.json()["access_token"]))).json() == []  # not shared
    assert (await client.get("/api/student/courses")).status_code == 401


# --------------------------------------------------------------------------- recommendations
async def test_no_data_means_beginner_courses_with_start_here(client, student, seeded):
    body = await recommended(client, student)
    assert body["has_data"] is False and len(body["courses"]) == 5
    assert all(c["level"] == "Beginner" and c["reason"] == "Start here" for c in body["courses"])
    assert len(body["plan"]["weeks"]) == 4 and body["plan"]["weeks"][0]["modules"]


async def test_career_path_drives_the_recommendations(client, student, seeded):
    await set_path(seeded, "Backend Developer")
    body = await recommended(client, student)
    by_slug = {c["slug"]: c for c in body["courses"]}
    assert body["has_data"] and len(body["courses"]) == 5
    assert "sql-dbms" in by_slug and "Databases" in by_slug["sql-dbms"]["reason"]
    assert "dsa" in by_slug and "Data Structures" in by_slug["dsa"]["reason"]
    assert "git-docker-cloud" in by_slug  # Deployment and Git/GitHub
    assert body["courses"][0]["score"] >= body["courses"][-1]["score"]


async def test_recommendations_change_when_a_gap_changes(client, student, seeded):
    await set_path(seeded, "Backend Developer")
    before = {c["slug"]: c for c in (await recommended(client, student))["courses"]}
    assert "Databases" in before["sql-dbms"]["reason"]

    # a resume that shows SQL, MongoDB and Git closes the database gap
    text = "Rahul\nSKILLS\nPython, SQL, MongoDB, PostgreSQL, Git, Docker, AWS\nPROJECTS\n- Built an API with SQL and Docker for 20 users"
    r = await client.post("/api/resume/analyze-text", json={"text": text, "career_path": "backend"}, headers=bearer(student["token"]))
    assert r.status_code == 200
    after = {c["slug"]: c for c in (await recommended(client, student))["courses"]}
    assert "Databases" not in after.get("sql-dbms", {"reason": ""})["reason"]
    assert "Deployment" not in after.get("git-docker-cloud", {"reason": ""})["reason"]
    assert after["dsa"]["score"] >= 3  # a gap that is still open stays

    # a weak assessment topic adds a signal for its course
    await seeded["assessment_attempts"].insert_one({
        "user_id": student["user"]["id"], "assessment_id": "asm-c-easy", "overall_score": 20, "skill_gaps": ["C"],
        "topic_scores": [{"topic": "Pointers", "score": 20, "total": 2}], "submitted_at": __import__("datetime").datetime.now(),
    })
    assessed = {c["slug"]: c for c in (await recommended(client, student))["courses"]}
    assert "c-programming" in assessed and "assessment" in assessed["c-programming"]["reason"].lower()


async def test_completed_courses_disappear(client, student, seeded):
    await set_path(seeded, "Backend Developer")
    h = bearer(student["token"])
    assert "dsa" in {c["slug"] for c in (await recommended(client, student))["courses"]}
    for m in (await client.get("/api/courses/dsa")).json()["modules"]:
        await client.post("/api/courses/dsa/progress", json={"module_id": m["id"]}, headers=h)
    body = await recommended(client, student)
    assert "dsa" not in {c["slug"] for c in body["courses"]}
    assert all(m["course_slug"] != "dsa" for w in body["plan"]["weeks"] for m in w["modules"])


async def test_started_course_continues_and_plan_skips_done_modules(client, student, seeded):
    await set_path(seeded, "Backend Developer")
    h = bearer(student["token"])
    first = (await client.get("/api/courses/sql-dbms")).json()["modules"][0]["id"]
    await client.post("/api/courses/sql-dbms/progress", json={"module_id": first}, headers=h)
    body = await recommended(client, student)
    sql = next(c for c in body["courses"] if c["slug"] == "sql-dbms")
    assert sql["progress"]["done"] == 1 and "Continue where you left off" in sql["reasons"][0]
    planned = [m["module_id"] for w in body["plan"]["weeks"] for m in w["modules"]]
    assert first not in planned


async def test_plan_has_four_weeks_of_about_eight_hours(client, student, seeded):
    await set_path(seeded, "Data Scientist")
    plan = (await recommended(client, student))["plan"]
    assert [w["week"] for w in plan["weeks"]] == [1, 2, 3, 4] and plan["hours_per_week"] == 8
    for w in plan["weeks"]:
        assert w["hours"] <= 8 or len(w["modules"]) == 1
        assert all({"course_slug", "module_id", "title", "hours"} <= set(m) for m in w["modules"])
    assert plan["total_hours"] == sum(w["hours"] for w in plan["weeks"])


def test_recommend_function_is_pure_and_ranks_by_signal():
    role = {"title": "Backend Developer", "required_skills": ["Databases", "Data Structures"]}
    progress = {}
    full = recs.recommend(COURSES, progress, role, known_skills=set(), assessment=None, resume=None)
    assert {"sql-dbms", "dsa"} <= {c["slug"] for c in full["courses"]}
    knows_sql = recs.recommend(COURSES, progress, role, known_skills={"SQL"}, assessment=None, resume=None)
    sql = next((c for c in knows_sql["courses"] if c["slug"] == "sql-dbms"), None)
    assert sql is None or sql["score"] == 0  # the gap is gone, so it no longer ranks for it


async def test_recommendations_need_a_student_login(client, seeded):
    assert (await client.get("/api/recommendations/courses")).status_code == 401
