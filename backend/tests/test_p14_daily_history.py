"""P14 stages C and D: the daily challenge, streaks, and "My submissions"."""
from datetime import date, datetime, timedelta

import pytest

from app.seed import seed_collections
from app.services import daily_challenge_service as dc
from app.utils.timeutil import utcnow
from tests.conftest import bearer, register


@pytest.fixture
async def seeded(db):
    await seed_collections(db)
    return db


def problems(n=12):
    return [{"id": f"p{i:02d}", "slug": f"problem-{i}", "title": f"Problem {i}", "function_name": "f", "difficulty": "Easy"} for i in range(n)]


async def add_attempt(db, user_id, slug="sum-two-numbers", verdict="Accepted", when=None, language="python", code="def f(): pass", att_id=None):
    when = when or utcnow()
    n = await db["practice_attempts"].count_documents({})
    await db["practice_attempts"].insert_one({
        "id": att_id or f"att-t{n:04d}", "user_id": user_id, "problem_slug": slug, "language": language, "code": code, "verdict": verdict,
        "is_correct": verdict == "Accepted", "runtime_ms": 12, "memory_kb": 1000, "passed_count": 3 if verdict == "Accepted" else 1, "total_count": 3,
        "message": f"Status: {verdict}", "timestamp": when, "created_at": when,
    })


# ------------------------------------------------------------------------------------------------------------ the problem of the day
def test_same_date_same_problem_for_everyone():
    pool = problems()
    day = date(2026, 3, 14)
    assert dc.problem_for_day(pool, day)["slug"] == dc.problem_for_day(list(reversed(pool)), day)["slug"]  # order of the list does not matter
    assert dc.problem_for_day(pool, day) == dc.problem_for_day(pool, day)


def test_the_problem_changes_from_day_to_day_and_never_repeats_back_to_back():
    pool = problems()
    seen = [dc.problem_for_day(pool, date(2026, 1, 1) + timedelta(days=i))["slug"] for i in range(60)]
    assert len(set(seen)) > 5
    assert all(a != b for a, b in zip(seen, seen[1:]))


def test_no_problems_means_no_challenge():
    assert dc.problem_for_day([], date(2026, 1, 1)) is None
    assert dc.problem_for_day([{"slug": "x", "id": "x"}], date(2026, 1, 1)) is None  # an old-format problem without a function is skipped
    assert dc.problem_for_day(problems(1), date(2026, 1, 1))["slug"] == "problem-0"


async def test_endpoint_gives_every_student_the_same_problem(client, seeded):
    a = (await register(client, "a@example.com")).json()["access_token"]
    b = (await register(client, "b@example.com")).json()["access_token"]
    ra = await client.get("/api/practice/daily", headers=bearer(a))
    rb = await client.get("/api/practice/daily", headers=bearer(b))
    assert ra.status_code == 200
    assert ra.json()["problem"] == rb.json()["problem"]
    assert ra.json()["date"] == utcnow().date().isoformat()
    assert ra.json()["current_streak"] == 0 and ra.json()["solved_today"] is False
    assert set(ra.json()["problem"]) == {"slug", "title", "difficulty", "topic"}


async def test_daily_needs_a_student_login(client, seeded, admin):
    assert (await client.get("/api/practice/daily")).status_code == 401
    assert (await client.get("/api/practice/daily", headers=bearer(admin["token"]))).status_code == 403


async def test_solving_todays_problem_marks_it_solved_once(client, seeded, student):
    daily = (await client.get("/api/practice/daily", headers=bearer(student["token"]))).json()
    await add_attempt(seeded, student["user"]["id"], daily["problem"]["slug"], "Wrong Answer")
    assert (await client.get("/api/practice/daily", headers=bearer(student["token"]))).json()["solved_today"] is False
    await add_attempt(seeded, student["user"]["id"], daily["problem"]["slug"], "Accepted")
    await add_attempt(seeded, student["user"]["id"], daily["problem"]["slug"], "Accepted")  # a second Accepted the same day
    after = (await client.get("/api/practice/daily", headers=bearer(student["token"]))).json()
    assert after["solved_today"] is True
    assert after["current_streak"] == 1 and after["best_streak"] == 1  # counted once


# ------------------------------------------------------------------------------------------------------------ streak rules
D = date(2026, 6, 10)


def test_streak_counts_consecutive_days_once_each():
    assert dc.streaks({D - timedelta(days=2), D - timedelta(days=1), D}, D) == {"current": 3, "best": 3, "last_day": D.isoformat()}
    assert dc.streaks({D}, D)["current"] == 1
    assert dc.streaks(set(), D) == {"current": 0, "best": 0, "last_day": None}


def test_a_streak_survives_until_the_day_ends_then_resets():
    yesterday_run = {D - timedelta(days=3), D - timedelta(days=2), D - timedelta(days=1)}
    assert dc.streaks(yesterday_run, D)["current"] == 3          # nothing yet today: the streak is still alive
    assert dc.streaks(yesterday_run, D + timedelta(days=1))["current"] == 0  # a whole day was missed: reset
    assert dc.streaks(yesterday_run, D + timedelta(days=1))["best"] == 3     # the best streak stays


def test_best_streak_is_the_longest_run_ever():
    days = {D - timedelta(days=i) for i in (0, 1, 10, 11, 12, 13, 20)}
    assert dc.streaks(days, D) == {"current": 2, "best": 4, "last_day": D.isoformat()}


def attempt(day, hour=12, verdict="Accepted", slug="s"):
    return {"problem_slug": slug, "verdict": verdict, "is_correct": verdict == "Accepted", "timestamp": datetime(day.year, day.month, day.day, hour)}


def test_only_accepted_code_submissions_make_a_streak_day():
    rows = [attempt(D, verdict="Wrong Answer"), attempt(D - timedelta(days=1), verdict="Compile Error"), {"problem_slug": "s", "verdict": "", "timestamp": datetime(2026, 6, 8)},
            {"question_id": "q1", "is_correct": True, "timestamp": datetime(2026, 6, 7)}]  # a quiz answer and a code snapshot are not submissions of code
    assert dc.accepted_days(rows) == set()


def test_the_day_boundary_uses_the_stored_offset_consistently():
    late = attempt(D, hour=23)  # 23:00 UTC
    assert dc.accepted_days([late], 0) == {D}
    assert dc.accepted_days([late], 120) == {D + timedelta(days=1)}   # UTC+2: already tomorrow there
    assert dc.accepted_days([attempt(D, hour=1)], -120) == {D - timedelta(days=1)}  # UTC-2: still yesterday
    now = datetime(2026, 6, 10, 23, 30)
    one_day = [attempt(D - timedelta(days=1), hour=23)]
    assert dc.summarize(one_day, 0, now)["current_streak"] == 1       # yesterday in UTC, streak alive
    assert dc.summarize(one_day, 120, now)["current_streak"] == 1     # local: the attempt is on D, now is D+1 -> alive too
    assert dc.summarize([attempt(D - timedelta(days=2), hour=12)], 0, now)["current_streak"] == 0  # two days ago: broken


def test_offsets_are_clamped_to_real_time_zones():
    assert dc.clamp_offset(99999) == 840 and dc.clamp_offset(-99999) == -720 and dc.clamp_offset("x") == 0 and dc.clamp_offset(None) == 0


async def test_streak_through_the_api_resets_after_a_missed_day(client, seeded, student):
    uid = student["user"]["id"]
    for ago in (3, 2, 1):
        await add_attempt(seeded, uid, when=utcnow() - timedelta(days=ago))
    r = (await client.get("/api/practice/achievements", headers=bearer(student["token"]))).json()
    assert r["current_streak"] == 3 and r["best_streak"] == 3  # nothing today yet, yesterday counts
    await seeded["practice_attempts"].delete_many({})
    await add_attempt(seeded, uid, when=utcnow() - timedelta(days=3))
    await add_attempt(seeded, uid, when=utcnow() - timedelta(days=2))  # a missed day (yesterday) follows
    r = (await client.get("/api/practice/achievements", headers=bearer(student["token"]))).json()
    assert r["current_streak"] == 0 and r["best_streak"] == 2


async def test_badges_for_seven_days_thirty_days_and_ten_solved(client, seeded, student):
    uid = student["user"]["id"]
    for ago in range(0, 7):
        await add_attempt(seeded, uid, slug=f"p{ago}", when=utcnow() - timedelta(days=ago))
    r = (await client.get("/api/practice/achievements", headers=bearer(student["token"]))).json()
    badges = {b["key"]: b for b in r["badges"]}
    assert badges["streak-7"]["earned"] is True and badges["streak-30"]["earned"] is False and badges["solved-10"]["earned"] is False
    assert badges["streak-30"]["progress"] == 7 and badges["solved-10"]["progress"] == 7
    for i in range(7, 10):
        await add_attempt(seeded, uid, slug=f"p{i}", when=utcnow() - timedelta(days=20))
    badges = {b["key"]: b for b in (await client.get("/api/practice/achievements", headers=bearer(student["token"]))).json()["badges"]}
    assert badges["solved-10"]["earned"] is True


async def test_day_offset_is_stored_validated_and_student_only(client, seeded, student, admin):
    ok = await client.put("/api/student/day-offset", headers=bearer(student["token"]), json={"day_offset_minutes": 330})
    assert ok.status_code == 200 and ok.json()["day_offset_minutes"] == 330
    assert (await client.get("/api/practice/daily", headers=bearer(student["token"]))).json()["day_offset_minutes"] == 330
    assert (await client.put("/api/student/day-offset", headers=bearer(student["token"]), json={"day_offset_minutes": 841})).status_code == 422
    assert (await client.put("/api/student/day-offset", headers=bearer(student["token"]), json={"day_offset_minutes": "x"})).status_code == 422
    assert (await client.put("/api/student/day-offset", headers=bearer(admin["token"]), json={"day_offset_minutes": 0})).status_code == 403
    assert (await client.put("/api/student/day-offset", json={"day_offset_minutes": 0})).status_code == 401


# ------------------------------------------------------------------------------------------------------------ my submissions
async def two_students(client):
    a = await register(client, "a@example.com")
    b = await register(client, "b@example.com")
    return ({"token": a.json()["access_token"], "id": a.json()["user"]["id"]}, {"token": b.json()["access_token"], "id": b.json()["user"]["id"]})


async def test_the_list_shows_only_my_judged_submissions_newest_first_without_code(client, seeded):
    a, b = await two_students(client)
    await add_attempt(seeded, a["id"], verdict="Wrong Answer", when=utcnow() - timedelta(hours=2), att_id="att-old")
    await add_attempt(seeded, a["id"], verdict="Accepted", when=utcnow() - timedelta(hours=1), att_id="att-new")
    await add_attempt(seeded, b["id"], verdict="Accepted", att_id="att-other")
    await seeded["practice_attempts"].insert_one({"id": "att-snap", "user_id": a["id"], "problem_slug": "sum-two-numbers", "language": "python", "code": "x", "verdict": "", "timestamp": utcnow()})
    r = await client.get("/api/practice/submissions", headers=bearer(a["token"]))
    assert r.status_code == 200
    body = r.json()
    assert [i["id"] for i in body["items"]] == ["att-new", "att-old"] and body["total"] == 2
    assert "code" not in body["items"][0]
    assert body["items"][0]["problem_title"] and body["items"][0]["difficulty"]
    assert body["verdicts"] == ["Accepted", "Wrong Answer"] and body["languages"] == ["python"]


async def test_pagination_is_capped_and_pages_do_not_overlap(client, seeded):
    a, _ = await two_students(client)
    for i in range(25):
        await add_attempt(seeded, a["id"], when=utcnow() - timedelta(minutes=i), att_id=f"att-{i:02d}")
    page1 = (await client.get("/api/practice/submissions?page=1&page_size=10", headers=bearer(a["token"]))).json()
    page3 = (await client.get("/api/practice/submissions?page=3&page_size=10", headers=bearer(a["token"]))).json()
    assert page1["total"] == 25 and len(page1["items"]) == 10 and len(page3["items"]) == 5
    assert not {i["id"] for i in page1["items"]} & {i["id"] for i in page3["items"]}
    for bad in ("page_size=51", "page_size=0", "page=0", "page=-1", "page_size=100000"):
        assert (await client.get(f"/api/practice/submissions?{bad}", headers=bearer(a["token"]))).status_code == 422, bad
    assert len((await client.get("/api/practice/submissions?page_size=50", headers=bearer(a["token"]))).json()["items"]) == 25
    assert (await client.get("/api/practice/submissions?page=99", headers=bearer(a["token"]))).json()["items"] == []


async def test_filters_by_verdict_language_and_difficulty(client, seeded):
    a, _ = await two_students(client)
    problems_by_difficulty = {}
    for p in await seeded["practice_problems"].find({}).to_list(100):
        problems_by_difficulty.setdefault(p["difficulty"], p["slug"])
    easy, hard = problems_by_difficulty["Easy"], problems_by_difficulty["Hard"]
    await add_attempt(seeded, a["id"], easy, "Accepted", language="python")
    await add_attempt(seeded, a["id"], easy, "Wrong Answer", language="java")
    await add_attempt(seeded, a["id"], hard, "Time Limit Exceeded", language="python")
    h = bearer(a["token"])
    total = lambda q: client.get(f"/api/practice/submissions?{q}", headers=h)
    assert (await total("verdict=Accepted")).json()["total"] == 1
    assert (await total("language=java")).json()["total"] == 1
    assert (await total("language=Python")).json()["total"] == 2          # the language name is matched like the judge does
    assert (await total("difficulty=hard")).json()["total"] == 1
    assert (await total("difficulty=Easy&language=python")).json()["total"] == 1
    assert (await total("difficulty=Easy&verdict=Time Limit Exceeded")).json()["total"] == 0
    for bad in ("verdict=Maybe", "language=cobol", "difficulty=extreme"):
        assert (await total(bad)).status_code == 422, bad
    assert (await total("verdict=" + "x" * 41)).status_code == 422


async def test_I_can_open_my_code_and_nobody_else_can(client, seeded, admin):
    a, b = await two_students(client)
    await add_attempt(seeded, a["id"], att_id="att-mine", code="def add_numbers(a, b):\n    return a + b\n")
    mine = await client.get("/api/practice/submissions/att-mine", headers=bearer(a["token"]))
    assert mine.status_code == 200 and "return a + b" in mine.json()["code"] and mine.json()["verdict"] == "Accepted"
    assert (await client.get("/api/practice/submissions/att-mine", headers=bearer(b["token"]))).status_code == 404   # someone else's submission
    assert (await client.get("/api/practice/submissions/att-mine", headers=bearer(admin["token"]))).status_code == 403
    assert (await client.get("/api/practice/submissions/att-mine")).status_code == 401
    assert (await client.get("/api/practice/submissions/att-nope", headers=bearer(a["token"]))).status_code == 404
    assert (await client.get("/api/practice/submissions/" + "x" * 61, headers=bearer(a["token"]))).status_code == 422
    # a code snapshot (no verdict) is not a submission
    await seeded["practice_attempts"].insert_one({"id": "att-snap2", "user_id": a["id"], "problem_slug": "s", "language": "python", "code": "x", "verdict": ""})
    assert (await client.get("/api/practice/submissions/att-snap2", headers=bearer(a["token"]))).status_code == 404


async def test_the_list_needs_a_student_login(client, seeded, admin):
    assert (await client.get("/api/practice/submissions")).status_code == 401
    assert (await client.get("/api/practice/submissions", headers=bearer(admin["token"]))).status_code == 403


async def test_no_hidden_test_data_in_any_submission_response(client, seeded):
    a, _ = await two_students(client)
    await add_attempt(seeded, a["id"], verdict="Wrong Answer", att_id="att-w")
    rows = (await client.get("/api/practice/submissions", headers=bearer(a["token"]))).json()
    detail = (await client.get("/api/practice/submissions/att-w", headers=bearer(a["token"]))).json()
    allowed_row = {"id", "problem_slug", "problem_title", "difficulty", "language", "verdict", "runtime_ms", "passed_count", "total_count", "created_at"}
    assert set(rows["items"][0]) == allowed_row
    assert set(detail) == allowed_row | {"code", "memory_kb"}
    for forbidden in ("test_cases", "expected", "hidden", "args", "input", "stdout", "failed_detail", "message"):
        assert forbidden not in detail and forbidden not in rows["items"][0]
