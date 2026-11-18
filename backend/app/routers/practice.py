import logging
import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Path, Query, Request

from app.config import settings
from app.limiter import limiter, user_or_ip
from app.models.practice import (
    CodeRunRequest,
    CodeRunResponse,
    CodeSubmitRequest,
    CodeSubmitResponse,
    AchievementsOut,
    CodingProblem,
    DailyChallengeOut,
    DailyProblem,
    HintOut,
    PracticeAnswerBody,
    PracticeAttempt,
    PracticeAttemptBody,
    RunCaseOut,
    SubmissionDetail,
    SubmissionOut,
    SubmissionPage,
    SubmissionRow,
)
from app.models.user import UserOut
from app.repositories import assessment_bank, practice, users
from app.services import daily_challenge_service as daily
from app.services import function_judge as fj
from app.services.assessment_service import check_answer
from app.services.code_execution_service import MAX_SOURCE_BYTES
from app.services.sandbox_errors import SandboxRateLimited, SandboxUnavailable
from app.utils.security import get_current_user, require_student
from app.utils.timeutil import utcnow

logger = logging.getLogger("skillsense_practice")
router = APIRouter(prefix="/practice", tags=["Coding Practice"])

JUDGE_UNAVAILABLE = "Judge unavailable"


def _public(problem: dict, stats: Optional[dict] = None) -> Optional[CodingProblem]:
    """What students may see (see function_judge.public_problem). A stored problem in an old format is skipped, not served."""
    if not problem.get("function_name"):
        logger.warning("Problem %s has no function signature (old format); not served.", problem.get("slug"))
        return None
    view = fj.public_problem(problem)
    counts = (stats or {}).get(problem["slug"]) or {}
    submissions = counts.get("submissions", 0)
    view["submissions_count"] = submissions
    view["acceptance_rate"] = round(counts.get("accepted", 0) * 100 / submissions) if submissions else None
    return CodingProblem(**view)


async def _problem_or_404(slug: Optional[str], public: bool = False) -> dict:
    """The full problem (hidden cases included) for judging; `public=True` reads the student view straight from the database
    (no hidden case, no hints, with their counts), which is also much lighter for the list and detail pages."""
    problem = await (practice.get_public_problem(slug) if public else practice.get_problem(slug)) if slug else None
    if not problem or not problem.get("function_name"):
        raise HTTPException(status_code=404, detail="Problem not found")
    return problem


@router.get("/problems", response_model=List[CodingProblem])
async def get_practice_problems(
    difficulty: Optional[str] = Query(None, max_length=20),
    topic: Optional[str] = Query(None, max_length=60),
):
    """Coding practice problems from MongoDB, with optional difficulty / topic filtering, in difficulty order."""
    stats = await practice.acceptance_stats()
    result = []
    for p in await practice.list_public_problems():
        if difficulty and difficulty != "All" and p.get("difficulty", "").lower() != difficulty.lower():
            continue
        if topic and topic != "All" and topic.lower() not in p.get("topic", "").lower():
            continue
        view = _public(p, stats)
        if view:
            result.append(view)
    return sorted(result, key=lambda v: (v.difficulty_rank, v.id))


@router.get("/solved")
async def get_solved_problems(current_user: UserOut = Depends(require_student)):
    """Slugs of the problems this student has an Accepted submission for (drives the solved badge)."""
    return {"solved": await practice.solved_slugs(current_user.id)}


@router.get("/problems/{problem_slug}", response_model=CodingProblem)
async def get_practice_problem(problem_slug: str):
    problem = await _problem_or_404(problem_slug, public=True)
    return _public(problem, await practice.acceptance_stats())


@router.get("/problems/{problem_slug}/hints", response_model=HintOut)
async def get_problem_hint(problem_slug: str, level: int = Query(..., ge=1, le=10), current_user: UserOut = Depends(get_current_user)):
    """One hint at a time (1, 2, 3). Logged-in users only; the list of hints is never sent in one piece."""
    hints = await practice.get_hints(problem_slug)
    if hints is None:
        raise HTTPException(status_code=404, detail="Problem not found")
    if level > len(hints):
        raise HTTPException(status_code=404, detail="There is no such hint")
    return HintOut(level=level, total=len(hints), hint=hints[level - 1])


@router.get("/problems/{problem_slug}/submissions", response_model=List[SubmissionOut])
async def get_problem_submissions(problem_slug: str, current_user: UserOut = Depends(get_current_user)):
    """The logged-in user's own last 20 judged submissions of this problem."""
    await _problem_or_404(problem_slug, public=True)
    rows = await practice.submissions_for(current_user.id, problem_slug, 20)
    return [
        SubmissionOut(
            id=r["id"], language=r.get("language", ""), verdict=r.get("verdict", ""), runtime_ms=r.get("runtime_ms"), memory_kb=r.get("memory_kb"),
            passed_count=r.get("passed_count"), total_count=r.get("total_count"), created_at=r.get("created_at") or r.get("timestamp") or utcnow(),
            code=r.get("code", ""),
        )
        for r in rows
    ]


SUBMISSION_PAGE_MAX = 50  # rows per page, at most (a bigger page_size is a 422)
VERDICTS = {"Accepted", "Wrong Answer", "Runtime Error", "Time Limit Exceeded", "Output Limit Exceeded", "Compile Error"}
DIFFICULTIES = {"easy": "Easy", "medium": "Medium", "hard": "Hard"}


@router.get("/daily", response_model=DailyChallengeOut)
async def get_daily_challenge(current_user: UserOut = Depends(require_student)):
    """Today's problem (the same for everyone on the same UTC date) and this student's streak. See services/daily_challenge_service.py for the day rules."""
    now = utcnow()
    problem = daily.problem_for_day(await practice.list_public_problems(), now.date())
    attempts = await practice.attempts_for_user(current_user.id, 5000)
    summary = daily.summarize(attempts, (await users.get(current_user.id) or {}).get("day_offset_minutes", 0), now)
    return DailyChallengeOut(
        date=now.date().isoformat(),
        problem=DailyProblem(slug=problem["slug"], title=problem["title"], difficulty=problem.get("difficulty", ""), topic=problem.get("topic", "")) if problem else None,
        solved_today=bool(problem) and daily.solved_today(attempts, problem["slug"], now),
        current_streak=summary["current_streak"], best_streak=summary["best_streak"], last_solved_day=summary["last_solved_day"],
        day_offset_minutes=summary["day_offset_minutes"],
    )


@router.get("/achievements", response_model=AchievementsOut)
async def get_achievements(current_user: UserOut = Depends(require_student)):
    """Streak, best streak and badges (7-day streak, 30-day streak, 10 problems solved) from this student's own Accepted submissions."""
    summary = daily.summarize(await practice.attempts_for_user(current_user.id, 5000), (await users.get(current_user.id) or {}).get("day_offset_minutes", 0))
    return AchievementsOut(**summary)


def _submission_row(r: dict, problems: dict) -> SubmissionRow:
    problem = problems.get(r.get("problem_slug", "")) or {}
    return SubmissionRow(
        id=r["id"], problem_slug=r["problem_slug"], problem_title=problem.get("title") or r["problem_slug"], difficulty=problem.get("difficulty", ""),
        language=r.get("language", ""), verdict=r.get("verdict", ""), runtime_ms=r.get("runtime_ms"), passed_count=r.get("passed_count"),
        total_count=r.get("total_count"), created_at=r.get("timestamp") or r.get("created_at") or utcnow(),
    )


@router.get("/submissions", response_model=SubmissionPage)
async def get_my_submissions(
    page: int = Query(1, ge=1, le=100000),
    page_size: int = Query(20, ge=1, le=SUBMISSION_PAGE_MAX),
    verdict: Optional[str] = Query(None, max_length=40),
    language: Optional[str] = Query(None, max_length=20),
    difficulty: Optional[str] = Query(None, max_length=10),
    current_user: UserOut = Depends(require_student),
):
    """The signed-in student's own judged submissions, newest first, one page at a time. Filters: verdict, language, difficulty.
    The rows carry no code (open one with /submissions/{id}) and nothing about hidden test cases: only counts."""
    if verdict and verdict not in VERDICTS:
        raise HTTPException(status_code=422, detail="Unknown verdict")
    lang_key = None
    if language:
        try:
            lang_key = fj.normalize_language(language)
        except ValueError:
            raise HTTPException(status_code=422, detail="Unknown language") from None
    wanted = None
    if difficulty:
        wanted = DIFFICULTIES.get(difficulty.lower())
        if not wanted:
            raise HTTPException(status_code=422, detail="Unknown difficulty")
    problems = {p["slug"]: p for p in await practice.list_public_problems()}
    slugs = [slug for slug, p in problems.items() if p.get("difficulty") == wanted] if wanted else None
    total = await practice.count_submissions(current_user.id, verdict, lang_key, slugs)
    rows = await practice.list_submissions(current_user.id, verdict, lang_key, slugs, skip=(page - 1) * page_size, limit=page_size)
    options = await practice.submission_filters(current_user.id)
    return SubmissionPage(
        items=[_submission_row(r, problems) for r in rows], total=total, page=page, page_size=page_size,
        verdicts=options["verdicts"], languages=options["languages"],
    )


@router.get("/submissions/{submission_id}", response_model=SubmissionDetail)
async def get_my_submission(submission_id: str = Path(..., max_length=60), current_user: UserOut = Depends(require_student)):
    """One of the signed-in student's own submissions, with the code they submitted. Someone else's id is a 404 (it is not revealed to exist)."""
    row = await practice.get_submission(current_user.id, submission_id)
    if not row:
        raise HTTPException(status_code=404, detail="Submission not found")
    problems = {p["slug"]: p for p in await practice.list_public_problems()}
    return SubmissionDetail(**_submission_row(row, problems).model_dump(), code=row.get("code", ""), memory_kb=row.get("memory_kb"))


def _check_source(source_code: str, language: str, problem: dict) -> str:
    if len(source_code.encode("utf-8")) > MAX_SOURCE_BYTES:
        raise HTTPException(status_code=413, detail=f"Source code is larger than the {MAX_SOURCE_BYTES // 1024} KB limit.")
    try:
        key = fj.normalize_language(language)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from None
    if key == "c" and not fj.signature_of(problem).c_available:
        raise HTTPException(status_code=400, detail=fj.signature_of(problem).c_disabled_reason)
    return key


def _case_text(problem: dict, args: list) -> str:
    return fj.display_args([p["name"] for p in problem["params"]], args)


@router.post("/code/run", response_model=CodeRunResponse)
@limiter.shared_limit(settings.CODE_RATE_LIMIT, scope="code", key_func=user_or_ip)
async def run_practice_code(request: Request, req: CodeRunRequest, current_user: UserOut = Depends(require_student)):
    """Run the student's function on the shown examples (or on the cases sent: edited examples and up to 5 custom ones).
    Students only; 10 runs/submissions per minute per user. Only shown examples have an expected value."""
    problem = await _problem_or_404(req.problem_slug or req.problem_id)
    language = _check_source(req.source_code, req.language, problem)
    examples = [c for c in problem["test_cases"] if not c.get("hidden")]

    cases: List[fj.CaseInput] = []
    custom_flags: List[bool] = []
    if req.cases is None:
        for c in examples:
            cases.append(fj.CaseInput(args=c["args"], expected=c["expected"], has_expected=True, shown=True))
            custom_flags.append(False)
    else:
        errors: List[dict] = []
        for n, text in enumerate(req.cases, 1):
            try:
                args = fj.parse_case_text(problem, text, n)
            except fj.CaseInputError as exc:
                errors += exc.errors
                continue
            match = next((c for c in examples if fj.compact_json(c["args"]) == fj.compact_json(args)), None)
            cases.append(fj.CaseInput(args=args, expected=match["expected"] if match else None, has_expected=bool(match), shown=True))
            custom_flags.append(match is None)
        if errors:
            raise HTTPException(status_code=422, detail={"message": errors[0]["message"], "errors": errors})
        if not cases:
            raise HTTPException(status_code=422, detail={"message": "Add at least one test case to run.", "errors": []})
        if sum(custom_flags) > fj.MAX_CUSTOM_CASES:
            raise HTTPException(status_code=422, detail={"message": f"You can run at most {fj.MAX_CUSTOM_CASES} custom test cases at a time.", "errors": []})
    for c in cases:
        c.text = _case_text(problem, c.args)

    outcome = await fj.run_function_cases(problem, language, req.source_code, cases)
    status = outcome.verdict
    if status == "Accepted" and not any(c.has_expected for c in cases):
        status = fj.FINISHED
    out_cases = []
    for result, case, custom in zip(outcome.cases, cases, custom_flags):
        out_cases.append(RunCaseOut(
            index=result.index, input=case.text, custom=custom, status=result.status, passed=result.passed,
            your_output=result.your_output, expected=fj.display_value(case.expected) if case.has_expected else None,
            runtime_ms=result.ms, stdout=result.stdout, error=result.error, error_line=result.error_line,
        ))
    return CodeRunResponse(
        status=status, message=outcome.message, compile_output=outcome.compile_output, error_lines=outcome.error_lines,
        runtime_ms=outcome.runtime_ms, memory_kb=outcome.memory_kb, cases=out_cases,
    )


@router.post("/code/submit", response_model=CodeSubmitResponse)
@limiter.shared_limit(settings.CODE_RATE_LIMIT, scope="code", key_func=user_or_ip)
async def submit_practice_code(request: Request, req: CodeSubmitRequest, current_user: UserOut = Depends(require_student)):
    """Judge the code on every test case (shown + hidden) in one execution. A hidden case that fails is reported by its number
    only: no input, no expected output, nothing the student's own program printed for it."""
    problem = await _problem_or_404(req.problem_slug or req.problem_id)
    language = _check_source(req.source_code, req.language, problem)
    cases = []
    for c in problem["test_cases"]:
        shown = not c.get("hidden")
        cases.append(fj.CaseInput(args=c["args"], expected=c["expected"], has_expected=True, shown=shown, text=_case_text(problem, c["args"]) if shown else ""))

    try:
        outcome = await fj.run_function_cases(problem, language, req.source_code, cases)
    except (SandboxUnavailable, SandboxRateLimited) as exc:
        # The provider failed, the student's code did not: never a Wrong Answer, and nothing is recorded.
        return CodeSubmitResponse(status=JUDGE_UNAVAILABLE, total_count=len(cases), message=str(exc),
                                  expected_complexity=problem.get("expected_complexity", ""))

    passed = sum(1 for r in outcome.cases if r.status == fj.PASSED)
    failure = outcome.first_failure
    detail = None
    stdout = ""
    if failure is not None and failure.shown:
        case = cases[failure.index - 1]
        detail = {"case": failure.index, "input": case.text, "your_output": failure.your_output, "expected": fj.display_value(case.expected),
                  "error": failure.error, "error_line": failure.error_line}
        stdout = failure.stdout
    message = outcome.message
    if outcome.verdict == "Accepted":
        message = f"Passed all {len(cases)} test cases."
    elif failure is not None:
        message = f"Test case {failure.index} of {len(cases)} failed ({failure.status})."

    attempt = PracticeAttempt(
        id=f"att-{uuid.uuid4().hex[:8]}", user_id=current_user.id, problem_slug=problem["slug"], language=language, code=req.source_code,
        message=f"Status: {outcome.verdict}, passed {passed}/{len(cases)} test cases.", is_correct=outcome.verdict == "Accepted",
        verdict=outcome.verdict, runtime_ms=outcome.runtime_ms, memory_kb=outcome.memory_kb, passed_count=passed, total_count=len(cases),
    )
    await practice.insert_attempt(attempt.model_dump())

    return CodeSubmitResponse(
        status=outcome.verdict, passed_count=passed, total_count=len(cases), runtime_ms=outcome.runtime_ms, memory_kb=outcome.memory_kb,
        expected_complexity=problem.get("expected_complexity", ""), failed_case=failure.index if failure else None, failed_detail=detail,
        message=message, compile_output=outcome.compile_output, error_lines=outcome.error_lines, stdout=stdout,
        test_results=[{"case": r.index, "passed": r.passed, "is_hidden": not r.shown, "status": r.status} for r in outcome.cases],
    )


@router.post("/problems/{problem_slug}/attempt", response_model=PracticeAttempt)
async def record_practice_attempt(problem_slug: str, body: PracticeAttemptBody, current_user: UserOut = Depends(get_current_user)):
    """Save a code snapshot to the student's portfolio."""
    await _problem_or_404(problem_slug, public=True)
    attempt = PracticeAttempt(
        id=f"att-{uuid.uuid4().hex[:8]}",
        user_id=current_user.id,
        problem_slug=problem_slug,
        language=body.language,
        code=body.code,
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
async def answer_practice_question(question_id: str, body: PracticeAnswerBody, current_user: UserOut = Depends(get_current_user)):
    """Submit and validate a candidate answer against ground truth."""
    selected_option = body.selected_option_index if body.selected_option_index is not None else (body.selected_option or 0)
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
