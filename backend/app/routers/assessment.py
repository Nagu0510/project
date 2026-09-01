from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional
from datetime import datetime
from app.models.assessment import (
    AssessmentQuestion,
    AssessmentSummary,
    AssessmentDetail,
    AssessmentSubmission,
    AssessmentResult,
    PracticeVerifyRequest,
    PracticeVerifyResponse,
)
from app.models.user import UserOut
from app.utils.security import get_current_user, require_student
from app.services.assessment_service import (
    get_available_assessments,
    get_assessment_detail,
    evaluate_assessment_submission,
    verify_practice_answer,
    QUESTIONS_MAP,
)
from app.data.assessment_bank import ASSESSMENT_QUESTION_BANK, ASSESSMENT_SETS
from app.database import db_manager

router = APIRouter(prefix="/assessments", tags=["Assessments"])

@router.get("", response_model=List[AssessmentSummary])
async def list_assessments(
    career_path: Optional[str] = Query(None),
    difficulty: Optional[str] = Query(None),
    skill: Optional[str] = Query(None),
    preview: Optional[bool] = Query(False),
):
    """List available formal skill assessments with filters"""
    return get_available_assessments(career_path, difficulty, skill)

@router.get("/catalog", response_model=List[AssessmentSummary])
async def get_assessment_catalog(
    career_path: Optional[str] = Query(None),
    difficulty: Optional[str] = Query(None),
    skill: Optional[str] = Query(None),
):
    """Alias for listing assessments catalog"""
    return get_available_assessments(career_path, difficulty, skill)

@router.get("/practice/questions", response_model=List[AssessmentQuestion])
async def get_practice_questions(
    skill: Optional[str] = Query(None),
    difficulty: Optional[str] = Query(None),
    topic: Optional[str] = Query(None),
):
    """Get questions for interactive Skill Practice Mode with answers hidden initially"""
    filtered = []
    for q in ASSESSMENT_QUESTION_BANK:
        if skill and skill != "All" and q.get("skill", "").lower() != skill.lower():
            continue
        if difficulty and difficulty != "All" and q.get("difficulty", "").lower() != difficulty.lower():
            continue
        if topic and topic != "All" and topic.lower() not in q.get("topic", "").lower():
            continue
        q_copy = dict(q)
        q_copy["correct_option_index"] = None  # Hide answer key until user clicks verify
        filtered.append(AssessmentQuestion(**q_copy))

    if not filtered:
        # Return first 5 questions
        for q in ASSESSMENT_QUESTION_BANK[:5]:
            q_copy = dict(q)
            q_copy["correct_option_index"] = None
            filtered.append(AssessmentQuestion(**q_copy))

    return filtered

@router.post("/practice/verify", response_model=PracticeVerifyResponse)
async def verify_practice_mode_answer(req: PracticeVerifyRequest):
    """Verify single question answer in interactive practice mode with immediate feedback"""
    return verify_practice_answer(req.question_id, req.selected_option_index)

@router.get("/result/latest", response_model=AssessmentResult)
async def get_latest_result(current_user: UserOut = Depends(require_student)):
    """Retrieve candidate's most recent assessment attempt report"""
    # Check MongoDB first
    if db_manager.is_connected and db_manager.db is not None:
        try:
            cursor = db_manager.db["assessment_attempts"].find({"user_id": current_user.id}).sort("submitted_at", -1).limit(1)
            results = await cursor.to_list(length=1)
            if results:
                doc = results[0]
                doc.pop("_id", None)
                return AssessmentResult(**doc)
        except Exception:
            pass

    # Check in-memory store
    for attempt in reversed(list(db_manager._memory_store["assessment_attempts"].values())):
        if attempt.get("user_id") == current_user.id:
            return AssessmentResult(**attempt)

    # Initial diagnostic baseline result if none recorded yet
    return evaluate_assessment_submission(
        user_id=current_user.id,
        assessment_id="asm-py-med-1",
        answers={"py-med-01": 1, "py-med-02": 1, "py-med-03": 0},
        time_taken_seconds=300,
    )

@router.get("/{assessment_id}", response_model=AssessmentDetail)
async def get_assessment_by_id(assessment_id: str):
    """Retrieve full assessment questions with answer keys stripped"""
    detail = get_assessment_detail(assessment_id, strip_answers=True)
    if not detail:
        raise HTTPException(status_code=404, detail="Assessment not found")
    return detail

@router.post("/{assessment_id}/start")
async def start_assessment(assessment_id: str, current_user: UserOut = Depends(require_student)):
    """Start assessment timer session"""
    detail = get_assessment_detail(assessment_id, strip_answers=True)
    return {
        "assessment_id": assessment_id,
        "title": detail.title if detail else "Skill Assessment",
        "user_id": current_user.id,
        "status": "started",
        "total_questions": detail.questions_count if detail else 5,
        "duration_seconds": (detail.duration_minutes * 60) if detail else 900,
    }

@router.post("/submit", response_model=AssessmentResult)
async def submit_assessment(
    submission: AssessmentSubmission,
    current_user: UserOut = Depends(require_student),
):
    """Submit assessment answers, evaluate score on backend, update student profile and persist to MongoDB"""
    result = evaluate_assessment_submission(
        user_id=current_user.id,
        assessment_id=submission.assessment_id,
        answers=submission.answers,
        time_taken_seconds=submission.time_taken_seconds,
    )

    result_dict = result.dict()
    # Save to memory store
    db_manager._memory_store["assessment_attempts"][result.attempt_id] = result_dict

    # Update student record
    user_id = current_user.id
    if user_id in db_manager._memory_store["users"]:
        db_manager._memory_store["users"][user_id]["readiness_score"] = result.readiness_score
        db_manager._memory_store["users"][user_id]["assessments_completed"] = db_manager._memory_store["users"][user_id].get("assessments_completed", 0) + 1
        db_manager._memory_store["users"][user_id]["strong_skills"] = result.strengths
        db_manager._memory_store["users"][user_id]["gap_skills"] = result.skill_gaps

    # Persist in MongoDB
    if db_manager.is_connected and db_manager.db is not None:
        try:
            await db_manager.db["assessment_attempts"].insert_one(dict(result_dict))
            await db_manager.db["users"].update_one(
                {"id": user_id},
                {
                    "$set": {
                        "readiness_score": result.readiness_score,
                        "strong_skills": result.strengths,
                        "gap_skills": result.skill_gaps,
                    },
                    "$inc": {"assessments_completed": 1},
                }
            )
        except Exception:
            pass

    return result

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
