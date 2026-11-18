import random
import uuid
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from app.models.assessment import (
    AssessmentDetail,
    AssessmentQuestion,
    AssessmentResult,
    AssessmentSession,
    AssessmentSummary,
    PracticeVerifyResponse,
    ReviewItem,
    TopicScore,
)
from app.repositories import assessment_bank, attempts, career_paths
from app.repositories import assessment_sessions as sessions
from app.repositories import courses as courses_repo
from app.repositories import users as users_repo
from app.services import roadmap_service
from app.utils.timeutil import utcnow


async def get_available_assessments(
    career_path: Optional[str] = None, difficulty: Optional[str] = None, skill: Optional[str] = None
) -> List[AssessmentSummary]:
    """Assessment catalog. `career_path` is accepted but not filtered on, so students can cross-train."""
    return [
        AssessmentSummary(
            id=s["id"],
            title=s["title"],
            skill=s["skill"],
            career_path=s["career_path"],
            difficulty=s["difficulty"],
            questions_count=s["questions_count"],
            duration_minutes=s["duration_minutes"],
            best_score=None,
            attempts_count=0,
            company=s.get("company"),
            course_slug=s.get("course_slug"),
        )
        for s in await assessment_bank.list_sets(difficulty, skill)
    ]


async def get_assessment_detail(assessment_id: str) -> Optional[AssessmentDetail]:
    """An assessment with its questions. Answer keys never leave the repository, so none are returned."""
    target_set = await assessment_bank.get_set(assessment_id)
    if not target_set:
        return None
    questions = [
        AssessmentQuestion(**{**q, "number": idx + 1})
        for idx, q in enumerate(await assessment_bank.public_questions_by_ids(target_set["question_ids"]))
    ]
    return AssessmentDetail(
        id=target_set["id"],
        title=target_set["title"],
        skill=target_set["skill"],
        career_path=target_set["career_path"],
        difficulty=target_set["difficulty"],
        questions_count=len(questions),
        duration_minutes=target_set["duration_minutes"],
        questions=questions,
    )


GRACE_SECONDS = 30  # a submit this long after expires_at still counts (network delay, auto-submit at the buzzer)
GAP_BELOW, STRONG_FROM = 60, 80


def band_for(score: int) -> str:
    """Topic band: under 60 is a gap, 60-79 developing, 80 and above strong."""
    return "strong" if score >= STRONG_FROM else "developing" if score >= GAP_BELOW else "gap"


def iso_z(dt: datetime) -> str:
    return dt.replace(microsecond=0).isoformat() + "Z"


class SessionError(Exception):
    """A session cannot be used. `status` is the HTTP status the router answers with."""

    def __init__(self, status: int, message: str):
        super().__init__(message)
        self.status, self.message = status, message


async def _session_view(doc: Dict[str, Any], resumed: bool, now: datetime) -> AssessmentSession:
    questions = [
        AssessmentQuestion(**{**q, "number": i + 1})
        for i, q in enumerate(await assessment_bank.public_questions_by_ids(doc["question_ids"]))
    ]
    return AssessmentSession(
        session_id=doc["session_id"], assessment_id=doc["assessment_id"], title=doc.get("title", ""),
        difficulty=doc.get("difficulty", "Medium"), user_id=doc["user_id"], total_questions=len(questions),
        duration_seconds=doc["duration_seconds"], started_at=iso_z(doc["started_at"]), expires_at=iso_z(doc["expires_at"]),
        server_time=iso_z(now), seconds_remaining=max(0, int((doc["expires_at"] - now).total_seconds())),
        resumed=resumed, answers=doc.get("answers") or {}, questions=questions,
    )


async def start_session(user_id: str, assessment_id: str) -> Optional[AssessmentSession]:
    """Open a timed session, or reopen the student's unexpired one (same questions, same deadline). None for an unknown assessment."""
    target = await assessment_bank.get_set(assessment_id)
    if not target:
        return None
    now = utcnow()
    open_doc = await sessions.find_open(user_id, assessment_id, now)
    if open_doc:
        return await _session_view(open_doc, True, now)
    ids = [q["id"] for q in await assessment_bank.public_questions_by_ids(target["question_ids"], active_only=True)]  # new sessions skip deactivated questions
    random.shuffle(ids)
    duration = int(target["duration_minutes"]) * 60
    doc = {
        "session_id": f"ses-{uuid.uuid4().hex}", "user_id": user_id, "assessment_id": assessment_id,
        "title": target["title"], "difficulty": target["difficulty"], "question_ids": ids, "answers": {},
        "duration_seconds": duration, "started_at": now, "expires_at": now + timedelta(seconds=duration), "submitted_at": None,
    }
    await sessions.create(doc)
    return await _session_view(doc, False, now)


async def load_open_session(user_id: str, session_id: str, now: datetime, grace: int = 0) -> Dict[str, Any]:
    """The session if it is this student's, not submitted and not expired; otherwise a SessionError."""
    doc = await sessions.get(session_id)
    if not doc or doc["user_id"] != user_id:  # someone else's session looks exactly like a missing one
        raise SessionError(404, "Session not found. Start the assessment again.")
    if doc.get("submitted_at"):
        raise SessionError(409, "This session was already submitted.")
    if now > doc["expires_at"] + timedelta(seconds=grace):
        raise SessionError(410, "This session has expired. Start the assessment again.")
    return doc


async def save_session_answers(user_id: str, session_id: str, answers: Dict[str, int]) -> int:
    """Keep the answers on the server so a refresh does not lose them. Unknown question ids and out-of-range options are dropped."""
    doc = await load_open_session(user_id, session_id, utcnow())
    shown = await assessment_bank.public_questions_by_ids(doc["question_ids"])
    sizes = {q["id"]: len(q["options"]) for q in shown}
    clean = {qid: i for qid, i in answers.items() if qid in sizes and 0 <= i < sizes[qid]}
    await sessions.save_answers(session_id, clean)
    return len(clean)


async def evaluate_session(doc: Dict[str, Any], answers: Dict[str, int], now: datetime) -> AssessmentResult:
    """Score ONLY the questions of this session against the stored answer keys (the only reader of the keys besides check_answer)."""
    q_ids = doc["question_ids"]
    keys = await assessment_bank.scoring_data(q_ids)
    given = {**(doc.get("answers") or {}), **answers}  # what the page sends now wins over what was auto-saved

    review: List[ReviewItem] = []
    topic_map: Dict[str, Dict[str, int]] = {}
    skill_map: Dict[str, Dict[str, int]] = {}
    correct_count = 0
    for qid in q_ids:
        raw = keys.get(qid)
        if not raw:
            continue
        options = raw.get("options") or []
        key = raw.get("correct_option_index", 0)
        chosen = given.get(qid)
        ok = chosen is not None and chosen == key
        correct_count += int(ok)
        for bucket, name in ((topic_map, raw.get("topic", "General Engineering")), (skill_map, raw.get("skill", "Core Concepts"))):
            row = bucket.setdefault(name, {"score": 0, "total": 0})
            row["total"] += 1
            row["score"] += int(ok)
        review.append(ReviewItem(
            question_id=qid, number=len(review) + 1, topic=raw.get("topic", ""), skill=raw.get("skill", ""),
            question_text=raw.get("question_text", ""), code=raw.get("code"), language=raw.get("language"), options=options,
            your_answer_index=chosen if chosen is not None and 0 <= chosen < len(options) else None,
            correct_option_index=key, correct_answer=options[key] if 0 <= key < len(options) else "",
            is_correct=ok, explanation=raw.get("explanation", ""),
        ))

    total = len(review)
    overall = int(correct_count / total * 100) if total else 0

    def pct(row: Dict[str, int]) -> int:
        return int(row["score"] / row["total"] * 100) if row["total"] else 0

    topic_scores = [TopicScore(topic=t, score=pct(r), total=r["total"], band=band_for(pct(r))) for t, r in topic_map.items()]
    strengths = [s for s, r in skill_map.items() if band_for(pct(r)) == "strong"]
    skill_gaps = [s for s, r in skill_map.items() if band_for(pct(r)) == "gap"]

    target = await assessment_bank.get_set(doc["assessment_id"]) or {}
    skill = target.get("skill", "")
    spent = min(int((now - doc["started_at"]).total_seconds()), doc["duration_seconds"] + GRACE_SECONDS)
    return AssessmentResult(
        attempt_id=f"att-{uuid.uuid4().hex[:8]}", user_id=doc["user_id"], assessment_id=doc["assessment_id"],
        assessment_title=doc.get("title", ""), difficulty=doc.get("difficulty", "Medium"),
        overall_score=overall, readiness_score=min(100, int(overall * 0.7 + 25)),  # 70% assessment + 25 baseline
        correct_count=correct_count, total_questions=total, topic_scores=topic_scores,
        strengths=strengths, skill_gaps=skill_gaps, gap_topics=[t.topic for t in topic_scores if t.band == "gap"],
        recommended_practice=f"{skill} Practice Set (Medium)" if overall >= GAP_BELOW else f"{skill} Foundations (Easy)",
        recommended_roadmap_step="", session_id=doc["session_id"], time_taken_seconds=max(0, spent),
        submitted_at=now, review=review,
    )


async def user_gap_topics(user_id: str) -> List[str]:
    """Topics currently in the gap band: the newest result for each topic across all of the student's attempts."""
    latest: Dict[str, str] = {}
    for a in reversed(await attempts.for_user(user_id)):  # oldest first, so newer attempts overwrite
        for t in a.get("topic_scores") or []:
            latest[t["topic"]] = t.get("band") or band_for(t.get("score", 0))
    return sorted(t for t, band in latest.items() if band == "gap")


async def next_steps(result: AssessmentResult, gap_topics_all: List[str]) -> List[Dict[str, Any]]:
    """Where to go next, using only real courses, sets and roadmap milestones from the database."""
    target = await assessment_bank.get_set(result.assessment_id) or {}
    steps: List[Dict[str, Any]] = []
    all_courses = await courses_repo.list_courses()
    course = next((c for c in all_courses if c["slug"] == target.get("course_slug")), None) or next(
        (c for c in all_courses if target.get("skill") in (c.get("assessment_skills") or [])), None
    )
    if course and result.gap_topics:
        steps.append({"kind": "course", "course_slug": course["slug"], "title": course["title"],
                      "reason": "Revise: " + ", ".join(result.gap_topics)})
    elif result.overall_score >= STRONG_FROM:
        level_up = {"Easy": "Medium", "Medium": "Hard"}.get(result.difficulty)
        harder = next((s for s in await assessment_bank.list_sets(skill=target.get("skill"))
                       if s["id"] != result.assessment_id and s["difficulty"] == level_up), None)
        if harder:
            steps.append({"kind": "assessment", "assessment_id": harder["id"], "title": harder["title"],
                          "reason": "You scored well. Try the next level."})
    user = await users_repo.get(result.user_id)
    config = await career_paths.find((user or {}).get("current_path") or "")
    if config and gap_topics_all:
        priority = [m for m in config.get("milestones", []) if roadmap_service.matches_gaps(m, gap_topics_all)]
        if priority:
            steps.append({"kind": "roadmap", "milestone_id": priority[0]["id"], "title": priority[0]["title"],
                          "reason": "A milestone on your roadmap covers this gap"})
    return steps


async def check_answer(question_id: str, selected_option_index: int) -> Optional[dict]:
    """Check one practice answer and reveal the key. Returns None for an unknown question."""
    raw_q = (await assessment_bank.scoring_data([question_id])).get(question_id)
    if not raw_q or not raw_q.get("practice", True) or raw_q.get("active") is False:  # graded-only and deactivated questions never reveal their key here
        return None
    correct_idx = raw_q.get("correct_option_index", 0)
    options = raw_q.get("options") or []
    return {
        "question_id": question_id,
        "is_correct": selected_option_index == correct_idx,
        "correct_option_index": correct_idx,
        "correct_answer": options[correct_idx] if len(options) > correct_idx else "",
        "explanation": raw_q.get("explanation", ""),
    }


async def verify_practice_answer(question_id: str, selected_option_index: int) -> Optional[PracticeVerifyResponse]:
    checked = await check_answer(question_id, selected_option_index)
    if not checked:
        return None
    return PracticeVerifyResponse(
        question_id=checked["question_id"],
        is_correct=checked["is_correct"],
        correct_option_index=checked["correct_option_index"],
        explanation=checked["explanation"],
    )
