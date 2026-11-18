"""Readiness is computed from the student's own records. No data for a part = 0 for that part. Nothing invented."""
from datetime import date, datetime, timedelta

import pytest

from app.seed import seed_collections
from app.services import readiness_service as rs
from tests.conftest import bearer, register

TODAY = date(2026, 10, 9)


def at(days_ago: int, hour: int = 12) -> datetime:
    d = TODAY - timedelta(days=days_ago)
    return datetime(d.year, d.month, d.day, hour)


@pytest.fixture
async def seeded(db):
    await seed_collections(db)
    return db


def part(result, key):
    return next(p for p in result["parts"] if p["key"] == key)


# --------------------------------------------------------------------------- the calculation (pure)
def test_zero_data_is_zero_in_every_part():
    r = rs.compute({}, TODAY)
    assert r["overall"] == 0 and r["has_data"] is False and r["streak_days"] == 0
    assert [(p["key"], p["value"], p["points"], p["has_data"]) for p in r["parts"]] == [
        ("assessments", 0, 0.0, False), ("coding", 0, 0.0, False), ("learning", 0, 0.0, False),
        ("resume", 0, 0.0, False), ("consistency", 0, 0.0, False)]
    assert [p["weight"] for p in r["parts"]] == [40, 20, 15, 15, 10]


def test_parts_with_known_data():
    raw = {
        "assessment_attempts": [
            {"assessment_id": "a1", "overall_score": 40, "submitted_at": at(9)},
            {"assessment_id": "a1", "overall_score": 80, "submitted_at": at(3)},   # only the LATEST attempt of a1 counts
            {"assessment_id": "a2", "overall_score": 60, "submitted_at": at(0)},
        ],
        "practice_attempts": [
            {"problem_slug": "p-a", "verdict": "Accepted", "is_correct": True, "timestamp": at(1)},
            {"problem_slug": "p-b", "verdict": "Wrong Answer", "timestamp": at(1)},
            {"problem_slug": "p-b", "verdict": "Accepted", "is_correct": True, "timestamp": at(1)},
            {"problem_slug": "p-c", "verdict": "Wrong Answer", "timestamp": at(20)},
            {"problem_slug": "p-a", "message": "Code snapshot saved.", "timestamp": at(2)},   # a snapshot is not an attempt
        ],
        "roadmap_pct": 50, "course_pcts": [50, 25], "resume_score": 80,
    }
    r = rs.compute(raw, TODAY)
    assert part(r, "assessments")["value"] == 70 and part(r, "assessments")["points"] == 28.0   # (80 + 60) / 2
    assert part(r, "coding")["value"] == 67 and part(r, "coding")["detail"] == "2 of 3 attempted problems Accepted"
    assert part(r, "learning")["value"] == 44                                                      # mean(roadmap 50, courses 37.5)
    assert part(r, "resume")["value"] == 80 and part(r, "resume")["points"] == 12.0
    assert r["active_days_14"] == 4                                                                # today, yesterday, 3 and 9 days ago (20 days ago is outside)
    assert part(r, "consistency")["value"] == 29
    assert r["overall"] == round(0.4 * 70 + 0.2 * 67 + 0.15 * 44 + 0.15 * 80 + 0.1 * 29) == 63
    assert r["problems_attempted"] == 3 and r["problems_solved"] == 2 and r["assessments_taken"] == 3
    assert r["has_data"] is True


def test_a_part_without_data_does_not_borrow_from_the_others():
    only_resume = rs.compute({"resume_score": 90}, TODAY)
    assert only_resume["overall"] == 14 and part(only_resume, "assessments")["points"] == 0   # 0.15 * 90 = 13.5, nothing else
    nothing_done = rs.compute({"roadmap_pct": 0, "course_pcts": []}, TODAY)
    assert part(nothing_done, "learning")["has_data"] is False and nothing_done["has_data"] is False and nothing_done["overall"] == 0  # a chosen path with 0% done is still no data
    only_roadmap = rs.compute({"roadmap_pct": 40}, TODAY)
    assert part(only_roadmap, "learning")["value"] == 40 and only_roadmap["overall"] == 6


def test_older_submissions_without_a_verdict_still_count():
    r = rs.compute({"practice_attempts": [{"problem_slug": "old", "message": "Status: Accepted, passed 4/4 test cases.", "is_correct": True, "timestamp": at(0)}]}, TODAY)
    assert part(r, "coding")["value"] == 100


def test_all_parts_at_their_maximum_give_100():
    raw = {"assessment_attempts": [{"assessment_id": "a", "overall_score": 100, "submitted_at": at(i)} for i in range(14)],
           "practice_attempts": [{"problem_slug": "p", "verdict": "Accepted", "is_correct": True, "timestamp": at(0)}],
           "roadmap_pct": 100, "course_pcts": [100], "resume_score": 100}
    assert rs.compute(raw, TODAY)["overall"] == 100


# --------------------------------------------------------------------------- streak
@pytest.mark.parametrize("offsets,expected", [
    ([0, 1, 2, 4], 3),        # today and the two days before; the gap ends it
    ([1, 2], 2),              # nothing today yet: count back from yesterday
    ([2], 0),                 # a gap before yesterday: the streak is over
    ([], 0),
    ([0], 1),
])
def test_streak_is_consecutive_days_ending_today_or_yesterday(offsets, expected):
    days = {TODAY - timedelta(days=o) for o in offsets}
    assert rs.streak_days(days, TODAY) == expected


def test_streak_counts_assessments_and_coding_together():
    raw = {"assessment_attempts": [{"assessment_id": "a", "overall_score": 50, "submitted_at": at(1)}],
           "practice_attempts": [{"problem_slug": "p", "verdict": "Wrong Answer", "timestamp": at(0)}]}
    assert rs.compute(raw, TODAY)["streak_days"] == 2


# --------------------------------------------------------------------------- through the API
async def test_a_new_student_sees_zeros(client, student, seeded):
    h = bearer(student["token"])
    dash = (await client.get("/api/student/dashboard", headers=h)).json()
    assert dash["career_readiness"] == 0 and dash["has_data"] is False and dash["score_history"] == []
    assert dash["streak_days"] == 0 and dash["problems_solved"] == 0 and dash["resume_score"] == 0
    assert [p["points"] for p in dash["readiness_parts"]] == [0, 0, 0, 0, 0]
    prog = (await client.get("/api/student/progress", headers=h)).json()
    assert prog["readiness_score"] == 0 and prog["streak_days"] == 0 and prog["active_milestone"] == 0
    stats = (await client.get("/api/practice/stats", headers=h)).json()
    assert stats["total_solved"] == 0 and stats["problems_solved"] == 0


async def test_dashboard_numbers_follow_the_records(client, student, seeded):
    h = bearer(student["token"])
    uid = student["user"]["id"]
    await seeded["assessment_attempts"].insert_one({"attempt_id": "x1", "user_id": uid, "assessment_id": "asm-c-easy", "assessment_title": "C (Easy)",
                                                    "overall_score": 80, "submitted_at": datetime.utcnow(), "strengths": ["C"], "skill_gaps": []})
    await seeded["practice_attempts"].insert_one({"id": "pa1", "user_id": uid, "problem_slug": "sum-two-numbers", "language": "python",
                                                   "verdict": "Accepted", "is_correct": True, "timestamp": datetime.utcnow()})
    await seeded["resume_analyses"].insert_one({"user_id": uid, "id": "r1", "overall_score": 60, "created_at": datetime.utcnow(), "detected_skills": []})
    dash = (await client.get("/api/student/dashboard", headers=h)).json()
    parts = {p["key"]: p for p in dash["readiness_parts"]}
    assert parts["assessments"]["value"] == 80 and parts["coding"]["value"] == 100 and parts["resume"]["value"] == 60
    assert dash["career_readiness"] == round(0.4 * 80 + 0.2 * 100 + 0.15 * 60 + 0.1 * round(100 / 14))
    assert dash["problems_solved"] == 1 and dash["assessment_score"] == 80 and dash["resume_score"] == 60
    assert dash["strengths"] == ["C"] and dash["streak_days"] == 1
    assert [(h["kind"], h["score"]) for h in dash["score_history"]] == [("assessment", 80), ("resume", 60)] or \
        sorted((h["kind"], h["score"]) for h in dash["score_history"]) == [("assessment", 80), ("resume", 60)]
    stats = (await client.get("/api/practice/stats", headers=h)).json()
    assert stats["streak_days"] == 1 and stats["problems_solved"] == 1 and stats["accuracy_percentage"] == 100


async def test_course_progress_counts_toward_readiness(client, student, seeded):
    h = bearer(student["token"])
    first = (await client.get("/api/courses/c-programming")).json()["modules"][0]["id"]
    await client.post("/api/courses/c-programming/progress", json={"module_id": first}, headers=h)
    parts = {p["key"]: p for p in (await client.get("/api/student/dashboard", headers=h)).json()["readiness_parts"]}
    assert parts["learning"]["has_data"] is True and parts["learning"]["value"] == 12  # 1 of 8 modules (int)


async def test_readiness_is_not_shared_between_students(client, student, seeded):
    await seeded["resume_analyses"].insert_one({"user_id": student["user"]["id"], "id": "r1", "overall_score": 90, "created_at": datetime.utcnow(), "detected_skills": []})
    other = await register(client, email="other@example.com")
    dash = (await client.get("/api/student/dashboard", headers=bearer(other.json()["access_token"]))).json()
    assert dash["career_readiness"] == 0 and dash["resume_score"] == 0


async def test_career_match_is_computed_per_student_not_stored(client, student, seeded):
    guest = (await client.get("/api/career-paths")).json()
    assert guest and all(p["match_percentage"] == 0 for p in guest)
    mine = (await client.get("/api/career-paths", headers=bearer(student["token"]))).json()
    assert all(p["match_percentage"] == 0 for p in mine)  # nothing shown yet
    await seeded["resume_analyses"].insert_one({"user_id": student["user"]["id"], "id": "r1", "overall_score": 70, "created_at": datetime.utcnow(),
                                                "detected_skills": ["Python", "Git", "SQL", "DSA", "Docker"]})
    after = {p["id"]: p["match_percentage"] for p in (await client.get("/api/career-paths", headers=bearer(student["token"]))).json()}
    assert after["backend"] > 0 and after["backend"] > after["frontend"]
    assert (await client.get("/api/career-paths/backend", headers=bearer(student["token"]))).json()["match_percentage"] == after["backend"]


# --------------------------------------------------------------------------- admin
async def test_admin_routes_reject_students_and_anonymous(client, student, seeded):
    h = bearer(student["token"])
    for path in ("/api/admin/dashboard", "/api/admin/analytics", "/api/admin/students"):
        assert (await client.get(path)).status_code == 401
        assert (await client.get(path, headers=h)).status_code == 403


async def test_admin_students_and_analytics_come_from_records(client, student, admin, seeded):
    uid = student["user"]["id"]
    await seeded["assessment_attempts"].insert_one({"attempt_id": "x1", "user_id": uid, "assessment_id": "asm-c-easy", "overall_score": 90,
                                                    "submitted_at": datetime.utcnow(), "strengths": [], "skill_gaps": []})
    await seeded["practice_attempts"].insert_one({"id": "pa1", "user_id": uid, "problem_slug": "sum-two-numbers", "verdict": "Accepted",
                                                   "is_correct": True, "timestamp": datetime.utcnow()})
    h = bearer(admin["token"])
    rows = (await client.get("/api/admin/students", headers=h)).json()
    mine = next(r for r in rows if r["id"] == uid)
    assert mine["readiness_score"] == round(0.4 * 90 + 0.2 * 100 + 0.1 * round(100 / 14))
    assert mine["assessments_completed"] == 1 and mine["problems_solved"] == 1 and mine["attempts"] == 2 and mine["has_data"] is True
    assert all("password" not in r for r in rows)
    a = (await client.get("/api/admin/analytics", headers=h)).json()
    assert a["registered_students_count"] == len(rows) == 1 and a["assessed_students_count"] == 1
    assert a["average_readiness_score"] == mine["readiness_score"] and a["assessments_taken_count"] == 1 and a["problems_solved_count"] == 1
    d = (await client.get("/api/admin/dashboard", headers=h)).json()
    assert d["total_students"] == 1 and d["question_papers_count"] == await seeded["question_papers"].count_documents({})


# --------------------------------------------------------------------------- company stats
async def test_company_stats_come_only_from_previous_questions(client, db):
    empty = (await client.get("/api/question-intelligence/summary")).json()
    assert empty == {"empty": True, "company_count": 0, "total_questions": 0, "companies": {}}
    await db["previous_questions"].insert_many([
        {"id": "q1", "title": "A", "company": "Acme", "companies": ["Acme"], "topic": "Arrays", "difficulty": "Easy", "status": "published", "year": 2025, "exam": "Online Test"},
        {"id": "q2", "title": "B", "company": "Acme", "companies": ["Acme"], "topic": "Arrays", "difficulty": "Hard", "status": "published", "year": 2024, "exam": "Online Test"},
        {"id": "q3", "title": "C", "company": "Acme", "companies": ["Acme"], "topic": "Strings", "difficulty": "Easy", "status": "published", "year": 2024, "exam": "Online Test"},
        {"id": "q4", "title": "D", "company": "Acme", "companies": ["Acme"], "topic": "Strings", "difficulty": "Easy", "status": "rejected", "year": 2024, "exam": "Online Test"},
    ])
    summary = (await client.get("/api/question-intelligence/summary")).json()
    acme = summary["companies"]["acme"]
    assert summary["empty"] is False and summary["company_count"] == 1 and summary["total_questions"] == 3  # the rejected one is not published
    assert acme["total_questions"] == 3 and acme["top_topics"][0] == {"topic": "Arrays", "percentage": 67}
    assert acme["difficulty_mix"] == {"Easy": 2, "Hard": 1}
