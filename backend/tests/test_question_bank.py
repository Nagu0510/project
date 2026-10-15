"""Question bank, assessment sets, company tags and the resume-driven practice set (stages C and D)."""
import json
import shutil
import sys
from collections import Counter
from pathlib import Path

import pytest

from app.data import skills as catalog
from app.data.assessment_bank import ASSESSMENT_QUESTION_BANK, ASSESSMENT_SETS, COMPANIES
from app.seed import seed_collections
from app.services import resume_practice_service as practice_set
from tests.conftest import bearer, take_assessment

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import validate_questions  # noqa: E402

NEW_SKILLS = ["C", "C++", "Python", "Java", "JavaScript", "Machine Learning", "Deep Learning & AI"]
AUTHORED = [q for q in ASSESSMENT_QUESTION_BANK if q["id"].split("-")[0] in {"c", "cpp", "py2", "java2", "js2", "ml", "dl"}]


@pytest.fixture
async def seeded(db):
    await seed_collections(db)
    return db


# --------------------------------------------------------------------------- the bank itself
def test_validator_passes():
    """The same checks as `python scripts/validate_questions.py` (Python and JavaScript snippets are really run)."""
    if not shutil.which("node"):
        pytest.skip("node is not installed, so JavaScript Code Output snippets cannot be run")
    validate_questions.errors.clear()
    validate_questions.check_questions()
    validate_questions.check_sets()
    validate_questions.check_courses()
    validate_questions.check_outputs(online=False)
    assert validate_questions.errors == []


def test_validator_actually_catches_mistakes(monkeypatch):
    broken = [dict(ASSESSMENT_QUESTION_BANK[0]), dict(ASSESSMENT_QUESTION_BANK[0], id="x-2")]
    broken.append({**ASSESSMENT_QUESTION_BANK[1], "id": "x-3", "options": ["a", "a", "b", "c"]})
    broken.append({**ASSESSMENT_QUESTION_BANK[2], "id": "x-4", "correct_option_index": 7})
    broken.append({**ASSESSMENT_QUESTION_BANK[3], "id": "x-5", "skill": "Klingon"})
    wrong = next(q for q in ASSESSMENT_QUESTION_BANK if q["id"] == "py2-02" or q["id"] == "py2-01")
    broken.append({**wrong, "id": "x-6", "question_text": "different", "options": ["wrong", "bad", "worse", "no"], "correct_option_index": 0})
    monkeypatch.setattr(validate_questions, "ASSESSMENT_QUESTION_BANK", broken)
    validate_questions.errors.clear()
    validate_questions.check_questions()
    validate_questions.check_outputs(online=False)
    text = " | ".join(validate_questions.errors)
    for needle in ("duplicate id" if False else "duplicate question text", "identical", "invalid correct_option_index", "unknown skill", "stated answer"):
        assert needle in text, needle
    validate_questions.errors.clear()


def test_at_least_fifteen_questions_per_new_skill_and_105_overall():
    counts = Counter(q["skill"] for q in ASSESSMENT_QUESTION_BANK)
    assert all(counts[s] >= 15 for s in NEW_SKILLS), counts
    assert sum(counts[s] for s in NEW_SKILLS) >= 105


@pytest.mark.parametrize("skill", NEW_SKILLS)
def test_each_skill_mixes_difficulty_and_types(skill):
    qs = [q for q in AUTHORED if q["skill"] == skill]
    assert len(qs) == 20
    assert Counter(q["difficulty"] for q in qs) == {"Easy": 6, "Medium": 8, "Hard": 6}
    assert {"Conceptual", "Code Output", "Find the Error", "Scenario"} <= {q["question_type"] for q in qs}
    assert all(q["origin"] == "authored" and len(q["options"]) == 4 and isinstance(q["practice"], bool) for q in qs)
    assert any(not q["practice"] for q in qs) and any(q["practice"] for q in qs)


def test_correct_answers_are_spread_across_positions():
    positions = Counter(q["correct_option_index"] for q in AUTHORED)
    assert len(positions) == 4 and max(positions.values()) < 0.4 * len(AUTHORED)


def test_every_new_set_is_valid():
    course_sets = [s for s in ASSESSMENT_SETS if s.get("course_slug")]
    assert len(course_sets) == 21 and all(s["questions_count"] >= 8 for s in course_sets)
    assert {s["difficulty"] for s in course_sets} == {"Easy", "Medium", "Hard"}
    company_sets = [s for s in ASSESSMENT_SETS if s.get("company")]
    assert {s["company"] for s in company_sets} == set(COMPANIES) and all(s["questions_count"] == 20 for s in company_sets)
    tcs = next(s for s in company_sets if s["company"] == "TCS")
    assert tcs["title"].startswith("TCS-style: C and Python")
    by_id = {q["id"]: q for q in ASSESSMENT_QUESTION_BANK}
    assert {by_id[i]["skill"] for i in tcs["question_ids"]} == {"C", "Python"}
    assert all("TCS" in by_id[i]["companies"] for i in tcs["question_ids"])
    hard = next(s for s in course_sets if s["id"] == "asm-py-hard")
    assert [by_id[i]["difficulty"] for i in hard["question_ids"]].count("Hard") == 6


# --------------------------------------------------------------------------- answer keys never leave early
def _no_answers(payload):
    text = json.dumps(payload)
    assert '"explanation"' not in text
    items = payload if isinstance(payload, list) else payload.get("questions", [payload])
    assert items and all(q.get("correct_option_index") is None for q in items)
    assert all("explanation" not in q for q in items)


async def test_answer_keys_are_not_in_any_question_payload(client, student, seeded):
    h = bearer(student["token"])
    _no_answers((await client.get("/api/assessments/practice/questions", params={"skill": "C"}, headers=h)).json())
    _no_answers((await client.get("/api/practice/questions", params={"skill": "Python"}, headers=h)).json())
    _no_answers((await client.get("/api/practice/questions/c-01", headers=h)).json())
    detail = (await client.post("/api/assessments/asm-cpp-hard/start", headers=h)).json()
    assert len(detail["questions"]) == 8
    _no_answers(detail["questions"])
    assert all(q["code"] or q["question_type"] in ("Conceptual", "Scenario") for q in detail["questions"])
    await client.post("/api/resume/analyze-text", json={"text": "Rahul\nSKILLS\nPython, C", "career_path": "backend"}, headers=h)
    _no_answers((await client.get("/api/resume/questions", headers=h)).json())


async def test_the_answer_is_revealed_only_after_answering(client, student, seeded):
    q = next(x for x in ASSESSMENT_QUESTION_BANK if x["id"] == "c-02")
    h = bearer(student["token"])
    r = await client.post("/api/assessments/practice/verify", headers=h, json={"question_id": "c-02", "selected_option_index": q["correct_option_index"]})
    assert r.json()["is_correct"] is True and r.json()["explanation"]
    wrong = await client.post("/api/assessments/practice/verify", headers=h, json={"question_id": "c-02", "selected_option_index": (q["correct_option_index"] + 1) % 4})
    assert wrong.json()["is_correct"] is False and wrong.json()["correct_option_index"] == q["correct_option_index"]


async def test_assessment_submission_scores_authored_questions(client, student, seeded):
    _, r = await take_assessment(client, student["token"], "asm-c-easy", correct=True)
    result = r.json()
    assert result["overall_score"] == 100 and result["correct_count"] == 8


# --------------------------------------------------------------------------- company filter and labels
async def test_company_filter(client, student, seeded):
    h = bearer(student["token"])
    tcs = (await client.get("/api/practice/questions", params={"company": "TCS"}, headers=h)).json()
    assert tcs and all("TCS" in q["companies"] for q in tcs)
    assert {q["skill"] for q in tcs} <= {"C", "Python"} | {"Python"}
    wipro = (await client.get("/api/assessments/practice/questions", params={"company": "Wipro"}, headers=h)).json()
    assert wipro and all("Wipro" in q["companies"] for q in wipro) and {q["skill"] for q in wipro} == {"C++", "Java"}
    assert len((await client.get("/api/practice/questions", params={"company": "All"}, headers=h)).json()) >= 100
    assert (await client.get("/api/practice/questions", params={"company": "NoSuchCo"}, headers=h)).json() == []


async def test_assessment_only_questions_stay_out_of_practice_mode(client, student, seeded):
    h = bearer(student["token"])
    practice_ids = {q["id"] for q in (await client.get("/api/practice/questions", headers=h)).json()}
    assert "c-20" not in practice_ids and "c-01" in practice_ids
    in_set = (await client.post("/api/assessments/asm-c-hard/start", headers=h)).json()["questions"]
    assert "c-20" in {q["id"] for q in in_set}  # but a formal assessment can still use it


async def test_sets_expose_company_and_course(client, seeded):
    sets = {s["id"]: s for s in (await client.get("/api/assessments")).json()}
    assert sets["asm-co-tcs"]["company"] == "TCS" and sets["asm-c-easy"]["course_slug"] == "c-programming"
    assert len([s for s in sets.values() if s["course_slug"]]) == 21


# --------------------------------------------------------------------------- resume-driven practice
RESUME = ("Rahul\nrahul@example.com\nSKILLS\nPython, SQL, Git, C\nPROJECTS\nLibrary API | FastAPI\n"
          "- Built a REST API in Python serving 200 users\n- Stored data in SQL tables\nEDUCATION\nB.Tech, Example College, 2026")


async def analyze(client, student, text=RESUME, role="backend"):
    r = await client.post("/api/resume/analyze-text", json={"text": text, "career_path": role}, headers=bearer(student["token"]))
    assert r.status_code == 200, r.text
    return r.json()


async def test_resume_prompts_only_name_skills_found_in_the_resume(client, student, seeded):
    body = await analyze(client, student)
    detected = set(body["detected_skills"])
    got = (await client.get("/api/resume/questions", params={"analysis_id": body["analysis_id"]}, headers=bearer(student["token"]))).json()
    assert got["prompts"] and all(p["label"] == "generated template" for p in got["prompts"])
    for p in got["prompts"]:
        assert p["skill"] in detected
        assert set(catalog.scan(p["text"], skills_context=True)) <= detected, p["text"]  # no skill named that the resume lacks
    python_prompt = next(p for p in got["prompts"] if p["skill"] == "Python")
    assert "Library API" in python_prompt["text"] or "Python" in python_prompt["text"]
    assert any("You list" in p["text"] and "explain how you used it and one problem you solved" in p["text"] for p in got["prompts"])
    assert {q["for_skill"] for q in got["questions"]} <= detected | {"DSA", "Docker", "AWS", "Java", "REST API", "FastAPI", "Linux", "Git"}
    assert "not real past questions" in got["disclaimer"]


async def test_weak_and_claimed_skills_start_with_easier_questions(client, student, seeded):
    body = await analyze(client, student, text="Rahul\nSKILLS\nPython")  # claimed only
    h = bearer(student["token"])
    got = (await client.get("/api/resume/questions", params={"analysis_id": body["analysis_id"]}, headers=h)).json()
    py = [q for q in got["questions"] if q["for_skill"] == "Python"]
    assert py and py[0]["difficulty"] == "Easy" and all(q["level"] == "claimed" for q in py)

    shown = await analyze(client, student, text="Rahul\nSKILLS\nPython\nPROJECTS\n- Built a Python tool for 40 users with tests")
    got2 = (await client.get("/api/resume/questions", params={"analysis_id": shown["analysis_id"]}, headers=h)).json()
    py2 = [q for q in got2["questions"] if q["for_skill"] == "Python"]
    assert py2[0]["difficulty"] == "Medium"  # shown in a project: start higher
    gaps = [q for q in got["questions"] if q["level"] == "gap"]
    assert gaps and all(q["difficulty"] in ("Easy", "Medium") for q in gaps)  # missing role skills get easy ones


async def test_resume_company_filter_and_validation(client, student, seeded):
    body = await analyze(client, student)
    h = bearer(student["token"])
    tcs = (await client.get("/api/resume/questions", params={"analysis_id": body["analysis_id"], "company": "TCS"}, headers=h)).json()
    assert tcs["company"] == "TCS" and tcs["questions"] and all("TCS" in q["companies"] for q in tcs["questions"])
    assert {q["skill"] for q in tcs["questions"]} <= {"C", "Python"}
    assert (await client.get("/api/resume/questions", params={"company": "Hooli"}, headers=h)).status_code == 400
    latest = (await client.get("/api/resume/questions", headers=h)).json()  # no analysis_id: the latest one
    assert latest["analysis_id"] == body["analysis_id"]


async def test_nothing_matching_gives_an_empty_set_with_a_note(client, student, seeded):
    body = await analyze(client, student, text="Rahul\nSKILLS\nDocker, Kubernetes, Linux", role="cloud")
    got = (await client.get("/api/resume/questions", params={"analysis_id": body["analysis_id"], "company": "TCS"}, headers=bearer(student["token"]))).json()
    assert got["questions"] == [] and "TCS-style" in got["note"]


async def test_a_student_cannot_open_someone_elses_analysis(client, student, seeded):
    from tests.conftest import register

    mine = await analyze(client, student)
    other = await register(client, email="other@example.com")
    h2 = bearer(other.json()["access_token"])
    assert (await client.get("/api/resume/questions", params={"analysis_id": mine["analysis_id"]}, headers=h2)).status_code == 404
    assert (await client.get("/api/resume/questions", headers=h2)).status_code == 404  # they have no analysis of their own
    assert (await client.get("/api/resume/questions")).status_code == 401


def test_question_selection_is_a_pure_function():
    bank = [{"id": f"q{i}", "skill": "Python", "difficulty": d} for i, d in enumerate(["Hard", "Easy", "Medium", "Easy"])]
    analysis = {"detected_skills": ["Python"], "skill_levels": {"Python": "verified"}, "missing_skills": []}
    assert [q["difficulty"] for q in practice_set.build_questions(analysis, bank)][0] == "Hard"
    analysis["skill_levels"] = {"Python": "claimed"}
    assert [q["difficulty"] for q in practice_set.build_questions(analysis, bank)][:2] == ["Easy", "Easy"]
    assert practice_set.build_questions({"detected_skills": ["Excel"]}, bank) == []
