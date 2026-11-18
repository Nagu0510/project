"""P14 stages A and B: demo data (seed / reset), admin analytics and the CSV exports."""
import csv
import importlib.util
import io
from datetime import date, datetime, timedelta
from pathlib import Path

import pytest

from app.config import settings
from app.limiter import limiter, reset_default_limits
from app.seed import seed_collections
from app.services import admin_analytics_service as analytics
from app.services import demo_data
from app.utils.timeutil import utcnow
from tests.conftest import PASSWORD, bearer, register

SCRIPT = Path(__file__).resolve().parent.parent / "scripts" / "seed_demo_data.py"


@pytest.fixture
async def seeded(db):
    await seed_collections(db)
    return db


def load_script():
    spec = importlib.util.spec_from_file_location("seed_demo_data_script", SCRIPT)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


async def totals(db):
    return {name: await db[name].count_documents({}) for name in demo_data.COLLECTIONS}


# ------------------------------------------------------------------------------------------------------------ stage A: demo data
async def test_seed_creates_flagged_students_with_every_kind_of_record(seeded):
    made = await demo_data.seed(seeded, 25)
    assert await seeded["users"].count_documents({"demo": True}) == 25
    assert made["users"] == 25 and made["assessment_attempts"] > 20 and made["practice_attempts"] > 40
    assert made["roadmaps"] > 10 and made["resume_analyses"] > 10 and made["notifications"] > 20
    for name in demo_data.COLLECTIONS:  # nothing exists in these collections that is not flagged
        assert await seeded[name].count_documents({"demo": {"$ne": True}}) == 0, name
    user = await seeded["users"].find_one({"id": "usr-demo-01"})
    assert user["email"] == "demo01@example.test" and user["role"] == "student" and user["password"] is None
    verdicts = set(await seeded["practice_attempts"].distinct("verdict"))
    assert "Accepted" in verdicts and len(verdicts) >= 3                      # mixed verdicts
    bands = {t["band"] for a in await seeded["assessment_attempts"].find({}).to_list(500) for t in a["topic_scores"]}
    assert bands == {"gap", "developing", "strong"}                          # results across the bands
    assert len(await seeded["assessment_attempts"].distinct("user_id")) >= 12


async def test_the_dates_are_spread_over_the_last_30_days(seeded):
    now = utcnow()
    await demo_data.seed(seeded, 25, now)
    stamps = [a["submitted_at"] for a in await seeded["assessment_attempts"].find({}).to_list(500)]
    stamps += [a["timestamp"] for a in await seeded["practice_attempts"].find({}).to_list(2000)]
    assert all(now - timedelta(days=30) <= s <= now for s in stamps)
    assert len({s.date() for s in stamps}) >= 15                             # spread, not bunched


async def test_running_it_twice_does_not_duplicate_anything(seeded):
    await demo_data.seed(seeded, 25)
    first = await totals(seeded)
    ids = sorted(u["id"] for u in await seeded["users"].find({}).to_list(100))
    await demo_data.seed(seeded, 25)
    assert await totals(seeded) == first
    assert sorted(u["id"] for u in await seeded["users"].find({}).to_list(100)) == ids


async def test_reset_removes_only_demo_data(client, seeded):
    real = (await register(client, "real@example.com")).json()
    real_id = real["user"]["id"]
    await seeded["practice_attempts"].insert_one({"id": "att-real", "user_id": real_id, "problem_slug": "sum-two-numbers", "language": "python", "code": "x", "verdict": "Accepted", "timestamp": utcnow()})
    await seeded["notifications"].insert_one({"id": "n-real", "user_id": real_id, "type": "x", "title": "t", "message": "m", "read": False, "created_at": utcnow()})
    # decoys: flagged but not clearly demo (a real-looking address, a non-demo id) must survive too
    await seeded["users"].insert_one({"id": "usr-demo-99", "email": "someone@gmail.com", "demo": True, "role": "student", "name": "x"})
    await seeded["users"].insert_one({"id": "usr-other", "email": "demo50@example.test", "demo": True, "role": "student", "name": "x"})
    await demo_data.seed(seeded, 25)
    before_real = await totals(seeded)

    removed = await demo_data.reset(seeded)
    assert removed["users"] == 25 and removed["practice_attempts"] > 0
    assert await seeded["users"].count_documents({"email": {"$regex": "^demo\\d\\d@example.test$"}, "id": {"$regex": "^usr-demo-"}}) == 0
    assert await seeded["users"].find_one({"id": real_id}) is not None
    assert await seeded["practice_attempts"].find_one({"id": "att-real"}) is not None
    assert await seeded["notifications"].find_one({"id": "n-real"}) is not None
    assert await seeded["users"].find_one({"id": "usr-demo-99"}) is not None   # flagged, but a real-looking address: not removed
    assert await seeded["users"].find_one({"id": "usr-other"}) is not None     # flagged, but not a demo id: not removed
    for name in ("assessment_attempts", "roadmaps", "resume_analyses", "student_profiles"):
        assert await seeded[name].count_documents({"user_id": {"$regex": "^usr-demo-"}}) == 0, name
    assert before_real["users"] == 25 + 3 and (await totals(seeded))["users"] == 3
    assert (await demo_data.reset(seeded))["users"] == 0                         # a second reset removes nothing more


async def test_demo_students_cannot_sign_in(client, seeded):
    from fastapi import HTTPException

    from app.routers.auth import _authenticate

    await demo_data.seed(seeded, 3)
    for password in (PASSWORD, "demo", "password", "x" * 12):
        r = await client.post("/api/auth/login", json={"email": "demo01@example.test", "password": password})
        assert r.status_code in (401, 422), password                          # the API does not even accept the reserved .test domain
        with pytest.raises(HTTPException) as err:                              # and the account has no password, so the check itself refuses
            await _authenticate("demo01@example.test", password, "student")
        assert err.value.status_code == 401


async def test_seed_needs_seeded_content_and_a_sane_count(db):
    with pytest.raises(demo_data.DemoDataError, match="seed"):
        await demo_data.seed(db, 5)
    await seed_collections(db)
    for bad in (0, -1, 101):
        with pytest.raises(demo_data.DemoDataError):
            await demo_data.seed(db, bad)


async def test_the_script_refuses_without_yes_and_in_production(monkeypatch, seeded, capsys):
    script = load_script()
    assert await script.main(["--reset"]) == 2          # no --yes: nothing is connected or touched
    assert await script.main([]) == 2
    assert "--yes" in capsys.readouterr().out
    monkeypatch.setattr(script.settings, "ENV", "production")
    assert await script.main(["--yes"]) == 2
    assert "production" in capsys.readouterr().out
    assert await seeded["users"].count_documents({"demo": True}) == 0


async def test_the_script_creates_and_resets_and_says_what_it_did(seeded, capsys):
    script = load_script()
    assert await script.run(script.parse(["--yes", "--count", "6"]), seeded) == 0
    out = capsys.readouterr().out
    assert "6 students" in out and "users 6" in out and "cannot sign in" in out
    assert await script.run(script.parse(["--yes", "--reset"]), seeded) == 0
    assert "Removed demo records" in capsys.readouterr().out and await seeded["users"].count_documents({}) == 0


# ------------------------------------------------------------------------------------------------------------ stage B: analytics (pure)
def row(score, has_data=True, assessed=1):
    return {"readiness_score": score, "has_data": has_data, "assessments_completed": assessed}


def test_distribution_puts_each_student_in_one_band_and_counts_empty_ones_apart():
    d = analytics.readiness_distribution([row(0), row(19), row(20), row(59), row(60), row(79), row(80), row(100), row(0, has_data=False)])
    assert [b["count"] for b in d["buckets"]] == [2, 1, 1, 2, 2] and d["no_data"] == 1
    assert [b["label"] for b in d["buckets"]] == ["0-19", "20-39", "40-59", "60-79", "80-100"]


def test_weakest_skills_are_ranked_by_a_question_weighted_average():
    attempts = [
        {"user_id": "a", "topic_scores": [{"topic": "SQL", "score": 40, "total": 5}, {"topic": "Python", "score": 90, "total": 5}]},
        {"user_id": "b", "topic_scores": [{"topic": "SQL", "score": 80, "total": 5}, {"topic": "Java", "score": 50, "total": 10}, {"topic": "Empty", "score": 0, "total": 0}]},
    ]
    ranked = analytics.weakest_skills(attempts)
    assert [r["topic"] for r in ranked] == ["Java", "SQL", "Python"]            # 50, 60, 90
    assert ranked[1] == {"topic": "SQL", "average": 60, "questions": 10, "attempts": 2, "students": 2}
    assert len(analytics.weakest_skills([{"user_id": "x", "topic_scores": [{"topic": f"t{i}", "score": i, "total": 3} for i in range(20)]}], limit=3)) == 3
    assert analytics.weakest_skills([]) == []
    assert analytics.weakest_skills([{"user_id": "a", "topic_scores": [{"topic": "Tiny", "score": 0, "total": 2}]}]) == []   # too few questions to rank


def test_activity_over_time_has_a_row_per_day_with_zeros_included():
    today = date(2026, 6, 30)
    assess = [{"user_id": "a", "submitted_at": datetime(2026, 6, 30, 9)}, {"user_id": "b", "submitted_at": datetime(2026, 6, 30, 10)}, {"user_id": "a", "submitted_at": datetime(2026, 1, 1)}]
    practice = [{"user_id": "a", "problem_slug": "p", "verdict": "Accepted", "timestamp": datetime(2026, 6, 29, 9)},
                {"user_id": "c", "problem_slug": "p", "verdict": "", "timestamp": datetime(2026, 6, 29, 9)}]  # a snapshot is not a submission
    rows = analytics.activity_over_time(assess, practice, today)
    assert len(rows) == 30 and rows[0]["date"] == "2026-06-01" and rows[-1]["date"] == "2026-06-30"
    assert rows[-1] == {"date": "2026-06-30", "assessments": 2, "submissions": 0, "active_students": 2}
    assert rows[-2] == {"date": "2026-06-29", "assessments": 0, "submissions": 1, "active_students": 1}
    assert sum(r["assessments"] for r in rows) == 2                               # the January attempt is outside the window


# ------------------------------------------------------------------------------------------------------------ stage B: analytics endpoint
async def test_analytics_numbers_with_demo_data(client, seeded, admin):
    await demo_data.seed(seeded, 25)
    r = await client.get("/api/admin/analytics", headers=bearer(admin["token"]))
    assert r.status_code == 200
    body = r.json()
    for key in ("registered_students_count", "average_readiness_score", "assessments_taken_count", "topic_frequencies"):  # the existing keys stay
        assert key in body
    assert body["registered_students_count"] == 25 and body["demo_students_count"] == 25
    assert 0 < body["active_students_7d"] <= 25 and 0 < body["average_readiness"] <= 100
    dist = body["readiness_distribution"]
    assert sum(b["count"] for b in dist["buckets"]) + dist["no_data"] == 25
    weak = body["weakest_skills"]
    assert 0 < len(weak) <= 8 and [w["average"] for w in weak] == sorted(w["average"] for w in weak)
    activity = body["activity"]
    assert len(activity) == 30 and activity[-1]["date"] == utcnow().date().isoformat()
    assert sum(a["assessments"] for a in activity) == body["assessments_taken_count"]
    assert sum(a["submissions"] for a in activity) > 0


async def test_analytics_on_an_empty_platform_is_all_zeros(client, db, admin):
    body = (await client.get("/api/admin/analytics", headers=bearer(admin["token"]))).json()
    assert body["registered_students_count"] == 0 and body["active_students_7d"] == 0 and body["average_readiness"] == 0
    assert body["weakest_skills"] == [] and len(body["activity"]) == 30 and all(a["active_students"] == 0 for a in body["activity"])
    assert body["readiness_distribution"]["no_data"] == 0


async def test_analytics_and_exports_are_admin_only(client, student, admin):
    for path in ("/api/admin/analytics", "/api/admin/students/export.csv", "/api/admin/assessment-results/export.csv"):
        assert (await client.get(path)).status_code == 401, path
        assert (await client.get(path, headers=bearer(student["token"]))).status_code == 403, path
        assert (await client.get(path, headers=bearer(admin["token"]))).status_code == 200, path


# ------------------------------------------------------------------------------------------------------------ stage B: CSV exports
def parse_csv(response):
    assert response.headers["content-type"].startswith("text/csv")
    assert "attachment" in response.headers["content-disposition"] and response.headers["cache-control"] == "no-store"
    return list(csv.reader(io.StringIO(response.text.lstrip("﻿"))))


EVIL = ['=HYPERLINK("http://evil.example","click")', "+1+1", "-2+3", "@SUM(A1:A9)", "\t=cmd", "\r=cmd"]


async def test_csv_cells_that_look_like_formulas_are_escaped_in_both_exports(client, seeded, admin):
    for i, name in enumerate(EVIL[:4]):
        reg = await register(client, f"evil{i}@example.com", name=name.strip() or "x" * 3)
        assert reg.status_code == 201, reg.text
    evil = await seeded["users"].find_one({"email": "evil0@example.com"})
    await seeded["assessment_attempts"].insert_one({
        "attempt_id": "att-evil", "user_id": evil["id"], "assessment_id": "asm-x", "assessment_title": '=cmd|" /C calc"!A0', "difficulty": "+Hard", "overall_score": 50,
        "correct_count": 2, "total_questions": 4, "time_taken_seconds": 90, "submitted_at": utcnow(), "gap_topics": ["@topic", "-x"], "review": [{"question_text": "SECRET ANSWER KEY"}]})
    for path in ("/api/admin/students/export.csv", "/api/admin/assessment-results/export.csv"):
        rows = parse_csv(await client.get(path, headers=bearer(admin["token"])))
        for line in rows[1:]:
            for cell in line:
                assert cell[:1] not in ("=", "+", "-", "@", "\t", "\r"), f"{path}: unescaped cell {cell!r}"
    students = parse_csv(await client.get("/api/admin/students/export.csv", headers=bearer(admin["token"])))
    assert any(line[0].startswith("'=HYPERLINK") for line in students[1:]) and any(line[0] == "'+1+1" for line in students[1:])
    results = parse_csv(await client.get("/api/admin/assessment-results/export.csv", headers=bearer(admin["token"])))
    line = results[1]
    assert line[0].startswith("'=HYPERLINK") and line[2].startswith("'=cmd") and line[3] == "'+Hard" and line[9] == "'@topic; -x"


async def test_assessment_results_csv_has_the_documented_columns_only(client, seeded, admin):
    await demo_data.seed(seeded, 8)
    rows = parse_csv(await client.get("/api/admin/assessment-results/export.csv", headers=bearer(admin["token"])))
    assert rows[0] == ["Student", "Email", "Assessment", "Difficulty", "Score %", "Correct", "Questions", "Time taken (s)", "Submitted at (UTC)", "Gap topics"]
    assert len(rows) - 1 == await seeded["assessment_attempts"].count_documents({})
    assert all(len(line) == 10 for line in rows) and all(line[1].endswith("@example.test") for line in rows[1:])


async def test_no_sensitive_data_in_either_export(client, seeded, admin):
    reg = await register(client, "secret@example.com", name="Secret Person")
    uid = reg.json()["user"]["id"]
    await seeded["users"].update_one({"id": uid}, {"$set": {"google_sub": "GSUB-123456", "picture": "https://pic.example/x.png", "failed_logins": 3, "unsub_version": 9}})
    await seeded["assessment_attempts"].insert_one({"attempt_id": "att-s", "user_id": uid, "assessment_title": "T", "overall_score": 1, "submitted_at": utcnow(),
                                                      "session_id": "ses-SECRETSESSION", "review": [{"question_text": "KEY-LEAK-MARKER", "correct_option": 3}]})
    password_hash = (await seeded["users"].find_one({"id": uid}))["password"]
    for path in ("/api/admin/students/export.csv", "/api/admin/assessment-results/export.csv"):
        text = (await client.get(path, headers=bearer(admin["token"]))).text
        for secret in (password_hash, "GSUB-123456", "pic.example", "ses-SECRETSESSION", "KEY-LEAK-MARKER", "$2b$", PASSWORD, "access_token", "refresh"):
            assert secret not in text, f"{path} leaks {secret[:12]}"
        header = text.lstrip("﻿").splitlines()[0].lower()
        for word in ("password", "hash", "token", "secret", "session", "google"):
            assert word not in header, f"{path} header has {word}"


async def test_exports_are_rate_limited(client, student, admin):
    limiter.enabled = True
    limiter.reset()
    reset_default_limits()
    try:
        limit = int(settings.EXPORT_RATE_LIMIT.split("/")[0])
        for path in ("/api/admin/students/export.csv", "/api/admin/assessment-results/export.csv"):
            limiter.reset()
            codes = [(await client.get(path, headers=bearer(admin["token"]))).status_code for _ in range(limit + 2)]
            assert codes[:limit] == [200] * limit and codes[limit:] == [429, 429], (path, codes)
    finally:
        limiter.enabled = False
        limiter.reset()
        reset_default_limits()
