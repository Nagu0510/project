"""P9: admin hardening, the content editor, notifications and their email copies."""
import io
import json
import os
import re
import subprocess
import sys
import tempfile
from datetime import date, timedelta
from pathlib import Path

import pytest
from PIL import Image

from app.main import app
from app.seed import seed_collections
from app.services import notification_service, placement_service
from app.services import resume_extract as rx
from app.services.question_matching_service import find_historical_question_match, invalidate_question_matching_cache
from tests.conftest import PASSWORD, bearer, register, take_assessment

PAPER = ("1. Describe how a bloom filter reduces disk lookups in a distributed key value store.\n"
         "2. Explain why a skip list gives logarithmic search time without rebalancing like a tree.\n"
         "3. Compare write ahead logging with shadow paging for crash recovery in a database engine.\n")


@pytest.fixture
async def seeded(db):
    await seed_collections(db)
    return db


@pytest.fixture(autouse=True)
def _fresh_match_index():
    invalidate_question_matching_cache()
    yield
    invalidate_question_matching_cache()


def png(size=(800, 800)) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", size, "white").save(buf, "PNG")
    return buf.getvalue()


async def upload(client, admin, name="paper.txt", data=PAPER.encode(), company="TestCo", mime="text/plain"):
    return await client.post("/api/admin/question-papers/upload", headers=bearer(admin["token"]),
                             data={"company": company, "exam": "Round 1", "year": "2025"}, files={"file": (name, data, mime)})


# --------------------------------------------------------------------------- A6: admin routes are admin only
def admin_routes():
    """(method, path) of every admin endpoint, read from the OpenAPI schema so nested routers are included."""
    for path, ops in app.openapi()["paths"].items():
        for method in ops:
            m = method.upper()
            if path.startswith("/api/admin") or (path.startswith("/api/placements") and m in {"POST", "PUT", "PATCH", "DELETE"}):
                yield m, re.sub(r"\{[^}]+\}", "x", path)


async def test_every_admin_route_rejects_anonymous_and_student_tokens(client, student, seeded):
    routes = list(admin_routes())
    assert len(routes) >= 25, routes
    for method, path in routes:
        anon = await client.request(method, path)
        assert anon.status_code == 401, (method, path, anon.status_code)
        stu = await client.request(method, path, headers=bearer(student["token"]))
        assert stu.status_code == 403, (method, path, stu.status_code)


def test_docs_are_off_and_cors_is_narrow_in_production():
    code = (
        "import os, json\n"
        "os.environ.update(ENV='production', JWT_SECRET_KEY='prod-' + 'k9' * 30, FRONTEND_URL='https://app.example.com', "
        "ENABLE_DEMO_ACCOUNTS='false', ENABLE_MEMORY_FALLBACK='false')\n"
        "from app.main import app\n"
        "cors = next(m for m in app.user_middleware if m.cls.__name__ == 'CORSMiddleware')\n"
        "print(json.dumps({'docs': app.docs_url, 'redoc': app.redoc_url, 'openapi': app.openapi_url, 'origins': cors.kwargs['allow_origins']}))\n"
    )
    env = {k: v for k, v in os.environ.items() if k not in ("ENV",)}
    out = subprocess.run([sys.executable, "-c", code], cwd=Path(__file__).resolve().parent.parent, env=env, capture_output=True, text=True, timeout=120)
    assert out.returncode == 0, out.stderr[-600:]
    info = json.loads(out.stdout.strip().splitlines()[-1])
    assert info["docs"] is None and info["redoc"] is None and info["openapi"] is None
    assert info["origins"] == ["https://app.example.com"]


async def test_docs_are_on_and_localhost_is_allowed_in_development(client):
    assert (await client.get("/docs")).status_code == 200  # the test environment is not production
    cors = next(m for m in app.user_middleware if m.cls.__name__ == "CORSMiddleware")
    assert "http://localhost:5173" in cors.kwargs["allow_origins"]


# --------------------------------------------------------------------------- A1: enums and bodies
async def test_invalid_status_values_are_422_and_the_status_is_a_json_body(client, admin, seeded):
    ha = bearer(admin["token"])
    up = await upload(client, admin)
    qid = (await client.get(f"/api/admin/question-papers/{up.json()['id']}/questions", headers=ha)).json()[0]["id"]
    url = f"/api/admin/extracted-questions/{qid}/status"
    assert (await client.put(url, headers=ha, json={"new_status": "banana"})).status_code == 422
    assert (await client.put(url, headers=ha, params={"new_status": "approved"})).status_code == 422  # the query string no longer works
    assert (await client.put(url, headers=ha, json={})).status_code == 422
    assert (await client.put(url, headers=ha, json={"new_status": "approved"})).status_code == 200

    job = {"company": "Acme", "role": "Dev", "required_skills": ["Python"]}
    assert (await client.post("/api/placements", headers=ha, json={**job, "status": "banana"})).status_code == 422
    created = await client.post("/api/placements", headers=ha, json={**job, "status": "draft"})
    assert created.status_code == 201 and created.json()["status"] == "draft"
    pid = created.json()["id"]
    assert (await client.patch(f"/api/placements/{pid}/status", headers=ha, json={"new_status": "banana"})).status_code == 422
    assert (await client.patch(f"/api/placements/{pid}/status", headers=ha, params={"new_status": "closed"})).status_code == 422
    assert (await client.patch(f"/api/placements/{pid}/status", headers=ha, json={"new_status": "closed"})).status_code == 200
    assert (await client.get("/api/placements", headers=ha, params={"status_filter": "banana"})).status_code == 422


# --------------------------------------------------------------------------- A2 + A4: review queue and the match index
async def test_extraction_starts_as_needs_review_and_only_approved_questions_reach_students(client, admin, student, seeded):
    ha, hs = bearer(admin["token"]), bearer(student["token"])
    up = await upload(client, admin)
    assert up.status_code == 200, up.text
    pid = up.json()["id"]
    qs = (await client.get(f"/api/admin/question-papers/{pid}/questions", headers=ha)).json()
    assert len(qs) == 3 and {q["status"] for q in qs} == {"needs_review"} and all(q["approved_by"] is None for q in qs)
    before = {q["id"] for q in (await client.get("/api/previous-questions", headers=hs)).json()}
    assert not any(i.startswith("pq-ext-q-") for i in before)  # nothing from the new paper yet

    first, second, third = qs[0], qs[1], qs[2]
    probe = first["question_text"].split(". ", 1)[1]
    assert (await find_historical_question_match(probe)).matched is False  # needs_review is not indexed

    approved = await client.post(f"/api/admin/questions/{first['id']}/approve", headers=ha)
    assert approved.status_code == 200
    stored = await seeded["extracted_questions"].find_one({"id": first["id"]})
    assert stored["status"] == "approved" and stored["approved_by"] == admin["user"]["id"] and stored["approved_at"] is not None
    pq = {q["id"]: q for q in (await client.get("/api/previous-questions", headers=hs)).json()}
    assert f"pq-{first['id']}" in pq and pq[f"pq-{first['id']}"]["status"] == "published"
    hit = await find_historical_question_match(probe)
    assert hit.matched and hit.companies == ["TestCo"]  # the cache was rebuilt after the approval

    # reject / needs_review keep (or put) a question out of the pool, and the index forgets an approved one
    await client.put(f"/api/admin/extracted-questions/{second['id']}/status", headers=ha, json={"new_status": "rejected"})
    await client.put(f"/api/admin/extracted-questions/{third['id']}/status", headers=ha, json={"new_status": "needs_review"})
    pq = {q["id"] for q in (await client.get("/api/previous-questions", headers=hs)).json()}
    assert f"pq-{second['id']}" not in pq and f"pq-{third['id']}" not in pq
    await client.put(f"/api/admin/extracted-questions/{first['id']}/status", headers=ha, json={"new_status": "rejected"})
    assert f"pq-{first['id']}" not in {q["id"] for q in (await client.get("/api/previous-questions", headers=hs)).json()}
    assert (await find_historical_question_match(probe)).matched is False
    reset = await seeded["extracted_questions"].find_one({"id": first["id"]})
    assert reset["status"] == "rejected" and reset["approved_by"] is None

    await client.post(f"/api/admin/questions/{first['id']}/publish", headers=ha)  # published works the same way as approved
    assert (await find_historical_question_match(probe)).matched is True


async def test_matching_uses_only_published_previous_questions(seeded):
    await seeded["previous_questions"].insert_one({"id": "pq-draft", "status": "approved", "company": "Ghost", "companies": ["Ghost"], "exam": "x", "year": 2025,
                                                   "question_text": "Describe the zebra migration pattern in detail please", "topic": "t", "difficulty": "Easy"})
    assert (await find_historical_question_match("Describe the zebra migration pattern in detail please")).matched is False


# --------------------------------------------------------------------------- A3: OCR for scans, same limits as the resume upload
class _Fake:
    name = "fake"

    def __init__(self, confidence):
        self.confidence = confidence

    def read(self, img):
        return "1. What is a stack and where is it used in compilers?\n2. Write a SQL query to join the orders and customers tables.", self.confidence


async def test_a_scanned_paper_goes_through_ocr_and_low_confidence_flags_its_questions(client, admin, monkeypatch, seeded):
    ha = bearer(admin["token"])
    monkeypatch.setattr(rx, "get_ocr_engine", lambda: _Fake(41))
    r = await upload(client, admin, "scan.png", png(), mime="image/png")
    assert r.status_code == 200, r.text
    paper = r.json()
    assert paper["ocr_used"] is True and paper["ocr_confidence"] == 41 and paper["source_kind"] == "png" and paper["questions_count"] == 2
    assert any("low" in w.lower() for w in paper["warnings"])
    qs = (await client.get(f"/api/admin/question-papers/{paper['id']}/questions", headers=ha)).json()
    assert {q["status"] for q in qs} == {"needs_review"} and all(q["low_confidence"] and q["ocr_confidence"] == 41 for q in qs)

    monkeypatch.setattr(rx, "get_ocr_engine", lambda: _Fake(92))
    good = (await upload(client, admin, "scan2.png", png(), mime="image/png")).json()
    qs = (await client.get(f"/api/admin/question-papers/{good['id']}/questions", headers=ha)).json()
    assert {q["status"] for q in qs} == {"needs_review"} and not any(q["low_confidence"] for q in qs)  # still reviewed, not flagged


async def test_paper_upload_has_the_resume_upload_limits_and_checks(client, admin, tmp_path, monkeypatch, seeded):
    monkeypatch.setattr(tempfile, "tempdir", str(tmp_path))
    assert (await upload(client, admin, "empty.txt", b"")).status_code == 400
    assert (await upload(client, admin, "big.txt", b"a" * (8 * 1024 * 1024 + 10))).status_code == 413
    liar = await upload(client, admin, "scan.pdf", png(), mime="application/pdf")  # PNG bytes with a .pdf name
    assert liar.status_code == 400 and "PNG" in liar.json()["detail"]
    assert (await upload(client, admin, "notes.exe", b"MZ")).status_code == 400
    assert (await upload(client, admin, "bad.json", b"{not json")).status_code == 400
    ok = await upload(client, admin, "paper.json", json.dumps({"questions": [{"question": "What is polymorphism in object oriented programming?"}]}).encode(), mime="application/json")
    assert ok.status_code == 200 and ok.json()["source_kind"] == "json" and ok.json()["ocr_used"] is False
    monkeypatch.setattr(rx, "get_ocr_engine", lambda: _Fake(90))
    assert (await upload(client, admin, "scan.png", png(), mime="image/png")).status_code == 200
    assert list(tmp_path.iterdir()) == []  # the temporary copies of the uploads are gone


async def test_a_scan_without_an_ocr_engine_is_503(client, admin, monkeypatch, seeded):
    class Broken:
        def __init__(self):
            raise ImportError("nope")

    monkeypatch.setattr(rx, "_ENGINE_CLASSES", {"rapidocr": Broken, "tesseract": Broken})
    rx.reset_ocr_engines()
    try:
        r = await upload(client, admin, "scan.png", png(), mime="image/png")
        assert r.status_code == 503 and r.json()["detail"] == "OCR engine unavailable"
        assert (await upload(client, admin)).status_code == 200  # text papers need no OCR
    finally:
        rx.reset_ocr_engines()


# --------------------------------------------------------------------------- A4: pagination
async def test_pagination_bounds(client, admin, seeded):
    ha = bearer(admin["token"])
    big = "\n".join(f"{i}. Explain how algorithm number {i} sorts an array of integers efficiently." for i in range(1, 8)) + "\n"
    pid = (await upload(client, admin, data=big.encode())).json()["id"]
    for url in (f"/api/admin/question-papers/{pid}/questions", "/api/admin/extracted-questions"):
        assert (await client.get(url, headers=ha, params={"page_size": 101})).status_code == 422
        assert (await client.get(url, headers=ha, params={"page_size": 0})).status_code == 422
        assert (await client.get(url, headers=ha, params={"page": 0})).status_code == 422
    first = await client.get(f"/api/admin/question-papers/{pid}/questions", headers=ha, params={"page": 1, "page_size": 3})
    last = await client.get(f"/api/admin/question-papers/{pid}/questions", headers=ha, params={"page": 3, "page_size": 3})
    assert len(first.json()) == 3 and first.headers["x-total-count"] == "7" and len(last.json()) == 1
    assert {q["id"] for q in first.json()}.isdisjoint({q["id"] for q in last.json()})
    assert len((await client.get("/api/admin/extracted-questions", headers=ha, params={"page_size": 100})).json()) == 7

    assert (await client.get("/api/previous-questions", params={"page_size": 101})).status_code == 422
    assert (await client.get("/api/previous-questions", params={"page": 0})).status_code == 422
    two = await client.get("/api/previous-questions", params={"page_size": 2})
    assert len(two.json()) == 2 and int(two.headers["x-total-count"]) >= 6
    assert len((await client.get("/api/previous-questions", params={"page": 99})).json()) == 0


# --------------------------------------------------------------------------- A5: eligibility from the student's own profile
async def test_profile_fields_are_validated(client, student):
    h = bearer(student["token"])
    base = (await client.get("/api/student/profile", headers=h)).json()
    for bad in ({"cgpa": 10.5}, {"cgpa": -1}, {"graduation_year": 1999}, {"graduation_year": 2041}):
        assert (await client.put("/api/student/profile", headers=h, json={**base, **bad})).status_code == 422, bad
    ok = await client.put("/api/student/profile", headers=h, json={**base, "cgpa": 8.2, "branch": "Computer Science", "graduation_year": 2027})
    assert ok.status_code == 200
    got = (await client.get("/api/student/profile", headers=h)).json()
    assert got["cgpa"] == 8.2 and got["branch"] == "Computer Science" and got["graduation_year"] == 2027


def test_eligibility_rules():
    job = {"minimum_cgpa": 7.0, "eligible_branches": ["Computer Science", "IT"], "graduation_year": 2027}
    assert placement_service.eligibility(job, {})["message"] == "Add CGPA, branch, graduation year to see eligibility"
    only_cgpa = placement_service.eligibility({"minimum_cgpa": 7.0}, {})
    assert only_cgpa["state"] == "unknown" and only_cgpa["message"] == "Add CGPA to see eligibility"
    low = placement_service.eligibility(job, {"cgpa": 6.5, "branch": "Computer Science", "graduation_year": 2027})
    assert low["state"] == "not_eligible" and "7.0" in low["reasons"][0]
    assert placement_service.eligibility(job, {"cgpa": 8, "branch": "Information Technology (IT)", "graduation_year": 2027})["state"] == "eligible"
    assert placement_service.eligibility(job, {"cgpa": 8, "branch": "Mechanical", "graduation_year": 2027})["state"] == "not_eligible"
    assert placement_service.eligibility(job, {"cgpa": 8, "branch": "IT", "graduation_year": 2026})["state"] == "not_eligible"
    assert placement_service.eligibility({}, {})["message"] == "No eligibility criteria listed"  # a job with no criteria has nothing to check


async def test_placements_never_show_a_fake_match_or_eligibility(client, student, admin, seeded, db):
    h, ha = bearer(student["token"]), bearer(admin["token"])
    strict = (await client.post("/api/placements", headers=ha, json={"company": "Strict", "role": "Dev", "required_skills": ["Python"], "minimum_cgpa": 7.5})).json()
    jobs = (await client.get("/api/placements", headers=h)).json()
    assert len(jobs) == 6 and all(j["match_known"] is False and j["match_percentage"] == 0 and j["status"] == "published" for j in jobs)  # no skills yet
    by_id = {j["id"]: j for j in jobs}
    assert by_id[strict["id"]]["eligibility"] == {"state": "unknown", "message": "Add CGPA to see eligibility", "missing": ["CGPA"], "reasons": []}
    seeded_job = next(j for j in jobs if j["id"] != strict["id"])
    assert seeded_job["eligibility"]["message"] == "No eligibility criteria listed"  # nothing to check, and it says so

    await db["users"].update_one({"email": student["email"]}, {"$set": {"strong_skills": ["Python", "SQL"]}})
    base = (await client.get("/api/student/profile", headers=h)).json()
    await client.put("/api/student/profile", headers=h, json={**base, "cgpa": 5.0, "branch": "Computer Science", "graduation_year": 2027})
    jobs = {j["id"]: j for j in (await client.get("/api/placements", headers=h)).json()}
    assert all(j["match_known"] for j in jobs.values())
    assert jobs[strict["id"]]["eligibility"]["state"] == "not_eligible" and jobs[strict["id"]]["status"] == "Skill Gap Identified"
    assert jobs[strict["id"]]["match_percentage"] == 100  # the skills match; the CGPA is what rules it out
    await client.put("/api/student/profile", headers=h, json={**base, "cgpa": 8.0})
    assert {j["id"]: j for j in (await client.get("/api/placements", headers=h)).json()}[strict["id"]]["status"] == "Ready to Apply"


# --------------------------------------------------------------------------- C: notifications
async def test_assessment_completion_creates_one_notification(client, student, seeded):
    h = bearer(student["token"])
    assert (await client.get("/api/notifications", headers=h)).json() == []
    _, r = await take_assessment(client, student["token"], "asm-py-easy", correct=True)
    assert r.status_code == 200
    items = (await client.get("/api/notifications", headers=h)).json()
    assert len(items) == 1 and items[0]["type"] == "assessment_completed" and items[0]["link"] == "/assessment-results"
    assert "100%" in items[0]["body"] and items[0]["body"] == items[0]["message"] and items[0]["read"] is False
    assert (await client.post("/api/notifications/read-all", headers=h)).json() == {"updated": 1}
    assert (await client.get("/api/notifications", headers=h)).json()[0]["read"] is True
    # another student sees none of it
    other = (await register(client, email="other@example.com", name="Ot Her")).json()["access_token"]
    assert (await client.get("/api/notifications", headers=bearer(other))).json() == []


async def test_resume_scan_announces_recommended_courses_once(client, student, seeded):
    h = bearer(student["token"])
    text = "Rahul\nrahul@example.com\nSKILLS\nPython, SQL, Git\nPROJECTS\n- Built an API with Python for 20 users"
    assert (await client.post("/api/resume/analyze-text", json={"text": text, "career_path": "backend"}, headers=h)).status_code == 200
    first = [n for n in (await client.get("/api/notifications", headers=h)).json() if n["type"] == "course_recommended"]
    assert first and all(n["link"].startswith("/courses/") for n in first)
    await client.post("/api/resume/analyze-text", json={"text": text, "career_path": "backend"}, headers=h)
    again = [n for n in (await client.get("/api/notifications", headers=h)).json() if n["type"] == "course_recommended"]
    assert len(again) == len(first)  # the same course is not announced twice


async def test_approving_a_paper_notifies_students_targeting_that_company(client, admin, student, seeded):
    h = bearer(student["token"])
    base = (await client.get("/api/student/profile", headers=h)).json()
    await client.put("/api/student/profile", headers=h, json={**base, "target_companies": ["testco"]})
    bystander = (await register(client, email="by@example.com", name="By Stander")).json()["access_token"]
    pid = (await upload(client, admin)).json()["id"]
    qs = (await client.get(f"/api/admin/question-papers/{pid}/questions", headers=bearer(admin["token"]))).json()
    for q in qs[:2]:  # two approvals, one notification
        await client.post(f"/api/admin/questions/{q['id']}/approve", headers=bearer(admin["token"]))
    mine = [n for n in (await client.get("/api/notifications", headers=h)).json() if n["type"] == "paper_approved"]
    assert len(mine) == 1 and "TestCo" in mine[0]["title"] and mine[0]["link"] == "/previous-questions"
    assert (await client.get("/api/notifications", headers=bearer(bystander))).json() == []


JOB = {"company": "Acme", "role": "Backend Dev", "required_skills": ["Python", "SQL"], "status": "published"}


async def make_student(client, db, email, skills=("Python", "SQL"), verified=True, opted_in=False, name="Pat Student"):
    token = (await register(client, email=email, name=name)).json()["access_token"]
    await db["users"].update_one({"email": email}, {"$set": {"strong_skills": list(skills), "email_verified": verified, "email_notifications": opted_in}})
    return token


async def test_a_new_matching_placement_notifies_only_matching_students(client, admin, db, seeded):
    match = await make_student(client, db, "match@example.com")
    none = await make_student(client, db, "none@example.com", skills=("Excel",))
    noskills = await make_student(client, db, "noskills@example.com", skills=())
    ha = bearer(admin["token"])
    await client.post("/api/placements", headers=ha, json={**JOB, "status": "draft"})  # a draft tells nobody
    assert (await client.get("/api/notifications", headers=bearer(match))).json() == []
    created = (await client.post("/api/placements", headers=ha, json=JOB)).json()
    got = (await client.get("/api/notifications", headers=bearer(match))).json()
    assert len(got) == 1 and got[0]["type"] == "placement_match" and "Acme" in got[0]["title"] and "100%" in got[0]["body"]
    assert (await client.get("/api/notifications", headers=bearer(none))).json() == []
    assert (await client.get("/api/notifications", headers=bearer(noskills))).json() == []
    # publishing a draft later also notifies, and publishing twice does not repeat
    draft = (await client.post("/api/placements", headers=ha, json={**JOB, "company": "Beta", "status": "draft"})).json()
    await client.patch(f"/api/placements/{draft['id']}/status", headers=ha, json={"new_status": "published"})
    await client.patch(f"/api/placements/{draft['id']}/status", headers=ha, json={"new_status": "published"})
    titles = [n["title"] for n in (await client.get("/api/notifications", headers=bearer(match))).json()]
    assert sorted(titles) == ["New placement: Acme", "New placement: Beta"]
    assert created["id"]


async def test_the_deadline_check_is_idempotent_for_the_same_day(client, admin, db, seeded):
    token = await make_student(client, db, "dl@example.com")
    today = date(2027, 3, 10)
    await db["placements"].insert_one({**JOB, "id": "job-soon", "deadline": "2027-03-12"})
    await db["placements"].insert_one({**JOB, "id": "job-later", "company": "Later", "deadline": "2027-03-20"})
    await db["placements"].insert_one({**JOB, "id": "job-past", "company": "Past", "deadline": "2027-03-01"})
    await db["placements"].insert_one({**JOB, "id": "job-closed", "company": "Closed", "deadline": "2027-03-11", "status": "closed"})

    assert await notification_service.run_daily_if_due(today) is True
    assert await notification_service.run_daily_if_due(today) is False  # same day (a restart, a second worker): nothing runs
    items = [n for n in (await client.get("/api/notifications", headers=bearer(token))).json() if n["type"] == "placement_deadline"]
    assert len(items) == 1 and "2 days" in items[0]["body"] and "Acme" in items[0]["body"]
    assert await db["job_runs"].count_documents({"name": "placement_deadlines"}) == 1

    assert await notification_service.deadline_check(today) == 0  # even called directly, nobody is told twice
    assert await notification_service.run_daily_if_due(today + timedelta(days=1)) is True  # the next day it runs again
    assert len([n for n in (await client.get("/api/notifications", headers=bearer(token))).json() if n["type"] == "placement_deadline"]) == 1


async def test_a_failed_daily_run_is_retried_and_never_raises_out_of_the_loop(db, monkeypatch):
    from app.services import scheduler

    calls = {"n": 0}

    async def flaky(today=None):
        calls["n"] += 1
        if calls["n"] == 1:
            raise RuntimeError("database hiccup")

    monkeypatch.setattr(notification_service, "deadline_check", flaky)
    with pytest.raises(RuntimeError):
        await notification_service.run_daily_if_due(date(2027, 1, 1))
    assert await notification_service.run_daily_if_due(date(2027, 1, 1)) is True  # the failed day was released, so it retries

    import asyncio

    async def always_fails(today=None):
        raise RuntimeError("down")

    monkeypatch.setattr(notification_service, "run_daily_if_due", always_fails)
    task = asyncio.create_task(scheduler.daily_loop(interval=0.01))
    await asyncio.sleep(0.1)
    assert not task.done()  # the loop survived repeated failures
    task.cancel()


# --------------------------------------------------------------------------- C10: email copies
async def test_email_copies_respect_the_opt_in_and_the_verified_flag(client, admin, db, outbox, seeded):
    await make_student(client, db, "yes@example.com", opted_in=True, verified=True, name="Yes Student")
    await make_student(client, db, "unverified@example.com", opted_in=True, verified=False)
    await make_student(client, db, "optout@example.com", opted_in=False, verified=True)
    outbox.clear()  # registration sent welcome / verification mails
    await client.post("/api/placements", headers=bearer(admin["token"]), json=JOB)
    assert [m["to"] for m in outbox] == ["yes@example.com"]
    mail = outbox[0]
    assert "Acme" in mail["text"] and "/unsubscribe?token=" in mail["text"] and "/unsubscribe?token=" in mail["html"]
    # all three still got the in-app notification
    for email in ("yes@example.com", "unverified@example.com", "optout@example.com"):
        n = await db["notifications"].count_documents({"user_id": (await db["users"].find_one({"email": email}))["id"], "type": "placement_match"})
        assert n == 1, email

    outbox.clear()
    await db["placements"].insert_one({**JOB, "id": "job-dl", "company": "Soon", "deadline": (date.today() + timedelta(days=1)).isoformat()})
    await notification_service.deadline_check()
    assert [m["to"] for m in outbox] == ["yes@example.com"] and "deadline" in outbox[0]["text"].lower()
    outbox.clear()
    await notification_service.deadline_check()
    assert outbox == []  # a repeat run sends no second email


async def test_email_disabled_logs_the_type_not_the_content(client, admin, db, caplog, monkeypatch, seeded):
    from app.services import email_service

    monkeypatch.setattr(email_service.settings, "EMAIL_ENABLED", False)
    await make_student(client, db, "log@example.com", opted_in=True)
    caplog.clear()
    with caplog.at_level("INFO"):
        await client.post("/api/placements", headers=bearer(admin["token"]), json=JOB)
    text = " ".join(r.getMessage() for r in caplog.records)
    assert "placement_match" in text
    assert "Backend Dev" not in text and "unsubscribe" not in text.lower() and "log@example.com" not in text


async def test_the_email_setting_defaults_off_and_is_saved(client, student, db):
    h = bearer(student["token"])
    assert (await client.get("/api/auth/me", headers=h)).json()["email_notifications"] is False
    assert (await client.put("/api/student/settings", headers=h, json={"email_notifications": True})).json()["email_notifications"] is True
    assert (await db["users"].find_one({"email": student["email"]}))["email_notifications"] is True
    assert (await client.get("/api/auth/me", headers=h)).json()["email_notifications"] is True
    assert (await client.put("/api/student/settings", headers=h, json={"email_notifications": "maybe"})).status_code == 422


async def test_unsubscribe_link_works_once_and_rejects_a_tampered_token(client, db, student):
    user = await db["users"].find_one({"email": student["email"]})
    await db["users"].update_one({"id": user["id"]}, {"$set": {"email_notifications": True}})
    link = notification_service.unsubscribe_link(user)
    token = link.split("token=")[1]

    tampered = token[:-4] + ("AAAA" if not token.endswith("AAAA") else "BBBB")
    bad = await client.post("/api/notifications/unsubscribe", json={"token": tampered})
    assert bad.status_code == 400
    assert (await client.post("/api/notifications/unsubscribe", json={"token": "x" * 40})).status_code == 400
    assert (await db["users"].find_one({"id": user["id"]}))["email_notifications"] is True  # nothing changed

    ok = await client.post("/api/notifications/unsubscribe", json={"token": token})  # no login needed
    assert ok.status_code == 200 and ok.json()["unsubscribed"] is True
    assert (await db["users"].find_one({"id": user["id"]}))["email_notifications"] is False

    await db["users"].update_one({"id": user["id"]}, {"$set": {"email_notifications": True}})  # turned on again in Settings
    again = await client.post("/api/notifications/unsubscribe", json={"token": token})
    assert again.status_code == 400 and "already used" in again.json()["detail"]
    assert (await db["users"].find_one({"id": user["id"]}))["email_notifications"] is True  # the old link cannot switch it off again

    fresh = notification_service.unsubscribe_link(await db["users"].find_one({"id": user["id"]})).split("token=")[1]
    assert (await client.post("/api/notifications/unsubscribe", json={"token": fresh})).status_code == 200

    # a token of another type (an access token) is never accepted
    assert (await client.post("/api/notifications/unsubscribe", json={"token": student["token"]})).status_code == 400


# --------------------------------------------------------------------------- B: content editor
def good_question(**over):
    q = {"skill": "Python", "topic": "Python Fundamentals", "difficulty": "Easy", "question_type": "Conceptual",
         "question_text": "Which keyword defines a function in Python?", "options": ["def", "func", "lambda only", "fn"],
         "correct_option_index": 0, "explanation": "def introduces a function definition.", "practice": True, "companies": []}
    return {**q, **over}


async def test_the_question_editor_rejects_invalid_questions_with_a_list_of_problems(client, admin, seeded):
    ha = bearer(admin["token"])
    cases = {
        "4 options": good_question(options=["a", "b", "c"]),
        "identical options": good_question(options=["a", "a", "b", "c"]),
        "answer index": good_question(correct_option_index=4),
        "unknown skill": good_question(skill="Klingon"),
        "unknown topic": good_question(topic="Underwater Basket Weaving"),
        "bad difficulty": good_question(difficulty="Brutal"),
        "bad type": good_question(question_type="Essay"),
        "explanation": good_question(explanation="  "),
        "company": good_question(companies=["Hooli"]),
        "code output": good_question(question_type="Code Output"),
    }
    for name, body in cases.items():
        r = await client.post("/api/admin/content/questions", headers=ha, json=body)
        assert r.status_code == 422, name
        detail = r.json()["detail"]
        assert detail["message"] and isinstance(detail["errors"], list) and detail["errors"], name
    assert await seeded["assessment_questions"].count_documents({"edited_by_admin": True}) == 0

    ok = await client.post("/api/admin/content/questions", headers=ha, json=good_question())
    assert ok.status_code == 201 and ok.json()["edited_by_admin"] is True and ok.json()["active"] is True
    dup = await client.post("/api/admin/content/questions", headers=ha, json=good_question())
    assert dup.status_code == 422 and any("duplicate question text" in e for e in dup.json()["detail"]["errors"])
    same_id = await client.post("/api/admin/content/questions", headers=ha, json=good_question(id="py-easy-01", question_text="A different question entirely?"))
    assert same_id.status_code == 422 and any("already exists" in e for e in same_id.json()["detail"]["errors"])


async def test_create_edit_and_deactivate_a_question(client, admin, student, seeded):
    ha, hs = bearer(admin["token"]), bearer(student["token"])
    created = (await client.post("/api/admin/content/questions", headers=ha, json=good_question(skill="Python", companies=["TCS"]))).json()
    qid = created["id"]
    assert qid in {q["id"] for q in (await client.get("/api/practice/questions", headers=hs, params={"skill": "Python"})).json()}

    edited = await client.put(f"/api/admin/content/questions/{qid}", headers=ha, json=good_question(question_text="Which keyword starts a function definition in Python?", correct_option_index=0))
    assert edited.status_code == 200 and edited.json()["question_text"].startswith("Which keyword starts")
    assert (await client.put(f"/api/admin/content/questions/{qid}", headers=ha, json=good_question(options=["a", "b"]))).status_code == 422
    assert (await client.put("/api/admin/content/questions/nope", headers=ha, json=good_question())).status_code == 404
    assert (await client.put(f"/api/admin/content/questions/{qid}", headers=ha, json=good_question(id="other"))).status_code == 422

    assert (await client.post(f"/api/admin/content/questions/{qid}/deactivate", headers=ha)).json() == {"id": qid, "active": False}
    assert qid not in {q["id"] for q in (await client.get("/api/practice/questions", headers=hs)).json()}
    assert (await client.get(f"/api/practice/questions/{qid}", headers=hs)).status_code == 404
    listed = (await client.get("/api/admin/content/questions", headers=ha, params={"active": "false"})).json()
    assert [q["id"] for q in listed] == [qid] and listed[0]["correct_option_index"] == 0  # the admin list shows the key
    assert (await client.post(f"/api/admin/content/questions/{qid}/activate", headers=ha)).json()["active"] is True
    assert qid in {q["id"] for q in (await client.get("/api/practice/questions", headers=hs)).json()}
    page = await client.get("/api/admin/content/questions", headers=ha, params={"page_size": 5, "skill": "Python"})
    assert len(page.json()) == 5 and int(page.headers["x-total-count"]) > 5


async def test_deactivated_questions_are_left_out_of_new_assessment_sessions(client, admin, student, seeded):
    ha = bearer(admin["token"])
    first = (await client.post("/api/assessments/asm-py-easy/start", headers=bearer(student["token"]))).json()
    gone = first["questions"][0]["id"]
    await client.post(f"/api/admin/content/questions/{gone}/deactivate", headers=ha)
    other = (await register(client, email="s2@example.com", name="Se Cond")).json()["access_token"]
    second = (await client.post("/api/assessments/asm-py-easy/start", headers=bearer(other))).json()
    assert gone not in {q["id"] for q in second["questions"]} and len(second["questions"]) == 7


async def test_edited_by_admin_items_survive_a_reseed(client, admin, seeded):
    ha = bearer(admin["token"])
    # a seeded question, a seeded course and a seeded career path, all edited by the admin
    q = await seeded["assessment_questions"].find_one({"id": "py-easy-02"})
    body = {k: q[k] for k in ("skill", "topic", "difficulty", "question_type", "options", "correct_option_index", "explanation", "practice", "companies")}
    body["question_text"] = "ADMIN EDITED: " + q["question_text"]
    assert (await client.put("/api/admin/content/questions/py-easy-02", headers=ha, json=body)).status_code == 200

    course = await seeded["courses"].find_one({"slug": "dsa"})
    cbody = {k: course[k] for k in ("slug", "title", "level", "description", "skills", "prerequisites", "modules", "outcomes", "practice_topics", "assessment_skills", "resources")}
    cbody["title"] = "Admin DSA"
    assert (await client.put("/api/admin/content/courses/dsa", headers=ha, json=cbody)).status_code == 200

    path = await seeded["career_paths"].find_one({"id": "cloud"})
    pbody = {"title": "Cloud Wizard", "required_skills": ["Docker"], "milestones": [{"id": m["id"], "number": m["number"], "title": m["title"], "skills": m["skills"]} for m in path["milestones"]]}
    assert (await client.put("/api/admin/content/career-paths/cloud", headers=ha, json=pbody)).status_code == 200

    await client.post("/api/admin/content/questions/py-easy-03/deactivate", headers=ha)
    report = await seed_collections(seeded)  # python -m app.seed again
    assert report["assessment_questions"]["skipped"] >= 2 and report["courses"]["skipped"] >= 1 and report["career_paths"]["skipped"] >= 1
    assert (await seeded["assessment_questions"].find_one({"id": "py-easy-02"}))["question_text"].startswith("ADMIN EDITED")
    assert (await seeded["assessment_questions"].find_one({"id": "py-easy-03"}))["active"] is False  # a deactivated seed question stays off
    assert (await seeded["courses"].find_one({"slug": "dsa"}))["title"] == "Admin DSA"
    assert (await seeded["career_paths"].find_one({"id": "cloud"}))["title"] == "Cloud Wizard"
    assert (await seeded["assessment_questions"].find_one({"id": "py-easy-04"})).get("edited_by_admin") is None  # untouched ones are still refreshed


async def test_course_editor_validation_and_deactivation(client, admin, student, seeded):
    ha = bearer(admin["token"])
    course = await seeded["courses"].find_one({"slug": "dsa"})
    base = {k: course[k] for k in ("title", "level", "description", "skills", "prerequisites", "modules", "outcomes", "practice_topics", "assessment_skills", "resources")}
    new = {**base, "slug": "my-new-course", "title": "My New Course", "prerequisites": [], "modules": [{**m, "id": None} for m in base["modules"]]}
    for name, bad in {"skills": {**new, "skills": ["Made Up Skill"]}, "modules": {**new, "modules": new["modules"][:3]}, "deep link": {**new, "resources": [{"provider": "x", "url": "https://x.org/deep/link"}, {"provider": "y", "url": "https://y.org/"}]},
                      "level": {**new, "level": "Expert"}, "slug": {**new, "slug": "Bad Slug"}, "dup": {**new, "slug": "dsa"}}.items():
        r = await client.post("/api/admin/content/courses", headers=ha, json=bad)
        assert r.status_code == 422 and r.json()["detail"]["errors"], name
    ok = await client.post("/api/admin/content/courses", headers=ha, json=new)
    assert ok.status_code == 201 and ok.json()["estimated_hours"] > 0 and ok.json()["modules"][0]["id"].startswith("my-new-course-m")
    assert "my-new-course" in {c["slug"] for c in (await client.get("/api/courses")).json()}
    await client.post("/api/admin/content/courses/my-new-course/deactivate", headers=ha)
    assert "my-new-course" not in {c["slug"] for c in (await client.get("/api/courses")).json()}
    assert (await client.get("/api/courses/my-new-course")).status_code == 404
    assert "my-new-course" in {c["slug"] for c in (await client.get("/api/admin/content/courses", headers=ha)).json()}
    assert (await client.put("/api/admin/content/courses/my-new-course", headers=ha, json={**new, "slug": "renamed"})).status_code == 422


async def test_career_path_editor_validates_and_a_rename_keeps_student_progress(client, admin, student, seeded):
    ha, hs = bearer(admin["token"]), bearer(student["token"])
    await client.post("/api/student/career-path", headers=hs, json={"career_path_title": "Python Developer"})
    first = (await client.get("/api/student/roadmap", headers=hs)).json()["milestones"][0]["id"]
    await client.put("/api/student/roadmap/progress", headers=hs, json={"milestone_id": first, "status": "completed"})

    path = await seeded["career_paths"].find_one({"id": "python"})
    ms = [{"id": m["id"], "number": m["number"], "title": m["title"], "skills": m["skills"], "description": m["description"]} for m in path["milestones"]]
    for name, bad in {"title": {"title": " ", "required_skills": ["Python"], "milestones": ms},
                      "skills": {"title": "X", "required_skills": [], "milestones": ms},
                      "numbers": {"title": "X", "required_skills": ["Python"], "milestones": [{**ms[0], "number": 5}] + ms[1:]},
                      "dup title": {"title": "Backend Developer", "required_skills": ["Python"], "milestones": ms},
                      "no milestones": {"title": "X", "required_skills": ["Python"], "milestones": []}}.items():
        r = await client.put("/api/admin/content/career-paths/python", headers=ha, json=bad)
        assert r.status_code == 422 and r.json()["detail"]["errors"], name

    ok = await client.put("/api/admin/content/career-paths/python", headers=ha, json={"title": "Python Engineer", "required_skills": ["Python", "SQL"], "milestones": ms})
    assert ok.status_code == 200 and ok.json()["renamed_records"]["roadmaps"] == 1
    assert (await client.get("/api/student/profile", headers=hs)).json()["career_path"] == "Python Engineer"
    road = (await client.get("/api/student/roadmap", headers=hs)).json()
    assert road["career_path"] == "Python Engineer" and road["completion_percentage"] == 10  # the saved progress followed the rename
    assert (await client.put("/api/admin/content/career-paths/nope", headers=ha, json={"title": "X", "required_skills": ["a"], "milestones": ms})).status_code == 404


def test_the_script_and_the_editor_share_one_set_of_rules():
    from app.data.assessment_bank import ASSESSMENT_QUESTION_BANK
    from app.services import content_validation as rules

    assert all(rules.question_problems(q) == [] for q in ASSESSMENT_QUESTION_BANK)
    assert rules.question_problems({**ASSESSMENT_QUESTION_BANK[0], "options": ["a", "b"]})
