import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request

from app.models.practice import (
    CodeRunRequest,
    CodeRunResponse,
    CodeSubmitRequest,
    CodeSubmitResponse,
    CodingProblem,
    PracticeAttempt,
)
from app.models.user import UserOut
from app.repositories import assessment_bank, practice
from app.services.assessment_service import check_answer
from app.config import settings
from app.limiter import limiter, user_or_ip
from app.services.code_execution_service import JUDGE_UNAVAILABLE, MAX_SOURCE_BYTES, execute_async, run_tests_async
from app.utils.security import get_current_user, require_student
from app.utils.timeutil import utcnow

router = APIRouter(prefix="/practice", tags=["Coding Practice"])


def _all_cases(problem: dict) -> list:
    return problem.get("test_cases") or (problem.get("sample_test_cases", []) + problem.get("hidden_test_cases", []))


def _public(problem: dict) -> CodingProblem:
    """What students may see: sample cases only. Hidden cases and their expected outputs never leave the server."""
    shown = [tc for tc in _all_cases(problem) if not tc.get("is_hidden")]
    return CodingProblem(**{**problem, "test_cases": shown, "sample_test_cases": shown, "hidden_test_cases": []})


@router.get("/problems", response_model=List[CodingProblem])
async def get_practice_problems(
    difficulty: Optional[str] = Query(None),
    topic: Optional[str] = Query(None),
):
    """Coding practice problems from MongoDB, with optional difficulty / topic filtering."""
    result = []
    for p in await practice.list_problems():
        if difficulty and difficulty != "All" and p.get("difficulty", "").lower() != difficulty.lower():
            continue
        if topic and topic != "All" and topic.lower() not in p.get("topic", "").lower():
            continue
        result.append(_public(p))
    return result


@router.get("/solved")
async def get_solved_problems(current_user: UserOut = Depends(require_student)):
    """Slugs of the problems this student has an Accepted submission for (drives the solved badge)."""
    return {"solved": await practice.solved_slugs(current_user.id)}


@router.get("/problems/{problem_slug}", response_model=CodingProblem)
async def get_practice_problem(problem_slug: str):
    problem = await practice.get_problem(problem_slug)
    if not problem:
        raise HTTPException(status_code=404, detail="Problem not found")
    return _public(problem)


def _check_source_size(source_code: str, stdin: str = "") -> None:
    if len(source_code.encode("utf-8")) > MAX_SOURCE_BYTES:
        raise HTTPException(status_code=413, detail=f"Source code is larger than the {MAX_SOURCE_BYTES // 1024} KB limit.")
    if len(stdin.encode("utf-8")) > 64 * 1024:
        raise HTTPException(status_code=413, detail="Custom input is larger than the 64 KB limit.")


@router.post("/code/run", response_model=CodeRunResponse)
@limiter.shared_limit(settings.CODE_RATE_LIMIT, scope="code", key_func=user_or_ip)
async def run_practice_code(request: Request, req: CodeRunRequest, current_user: UserOut = Depends(require_student)):
    """Run one program in the sandbox. Students only; 10 runs/submissions per minute per user."""
    _check_source_size(req.source_code, req.stdin or "")
    res = await execute_async(req.language, req.source_code, req.stdin or "")
    return CodeRunResponse(
        status=res["status"],
        stdout=res["stdout"],
        stderr=res["stderr"],
        compile_output=res["compile_output"],
        runtime_ms=res["runtime_ms"],
        memory_kb=res["memory_kb"],
    )


@router.post("/code/submit", response_model=CodeSubmitResponse)
@limiter.shared_limit(settings.CODE_RATE_LIMIT, scope="code", key_func=user_or_ip)
async def submit_practice_code(request: Request, req: CodeSubmitRequest, current_user: UserOut = Depends(require_student)):
    """Evaluates candidate code against the problem's sample and hidden test cases."""
    _check_source_size(req.source_code)
    slug = req.problem_slug or req.problem_id
    prob = await practice.get_problem(slug) if slug else None
    if not prob:
        raise HTTPException(status_code=404, detail="Problem not found")

    res = await run_tests_async(req.language, req.source_code, _all_cases(prob))

    if res["status"] != JUDGE_UNAVAILABLE:  # a provider outage says nothing about the student's code: no attempt
        attempt = PracticeAttempt(
            id=f"att-{uuid.uuid4().hex[:8]}",
            user_id=current_user.id,
            problem_slug=prob["slug"],
            language=req.language,
            code=req.source_code,
            message=f"Status: {res['status']}, passed {res['passed_count']}/{res['total_count']} test cases.",
            is_correct=res["status"] == "Accepted",
            verdict=res["status"],
            runtime_ms=res["runtime_ms"],
        )
        await practice.insert_attempt(attempt.model_dump())

    return CodeSubmitResponse(
        status=res["status"],
        passed_count=res["passed_count"],
        total_count=res["total_count"],
        stdout=res["stdout"],
        stderr=res["stderr"],
        compile_output=res["compile_output"],
        runtime_ms=res["runtime_ms"],
        memory_kb=res["memory_kb"],
        test_results=res["test_results"],
        failed_case=res.get("failed_case"),
        message=res.get("message", ""),
    )


@router.post("/problems/{problem_slug}/attempt", response_model=PracticeAttempt)
async def record_practice_attempt(problem_slug: str, body: dict, current_user: UserOut = Depends(get_current_user)):
    """Save a code snapshot to the student's portfolio."""
    if not await practice.get_problem(problem_slug):
        raise HTTPException(status_code=404, detail="Problem not found")
    attempt = PracticeAttempt(
        id=f"att-{uuid.uuid4().hex[:8]}",
        user_id=current_user.id,
        problem_slug=problem_slug,
        language=body.get("language", "python"),
        code=body.get("code", ""),
        message="Code snapshot saved.",
    )
    await practice.insert_attempt(attempt.model_dump())
    return attempt


# =========================================================================
# INTERACTIVE PRACTICE QUESTIONS ENDPOINTS (MCQ, Code Output, Find Error)
# =========================================================================
@router.get("/questions")
async def get_interactive_practice_questions(
    skill: Optional[str] = Query(None),
    topic: Optional[str] = Query(None),
    difficulty: Optional[str] = Query(None),
    question_type: Optional[str] = Query(None),
    company: Optional[str] = Query(None),
    _user: UserOut = Depends(get_current_user),
):
    """Practice questions with filters (login required). Graded-only questions are never listed; the key is hidden until answered."""
    return await assessment_bank.search_public_questions(skill, topic, difficulty, question_type, company=company, practice_only=True)


@router.get("/questions/{question_id}")
async def get_practice_question_by_id(question_id: str, _user: UserOut = Depends(get_current_user)):
    """Get single question by ID with the answer key hidden (login required; graded-only questions are a 404)."""
    q = await assessment_bank.get_public_question(question_id)
    if not q or not q.get("practice", True) or q.get("active") is False:
        raise HTTPException(status_code=404, detail="Question not found")
    return q


@router.post("/questions/{question_id}/answer")
async def answer_practice_question(question_id: str, body: dict, current_user: UserOut = Depends(get_current_user)):
    """Submit and validate a candidate answer against ground truth."""
    selected_option = body.get("selected_option_index", body.get("selected_option", 0))
    checked = await check_answer(question_id, selected_option)
    if not checked:
        raise HTTPException(status_code=404, detail="Question not found")

    await practice.insert_attempt({
        "id": f"prac-{uuid.uuid4().hex[:8]}",
        "user_id": current_user.id,
        "question_id": question_id,
        "selected_option": selected_option,
        "is_correct": checked["is_correct"],
        "timestamp": utcnow(),
    })
    return checked


@router.get("/stats")
async def get_practice_stats(current_user: UserOut = Depends(get_current_user)):
    """Practice statistics computed from this user's own stored records.

    total_solved / correct_count / accuracy_percentage count submitted answers (judged code submissions and answered questions;
    code snapshots are not attempts). The streak counts consecutive days with an assessment OR a coding/practice attempt.
    """
    from app.repositories import attempts as assessment_attempts
    from app.services import readiness_service as rs

    user = {"id": current_user.id}
    result = rs.compute({
        "assessment_attempts": await assessment_attempts.for_user(current_user.id),
        "practice_attempts": await practice.attempts_for_user(current_user.id),
    })
    total, correct = result["submissions"], result["correct_submissions"]
    return {
        "total_solved": total,
        "correct_count": correct,
        "accuracy_percentage": int(correct / total * 100) if total else 0,
        "streak_days": result["streak_days"],
        "points": correct * 10,  # 10 points per correct answer / accepted solution
        "problems_solved": result["problems_solved"],
        "problems_attempted": result["problems_attempted"],
    }
