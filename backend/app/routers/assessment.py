from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from app.models.assessment import (
    AssessmentDetail,
    AssessmentQuestion,
    AssessmentResult,
    AssessmentSession,
    AssessmentSubmission,
    AssessmentSummary,
    PracticeVerifyRequest,
    PracticeVerifyResponse,
    SessionAnswers,
)
from app.models.user import UserOut
from app.repositories import assessment_bank, attempts, users
from app.repositories import assessment_sessions as sessions
from app.services.assessment_service import (
    GRACE_SECONDS,
    SessionError,
    evaluate_session,
    get_assessment_detail,
    get_available_assessments,
    load_open_session,
    next_steps,
    save_session_answers,
    start_session,
    user_gap_topics,
    verify_practice_answer,
)
from app.services import notification_service
from app.utils.security import get_current_user, require_student
from app.utils.timeutil import utcnow

router = APIRouter(prefix="/assessments", tags=["Assessments"])


@router.get("", response_model=List[AssessmentSummary])
async def list_assessments(
    career_path: Optional[str] = Query(None),
    difficulty: Optional[str] = Query(None),
    skill: Optional[str] = Query(None),
    preview: Optional[bool] = Query(False),
):
    """List available formal skill assessments with filters"""
    return await get_available_assessments(career_path, difficulty, skill)


@router.get("/catalog", response_model=List[AssessmentSummary])
async def get_assessment_catalog(
    career_path: Optional[str] = Query(None),
    difficulty: Optional[str] = Query(None),
    skill: Optional[str] = Query(None),
):
    """Alias for listing assessments catalog"""
    return await get_available_assessments(career_path, difficulty, skill)


@router.get("/practice/questions", response_model=List[AssessmentQuestion])
async def get_practice_questions(
    skill: Optional[str] = Query(None),
    difficulty: Optional[str] = Query(None),
    topic: Optional[str] = Query(None),
    company: Optional[str] = Query(None),
    _user: UserOut = Depends(get_current_user),
):
    """Questions for Skill Practice Mode (login required). Graded-only questions are never listed; the key stays hidden until verified."""
    found = await assessment_bank.search_public_questions(skill, topic, difficulty, company=company, practice_only=True)
    return [AssessmentQuestion(**q) for q in found]


@router.post("/practice/verify", response_model=PracticeVerifyResponse)
async def verify_practice_mode_answer(req: PracticeVerifyRequest, _user: UserOut = Depends(get_current_user)):
    """Verify a single practice answer with immediate feedback (login required; graded-only questions are a 404)."""
    result = await verify_practice_answer(req.question_id, req.selected_option_index)
    if not result:
        raise HTTPException(status_code=404, detail="Question not found")
    return result


@router.get("/result/latest", response_model=AssessmentResult)
async def get_latest_result(current_user: UserOut = Depends(require_student)):
    """The student's most recent graded attempt, with its review. 404 (no baseline) when nothing was taken yet."""
    doc = await attempts.latest(current_user.id)
    if not doc:
        raise HTTPException(status_code=404, detail="No assessment taken yet")
    return AssessmentResult(**doc)


@router.get("/{assessment_id}", response_model=AssessmentDetail)
async def get_assessment_by_id(assessment_id: str, _user: UserOut = Depends(get_current_user)):
    """The assessment's details. Questions come only from POST /{id}/start, so graded questions are not browsable."""
    detail = await get_assessment_detail(assessment_id)
    if not detail:
        raise HTTPException(status_code=404, detail="Assessment not found")
    return detail.model_copy(update={"questions": []})


@router.post("/{assessment_id}/start", response_model=AssessmentSession)
async def start_assessment(assessment_id: str, current_user: UserOut = Depends(require_student)):
    """Open a timed session (or reopen the unexpired one) and return its questions, shuffled, with no answer keys."""
    session = await start_session(current_user.id, assessment_id)
    if not session:
        raise HTTPException(status_code=404, detail="Assessment not found")
    return session


@router.put("/sessions/{session_id}/answers")
async def save_answers(session_id: str, body: SessionAnswers, current_user: UserOut = Depends(require_student)):
    """Autosave: the answers are kept on the server, so a refresh does not lose them."""
    try:
        return {"saved": await save_session_answers(current_user.id, session_id, body.answers)}
    except SessionError as err:
        raise HTTPException(status_code=err.status, detail=err.message)


@router.post("/submit", response_model=AssessmentResult)
async def submit_assessment(submission: AssessmentSubmission, current_user: UserOut = Depends(require_student)):
    """Score the session's own questions on the server, store the attempt and the student's gap topics, return the review."""
    now = utcnow()
    try:
        doc = await load_open_session(current_user.id, submission.session_id, now, grace=GRACE_SECONDS)
    except SessionError as err:
        raise HTTPException(status_code=err.status, detail=err.message)
    if submission.assessment_id and submission.assessment_id != doc["assessment_id"]:
        raise HTTPException(status_code=400, detail="This session belongs to a different assessment.")

    result = await evaluate_session(doc, submission.answers, now)
    if not await sessions.mark_submitted(doc["session_id"], now):  # two submits at once: only one wins
        raise HTTPException(status_code=409, detail="This session was already submitted.")
    try:
        await attempts.insert(result.model_dump())
        gap_topics = await user_gap_topics(current_user.id)
        steps = await next_steps(result, gap_topics)
        await attempts.set_next_steps(result.attempt_id, steps)
        await users.record_assessment(current_user.id, result.readiness_score, result.strengths, result.skill_gaps, gap_topics)
    except Exception:
        await sessions.release(doc["session_id"])  # nothing was lost: the student can submit again
        raise
    await notification_service.assessment_completed(current_user.id, result.attempt_id, result.assessment_title, result.overall_score, result.gap_topics)
    return result.model_copy(update={"next_steps": steps})


@router.post("/{assessment_id}/submit", response_model=AssessmentResult)
async def submit_assessment_with_param(
    assessment_id: str,
    submission: AssessmentSubmission,
    current_user: UserOut = Depends(require_student),
):
    submission.assessment_id = assessment_id
    return await submit_assessment(submission, current_user)


@router.get("/{assessment_id}/result", response_model=AssessmentResult)
async def get_assessment_result(assessment_id: str, current_user: UserOut = Depends(require_student)):
    return await get_latest_result(current_user)
