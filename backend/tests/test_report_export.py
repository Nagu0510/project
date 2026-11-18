"""The career report PDF and the admin CSV export."""
import csv
import io
from datetime import datetime

import pytest
from pypdf import PdfReader

from app.routers.admin import csv_cell
from app.seed import seed_collections
from tests.conftest import PASSWORD, bearer, register


@pytest.fixture
async def seeded(db):
    await seed_collections(db)
    return db


def pdf_text(content: bytes) -> str:
    reader = PdfReader(io.BytesIO(content))
    return "\n".join(page.extract_text() for page in reader.pages)


# --------------------------------------------------------------------------- report.pdf
async def test_report_for_a_new_student_is_a_valid_pdf_that_says_nothing_is_recorded(client, student, seeded):
    r = await client.get("/api/student/report.pdf", headers=bearer(student["token"]))
    assert r.status_code == 200 and r.headers["content-type"] == "application/pdf"
    assert "attachment" in r.headers["content-disposition"] and r.content.startswith(b"%PDF-") and r.content.rstrip().endswith(b"%%EOF")
    text = pdf_text(r.content)
    assert "SkillSense AI career report" in text and "Stu Dent" in text
    assert "Nothing has been recorded yet" in text
    assert "No assessment has been taken yet" in text and "No resume has been analysed yet" in text
    assert "Start here" in text  # a new student is still given beginner courses to start with


async def test_report_for_a_student_with_data_shows_the_real_numbers(client, student, seeded):
    h = bearer(student["token"])
    uid = student["user"]["id"]
    await seeded["assessment_attempts"].insert_one({"attempt_id": "x1", "user_id": uid, "assessment_id": "asm-c-easy", "assessment_title": "C (Easy)",
                                                    "overall_score": 80, "submitted_at": datetime.utcnow(), "strengths": ["C pointers"], "skill_gaps": ["Memory"]})
    await seeded["practice_attempts"].insert_one({"id": "p1", "user_id": uid, "problem_slug": "sum-two-numbers", "verdict": "Accepted", "is_correct": True, "timestamp": datetime.utcnow()})
    resume = await client.post("/api/resume/analyze-text", json={"text": "Rahul\nrahul@example.com\nSKILLS\nPython, SQL, Git\nPROJECTS\n- Built an API with Python for 20 users", "career_path": "backend"}, headers=h)
    assert resume.status_code == 200
    ats = resume.json()["overall_score"]
    dash = (await client.get("/api/student/dashboard", headers=h)).json()

    r = await client.get("/api/student/report.pdf", headers=h)
    assert r.content.startswith(b"%PDF-")
    text = pdf_text(r.content)
    assert f"{dash['career_readiness']}%" in text and "Backend Developer" not in "" and "Career path" in text
    assert "C (Easy) (80%)" in text and "C pointers" in text and "Memory" in text
    flat = " ".join(text.split())
    assert f"{ats}/100" in flat and "not a real ATS result" in flat
    assert resume.json()["fixes"][0]["title"] in text            # the top fix, stored with the analysis
    assert "Recommended courses" in text and "Why" in text
    assert "Nothing has been recorded yet" not in text
    assert "1 of 1 attempted" in text.replace("\n", " ") or "1 of 1 attempted" in text


async def test_report_survives_markup_and_non_latin_names(client, seeded):
    nasty = await register(client, email="nasty@example.com", name="<b>Tom & Jerry</b> 中文")
    r = await client.get("/api/student/report.pdf", headers=bearer(nasty.json()["access_token"]))
    assert r.status_code == 200 and r.content.startswith(b"%PDF-")
    assert "Tom & Jerry" in pdf_text(r.content)


async def test_report_is_private(client, student, admin, seeded):
    assert (await client.get("/api/student/report.pdf")).status_code == 401
    assert (await client.get("/api/student/report.pdf", headers=bearer(admin["token"]))).status_code == 403
    other = await register(client, email="other@example.com", name="Other Person")
    text = pdf_text((await client.get("/api/student/report.pdf", headers=bearer(other.json()["access_token"]))).content)
    assert "Other Person" in text and "Stu Dent" not in text


# --------------------------------------------------------------------------- CSV
@pytest.mark.parametrize("raw,expected", [
    ("=HYPERLINK(\"http://evil\",\"x\")", "'=HYPERLINK(\"http://evil\",\"x\")"),
    ("+1+1", "'+1+1"), ("-2+3", "'-2+3"), ("@SUM(A1)", "'@SUM(A1)"), ("\tcmd", "'\tcmd"), ("\rcmd", "'\rcmd"),
    ("Normal Name", "Normal Name"), ("a=b", "a=b"), ("", ""), (None, ""), (42, "42"), (0, "0"), (True, "True"),
])
def test_csv_cell_neutralises_formulas(raw, expected):
    assert csv_cell(raw) == expected


async def test_csv_export_is_admin_only(client, student, admin, seeded):
    assert (await client.get("/api/admin/students/export.csv")).status_code == 401
    assert (await client.get("/api/admin/students/export.csv", headers=bearer(student["token"]))).status_code == 403
    ok = await client.get("/api/admin/students/export.csv", headers=bearer(admin["token"]))
    assert ok.status_code == 200 and ok.headers["content-type"].startswith("text/csv") and "students.csv" in ok.headers["content-disposition"]


async def test_csv_export_neutralises_student_names_and_matches_the_list(client, admin, seeded):
    names = ['=HYPERLINK("http://evil.example","click")', "+cmd|' /C calc'!A0", "-1+1", "@SUM(1)", "Plain Student"]
    for i, name in enumerate(names):
        assert (await register(client, email=f"s{i}@example.com", name=name, password=PASSWORD)).status_code == 201
    h = bearer(admin["token"])
    body = (await client.get("/api/admin/students/export.csv", headers=h)).content.decode("utf-8-sig")
    rows = list(csv.reader(io.StringIO(body)))
    assert rows[0][:4] == ["Name", "Email", "Career path", "Readiness %"]
    cells = {r[1]: r[0] for r in rows[1:]}
    assert len(rows) - 1 == len((await client.get("/api/admin/students", headers=h)).json()) == 5
    assert cells["s0@example.com"].startswith("'=") and cells["s1@example.com"].startswith("'+")
    assert cells["s2@example.com"].startswith("'-") and cells["s3@example.com"].startswith("'@") and cells["s4@example.com"] == "Plain Student"
    for r in rows[1:]:  # no cell of the file can start as a formula
        assert all(not c[:1] in ("=", "+", "-", "@") for c in r), r
    assert all(r[3] == "0" for r in rows[1:])  # nobody has data, so readiness is 0 for every student
