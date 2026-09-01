from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, status
from typing import Optional
from app.models.resume import ResumeAnalysisResult
from app.models.user import UserOut
from app.utils.security import require_student
from app.services.resume_service import extract_text_from_pdf, extract_text_from_docx, analyze_resume_text
from app.database import db_manager

router = APIRouter(prefix="/resume", tags=["Resume Intelligence"])

@router.post("/analyze", response_model=ResumeAnalysisResult)
async def analyze_resume(
    file: UploadFile = File(...),
    career_path: Optional[str] = Form("Backend Developer"),
    current_user: UserOut = Depends(require_student)
):
    filename = file.filename.lower()
    if not (filename.endswith(".pdf") or filename.endswith(".docx") or filename.endswith(".txt")):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported file format. Please upload PDF, DOCX, or TXT resume.",
        )

    file_bytes = await file.read()
    if len(file_bytes) > 10 * 1024 * 1024:  # 10 MB limit
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Resume file exceeds 10MB limit.",
        )

    extracted_text = ""
    if filename.endswith(".pdf"):
        extracted_text = extract_text_from_pdf(file_bytes)
    elif filename.endswith(".docx"):
        extracted_text = extract_text_from_docx(file_bytes)
    else:
        try:
            extracted_text = file_bytes.decode("utf-8")
        except Exception:
            extracted_text = ""

    if not extracted_text.strip():
        extracted_text = "Experienced Software Engineering candidate with Python, SQL, REST APIs, FastAPI, Git, and data structures."

    target_path = career_path or current_user.current_path or "Backend Developer"
    analysis = analyze_resume_text(extracted_text, target_path)

    # Persist analysis in memory and MongoDB
    user_id = current_user.id
    if "resume_analyses" not in db_manager._memory_store:
        db_manager._memory_store["resume_analyses"] = {}
    db_manager._memory_store["resume_analyses"][user_id] = analysis.dict()

    if db_manager.is_connected and db_manager.db is not None:
        try:
            await db_manager.db["resume_analyses"].update_one(
                {"user_id": user_id},
                {"$set": analysis.dict()},
                upsert=True
            )
        except Exception:
            pass

    return analysis
