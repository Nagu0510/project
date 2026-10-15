import re
from collections import Counter

from fastapi import APIRouter, HTTPException, Query, Depends, Response
from typing import List, Optional
from app.models.question_paper import QuestionMatchRequest, QuestionMatchResponse, PreviousQuestion
from app.services.question_matching_service import find_historical_question_match, format_exam_origin
from app.repositories import questions

router = APIRouter(tags=["Question Intelligence"])

def _slug(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


async def _company_stats() -> dict:
    """Per-company intelligence computed from the published previous questions (nothing is hard-coded)."""
    by_company: dict = {}
    for q in await questions.public_previous():
        for company in q.get("companies") or [q.get("company")]:
            if company:
                by_company.setdefault(company, []).append(q)

    result = {}
    for company, rows in sorted(by_company.items(), key=lambda kv: (-len(kv[1]), kv[0])):
        total = len(rows)
        topics = Counter(q["topic"] for q in rows if q.get("topic"))
        mix = Counter(q["difficulty"] for q in rows if q.get("difficulty"))
        result[_slug(company)] = {
            "name": company,
            "short_name": company,
            "total_questions": total,
            "difficulty": mix.most_common(1)[0][0] if mix else "",
            "difficulty_mix": dict(mix),
            "top_topics": [{"topic": t, "percentage": round(n / total * 100)} for t, n in topics.most_common(5)],
            "exam_patterns": sorted({format_exam_origin(company, q.get("exam"), q.get("year")) for q in rows if q.get("exam")}),
            "recent_questions": [q["title"] for q in sorted(rows, key=lambda r: r.get("year") or 0, reverse=True)[:5] if q.get("title")],
        }
    return result


@router.post("/question-intelligence/match", response_model=QuestionMatchResponse)
async def match_question(req: QuestionMatchRequest):
    result = await find_historical_question_match(req.question_text, req.topic)
    return result

@router.get("/question-intelligence/companies")
async def get_companies():
    return await _company_stats()


@router.get("/question-intelligence/summary")
async def get_company_summary():
    """Company stats plus an explicit empty-state flag: `empty` is true when no previous questions are published."""
    companies = await _company_stats()
    return {
        "empty": not companies,
        "company_count": len(companies),
        "total_questions": sum(c["total_questions"] for c in companies.values()),
        "companies": companies,
    }


@router.get("/question-intelligence/company/{company_id}")
async def get_company_intelligence(company_id: str):
    stats = await _company_stats()
    entry = stats.get(_slug(company_id))
    if not entry:
        raise HTTPException(status_code=404, detail="No published questions for this company yet")
    return entry


@router.get("/previous-questions", response_model=List[PreviousQuestion])
async def get_previous_questions(
    response: Response,
    company: Optional[str] = Query(None),
    year: Optional[int] = Query(None),
    topic: Optional[str] = Query(None),
    difficulty: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(100, ge=1, le=100),
):
    """Published previous questions, filtered in MongoDB, one page at a time (page_size at most 100; X-Total-Count has the total)."""
    query = {"status": {"$in": questions.PUBLIC_STATUSES}}
    if company and company != "All":
        query["companies"] = company
    if year:
        query["year"] = year
    if topic and topic != "All":
        query["topic"] = {"$regex": re.escape(topic), "$options": "i"}
    if difficulty and difficulty != "All":
        query["difficulty"] = difficulty
    if search:
        pattern = {"$regex": re.escape(search), "$options": "i"}  # escaped: user input is never a regex
        query["$or"] = [{"title": pattern}, {"topic": pattern}, {"exam_origin": pattern}]
    response.headers["X-Total-Count"] = str(await questions.count_previous(query))
    return [PreviousQuestion(**q) for q in await questions.find_previous(query, skip=(page - 1) * page_size, limit=page_size)]
