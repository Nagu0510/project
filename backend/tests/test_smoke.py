"""End-to-end smoke flow over the real routers on an in-memory Mongo (mongomock)."""
import pytest

from app.seed import seed_collections
from tests.conftest import bearer, take_assessment


@pytest.fixture
async def seeded(db):
    await seed_collections(db)
    return db


async def test_student_journey(client, student, seeded):
    h = bearer(student["token"])

    # fresh account: everything is zero, nothing invented
    dash = (await client.get("/api/student/dashboard", headers=h)).json()
    assert dash["career_readiness"] == 0 and dash["assessments_completed"] == 0
    assert dash["strengths"] == [] and dash["roadmap_progress"] == 0
    stats = (await client.get("/api/practice/stats", headers=h)).json()
    assert {k: stats[k] for k in ("total_solved", "correct_count", "accuracy_percentage", "streak_days", "points")} == {"total_solved": 0, "correct_count": 0, "accuracy_percentage": 0, "streak_days": 0, "points": 0}
    assert (await client.get("/api/assessments/result/latest", headers=h)).status_code == 404

    # profile and career path persist
    profile = (await client.get("/api/student/profile", headers=h)).json()
    assert profile["email"] == student["email"]
    assert (await client.post("/api/student/career-path", headers=h, json={"career_path_title": "Nonsense"})).status_code == 400
    r = await client.post("/api/student/career-path", headers=h, json={"career_path_title": "Backend Developer"})
    assert r.status_code == 200 and r.json()["career_path"] == "Backend Developer"
    assert (await client.get("/api/student/profile", headers=h)).json()["career_path"] == "Backend Developer"

    # assessment: submit, then the result and the dashboard reflect it
    started, submit = await take_assessment(client, student["token"], "asm-py-med-1", {"py-med-01": 1, "py-med-02": 1, "py-med-03": 0})
    assert submit.status_code == 200, submit.text
    result = submit.json()
    latest = (await client.get("/api/assessments/result/latest", headers=h)).json()
    assert latest["attempt_id"] == result["attempt_id"]
    dash = (await client.get("/api/student/dashboard", headers=h)).json()
    assert dash["assessments_completed"] == 1
    # readiness is computed: 40% assessments + 10% consistency (1 active day of 14); nothing else has data yet
    assert dash["career_readiness"] == round(0.4 * result["overall_score"] + 0.10 * round(100 / 14))
    assert dash["streak_days"] == 1 and dash["has_data"] is True and len(dash["score_history"]) == 1
    assert dash["assessment_score"] == result["overall_score"]

    # roadmap + per-user progress
    road = (await client.get("/api/student/roadmap", headers=h)).json()
    assert road["career_path"] == "Backend Developer" and road["milestones"]
    first = road["milestones"][0]["id"]
    assert (await client.put("/api/student/roadmap/progress", headers=h, json={"milestone_id": "nope", "status": "completed"})).status_code == 404
    assert (await client.put("/api/student/roadmap/progress", headers=h, json={"milestone_id": first, "status": "completed"})).status_code == 200
    road = (await client.get("/api/student/roadmap", headers=h)).json()
    assert next(m for m in road["milestones"] if m["id"] == first)["status"] == "completed"
    assert (await client.get("/api/student/dashboard", headers=h)).json()["roadmap_progress"] > 0


async def test_practice_stats_are_per_user(client, student, seeded):
    h = bearer(student["token"])
    qid = "py-med-01"
    wrong = await client.post(f"/api/practice/questions/{qid}/answer", headers=h, json={"selected_option_index": 3})
    assert wrong.status_code == 200 and wrong.json()["is_correct"] is False
    right_idx = wrong.json()["correct_option_index"]
    await client.post(f"/api/practice/questions/{qid}/answer", headers=h, json={"selected_option_index": right_idx})

    stats = (await client.get("/api/practice/stats", headers=h)).json()
    assert stats["total_solved"] == 2 and stats["correct_count"] == 1 and stats["accuracy_percentage"] == 50
    assert stats["streak_days"] == 1 and stats["points"] == 10

    other = (await client.post("/api/auth/register", json={"name": "Other One", "email": "o@example.com", "password": "Sup3rSecret1"})).json()
    other_stats = (await client.get("/api/practice/stats", headers=bearer(other["access_token"]))).json()
    assert other_stats["total_solved"] == 0


async def test_problems_come_from_mongo_and_unknown_slug_is_404(client, student, db):
    h = bearer(student["token"])
    assert (await client.get("/api/practice/problems")).json() == []  # nothing seeded, nothing invented
    await seed_collections(db)
    problems = (await client.get("/api/practice/problems")).json()
    assert len(problems) == 12
    assert (await client.get("/api/practice/problems/sum-two-numbers")).status_code == 200
    assert (await client.get("/api/practice/problems/does-not-exist")).status_code == 404
    bad = await client.post("/api/practice/code/submit", headers=h,
                            json={"problem_slug": "does-not-exist", "language": "python", "source_code": "print(1)"})
    assert bad.status_code == 404


async def test_placements_read_only_from_mongo(client, student, admin, db):
    h = bearer(student["token"])
    assert (await client.get("/api/placements", headers=h)).json() == []
    await seed_collections(db)
    jobs = (await client.get("/api/placements", headers=h)).json()
    assert len(jobs) == 5 and all(j["deadline"].startswith("2027-") for j in jobs)
    assert all(j["match_percentage"] == 0 for j in jobs)  # new student has no skills yet

    # drafts are hidden from students, visible to admins
    ha = bearer(admin["token"])
    await client.patch(f"/api/placements/{jobs[0]['id']}/status", headers=ha, json={"new_status": "draft"})
    assert len((await client.get("/api/placements", headers=h)).json()) == 4
    assert len((await client.get("/api/placements", headers=ha)).json()) == 5
    assert (await client.get(f"/api/placements/{jobs[0]['id']}", headers=h)).status_code == 404


async def test_admin_question_flow_and_delete_hits_mongo(client, admin, student, db):
    ha = bearer(admin["token"])
    paper = ("1. Given an array of integers and a target, return indices of two numbers that add up to the target.\n"
             "2. Write a SQL query to find the second highest salary from the Employee table.\n")
    up = await client.post("/api/admin/question-papers/upload", headers=ha,
                           data={"company": "TestCo", "exam": "Round 1", "year": "2025"},
                           files={"file": ("paper.txt", paper.encode(), "text/plain")})
    assert up.status_code == 200, up.text
    pid = up.json()["id"]
    qs = (await client.get(f"/api/admin/question-papers/{pid}/questions", headers=ha)).json()
    assert qs, "extraction should find questions"
    qid = qs[0]["id"]

    assert (await client.get("/api/admin/extracted-questions", headers=bearer(student["token"]))).status_code == 403

    assert (await client.post(f"/api/admin/questions/{qid}/approve", headers=ha)).status_code == 200
    pyq = (await client.get("/api/previous-questions")).json()
    assert any(q["id"] == f"pq-{qid}" for q in pyq)

    assert (await client.delete(f"/api/admin/questions/{qid}", headers=ha)).status_code == 200
    assert await db["extracted_questions"].find_one({"id": qid}) is None  # really gone from Mongo
    assert not any(q["id"] == f"pq-{qid}" for q in (await client.get("/api/previous-questions")).json())
    assert (await client.delete(f"/api/admin/questions/{qid}", headers=ha)).status_code == 404

    analytics = (await client.get("/api/admin/analytics", headers=ha)).json()
    assert analytics["registered_students_count"] == 1 and analytics["average_readiness_score"] == 0


async def test_health_reports_real_database_status(client, db):
    assert (await client.get("/health")).status_code == 200
    from app.database import db_manager

    db_manager.is_connected = False
    r = await client.get("/health")
    assert r.status_code == 503 and r.json()["database"] == "disconnected"
