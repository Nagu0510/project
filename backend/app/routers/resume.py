import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request, UploadFile

from app.config import settings
from app.limiter import limiter, user_or_ip
from app.models.resume import ResumeAnalysisResult, ResumeHistoryItem, ResumeTextRequest
from app.models.user import UserOut
from app.repositories import career_paths, courses, profiles, resumes
from app.services import notification_service, resume_extract, resume_service
from app.utils.security import require_student

logger = logging.getLogger("skillsense_resume")
router = APIRouter(prefix="/resume", tags=["Resume Intelligence"])

MAX_JD_CHARS = 8000


async def _resolve_role(raw: Optional[str], user: UserOut) -> dict:
    """The target role must be a known career path. No silent fallback to some default role."""
    wanted = (raw or "").strip() or (user.current_path or "").strip()
    if not wanted:
        raise HTTPException(status_code=400, detail="Choose a target role (career path) for the analysis.")
    role = await career_paths.find(wanted)
    if not role:
        known = ", ".join(p["title"] for p in await career_paths.list_paths())
        raise HTTPException(status_code=400, detail=f"Unknown career path '{wanted[:60]}'. Choose one of: {known}.")
    return role


async def _score_and_save(text: str, role: dict, jd: Optional[str], user: UserOut, meta=None) -> ResumeAnalysisResult:
    jd = (jd or "").strip()[:MAX_JD_CHARS] or None
    try:
        result = resume_service.analyze_resume_text(
            text, role,
            jd_text=jd,
            verified=await resume_service.verified_skills(user.id),   # this student's own data only
            previous=await resumes.latest(user.id),
            courses=await courses.list_courses(),
            meta=meta,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    record = resume_service.stored_record(result, jd_used=bool(jd))
    await resumes.save(user.id, record)
    result.analysis_id = record["id"]
    await profiles.upsert(user.id, {
        "detected_skills": result.detected_skills,
        "strong_skills": result.strong_skills,
        "ats_score": result.overall_score,
    })
    await notification_service.courses_recommended(user)  # newly recommended courses, each announced once
    return result


@router.post("/analyze", response_model=ResumeAnalysisResult)
@limiter.limit(settings.RESUME_RATE_LIMIT, key_func=user_or_ip)
async def analyze_resume(
    request: Request,
    file: UploadFile = File(...),
    career_path: Optional[str] = Form(None),
    job_description: Optional[str] = Form(None),
    current_user: UserOut = Depends(require_student),
):
    """Read an uploaded resume (PDF, DOCX, TXT, PNG, JPG, WEBP; OCR for scans and photos) and score it."""
    role = await _resolve_role(career_path, current_user)
    data = await file.read(resume_extract.MAX_BYTES + 1)
    try:
        extracted = await resume_extract.extract_resume(file.filename or "", data)
    except resume_extract.ResumeFileError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message)
    if not extracted.text.strip():
        raise HTTPException(status_code=400, detail="No readable text was found in this file. Try a clearer scan, a text-based PDF, or paste your text instead.")
    return await _score_and_save(extracted.text, role, job_description, current_user, extracted)


@router.post("/analyze-text", response_model=ResumeAnalysisResult)
@limiter.limit(settings.RESUME_RATE_LIMIT, key_func=user_or_ip)
async def analyze_resume_text(request: Request, body: ResumeTextRequest, current_user: UserOut = Depends(require_student)):
    """Re-score text the student edited (for example to fix OCR mistakes) without uploading the file again."""
    role = await _resolve_role(body.career_path, current_user)
    text = resume_extract.clean_text(body.text)
    if not text:
        raise HTTPException(status_code=400, detail="The text is empty.")
    meta = resume_extract.Extracted(text=text, kind="text")
    return await _score_and_save(text, role, body.job_description, current_user, meta)


@router.get("/history", response_model=List[ResumeHistoryItem])
async def resume_history(current_user: UserOut = Depends(require_student)):
    """The student's last 10 analyses (newest first), for the progress chart."""
    return [
        ResumeHistoryItem(
            id=doc.get("id", ""), created_at=doc["created_at"].isoformat(),
            overall_score=doc.get("overall_score", 0),
            career_path=doc.get("career_path") or doc.get("recommended_path") or "",
            jd_used=bool(doc.get("jd_used")), jd_match=doc.get("jd_match"),
            ocr_used=bool(doc.get("ocr_used")), ocr_confidence=doc.get("ocr_confidence"),
            source=doc.get("source", ""), categories=doc.get("categories", []),
        )
        for doc in await resumes.history(current_user.id, 10)
    ]


@router.get("/questions")
async def resume_questions(
    analysis_id: Optional[str] = Query(None),
    company: Optional[str] = Query(None),
    current_user: UserOut = Depends(require_student),
):
    """A personal practice set for one of this student's analyses: questions for the skills the resume shows, plus interview prompts.

    Questions are 'pattern-inspired practice' (original, tagged by company style), never real past questions.
    """
    from app.data.assessment_bank import COMPANIES
    from app.repositories import assessment_bank
    from app.services import resume_practice_service as practice_set

    if company and company not in COMPANIES:
        raise HTTPException(status_code=400, detail=f"Unknown company '{company[:40]}'. Choose one of: {', '.join(COMPANIES)}.")
    analysis = await (resumes.get(current_user.id, analysis_id) if analysis_id else resumes.latest(current_user.id))
    if not analysis:
        raise HTTPException(status_code=404, detail="No resume analysis found. Analyse a resume first.")

    bank = await assessment_bank.search_public_questions(company=company, practice_only=True)
    questions = practice_set.build_questions(analysis, bank)
    note = ""
    if not questions:
        note = (f"No {company}-style questions match the skills in this resume yet." if company
                else "No practice questions match the skills in this resume yet.")
    return {
        "analysis_id": analysis.get("id", ""),
        "company": company or "",
        "career_path": analysis.get("career_path", ""),
        "questions": questions,
        "prompts": practice_set.build_prompts(analysis),
        "note": note,
        "disclaimer": "Pattern-inspired practice: original questions, not real past questions.",
    }
