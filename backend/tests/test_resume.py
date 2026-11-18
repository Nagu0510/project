"""Resume analyzer: extraction (text, OCR), skill detection, scoring, evidence, history. No network."""
import asyncio
import io
import tempfile
from pathlib import Path

import pytest

from app.data import skills as catalog
from app.data.career_config import CAREER_PATHS_CONFIG
from app.seed import seed_collections
from app.services import resume_extract as rx
from app.services import resume_service as rs
from tests.conftest import PASSWORD, bearer, register

FIXTURES = Path(__file__).parent / "fixtures"
BACKEND_ROLE = CAREER_PATHS_CONFIG["backend"]
CLOUD_ROLE = CAREER_PATHS_CONFIG["cloud"]


def fx(name: str) -> bytes:
    return (FIXTURES / name).read_bytes()


def detected(text: str) -> set:
    return set(rs.detect_skills(rs.parse_sections(text)))


def require_ocr():
    rx.reset_ocr_engines()
    try:
        rx.get_ocr_engine()
    except rx.OcrUnavailable:
        pytest.skip("no OCR engine could be loaded on this machine (pip install rapidocr-onnxruntime)")


@pytest.fixture
async def seeded(db):
    await seed_collections(db)
    return db


async def analyze(client, student, name, role="backend", jd=None, mime="application/octet-stream", data=None):
    form = {"career_path": role}
    if jd:
        form["job_description"] = jd
    return await client.post(
        "/api/resume/analyze", files={"file": (name, data if data is not None else fx(name), mime)}, data=form, headers=bearer(student["token"]),
    )


# ---------------------------------------------------------------------------
# Skill detection: ambiguous aliases
# ---------------------------------------------------------------------------
def test_c_education_heading_is_not_the_c_language():
    assert "C" not in detected("AARAV\n\nC. Education\nB.Tech in Computer Science, 2026\n\nSkills: Python, SQL")
    assert "C" not in detected("A. Summary\nB. Skills\nPython\nC. Education\nB.Tech")


def test_c_counts_in_skills_and_with_context():
    assert "C" in detected("SKILLS\nLanguages: Python, C, SQL")
    assert "C" in detected("PROJECTS\n- Wrote a parser in C programming for a course")
    assert "C" in detected("Worked with C/C++ for data structures")
    assert "C++" in detected("SKILLS\nC++, Java") and "C" not in detected("SKILLS\nC++, Java")


def test_os_outside_skills_is_ignored_but_the_phrase_counts():
    assert "Operating Systems" not in detected("PROJECTS\n- Improved the OS boot time of a Raspberry Pi demo by 20%")
    assert "Operating Systems" in detected("COURSEWORK\nOperating Systems, Computer Networks")
    assert "Operating Systems" in detected("SKILLS\nOS, Linux, Git")


def test_other_ambiguous_aliases():
    plain = detected("EXPERIENCE\n- Led the rest of the team to go live with the node of the spring release in ml class")
    assert not plain & {"REST API", "Go", "Node.js", "Spring Boot", "Machine Learning", "R"}
    skills_line = detected("SKILLS\nGo, R, ML, DL, Node, Spring, Py, REST")
    assert {"Go", "R", "Machine Learning", "Deep Learning", "Node.js", "Spring Boot", "Python", "REST API"} <= skills_line
    assert "REST API" in detected("PROJECTS\n- Built a REST API for orders")


def test_cpp_csharp_dotnet_node_next_are_exact():
    found = detected("SKILLS\nC++, C#, .NET, Node.js, Next.js, JavaScript")
    assert {"C++", "C#", ".NET", "Node.js", "Next.js", "JavaScript"} <= found
    assert "C" not in found and "Java" not in found
    assert "Java" not in detected("SKILLS\nJavaScript, TypeScript") and "JavaScript" in detected("SKILLS\nJavaScript")
    assert detected("SKILLS\nNext.js") == {"Next.js"}


def test_catalog_covers_the_required_skills():
    wanted = ["C", "C++", "Python", "Java", "JavaScript", "TypeScript", "HTML", "CSS", "React", "Node.js", "SQL", "MongoDB", "DSA", "OOP",
              "Operating Systems", "DBMS", "Computer Networks", "Git", "Docker", "AWS", "Linux", "NumPy", "Pandas", "Scikit-learn", "TensorFlow",
              "PyTorch", "Machine Learning", "Deep Learning", "NLP", "Computer Vision", "Generative AI"]
    assert [w for w in wanted if w not in catalog.SKILLS_BY_NAME] == []


def test_every_career_path_requirement_maps_to_catalog_skills():
    for cfg in CAREER_PATHS_CONFIG.values():
        for label in cfg["required_skills"]:
            alternatives = catalog.requirement_alternatives(label)
            assert alternatives, f"{cfg['title']}: no catalog skill for '{label}'"
            assert all(a in catalog.SKILLS_BY_NAME for a in alternatives)


# ---------------------------------------------------------------------------
# Sections
# ---------------------------------------------------------------------------
def test_headings_survive_ocr_noise_and_enumerators():
    text = "NAME\nEducatlon\nB.Tech\nPR0JECTS\nA project\nSk1lls: Python\nC. Experience\nIntern"
    order = rs.parse_sections(text)["order"]
    assert order == ["education", "projects", "skills", "experience"]


def test_skills_heading_with_inline_list():
    parsed = rs.parse_sections("Technical Skills: Python, C, SQL\nPROJECTS\n- x")
    assert parsed["order"] == ["skills", "projects"] and "C" in rs.detect_skills(parsed)


def test_evidence_levels():
    text = "SKILLS\nPython, Docker, SQL\n\nPROJECTS\n- Built a Docker based API using Python for 20 users"
    parsed = rs.parse_sections(text)
    found = rs.detect_skills(parsed)
    assert rs._evidence_level(found["SQL"], False) == "claimed"
    assert rs._evidence_level(found["Python"], False) == "demonstrated"
    assert rs._evidence_level(found["SQL"], True) == "verified"


# ---------------------------------------------------------------------------
# File validation
# ---------------------------------------------------------------------------
@pytest.mark.parametrize("name,data", ids=["png-as-pdf", "pdf-as-png", "junk-docx", "binary-txt", "docx-as-jpg", "exe"], argvalues=[
    ("resume.pdf", b"\x89PNG\r\n\x1a\n" + b"0" * 100),      # a PNG called .pdf
    ("resume.png", fx("resume_text.pdf")),                   # a PDF called .png
    ("resume.docx", b"not really a zip file at all"),
    ("resume.txt", b"MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00\xff\xff\x00\x00" + b"\x00" * 64),   # a program called .txt
    ("resume.jpg", fx("resume.docx")),
    ("resume.exe", b"MZ" + b"0" * 100),
])
async def test_wrong_magic_bytes_or_extension_rejected(client, student, name, data):
    r = await analyze(client, student, name, data=data)
    assert r.status_code == 400, r.text
    assert "Traceback" not in r.text


async def test_empty_oversized_and_unreadable_files(client, student, seeded):
    assert (await analyze(client, student, "a.txt", data=b"")).status_code == 400
    big = await analyze(client, student, "big.txt", data=b"a" * (8 * 1024 * 1024 + 1))
    assert big.status_code == 413 and "8 MB" in big.json()["detail"]
    assert (await analyze(client, student, "broken.pdf", data=b"%PDF-1.4 this is not a real pdf")).status_code == 400


async def test_encrypted_pdf_rejected_with_a_clear_message(client, student, seeded, tmp_path):
    import fitz

    doc = fitz.open()
    doc.new_page().insert_text((50, 80), "secret resume text " * 5)
    path = tmp_path / "locked.pdf"
    doc.save(path, encryption=fitz.PDF_ENCRYPT_AES_256, user_pw="open-sesame", owner_pw="owner-pw")
    r = await analyze(client, student, "locked.pdf", data=path.read_bytes())
    assert r.status_code == 400 and "password" in r.json()["detail"].lower()


async def test_only_four_pdf_pages_are_processed(client, student, seeded):
    import fitz

    doc = fitz.open()
    for i in range(6):
        doc.new_page().insert_text((50, 80), f"Page {i + 1} " + "Python developer building REST APIs with FastAPI and MongoDB. " * 3)
    r = await analyze(client, student, "six.pdf", data=doc.tobytes())
    body = r.json()
    assert r.status_code == 200 and body["pages_processed"] == 4 and body["ocr_used"] is False
    assert any("first 4" in w for w in body["warnings"]) and "Page 5" not in body["extracted_text"]


async def test_raw_upload_is_never_kept(client, student, seeded, tmp_path, monkeypatch):
    monkeypatch.setattr(tempfile, "tempdir", str(tmp_path))
    assert (await analyze(client, student, "resume_text.pdf")).status_code == 200
    assert (await analyze(client, student, "resume.docx")).status_code == 200
    assert list(tmp_path.iterdir()) == []
    stored = await seeded["resume_analyses"].find_one({"user_id": student["user"]["id"]})
    assert stored["text_hash"] and "extracted_text" not in stored and not any(isinstance(v, bytes) for v in stored.values())


# ---------------------------------------------------------------------------
# Extraction: text formats
# ---------------------------------------------------------------------------
@pytest.mark.parametrize("name", ["resume_text.pdf", "resume.docx", "resume.txt"])
async def test_text_formats_need_no_ocr(client, student, seeded, name):
    r = await analyze(client, student, name)
    body = r.json()
    assert r.status_code == 200, r.text
    assert body["ocr_used"] is False and body["ocr_confidence"] is None
    assert {"Python", "FastAPI", "MongoDB", "Docker"} <= set(body["detected_skills"])
    assert body["score_label"] == "ATS-style score (estimate)"


def test_docx_tables_and_headers_are_read():
    out = rx._extract_sync("docx", fx("resume.docx"))
    assert out.has_tables and "Aarav Mehta - Resume" in out.text and "FastAPI" in out.text


def test_txt_falls_back_to_latin1():
    out = rx._extract_sync("txt", "Résumé Python".encode("latin-1"))
    assert "Python" in out.text


# ---------------------------------------------------------------------------
# Extraction: OCR
# ---------------------------------------------------------------------------
@pytest.mark.parametrize("name,mime", [("resume_scanned.pdf", "application/pdf"), ("resume_photo.jpg", "image/jpeg")])
async def test_scans_and_photos_are_read_with_ocr(client, student, seeded, name, mime):
    require_ocr()
    r = await analyze(client, student, name, mime=mime)
    body = r.json()
    assert r.status_code == 200, r.text
    assert body["ocr_used"] is True and body["ocr_engine"]
    assert 0 <= body["ocr_confidence"] <= 100 and body["pages_processed"] >= 1
    text = body["extracted_text"].lower()
    assert "python" in text and "mongodb" in text and "education" in text
    assert {"Python", "MongoDB", "Docker"} <= set(body["detected_skills"])


def test_png_and_webp_images_are_accepted():
    require_ocr()
    from PIL import Image

    base = Image.open(FIXTURES / "resume_photo.jpg")
    for fmt, kind in (("PNG", "png"), ("WEBP", "webp")):
        buf = io.BytesIO()
        base.save(buf, fmt)
        assert rx.validate_upload(f"r.{kind}", buf.getvalue()) == kind
    out = rx._extract_sync("png", _png_bytes(base))
    assert out.ocr_used and "python" in out.text.lower()


def _png_bytes(img):
    buf = io.BytesIO()
    img.save(buf, "PNG")
    return buf.getvalue()


def test_image_preprocessing_rules():
    from PIL import Image

    small = rx.prepare_image(Image.new("RGB", (400, 600), "white"))
    assert min(small.size) >= 1000 and small.mode == "L"
    huge = rx.prepare_image(Image.new("RGB", (6000, 4000), "white"))
    assert max(huge.size) == 3000
    normal = rx.prepare_image(Image.new("RGB", (1240, 1754), "white"))
    assert normal.size == (1240, 1754)


def test_low_confidence_adds_a_warning(monkeypatch):
    class Blurry:
        name = "fake"

        def read(self, img):
            return "Python developer " * 5, 41

    monkeypatch.setattr(rx, "get_ocr_engine", lambda: Blurry())
    out = rx._extract_sync("png", _png_bytes(__import__("PIL.Image", fromlist=["Image"]).new("RGB", (800, 800), "white")))
    assert out.ocr_confidence == 41 and any("low" in w.lower() for w in out.warnings)


class _Broken:
    def __init__(self):
        raise ImportError("engine not installed")


class _Working:
    name = "fake-tesseract"

    def __init__(self):
        pass

    def read(self, img):
        return "Skills: Python, SQL", 90


async def test_ocr_engine_unavailable_is_503_but_text_files_still_work(client, student, seeded, monkeypatch):
    monkeypatch.setattr(rx, "_ENGINE_CLASSES", {"rapidocr": _Broken, "tesseract": _Broken})
    rx.reset_ocr_engines()
    try:
        scanned = await analyze(client, student, "resume_scanned.pdf")
        photo = await analyze(client, student, "resume_photo.jpg")
        assert scanned.status_code == 503 and scanned.json()["detail"] == "OCR engine unavailable"
        assert photo.status_code == 503
        for name in ("resume_text.pdf", "resume.docx", "resume.txt"):
            assert (await analyze(client, student, name)).status_code == 200, name
    finally:
        rx.reset_ocr_engines()


async def test_other_engine_is_tried_when_the_chosen_one_cannot_load(client, student, seeded, monkeypatch):
    monkeypatch.setattr(rx, "_ENGINE_CLASSES", {"rapidocr": _Broken, "tesseract": _Working})
    rx.reset_ocr_engines()
    try:
        r = await analyze(client, student, "resume_photo.jpg")
        assert r.status_code == 200 and r.json()["ocr_engine"] == "fake-tesseract"
    finally:
        rx.reset_ocr_engines()


async def test_ocr_timeout_is_reported(client, student, seeded, monkeypatch):
    import time

    monkeypatch.setattr(rx, "OCR_TIMEOUT_S", 0.2)
    monkeypatch.setattr(rx, "_extract_sync", lambda kind, data: time.sleep(1) or rx.Extracted(text="x", kind=kind))
    r = await analyze(client, student, "resume.txt")
    assert r.status_code == 504 and "too long" in r.json()["detail"]


def test_glued_ocr_words_get_their_spaces_back():
    out = rx.restore_spaces("-BuiltaRESTAPIwithFastAPIandMongoDBserving500requestsperminute\nFrameworks:FastAPl,Django")
    assert "Built a REST API with FastAPI and MongoDB serving" in out and "requests per minute" in out
    assert "FastAPI,Django" in out and detected(out)  # the OCR 'APl' became 'API'


# ---------------------------------------------------------------------------
# Scoring
# ---------------------------------------------------------------------------
async def test_score_breakdown_adds_up_and_fixes_are_ranked(client, student, seeded):
    body = (await analyze(client, student, "resume.txt")).json()
    cats = {c["key"]: c for c in body["categories"]}
    assert [c["max"] for c in body["categories"]] == [30, 15, 10, 10, 10, 10, 5, 5, 5]
    assert sum(c["score"] for c in body["categories"]) == body["overall_score"]
    assert all(0 <= c["score"] <= c["max"] and c["explanation"] for c in cats.values())
    fixes = body["fixes"]
    assert 1 <= len(fixes) <= 8 and [f["rank"] for f in fixes] == list(range(1, len(fixes) + 1))
    assert [f["points"] for f in fixes] == sorted((f["points"] for f in fixes), reverse=True)
    assert all(f["points"] >= 1 and f["example"] and f["title"] for f in fixes)


async def test_a_weak_resume_scores_low_and_gets_concrete_fixes(client, student, seeded):
    weak = "Rahul\nI like computers and I want a job.\nI know some Python."
    r = await client.post("/api/resume/analyze-text", json={"text": weak, "career_path": "backend"}, headers=bearer(student["token"]))
    body = r.json()
    assert r.status_code == 200 and body["overall_score"] < 30 and body["ats_compatibility"] == "Low"
    titles = " ".join(f["title"] for f in body["fixes"])
    assert "email" in titles.lower() or "phone" in titles.lower()
    assert body["missing_requirements"] and body["role_match"] < 30


async def test_role_requirements_come_from_career_config(client, student, seeded):
    cloud = (await analyze(client, student, "resume_cloud.pdf", role="cloud")).json()
    assert cloud["missing_requirements"] == [] and cloud["role_match"] == 100
    assert {c["key"]: c["score"] for c in cloud["categories"]}["keywords"] == 30
    as_backend = (await analyze(client, student, "resume_cloud.pdf", role="Backend Developer")).json()
    assert "Databases" in as_backend["missing_requirements"] and as_backend["role_match"] < 50


async def test_unknown_or_missing_career_path_is_400_never_a_default(client, student, seeded):
    bad = await analyze(client, student, "resume.txt", role="Underwater Basket Weaver")
    assert bad.status_code == 400 and "Unknown career path" in bad.json()["detail"] and "Backend Developer" in bad.json()["detail"]
    none = await client.post("/api/resume/analyze-text", json={"text": "Python"}, headers=bearer(student["token"]))
    assert none.status_code == 400
    assert await seeded["resume_analyses"].count_documents({}) == 0


async def test_job_description_match(client, student, seeded):
    jd = "We need an engineer with Python, FastAPI, Kubernetes, Terraform and PostgreSQL. Docker is a plus."
    body = (await analyze(client, student, "resume.txt", jd=jd)).json()
    jd_info = body["jd"]
    assert {"Python", "FastAPI", "PostgreSQL", "Docker"} <= set(jd_info["matched"])
    assert set(jd_info["missing"]) == {"Kubernetes", "Terraform"}
    assert jd_info["match_percent"] == round(100 * 4 / 6) == 67
    assert any("Kubernetes" in f["title"] or "Terraform" in f["title"] for f in body["fixes"])
    no_jd = (await analyze(client, student, "resume.txt")).json()
    assert no_jd["jd"] is None


async def test_job_description_without_recognizable_skills_falls_back_to_the_role(client, student, seeded):
    body = (await analyze(client, student, "resume.txt", jd="Looking for a friendly, motivated team player.")).json()
    assert body["jd"]["match_percent"] is None and "role requirements" in body["jd"]["note"]


async def test_editing_text_and_rescoring(client, student, seeded):
    h = bearer(student["token"])
    first = (await analyze(client, student, "resume.txt")).json()
    edited = first["extracted_text"].replace("Python, Java, C, SQL", "Python, Java, C, SQL, Kubernetes, Terraform")
    second = (await client.post("/api/resume/analyze-text", json={"text": edited, "career_path": "backend"}, headers=h)).json()
    assert {"Kubernetes", "Terraform"} <= set(second["detected_skills"])
    assert second["ocr_used"] is False and second["source"] == "text"
    assert second["comparison"]["previous_score"] == first["overall_score"]
    assert second["text_hash"] != first["text_hash"]


async def test_bullet_coach_gives_templates_not_invented_claims(client, student, seeded):
    long_bullet = ("- Worked on the login page and some other features of the portal which was a very large project with many "
                   "moving parts and many people involved over a long time period in the university")
    text = fx("resume.txt").decode().replace("\nINTERNSHIP\n", "\n" + long_bullet + "\n\nINTERNSHIP\n")
    body = (await client.post("/api/resume/analyze-text", json={"text": text, "career_path": "backend"}, headers=bearer(student["token"]))).json()
    tips = body["bullet_coach"]
    assert tips and all(t["template"].count("<") >= 3 and "Template only" in t["template_note"] for t in tips)
    weak = next(t for t in tips if t["original"].startswith("Worked on the login page and some other features of the portal"))
    assert {"no action verb", "no number", "too long"} <= set(weak["issues"])
    assert "login" not in weak["template"]  # nothing the student wrote is rephrased into a claim


async def test_learning_steps_use_real_courses_else_plain(client, student, seeded):
    text = "Rahul" + chr(10) + "SKILLS" + chr(10) + "Java" + chr(10) + "EDUCATION" + chr(10) + "B.Tech"
    body = (await client.post("/api/resume/analyze-text", json={"text": text, "career_path": "backend"}, headers=bearer(student["token"]))).json()
    steps = {s["skill"]: s for s in body["learning_steps"]}
    assert steps["Databases"]["kind"] == "course" and steps["Databases"]["course_slug"] == "sql-dbms"
    assert steps["Data Structures"]["kind"] == "course" and steps["Data Structures"]["course_slug"] == "dsa"
    assert steps["Authentication"]["kind"] == "plain" and steps["Authentication"]["title"] == "Learn Authentication"
    assert steps["Authentication"]["course_slug"] is None  # no course covers it, so no invented one
    linked = {f["course_slug"] for f in body["fixes"] if f["course_slug"]}
    assert {"sql-dbms", "dsa"} & linked  # the ranked fixes point at the same courses


# ---------------------------------------------------------------------------
# Verified skills belong to one student
# ---------------------------------------------------------------------------
async def test_verified_skills_are_independent_between_users(client, student, seeded):
    other = await register(client, email="other@example.com")
    other = {"token": other.json()["access_token"], "user": other.json()["user"]}
    # student: an Accepted Python submission. other: a passed JavaScript assessment.
    await seeded["practice_attempts"].insert_one({"id": "a1", "user_id": student["user"]["id"], "problem_slug": "sum-two-numbers", "language": "python", "verdict": "Accepted", "is_correct": True})
    js_set = await seeded["assessments"].find_one({"skill": "JavaScript"})
    await seeded["assessment_attempts"].insert_one({"user_id": other["user"]["id"], "assessment_id": js_set["id"], "overall_score": 85, "submitted_at": __import__("datetime").datetime.now()})
    text = "Rahul\nSKILLS\nPython, JavaScript, Git"

    def levels(body):
        return {s["name"]: s["evidence"] for s in body["skills"]}

    mine = (await client.post("/api/resume/analyze-text", json={"text": text, "career_path": "backend"}, headers=bearer(student["token"]))).json()
    theirs = (await client.post("/api/resume/analyze-text", json={"text": text, "career_path": "backend"}, headers=bearer(other["token"]))).json()
    assert levels(mine)["Python"] == "verified" and levels(mine)["JavaScript"] == "claimed"
    assert levels(theirs)["JavaScript"] == "verified" and levels(theirs)["Python"] == "claimed"
    assert "Accepted" in next(s["note"] for s in mine["skills"] if s["name"] == "Python")


async def test_failed_attempts_do_not_verify(client, student, seeded):
    await seeded["practice_attempts"].insert_one({"id": "a2", "user_id": student["user"]["id"], "language": "java", "verdict": "Wrong Answer"})
    await seeded["assessment_attempts"].insert_one({"user_id": student["user"]["id"], "assessment_id": "asm-py-easy-1", "overall_score": 30})
    assert await rs.verified_skills(student["user"]["id"]) == {}


# ---------------------------------------------------------------------------
# History and access
# ---------------------------------------------------------------------------
async def test_history_keeps_ten_newest_first_with_a_comparison(client, student, seeded):
    h = bearer(student["token"])
    assert (await client.get("/api/resume/history", headers=h)).json() == []
    weak = {"text": "Rahul\nI know some Python.", "career_path": "backend"}
    r1 = (await client.post("/api/resume/analyze-text", json=weak, headers=h)).json()
    assert r1["comparison"] is None
    r2 = (await analyze(client, student, "resume.txt")).json()
    assert r2["comparison"]["previous_score"] == r1["overall_score"] and r2["comparison"]["delta"] == r2["overall_score"] - r1["overall_score"] > 0
    for i in range(11):
        await client.post("/api/resume/analyze-text", json={**weak, "text": weak["text"] + f" {i}"}, headers=h)
    history = (await client.get("/api/resume/history", headers=h)).json()
    assert len(history) == 10
    assert history[0]["created_at"] >= history[-1]["created_at"]
    assert history[0]["categories"] and "score" in history[0]["categories"][0]


async def test_resume_routes_need_a_student_login(client, admin, seeded):
    assert (await client.get("/api/resume/history")).status_code == 401
    assert (await client.post("/api/resume/analyze-text", json={"text": "x", "career_path": "backend"})).status_code == 401
    assert (await client.get("/api/resume/history", headers=bearer(admin["token"]))).status_code == 403
