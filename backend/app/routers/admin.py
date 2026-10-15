import csv
import io
import json
import logging
import os
import uuid
from collections import Counter
from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Response, UploadFile, status

from app.models.question_paper import ExtractedQuestion, QuestionPaperMetadata, QuestionStatus, QuestionStatusUpdate
from app.models.user import UserOut
from app.repositories import assessment_bank, papers, placements, questions, users
from app.services import notification_service, readiness_service, resume_extract
from app.services.question_extraction_service import extract_questions_from_text
from app.services.question_matching_service import format_exam_origin, invalidate_question_matching_cache
from app.utils.security import require_admin
from app.utils.timeutil import utcnow

logger = logging.getLogger("skillsense_admin")
router = APIRouter(prefix="/admin", tags=["Admin Operations"])

PAPER_EXTENSIONS = {".pdf", ".docx", ".txt", ".json", ".png", ".jpg", ".jpeg", ".webp"}
MAX_PAPER_BYTES = resume_extract.MAX_BYTES  # same 8 MB limit as the resume upload
PAGE_SIZE_MAX = 100


def page_params(page: int = Query(1, ge=1), page_size: int = Query(50, ge=1, le=PAGE_SIZE_MAX)) -> dict:
    """?page=1&page_size=50 (page_size at most 100; anything else is a 422)."""
    return {"skip": (page - 1) * page_size, "limit": page_size, "page": page, "page_size": page_size}


def _page_headers(response: Response, total: int, paging: dict) -> None:
    response.headers["X-Total-Count"] = str(total)
    response.headers["X-Page"] = str(paging["page"])
    response.headers["X-Page-Size"] = str(paging["page_size"])


async def _distinct_company_count() -> int:
    return len({(p.get("company") or "").strip().lower() for p in await papers.list_papers()} - {""})


async def _topic_frequencies() -> list:
    """How often each topic appears in the published question bank (most frequent first)."""
    rows = await questions.public_previous()
    counts = Counter(q["topic"] for q in rows if q.get("topic"))
    total = sum(counts.values())
    return [
        {"topic": t, "count": n, "percentage": round(n / total * 100), "companies": sorted({c for q in rows if q.get("topic") == t for c in (q.get("companies") or [])})}
        for t, n in counts.most_common(8)
    ]


@router.get("/dashboard")
async def get_admin_dashboard(current_user: UserOut = Depends(require_admin)):
    return {
        "total_students": await users.count_students(),
        "question_papers_count": await papers.count(),
        "extracted_questions_count": await questions.count_extracted(),
        "active_assessments_count": await assessment_bank.count_sets(),
        "verified_companies_count": await _distinct_company_count(),
        "repeated_patterns_count": await questions.count_previous({"appearances": {"$gt": 1}}),
    }


@router.get("/question-papers", response_model=List[QuestionPaperMetadata])
async def get_question_papers(current_user: UserOut = Depends(require_admin)):
    return [QuestionPaperMetadata(**p) for p in await papers.list_papers()]


async def _read_paper(file: UploadFile):
    """The paper's text, read with the same extraction as the resume upload (magic-byte check, 8 MB limit, OCR for
    scanned PDFs and images, temp file deleted). Returns (text, kind, ocr_confidence, ocr_used, warnings)."""
    name = file.filename or ""
    ext = os.path.splitext(name.lower())[1]
    if ext not in PAPER_EXTENSIONS:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Unsupported file format '{name}'. Supported formats: {', '.join(sorted(PAPER_EXTENSIONS))}")
    data = await file.read(MAX_PAPER_BYTES + 1)
    if ext == ".json":  # structured papers have no OCR step: size, content check, then parse
        if not data:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "The uploaded file is empty (0 bytes).")
        if len(data) > MAX_PAPER_BYTES:
            raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "The file is larger than the 8 MB limit.")
        if resume_extract.detect_kind(data) != "txt":
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "This does not look like a JSON paper.")
        try:
            json.loads(data.decode("utf-8-sig"))
        except (UnicodeDecodeError, ValueError):
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "The JSON file is not valid JSON.")
        return data.decode("utf-8-sig"), "json", None, False, []
    try:
        extracted = await resume_extract.extract_resume(name, data)
    except resume_extract.ResumeFileError as exc:
        raise HTTPException(exc.status_code, exc.message)
    except Exception as exc:  # a corrupt or password-protected document: say so, log only the type
        logger.warning("Paper could not be read (%s).", type(exc).__name__)
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Could not read this document. It may be corrupted or password-protected.")
    return extracted.text, extracted.kind, extracted.ocr_confidence, extracted.ocr_used, list(extracted.warnings)


@router.post("/question-papers/upload", response_model=QuestionPaperMetadata)
async def upload_question_paper(
    file: UploadFile = File(...),
    company: str = Form(...),
    exam: str = Form(...),
    year: int = Form(2025),
    paper_type: str = Form("Mixed"),
    role: str = Form("Software Engineer"),
    description: Optional[str] = Form(None),
    current_user: UserOut = Depends(require_admin),
):
    """Read a paper (text, PDF, DOCX, JSON, or a scan / photo through OCR). Every extracted question starts as
    needs_review: none reaches students until an admin approves it."""
    if not file or not file.filename:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No file was provided for upload.")
    text, kind, confidence, ocr_used, warnings = await _read_paper(file)

    paper_id = f"qp-{uuid.uuid4().hex[:8]}"
    extracted = extract_questions_from_text(paper_id=paper_id, raw_text=text, company=company, exam=exam, year=year, role=role)
    if not extracted:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "No readable questions or structured test problems could be extracted from this document.",
        )
    low = ocr_used and confidence is not None and confidence < resume_extract.LOW_CONFIDENCE
    docs = [{**eq.model_dump(), "status": eq.status.value, "ocr_confidence": confidence if ocr_used else None, "low_confidence": bool(low)} for eq in extracted]

    paper_meta = {
        "id": paper_id,
        "company": company,
        "exam": exam,
        "year": year,
        "paper_type": paper_type,
        "role": role,
        "description": description or f"Extracted {len(extracted)} questions from {file.filename}",
        "questions_count": len(extracted),
        "status": "Extracted",
        "uploaded_at": utcnow(),
        "source_kind": kind,
        "ocr_used": ocr_used,
        "ocr_confidence": confidence if ocr_used else None,
        "warnings": warnings,
    }
    await papers.insert(paper_meta)
    await questions.insert_extracted(docs)
    return QuestionPaperMetadata(**paper_meta)


@router.get("/extracted-questions", response_model=List[ExtractedQuestion])
async def get_extracted_questions(
    response: Response,
    paper_id: Optional[str] = None,
    status_filter: Optional[QuestionStatus] = Query(None, alias="status"),
    paging: dict = Depends(page_params),
    current_user: UserOut = Depends(require_admin),
):
    """One page of the review queue, optionally only one status (X-Total-Count has the total)."""
    wanted = status_filter.value if status_filter else None
    _page_headers(response, await questions.count_extracted_for(paper_id, wanted), paging)
    return [ExtractedQuestion(**q) for q in await questions.list_extracted(paper_id, skip=paging["skip"], limit=paging["limit"], status=wanted)]


@router.get("/question-papers/{paper_id}/questions", response_model=List[ExtractedQuestion])
async def get_questions_by_paper(
    paper_id: str,
    response: Response,
    paging: dict = Depends(page_params),
    current_user: UserOut = Depends(require_admin),
):
    _page_headers(response, await questions.count_extracted_for(paper_id), paging)
    return [ExtractedQuestion(**q) for q in await questions.list_extracted(paper_id, skip=paging["skip"], limit=paging["limit"])]


async def _set_question_status(question_id: str, new_status: str, admin: UserOut) -> dict:
    q = await questions.get_extracted(question_id)
    if not q:
        raise HTTPException(status_code=404, detail="Question not found")

    if new_status in ("approved", "published"):
        now = utcnow()
        await questions.set_extracted_status(question_id, new_status, approved_by=admin.id, approved_at=now)
        company = q.get("company", "Corporate")
        text = q.get("question_text") or ""
        await questions.upsert_previous({
            "id": f"pq-{question_id}",
            "paper_id": q.get("paper_id"),
            "title": text[:60] + ("..." if len(text) > 60 else ""),
            "problem_slug": q.get("slug") or "",
            "question_text": text,
            "normalized_text": q.get("normalized_text"),
            "company": company,
            "companies": [company],
            "exam": q.get("exam", "Placement Exam"),
            "exam_origin": format_exam_origin(company, q.get("exam"), q.get("year")),
            "year": q.get("year", 2025),
            "role": q.get("role", "Software Engineer"),
            "topic": q.get("topic", "Algorithms"),
            "subtopic": q.get("subtopic", "General"),
            "difficulty": q.get("difficulty", "Medium"),
            "question_type": q.get("question_type", "Coding"),
            "frequency": 1,
            "appearances": 1,
            "badge": "Newly Published",
            "badge_type": "lime",
            "similarity": 0,
            "status": "published",  # what is in this collection is what students can see and what the match index uses
            "approved_by": admin.id,
            "approved_at": now,
            "historical_occurrences": q.get("historical_occurrences", []),
            "created_at": now,
        })
        paper = await papers.get(q.get("paper_id") or "")
        if paper and await papers.mark_approved(paper["id"]):  # first approved question of this paper
            await notification_service.paper_approved(paper)
    else:  # needs_review or rejected: out of the student pool again
        await questions.set_extracted_status(question_id, new_status)
        await questions.remove_previous(question_id)
    invalidate_question_matching_cache()
    return {"success": True, "question_id": question_id, "status": new_status}


@router.put("/extracted-questions/{question_id}/status")
async def update_question_status(question_id: str, body: QuestionStatusUpdate, current_user: UserOut = Depends(require_admin)):
    """Body: {"new_status": "needs_review" | "approved" | "published" | "rejected"}; any other value is a 422."""
    return await _set_question_status(question_id, body.new_status.value, current_user)


@router.post("/questions/{question_id}/approve")
async def approve_question(question_id: str, current_user: UserOut = Depends(require_admin)):
    return await _set_question_status(question_id, "approved", current_user)


@router.post("/questions/{question_id}/publish")
async def publish_question(question_id: str, current_user: UserOut = Depends(require_admin)):
    return await _set_question_status(question_id, "published", current_user)


@router.post("/questions/{question_id}/reject")
async def reject_question(question_id: str, current_user: UserOut = Depends(require_admin)):
    return await _set_question_status(question_id, "rejected", current_user)


@router.delete("/questions/{question_id}")
async def delete_question(question_id: str, current_user: UserOut = Depends(require_admin)):
    if not await questions.delete_extracted(question_id):
        raise HTTPException(status_code=404, detail="Question not found")
    invalidate_question_matching_cache()
    return {"success": True, "message": f"Question {question_id} deleted."}


async def _student_rows() -> list:
    """Every student with progress computed from their own records (nothing stored, nothing invented)."""
    students = await users.list_students()
    results = await readiness_service.readiness_for_users(students)
    rows = []
    for u in students:
        r = results[u["id"]]
        rows.append({
            "id": u["id"], "name": u.get("name", ""), "email": u.get("email", ""),
            "current_path": u.get("current_path") or u.get("career_interest") or "",
            "readiness_score": r["overall"],
            "assessments_completed": r["assessments_taken"],
            "problems_solved": r["problems_solved"],
            "problems_attempted": r["problems_attempted"],
            "attempts": r["assessments_taken"] + r["submissions"],
            "streak_days": r["streak_days"],
            "last_active": r["last_active"],
            "has_data": r["has_data"],
            "email_verified": bool(u.get("email_verified")),
            "created_at": u.get("created_at"),
        })
    return rows


@router.get("/students")
async def list_students(current_user: UserOut = Depends(require_admin)):
    """Registered students with their real progress (no password data)."""
    return await _student_rows()


def csv_cell(value) -> str:
    """One CSV cell. A text cell that starts with = + - @ (or a tab / carriage return) would be run as a formula by Excel or Sheets,
    so it gets a leading apostrophe. Numbers and empty values are left alone."""
    if value is None:
        return ""
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return str(value)
    text = str(value)
    return "'" + text if text[:1] in ("=", "+", "-", "@", "\t", "\r") else text


@router.get("/students/export.csv")
async def export_students_csv(current_user: UserOut = Depends(require_admin)):
    """All students as a CSV (admin only). Every text cell is made formula-safe."""
    header = ["Name", "Email", "Career path", "Readiness %", "Assessments completed", "Problems solved", "Problems attempted", "Total attempts",
              "Streak days", "Last active", "Email verified"]
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(header)
    for r in await _student_rows():
        writer.writerow([csv_cell(v) for v in (
            r["name"], r["email"], r["current_path"], r["readiness_score"], r["assessments_completed"], r["problems_solved"],
            r["problems_attempted"], r["attempts"], r["streak_days"], r["last_active"] or "", "yes" if r["email_verified"] else "no")])
    # a BOM first, so Excel reads the UTF-8 names correctly
    return Response(content="\ufeff" + buf.getvalue(), media_type="text/csv; charset=utf-8",
                    headers={"Content-Disposition": 'attachment; filename="students.csv"'})


@router.get("/analytics")
async def get_admin_analytics(current_user: UserOut = Depends(require_admin)):
    rows = await _student_rows()
    assessed = [r for r in rows if r["assessments_completed"] > 0]
    return {
        "managed_papers_count": await papers.count(),
        "extracted_questions_count": await questions.count_extracted(),
        "verified_companies_count": await _distinct_company_count(),
        "registered_students_count": len(rows),
        "average_readiness_score": int(round(sum(r["readiness_score"] for r in assessed) / len(assessed))) if assessed else 0,
        "assessed_students_count": len(assessed),
        "assessments_taken_count": sum(r["assessments_completed"] for r in rows),
        "problems_solved_count": sum(r["problems_solved"] for r in rows),
        "active_placement_drives": await placements.count_active(),
        "topic_frequencies": await _topic_frequencies(),
    }
