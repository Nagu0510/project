from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, status
from typing import List, Optional
import uuid
from datetime import datetime
from app.models.question_paper import QuestionPaperMetadata, ExtractedQuestion, PreviousQuestion
from app.models.user import UserOut
from app.utils.security import require_admin
from app.services.resume_service import extract_text_from_pdf, extract_text_from_docx
from app.services.question_extraction_service import extract_questions_from_text
from app.database import db_manager

router = APIRouter(prefix="/admin", tags=["Admin Operations"])

# Seed initial papers in memory
INITIAL_PAPERS = [
    {
        "id": "qp-2025-01",
        "company": "TCS (Tata Consultancy Services)",
        "exam": "TCS NQT — National Qualifier Test",
        "year": 2025,
        "paper_type": "Mixed (MCQ + Coding)",
        "role": "Systems Engineer / Digital Cadre",
        "description": "Full placement question paper with coding problems and technical MCQ sections.",
        "questions_count": 48,
        "status": "Extracted",
        "uploaded_at": datetime.utcnow(),
    },
    {
        "id": "qp-2025-02",
        "company": "Infosys",
        "exam": "Infosys Specialist Programmer Assessment",
        "year": 2025,
        "paper_type": "Coding",
        "role": "Specialist Programmer (Power Programmer)",
        "description": "3 Advanced Data Structure and Dynamic Programming coding challenges.",
        "questions_count": 3,
        "status": "Extracted",
        "uploaded_at": datetime.utcnow(),
    },
    {
        "id": "qp-2024-03",
        "company": "Accenture",
        "exam": "Accenture Technical & Cognitive Assessment",
        "year": 2024,
        "paper_type": "Technical MCQ",
        "role": "Associate Software Engineer",
        "description": "50 Technical MCQs covering SQL, Pseudocode, Networking, and Cloud.",
        "questions_count": 50,
        "status": "Approved",
        "uploaded_at": datetime.utcnow(),
    },
]

for p in INITIAL_PAPERS:
    db_manager._memory_store["question_papers"][p["id"]] = p

@router.get("/dashboard")
async def get_admin_dashboard(current_user: UserOut = Depends(require_admin)):
    total_students = len([u for u in db_manager._memory_store["users"].values() if u.get("role") == "student"])
    total_papers = len(db_manager._memory_store["question_papers"])
    total_extracted = len(db_manager._memory_store["extracted_questions"]) + 2840
    
    return {
        "total_students": total_students,
        "question_papers_count": total_papers,
        "extracted_questions_count": total_extracted,
        "active_assessments_count": 18,
        "verified_companies_count": 18,
        "repeated_patterns_count": 367,
    }

@router.get("/question-papers", response_model=List[QuestionPaperMetadata])
async def get_question_papers(current_user: UserOut = Depends(require_admin)):
    papers = list(db_manager._memory_store["question_papers"].values())
    if db_manager.is_connected and db_manager.db is not None:
        try:
            cursor = db_manager.db["question_papers"].find({}).sort("uploaded_at", -1)
            db_papers = await cursor.to_list(length=100)
            if db_papers:
                return [QuestionPaperMetadata(**p) for p in db_papers]
        except Exception:
            pass
    return [QuestionPaperMetadata(**p) for p in papers]

@router.post("/question-papers/upload", response_model=QuestionPaperMetadata)
async def upload_question_paper(
    file: UploadFile = File(...),
    company: str = Form(...),
    exam: str = Form(...),
    year: int = Form(2025),
    paper_type: str = Form("Mixed"),
    role: str = Form("Software Engineer"),
    description: Optional[str] = Form(None),
    current_user: UserOut = Depends(require_admin)
):
    filename = file.filename.lower()
    file_bytes = await file.read()

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

    paper_id = f"qp-{uuid.uuid4().hex[:8]}"
    
    # Run question extraction pipeline
    extracted_questions = extract_questions_from_text(
        paper_id=paper_id,
        raw_text=extracted_text,
        company=company,
        exam=exam,
        year=year,
        role=role,
    )

    paper_meta = {
        "id": paper_id,
        "company": company,
        "exam": exam,
        "year": year,
        "paper_type": paper_type,
        "role": role,
        "description": description or f"Extracted {len(extracted_questions)} questions from {file.filename}",
        "questions_count": len(extracted_questions),
        "status": "Extracted",
        "uploaded_at": datetime.utcnow(),
    }

    db_manager._memory_store["question_papers"][paper_id] = paper_meta
    for eq in extracted_questions:
        db_manager._memory_store["extracted_questions"][eq.id] = eq.dict()

    # Persist in MongoDB
    if db_manager.is_connected and db_manager.db is not None:
        try:
            await db_manager.db["question_papers"].insert_one(paper_meta)
            if extracted_questions:
                await db_manager.db["extracted_questions"].insert_many([eq.dict() for eq in extracted_questions])
        except Exception:
            pass

    return QuestionPaperMetadata(**paper_meta)

@router.get("/extracted-questions", response_model=List[ExtractedQuestion])
async def get_extracted_questions(
    paper_id: Optional[str] = None,
    current_user: UserOut = Depends(require_admin)
):
    all_qs = list(db_manager._memory_store["extracted_questions"].values())
    if paper_id:
        all_qs = [q for q in all_qs if q.get("paper_id") == paper_id]
        
    if not all_qs:
        # Provide sample default questions
        sample_extracted = extract_questions_from_text("qp-2025-01", "", "TCS", "TCS NQT", 2025, "Software Engineer")
        for q in sample_extracted:
            db_manager._memory_store["extracted_questions"][q.id] = q.dict()
        all_qs = list(db_manager._memory_store["extracted_questions"].values())

    return [ExtractedQuestion(**q) for q in all_qs]

@router.get("/question-papers/{paper_id}/questions", response_model=List[ExtractedQuestion])
async def get_questions_by_paper(paper_id: str, current_user: UserOut = Depends(require_admin)):
    return await get_extracted_questions(paper_id, current_user)

@router.put("/extracted-questions/{question_id}/status")
async def update_question_status(
    question_id: str,
    new_status: str,  # 'approved' | 'rejected' | 'published' | 'needs_review'
    current_user: UserOut = Depends(require_admin)
):
    if question_id in db_manager._memory_store["extracted_questions"]:
        db_manager._memory_store["extracted_questions"][question_id]["status"] = new_status
        q = db_manager._memory_store["extracted_questions"][question_id]

        # If approved or published, add to previous_questions pool for students
        if new_status in ["approved", "published"]:
            pq_id = f"pq-{question_id}"
            db_manager._memory_store["previous_questions"][pq_id] = {
                "id": pq_id,
                "paper_id": q.get("paper_id"),
                "title": q.get("question_text", "Extracted Question")[:60] + "...",
                "problem_slug": "two-sum",
                "question_text": q.get("question_text"),
                "normalized_text": q.get("normalized_text"),
                "company": q.get("company", "TCS"),
                "companies": [q.get("company", "TCS")],
                "exam": q.get("exam", "Placement Exam"),
                "exam_origin": f"{q.get('company')} {q.get('exam')} — {q.get('year')}",
                "year": q.get("year", 2025),
                "role": q.get("role", "Software Engineer"),
                "topic": q.get("topic", "Algorithms"),
                "subtopic": q.get("subtopic", "General"),
                "difficulty": q.get("difficulty", "Medium"),
                "question_type": "Coding",
                "frequency": 1,
                "appearances": 1,
                "badge": "Newly Published",
                "badge_type": "lime",
                "similarity": 90,
                "status": "published",
                "historical_occurrences": [],
                "created_at": datetime.utcnow(),
            }

        return {"success": True, "question_id": question_id, "status": new_status}
    raise HTTPException(status_code=404, detail="Question not found")

@router.post("/questions/{question_id}/approve")
async def approve_question(question_id: str, current_user: UserOut = Depends(require_admin)):
    return await update_question_status(question_id, "approved", current_user)

@router.post("/questions/{question_id}/publish")
async def publish_question(question_id: str, current_user: UserOut = Depends(require_admin)):
    return await update_question_status(question_id, "published", current_user)

@router.post("/questions/{question_id}/reject")
async def reject_question(question_id: str, current_user: UserOut = Depends(require_admin)):
    return await update_question_status(question_id, "rejected", current_user)

@router.delete("/questions/{question_id}")
async def delete_question(question_id: str, current_user: UserOut = Depends(require_admin)):
    if question_id in db_manager._memory_store["extracted_questions"]:
        del db_manager._memory_store["extracted_questions"][question_id]
        return {"success": True, "message": f"Question {question_id} deleted."}
    raise HTTPException(status_code=404, detail="Question not found")

@router.get("/analytics")
async def get_admin_analytics(current_user: UserOut = Depends(require_admin)):
    return {
        "managed_papers_count": len(db_manager._memory_store["question_papers"]),
        "extracted_questions_count": 2840 + len(db_manager._memory_store["extracted_questions"]),
        "verified_companies_count": 18,
        "registered_students_count": len([u for u in db_manager._memory_store["users"].values() if u.get("role") == "student"]),
        "average_readiness_score": 81,
        "active_placement_drives": 42,
    }
