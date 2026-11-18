"""End-to-end smoke test against the REAL backend and the REAL database (Atlas). Not part of pytest.

    1. start the backend:     npm run backend      (or run_dev.bat / run_dev.sh)
    2. from backend/:         .venv\\Scripts\\python.exe scripts\\smoke_test.py [--base http://127.0.0.1:8000/api]

A throwaway student (p3-test-smoke-<time>@example.com) walks through: register, login, pick a career path, take an assessment,
dashboard numbers from that attempt, run one tiny program on the online compiler (needs internet), upload the JPG resume fixture
(OCR), ATS-style score + fixes + recommended courses, a company question set, the PDF report. If ADMIN_TEST_EMAIL and
ADMIN_TEST_PASSWORD are set it also does: admin login, upload a TXT paper, approve a question, the student finds it, and a
notification exists. Everything it created is deleted at the end. Passwords and tokens are never printed.
Exit code 0 only when nothing FAILED (a SKIP is not a failure; it says why).
"""
import argparse
import os
import secrets
import sys
import time
from datetime import datetime, timedelta
from pathlib import Path

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

FIXTURE = Path(__file__).resolve().parent.parent / "tests" / "fixtures" / "resume_photo.jpg"
PAPER = (
    "1. Describe how a bloom filter reduces disk lookups in a distributed key value store.\n"
    "2. Explain why a skip list gives logarithmic search time without rebalancing like a tree.\n"
    "3. Compare write ahead logging with shadow paging for crash recovery in a database engine.\n"
)

rows = []  # (step, status, detail)


def record(step: str, status: str, detail: str = "") -> bool:
    rows.append((step, status, detail))
    print(f"  [{status}] {step}{' - ' + detail if detail else ''}", flush=True)
    return status == "PASS"


def check(step: str, fn):
    """Run one step; an assertion or HTTP error is a FAIL with its message, never a crash."""
    try:
        detail = fn()
        return record(step, "PASS", detail or "")
    except AssertionError as exc:
        return record(step, "FAIL", str(exc)[:200] or "assertion failed")
    except httpx.HTTPError as exc:
        return record(step, "FAIL", f"{type(exc).__name__}")
    except Exception as exc:  # anything unexpected is still a clear FAIL line
        return record(step, "FAIL", f"{type(exc).__name__}: {str(exc)[:150]}")


def ok(resp: httpx.Response, *statuses: int) -> dict:
    wanted = statuses or (200,)
    assert resp.status_code in wanted, f"HTTP {resp.status_code} {resp.request.method} {resp.request.url.path}: {resp.text[:160]}"
    return resp.json() if "json" in resp.headers.get("content-type", "") else {}


def cleanup(email: str, since, papers: list) -> str:
    """Delete everything this run created (database access like scripts/check_db.py; prints counts only)."""
    from pymongo import MongoClient

    from app.config import settings

    options = {"tls": True} if settings.MONGODB_URL.startswith("mongodb+srv://") else {}
    db = MongoClient(settings.MONGODB_URL, serverSelectionTimeoutMS=8000, **options)[settings.DATABASE_NAME]
    removed = 0
    user = db["users"].find_one({"email": email})
    if user:
        uid = user["id"]
        for name in ("student_profiles", "practice_attempts", "assessment_attempts", "roadmaps", "email_verifications", "password_resets",
                     "resume_analyses", "assessment_sessions", "course_progress", "notifications"):
            removed += db[name].delete_many({"user_id": uid}).deleted_count
        removed += db["users"].delete_one({"id": uid}).deleted_count
    for paper_id in papers:
        paper = db["question_papers"].find_one({"id": paper_id, "uploaded_at": {"$gte": since}})
        if not paper:
            continue
        ids = [d["id"] for d in db["extracted_questions"].find({"paper_id": paper_id}, {"id": 1})]
        removed += db["extracted_questions"].delete_many({"paper_id": paper_id}).deleted_count
        removed += db["previous_questions"].delete_many({"id": {"$in": [f"pq-{i}" for i in ids]}}).deleted_count
        removed += db["notifications"].delete_many({"dedupe_key": f"paper:{paper_id}"}).deleted_count
        removed += db["question_papers"].delete_one({"id": paper_id}).deleted_count
    return f"{removed} records removed"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base", default="http://127.0.0.1:8000/api")
    args = parser.parse_args()
    base = args.base.rstrip("/")
    root = base.rsplit("/api", 1)[0] if base.endswith("/api") else base

    stamp = int(time.time())
    email = f"p3-test-smoke-{stamp}@example.com"
    password = f"Aa1-{secrets.token_urlsafe(12)}"
    since = datetime.utcnow() - timedelta(seconds=5)
    state = {"papers": []}
    http = httpx.Client(base_url=base, timeout=60)
    auth = {}

    print(f"SkillSense AI smoke test against {base}\n")
    try:
        health = httpx.get(f"{root}/health", timeout=15)
    except httpx.HTTPError:
        print("The backend is not reachable. Start it first (npm run backend, or run_dev.bat / run_dev.sh).")
        return 2
    if health.status_code != 200:
        print(f"/health answered {health.status_code}: the database is not connected. Fix backend/.env and try again.")
        return 2
    record("health: backend and database up", "PASS", health.json().get("database_name", ""))

    try:
        # ---- student journey -------------------------------------------------------------------------------------
        def register():
            data = ok(http.post("/auth/register", json={"name": "Smoke Test", "email": email, "password": password}), 201)
            assert data["user"]["role"] == "student" and data["user"]["assessments_completed"] == 0
        check("register a throwaway student", register)

        def login():
            data = ok(http.post("/auth/login", json={"email": email, "password": password}))
            auth["Authorization"] = f"Bearer {data['access_token']}"
            assert (http.get("/auth/me", headers=auth)).json()["email"] == email
        if not check("login", login):
            raise SystemExit  # nothing else can work

        def pick_path():
            ok(http.post("/student/career-path", headers=auth, json={"career_path_title": "Python Developer"}))
            assert http.get("/student/profile", headers=auth).json()["career_path"] == "Python Developer"
        check("pick the Python Developer career path", pick_path)

        result = {}

        def assessment():
            started = ok(http.post("/assessments/asm-py-easy/start", headers=auth))
            assert len(started["questions"]) == 8 and all(q["correct_option_index"] is None for q in started["questions"]), "answer keys must be hidden"
            answers = {q["id"]: 0 for q in started["questions"]}
            done = ok(http.post("/assessments/asm-py-easy/submit", headers=auth, json={"session_id": started["session_id"], "answers": answers}))
            result.update(done)
            assert done["total_questions"] == 8 and len(done["review"]) == 8
            assert http.post("/assessments/asm-py-easy/submit", headers=auth, json={"session_id": started["session_id"], "answers": {}}).status_code == 409
            return f"score {done['overall_score']}%"
        has_result = check("start and submit an assessment (a second submit is refused)", assessment)

        def dashboard():
            assert has_result, "needs the assessment step"
            dash = ok(http.get("/student/dashboard", headers=auth))
            assert dash["assessments_completed"] == 1 and dash["assessment_score"] == result["overall_score"], "dashboard does not match the attempt"
            expected = round(0.4 * result["overall_score"] + 0.10 * round(100 / 14))
            assert dash["career_readiness"] == expected, f"readiness {dash['career_readiness']} != {expected}"
            return f"readiness {dash['career_readiness']}% from that one attempt"
        check("dashboard numbers come from that attempt", dashboard)

        def compiler():
            good = "class Solution:\n    def add_numbers(self, a: int, b: int) -> int:\n        return a + b\n"
            r = http.post("/practice/code/run", headers=auth, json={"language": "python", "source_code": good, "problem_slug": "sum-two-numbers"}, timeout=90)
            if r.status_code in (429, 503):
                raise AssertionError(f"the online compiler is busy or unreachable ({r.status_code}): {r.json().get('detail', '')[:100]}")
            data = ok(r)
            assert data["status"] == "Accepted" and len(data["cases"]) == 3 and all(c["passed"] for c in data["cases"]), f"unexpected result {data.get('status')}"
        check("run one function on the online compiler (all examples pass)", compiler)

        analysis = {}

        def resume():
            assert FIXTURE.exists(), "fixture tests/fixtures/resume_photo.jpg is missing"
            r = http.post("/resume/analyze", headers=auth, data={"career_path": "backend"},
                          files={"file": ("resume_photo.jpg", FIXTURE.read_bytes(), "image/jpeg")}, timeout=120)
            if r.status_code == 503 and "OCR" in r.text:
                return "SKIP"
            data = ok(r)
            analysis.update(data)
            assert data["ocr_used"] is True and 0 <= data["overall_score"] <= 100 and data["fixes"], "no OCR score or fixes"
            return f"ATS-style score {data['overall_score']}/100, {len(data['fixes'])} fixes, OCR {data.get('ocr_confidence')}%"
        try:
            detail = resume()
            if detail == "SKIP":
                record("upload the JPG resume (OCR)", "SKIP", "no OCR engine could be loaded on the server (pip install rapidocr-onnxruntime)")
            else:
                record("upload the JPG resume (OCR): score and fixes", "PASS", detail)
        except AssertionError as exc:
            record("upload the JPG resume (OCR): score and fixes", "FAIL", str(exc)[:200])
        except Exception as exc:
            record("upload the JPG resume (OCR): score and fixes", "FAIL", f"{type(exc).__name__}")

        def courses():
            data = ok(http.get("/recommendations/courses", headers=auth))
            assert data["courses"] and all(c.get("reasons") for c in data["courses"]), "no recommended courses with reasons"
            return f"{len(data['courses'])} courses, first: {data['courses'][0]['title']}"
        check("recommended courses with reasons", courses)

        def company_questions():
            if not analysis:
                raise AssertionError("needs the resume step")
            data = ok(http.get("/resume/questions", headers=auth, params={"analysis_id": analysis["analysis_id"], "company": "TCS"}))
            assert data["questions"] or data["note"], "neither questions nor a note"
            return f"{len(data['questions'])} TCS-style questions, {len(data['prompts'])} prompts"
        check("resume questions for a company (TCS)", company_questions)

        def report():
            r = http.get("/student/report.pdf", headers=auth)
            assert r.status_code == 200 and r.content.startswith(b"%PDF-") and r.content.rstrip().endswith(b"%%EOF"), f"HTTP {r.status_code}, not a PDF"
            return f"{len(r.content)} bytes"
        check("download the report PDF", report)

        # ---- admin part (only with a real admin account) ---------------------------------------------------------------
        admin_email, admin_password = os.environ.get("ADMIN_TEST_EMAIL"), os.environ.get("ADMIN_TEST_PASSWORD")
        if not (admin_email and admin_password):
            record("admin: upload, approve, student finds it, notification", "SKIP", "ADMIN_TEST_EMAIL / ADMIN_TEST_PASSWORD are not set")
        else:
            admin = httpx.Client(base_url=base, timeout=60)

            def admin_flow():
                prof = http.get("/student/profile", headers=auth).json()
                ok(http.put("/student/profile", headers=auth, json={**prof, "target_companies": ["Other"]}))
                token = ok(admin.post("/auth/admin/login", json={"email": admin_email, "password": admin_password}))["access_token"]
                ah = {"Authorization": f"Bearer {token}"}
                paper = ok(admin.post("/admin/question-papers/upload", headers=ah, data={"company": "Other", "exam": f"Smoke Test {stamp}", "year": "2025"},
                                      files={"file": ("smoke-paper.txt", PAPER.encode(), "text/plain")}))
                state["papers"].append(paper["id"])
                qs = ok(admin.get(f"/admin/question-papers/{paper['id']}/questions", headers=ah))
                assert len(qs) == 3 and {q["status"] for q in qs} == {"needs_review"}, "extraction must start as needs_review"
                visible = ok(http.get("/previous-questions", headers=auth, params={"company": "Other", "page_size": 100}))
                assert f"pq-{qs[0]['id']}" not in {q["id"] for q in visible}, "an unreviewed question is visible to students"
                ok(admin.post(f"/admin/questions/{qs[0]['id']}/approve", headers=ah))
                visible = ok(http.get("/previous-questions", headers=auth, params={"company": "Other", "page_size": 100}))
                assert f"pq-{qs[0]['id']}" in {q["id"] for q in visible}, "the approved question is not searchable"
                notes = ok(http.get("/notifications", headers=auth))
                assert any(n["type"] == "paper_approved" for n in notes), "no paper_approved notification"
                assert any(n["type"] == "assessment_completed" for n in notes), "no assessment_completed notification"
                return "approved question found by the student; notifications present"
            check("admin: upload TXT paper, approve, student finds it, notification exists", admin_flow)
    except SystemExit:
        pass
    finally:
        try:
            record("cleanup: delete the throwaway data", "PASS", cleanup(email, since, state["papers"]))
        except Exception as exc:
            record("cleanup: delete the throwaway data", "FAIL", f"{type(exc).__name__} - delete {email} by hand")

    print("\n  Step                                                                  Result")
    print("  " + "-" * 84)
    for step, status, detail in rows:
        print(f"  {step[:68]:<68}  {status}")
    failed = [r for r in rows if r[1] == "FAIL"]
    skipped = [r for r in rows if r[1] == "SKIP"]
    print(f"\n  {sum(r[1] == 'PASS' for r in rows)} passed, {len(failed)} failed, {len(skipped)} skipped")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
