"""P8: timed sessions, scoring, practice vs graded, topic bands and the rule-based roadmap."""
from datetime import timedelta

import pytest

from app.data.assessment_bank import ASSESSMENT_QUESTION_BANK
from app.data.career_config import CAREER_PATHS_CONFIG
from app.seed import seed_collections
from app.services import roadmap_service
from app.services.assessment_service import band_for
from app.utils.timeutil import utcnow
from tests.conftest import bearer, register, start_session, take_assessment

KEYS = {q["id"]: q["correct_option_index"] for q in ASSESSMENT_QUESTION_BANK}
SET = "asm-py-easy"  # 8 questions, course set of python-programming


@pytest.fixture
async def seeded(db):
    await seed_collections(db)
    return db


async def submit(client, token, session_id, answers=None, assessment_id=SET):
    return await client.post(f"/api/assessments/{assessment_id}/submit", headers=bearer(token),
                             json={"session_id": session_id, "answers": answers or {}})


def answers_with(questions, right):
    """Answer the first `right` questions correctly and the rest wrongly."""
    out = {}
    for i, q in enumerate(questions):
        out[q["id"]] = KEYS[q["id"]] if i < right else (KEYS[q["id"]] + 1) % 4
    return out


# --------------------------------------------------------------------------- A. sessions
async def test_start_returns_a_session_without_answer_keys(client, student, seeded):
    r = await start_session(client, student["token"], SET)
    body = r.json()
    assert r.status_code == 200 and body["session_id"].startswith("ses-") and body["status"] == "started"
    assert body["total_questions"] == len(body["questions"]) == 8 and body["resumed"] is False
    assert body["duration_seconds"] == 12 * 60 and 0 < body["seconds_remaining"] <= 12 * 60
    assert body["expires_at"].endswith("Z") and body["started_at"].endswith("Z")
    assert all(q["correct_option_index"] is None for q in body["questions"])
    assert all("explanation" not in q for q in body["questions"])
    stored = await seeded["assessment_sessions"].find_one({"session_id": body["session_id"]})
    assert stored["user_id"] == student["user"]["id"] and len(stored["question_ids"]) == 8 and stored["submitted_at"] is None


async def test_questions_are_shuffled_per_session(client, student, seeded):
    orders = set()
    for i in range(6):
        user = await register(client, email=f"shuf{i}@example.com", name="Shuf Fle")
        orders.add(tuple(q["id"] for q in (await start_session(client, user.json()["access_token"], SET)).json()["questions"]))
    assert len(orders) > 1  # six identical orders of 8 questions would be a 1 in 40320^5 coincidence


async def test_an_unexpired_session_is_resumed_with_the_same_questions_and_saved_answers(client, student, seeded):
    first = (await start_session(client, student["token"], SET)).json()
    q0 = first["questions"][0]["id"]
    saved = await client.put(f"/api/assessments/sessions/{first['session_id']}/answers", headers=bearer(student["token"]),
                             json={"answers": {q0: 2, "not-a-question": 1}})
    assert saved.json() == {"saved": 1}
    again = (await start_session(client, student["token"], SET)).json()
    assert again["resumed"] is True and again["session_id"] == first["session_id"]
    assert [q["id"] for q in again["questions"]] == [q["id"] for q in first["questions"]]
    assert again["answers"] == {q0: 2} and again["expires_at"] == first["expires_at"]


async def test_an_expired_session_is_not_resumed_and_cannot_be_submitted(client, student, seeded):
    first = (await start_session(client, student["token"], SET)).json()
    await seeded["assessment_sessions"].update_one(
        {"session_id": first["session_id"]}, {"$set": {"expires_at": utcnow() - timedelta(seconds=31)}})
    late = await submit(client, student["token"], first["session_id"], {first["questions"][0]["id"]: 0})
    assert late.status_code == 410 and "expired" in late.json()["detail"].lower()
    assert await seeded["assessment_attempts"].count_documents({}) == 0
    fresh = (await start_session(client, student["token"], SET)).json()
    assert fresh["session_id"] != first["session_id"] and fresh["resumed"] is False
    saving = await client.put(f"/api/assessments/sessions/{first['session_id']}/answers", headers=bearer(student["token"]), json={"answers": {}})
    assert saving.status_code == 410


async def test_a_submit_within_the_grace_period_still_counts(client, student, seeded):
    first = (await start_session(client, student["token"], SET)).json()
    await seeded["assessment_sessions"].update_one(
        {"session_id": first["session_id"]}, {"$set": {"expires_at": utcnow() - timedelta(seconds=10)}})
    assert (await submit(client, student["token"], first["session_id"])).status_code == 200


async def test_a_session_can_only_be_submitted_once(client, student, seeded):
    started, first = await take_assessment(client, student["token"], SET, correct=True)
    assert first.status_code == 200
    second = await submit(client, student["token"], started["session_id"], {})
    assert second.status_code == 409
    assert await seeded["assessment_attempts"].count_documents({}) == 1
    assert (await seeded["users"].find_one({"id": student["user"]["id"]}))["assessments_completed"] == 1
    # a submitted session is not reopened either
    assert (await start_session(client, student["token"], SET)).json()["session_id"] != started["session_id"]


async def test_another_students_session_cannot_be_used(client, student, seeded):
    mine = (await start_session(client, student["token"], SET)).json()
    other = (await register(client, email="intruder@example.com", name="In Truder")).json()["access_token"]
    assert (await submit(client, other, mine["session_id"])).status_code == 404
    assert (await client.put(f"/api/assessments/sessions/{mine['session_id']}/answers", headers=bearer(other), json={"answers": {}})).status_code == 404
    assert await seeded["assessment_attempts"].count_documents({}) == 0
    assert (await submit(client, student["token"], mine["session_id"])).status_code == 200  # the owner still can


async def test_unknown_assessment_session_and_missing_session_id(client, student, seeded):
    h = bearer(student["token"])
    assert (await start_session(client, student["token"], "asm-nope")).status_code == 404
    assert (await submit(client, student["token"], "ses-nope")).status_code == 404
    assert (await client.post("/api/assessments/submit", headers=h, json={"answers": {}})).status_code == 422  # session_id is required
    started = (await start_session(client, student["token"], SET)).json()
    wrong_set = await client.post("/api/assessments/asm-py-medium/submit", headers=h, json={"session_id": started["session_id"], "answers": {}})
    assert wrong_set.status_code == 400
    assert (await client.post(f"/api/assessments/{SET}/start")).status_code == 401  # login required


async def test_scoring_math_counts_only_the_sessions_questions(client, student, seeded):
    started = (await start_session(client, student["token"], SET)).json()
    answers = answers_with(started["questions"], right=6)
    answers["c-01"] = KEYS["c-01"]  # a real question that is NOT in this session: must be ignored
    r = await submit(client, student["token"], started["session_id"], answers)
    body = r.json()
    assert r.status_code == 200
    assert body["correct_count"] == 6 and body["total_questions"] == 8 and body["overall_score"] == 75
    assert body["readiness_score"] == int(75 * 0.7 + 25)
    assert len(body["review"]) == 8 and {i["question_id"] for i in body["review"]} == {q["id"] for q in started["questions"]}
    assert sum(i["is_correct"] for i in body["review"]) == 6
    # unanswered counts as wrong
    empty = await take_assessment(client, student["token"], SET)
    assert empty[1].json()["overall_score"] == 0 and empty[1].json()["correct_count"] == 0


async def test_answers_saved_before_a_refresh_are_scored_when_the_final_submit_is_empty(client, student, seeded):
    started = (await start_session(client, student["token"], SET)).json()
    saved = answers_with(started["questions"], right=4)
    await client.put(f"/api/assessments/sessions/{started['session_id']}/answers", headers=bearer(student["token"]), json={"answers": saved})
    assert (await submit(client, student["token"], started["session_id"], {})).json()["correct_count"] == 4


async def test_answer_keys_are_absent_before_submit_and_present_in_the_review_after(client, student, seeded):
    h = bearer(student["token"])
    started = (await start_session(client, student["token"], SET)).json()
    assert all(q["correct_option_index"] is None for q in started["questions"])
    detail = (await client.get(f"/api/assessments/{SET}", headers=h)).json()
    assert detail["questions"] == [] and detail["questions_count"] == 8  # the questions are only served by start
    assert (await client.get("/api/assessments/result/latest", headers=h)).status_code == 404  # nothing graded yet, no baseline

    result = (await submit(client, student["token"], started["session_id"], answers_with(started["questions"], right=3))).json()
    explanations = {q["id"]: q["explanation"] for q in ASSESSMENT_QUESTION_BANK}
    for item in result["review"]:
        assert item["correct_option_index"] == KEYS[item["question_id"]] and item["correct_answer"] == item["options"][item["correct_option_index"]]
        assert item["explanation"] == explanations[item["question_id"]] and item["your_answer_index"] in (0, 1, 2, 3)
    latest = (await client.get("/api/assessments/result/latest", headers=h)).json()
    assert latest["attempt_id"] == result["attempt_id"] and len(latest["review"]) == 8
    assert latest["next_steps"] and latest["next_steps"][0]["kind"] == "course"  # 5 of 8 wrong -> gap topics -> a real course


async def test_no_baseline_result_for_a_new_student(client, student, seeded):
    r = await client.get("/api/assessments/result/latest", headers=bearer(student["token"]))
    assert r.status_code == 404


# --------------------------------------------------------------------------- B. practice vs graded
GRADED_ONLY = [q["id"] for q in ASSESSMENT_QUESTION_BANK if q.get("practice") is False]


async def test_practice_endpoints_need_login_and_never_serve_graded_only_questions(client, student, seeded):
    assert len(GRADED_ONLY) == 7
    for url in ("/api/assessments/practice/questions", "/api/practice/questions", "/api/practice/questions/c-01"):
        assert (await client.get(url)).status_code == 401
    assert (await client.post("/api/assessments/practice/verify", json={"question_id": "c-01", "selected_option_index": 0})).status_code == 401

    h = bearer(student["token"])
    for url in ("/api/assessments/practice/questions", "/api/practice/questions"):
        ids = {q["id"] for q in (await client.get(url, headers=h)).json()}
        assert ids and not ids & set(GRADED_ONLY)
    for qid in GRADED_ONLY:
        assert (await client.get(f"/api/practice/questions/{qid}", headers=h)).status_code == 404
        assert (await client.post("/api/assessments/practice/verify", headers=h, json={"question_id": qid, "selected_option_index": 0})).status_code == 404
        assert (await client.post(f"/api/practice/questions/{qid}/answer", headers=h, json={"selected_option_index": 0})).status_code == 404


async def test_graded_only_questions_are_still_in_graded_sessions(client, student, seeded):
    started = (await start_session(client, student["token"], "asm-c-hard")).json()
    assert "c-20" in {q["id"] for q in started["questions"]}


# --------------------------------------------------------------------------- C. topic bands
@pytest.mark.parametrize("score,band", [(0, "gap"), (59, "gap"), (60, "developing"), (79, "developing"), (80, "strong"), (100, "strong")])
def test_band_boundaries(score, band):
    assert band_for(score) == band


async def test_bands_and_gap_topics_are_stored_on_the_attempt_and_the_user(client, student, seeded):
    started = (await start_session(client, student["token"], SET)).json()
    result = (await submit(client, student["token"], started["session_id"], answers_with(started["questions"], right=2))).json()
    assert result["topic_scores"] and all(t["band"] == band_for(t["score"]) for t in result["topic_scores"])
    gaps = [t["topic"] for t in result["topic_scores"] if t["score"] < 60]
    assert gaps and result["gap_topics"] == gaps
    attempt = await seeded["assessment_attempts"].find_one({"attempt_id": result["attempt_id"]})
    user = await seeded["users"].find_one({"id": student["user"]["id"]})
    assert attempt["gap_topics"] == gaps and sorted(user["gap_topics"]) == sorted(gaps)

    # a later perfect attempt on the same topics clears them from the user's gap topics
    again = await take_assessment(client, student["token"], SET, correct=True)
    assert again[1].json()["gap_topics"] == []
    assert (await seeded["users"].find_one({"id": student["user"]["id"]}))["gap_topics"] == []


async def test_readiness_still_computes_from_the_new_attempts(client, student, seeded):
    h = bearer(student["token"])
    _, r = await take_assessment(client, student["token"], SET, correct=True)
    dash = (await client.get("/api/student/dashboard", headers=h)).json()
    assert r.json()["overall_score"] == 100 and dash["assessment_score"] == 100 and dash["assessments_completed"] == 1
    assert dash["career_readiness"] == round(0.4 * 100 + 0.10 * round(100 / 14))


# --------------------------------------------------------------------------- D. roadmap
def milestone(i, skills, title=None):
    return {"id": f"m{i}", "number": i, "title": title or f"Milestone {i}", "description": "", "skills": skills,
            "estimated_time": "Week 1", "score": 99}


CONFIG = {"title": "Test Path", "milestones": [milestone(1, ["Alpha"]), milestone(2, ["Beta"]), milestone(3, ["Gamma Topic"]), milestone(4, ["Delta"])]}


def build(progress=None, gaps=(), best=None, sets=None, courses=()):
    return roadmap_service.build_roadmap(CONFIG, progress or {}, list(gaps), list(courses), sets or {}, best or {})


def statuses(road):
    return {m.id: m.status for m in road.milestones}


def test_statuses_come_only_from_saved_progress():
    road = build()
    assert statuses(road) == {"m1": "not_started", "m2": "locked", "m3": "locked", "m4": "locked"}
    assert road.completion_percentage == 0 and all(m.score is None for m in road.milestones)  # the config's score is not shown
    road = build({"m1": "completed", "m2": "in_progress"})
    assert statuses(road) == {"m1": "completed", "m2": "in_progress", "m3": "locked", "m4": "locked"}
    assert road.completion_percentage == 25 and road.current_milestone == 2
    assert build({"m1": "locked"}).milestones[0].status == "not_started"  # "locked" cannot be saved


def test_a_milestone_unlocks_when_the_previous_one_is_completed():
    assert statuses(build({"m1": "completed"}))["m2"] == "not_started"
    assert statuses(build({"m1": "in_progress"}))["m2"] == "locked"


def test_a_milestone_unlocks_when_its_related_assessment_was_passed_at_70_percent():
    course = {"slug": "gamma-course", "title": "Gamma", "skills": ["Gamma Topic"], "position": 1}
    sets = {"gamma-course": [{"id": "asm-gamma", "title": "Gamma set", "difficulty": "Easy"}]}
    assert statuses(build(courses=[course], sets=sets, best={"asm-gamma": 69}))["m3"] == "locked"
    road = build(courses=[course], sets=sets, best={"asm-gamma": 70})
    m3 = next(m for m in road.milestones if m.id == "m3")
    assert m3.status == "not_started" and m3.score == 70
    assert m3.course_slugs == ["gamma-course"] and m3.practice_sets[0]["id"] == "asm-gamma"
    assert statuses(road)["m2"] == "locked"  # only the milestone the assessment belongs to is opened


def test_priority_gaps_are_marked_and_sorted_first_among_not_started():
    progress = {"m1": "completed", "m2": "completed"}
    road = build(progress, gaps=["gamma topic"])
    assert [m.id for m in road.milestones] == ["m1", "m2", "m3", "m4"]  # m3 is the only open one
    road = build({"m1": "completed", "m2": "completed", "m3": "not_started"}, gaps=["Alpha"])
    assert not any(m.is_priority_gap for m in road.milestones)  # completed milestones are never priority
    unlocked = build({"m1": "not_started", "m2": "not_started", "m3": "not_started"}, gaps=["Gamma"])
    assert unlocked.milestones[0].id == "m1"  # m2/m3 are locked, so m1 stays the first open one

    course = {"slug": "c", "title": "C", "skills": ["Beta", "Gamma Topic"], "position": 1}
    passed = build(courses=[course], sets={"c": [{"id": "s", "title": "S", "difficulty": "Easy"}]}, best={"s": 90}, gaps=["Gamma Topic"])
    open_ids = [m.id for m in passed.milestones if m.status == "not_started"]
    assert open_ids == ["m3", "m1", "m2"] and passed.milestones[0].is_priority_gap and passed.milestones[0].id == "m3"
    assert passed.current_milestone == 3


def test_course_links_use_only_real_courses():
    courses = [{"slug": "alpha", "title": "Alpha", "skills": ["Alpha"], "position": 2},
               {"slug": "empty", "title": "Empty", "skills": [], "position": 1}]
    road = build(courses=courses)
    assert next(m for m in road.milestones if m.id == "m1").course_slugs == ["alpha"]
    assert all(m.course_slugs == [] for m in road.milestones if m.id != "m1")


async def pick_path(client, token, title="Python Developer"):
    r = await client.post("/api/student/career-path", headers=bearer(token), json={"career_path_title": title})
    assert r.status_code == 200, r.text


async def test_roadmap_progress_is_stored_per_career_path_and_checked_against_the_current_one(client, student, seeded):
    h = bearer(student["token"])
    await pick_path(client, student["token"], "Python Developer")
    road = (await client.get("/api/student/roadmap", headers=h)).json()
    assert road["career_path"] == "Python Developer" and road["completion_percentage"] == 0
    first = road["milestones"][0]
    assert first["status"] == "not_started" and {m["status"] for m in road["milestones"][1:]} == {"locked"}
    assert not first["is_priority_gap"]

    ok = await client.put("/api/student/roadmap/progress", headers=h, json={"milestone_id": first["id"], "status": "completed"})
    assert ok.status_code == 200
    assert (await seeded["roadmaps"].find_one({"user_id": student["user"]["id"], "career_path": "Python Developer"}))["milestones_progress"] == {first["id"]: "completed"}

    # a milestone of another career path is a 404, and nothing is saved for it
    other = await client.put("/api/student/roadmap/progress", headers=h, json={"milestone_id": "be-node-1", "status": "completed"})
    assert other.status_code == 404
    assert await seeded["roadmaps"].count_documents({"user_id": student["user"]["id"]}) == 1

    # switching path shows that path's own (empty) progress; switching back keeps the old one
    await pick_path(client, student["token"], "Backend Developer")
    assert (await client.get("/api/student/roadmap", headers=h)).json()["completion_percentage"] == 0
    assert (await client.put("/api/student/roadmap/progress", headers=h, json={"milestone_id": first["id"], "status": "completed"})).status_code == 404
    await pick_path(client, student["token"], "Python Developer")
    assert (await client.get("/api/student/roadmap", headers=h)).json()["completion_percentage"] == 10


async def test_a_locked_milestone_cannot_be_started_until_unlocked(client, student, seeded):
    h = bearer(student["token"])
    await pick_path(client, student["token"])
    road = (await client.get("/api/student/roadmap", headers=h)).json()
    first, second = road["milestones"][0], next(m for m in road["milestones"] if m["status"] == "locked")
    blocked = await client.put("/api/student/roadmap/progress", headers=h, json={"milestone_id": second["id"], "status": "in_progress"})
    assert blocked.status_code == 409 and "locked" in blocked.json()["detail"].lower()
    assert (await client.put("/api/student/roadmap/progress", headers=h, json={"milestone_id": first["id"], "status": "locked"})).status_code == 422
    assert (await client.put("/api/student/roadmap/progress", headers=h, json={"milestone_id": first["id"], "status": "completed"})).status_code == 200
    road = (await client.get("/api/student/roadmap", headers=h)).json()
    assert next(m for m in road["milestones"] if m["id"] == second["id"])["status"] == "not_started"
    assert (await client.put("/api/student/roadmap/progress", headers=h, json={"milestone_id": second["id"], "status": "in_progress"})).status_code == 200


async def test_passing_a_course_assessment_unlocks_its_milestones_and_gaps_become_priority(client, student, seeded):
    h = bearer(student["token"])
    await pick_path(client, student["token"])
    before = (await client.get("/api/student/roadmap", headers=h)).json()["milestones"]
    locked_py = next(m for m in before if m["status"] == "locked" and "python-programming" in m["course_slugs"])
    _, r = await take_assessment(client, student["token"], "asm-py-easy", correct=True)
    assert r.json()["overall_score"] == 100
    after = {m["id"]: m for m in (await client.get("/api/student/roadmap", headers=h)).json()["milestones"]}
    assert after[locked_py["id"]]["status"] == "not_started" and after[locked_py["id"]]["score"] == 100
    assert after[locked_py["id"]]["practice_sets"]

    # a weak attempt: its gap topics mark matching milestones as priority
    await take_assessment(client, student["token"], "asm-py-medium")
    user = await seeded["users"].find_one({"id": student["user"]["id"]})
    assert user["gap_topics"]
    road = (await client.get("/api/student/roadmap", headers=h)).json()
    flagged = [m for m in road["milestones"] if m["is_priority_gap"]]
    config = next(c for c in CAREER_PATHS_CONFIG.values() if c["title"] == "Python Developer")
    expected = {m["id"] for m in config["milestones"] if roadmap_service.matches_gaps(m, user["gap_topics"])}
    assert {m["id"] for m in flagged} == expected - {m["id"] for m in road["milestones"] if m["status"] == "completed"}


async def test_course_links_are_real_slugs_from_the_courses_collection(client, student, seeded):
    await pick_path(client, student["token"])
    slugs = {c["slug"] for c in await seeded["courses"].find({}).to_list(100)}
    set_ids = {s["id"] for s in await seeded["assessments"].find({}).to_list(500)}
    milestones = (await client.get("/api/student/roadmap", headers=bearer(student["token"]))).json()["milestones"]
    linked = [m for m in milestones if m["course_slugs"]]
    assert linked
    for m in milestones:
        assert set(m["course_slugs"]) <= slugs and {s["id"] for s in m["practice_sets"]} <= set_ids
        assert [c["slug"] for c in m["courses"]] == m["course_slugs"]


async def test_the_roadmap_needs_a_path_and_unknown_paths_are_404(client, student, seeded):
    h = bearer(student["token"])
    assert (await client.get("/api/student/roadmap", headers=h)).status_code == 400
    assert (await client.get("/api/student/roadmap", params={"career_path": "nope"}, headers=h)).status_code == 404
    guest = (await client.get("/api/student/roadmap", params={"career_path": "python"})).json()
    assert guest["milestones"][0]["status"] == "not_started" and guest["completion_percentage"] == 0
