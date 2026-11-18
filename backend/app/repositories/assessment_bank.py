"""Assessment sets (collection: assessments) and the question bank (collection: assessment_questions).

Answer keys are protected here: every function returns questions with `correct_option_index` set to
None and `explanation` removed, except `scoring_data`, which exists only for the scoring functions in
services/assessment_service.py. Do not call it from routers.
"""
from typing import Any, Dict, List, Optional

from app.repositories._base import NO_ID, col, find_many

_PUBLIC_PROJECTION = {"_id": 0, "correct_option_index": 0, "explanation": 0}


def _matches(value: Optional[str], wanted: Optional[str]) -> bool:
    return not wanted or wanted == "All" or (value or "").lower() == wanted.lower()


def _to_public(doc: Dict[str, Any]) -> Dict[str, Any]:
    return {**doc, "correct_option_index": None}  # key kept (None) so response shapes stay stable


# ---- assessment sets ----------------------------------------------------

async def list_sets(difficulty: Optional[str] = None, skill: Optional[str] = None) -> List[Dict[str, Any]]:
    sets = await find_many("assessments", sort=[("id", 1)], limit=500)
    return [s for s in sets if _matches(s.get("difficulty"), difficulty) and _matches(s.get("skill"), skill)]


async def get_set(assessment_id: str) -> Optional[Dict[str, Any]]:
    return await col("assessments").find_one({"id": assessment_id}, NO_ID)


async def count_sets() -> int:
    return await col("assessments").count_documents({})


# ---- questions (public view: no answer key, no explanation) -------------

async def public_questions_by_ids(ids: List[str], active_only: bool = False) -> List[Dict[str, Any]]:
    """Questions in the order of `ids`; unknown ids are skipped (and deactivated ones when `active_only`)."""
    query: Dict[str, Any] = {"id": {"$in": ids}}
    if active_only:
        query["active"] = {"$ne": False}
    docs = await col("assessment_questions").find(query, _PUBLIC_PROJECTION).to_list(length=len(ids) or 1)
    by_id = {d["id"]: _to_public(d) for d in docs}
    return [by_id[i] for i in ids if i in by_id]


async def search_public_questions(
    skill: Optional[str] = None,
    topic: Optional[str] = None,
    difficulty: Optional[str] = None,
    question_type: Optional[str] = None,
    company: Optional[str] = None,
    practice_only: bool = False,
) -> List[Dict[str, Any]]:
    docs = await col("assessment_questions").find({}, _PUBLIC_PROJECTION).sort("id", 1).to_list(length=2000)
    return [
        _to_public(d) for d in docs
        if d.get("active", True)
        and (not practice_only or d.get("practice", True))
        and (not company or company == "All" or company in (d.get("companies") or []))
        and _matches(d.get("skill"), skill)
        and _matches(d.get("difficulty"), difficulty)
        and _matches(d.get("question_type"), question_type)
        and (not topic or topic == "All" or topic.lower() in (d.get("topic") or "").lower())
    ]


async def get_public_question(question_id: str) -> Optional[Dict[str, Any]]:
    doc = await col("assessment_questions").find_one({"id": question_id}, _PUBLIC_PROJECTION)
    return _to_public(doc) if doc else None


# ---- answer keys: scoring only -------------------------------------------

async def scoring_data(ids: List[str]) -> Dict[str, Dict[str, Any]]:
    """Full question documents (WITH answer keys) by id. Only the scoring functions may call this."""
    docs = await col("assessment_questions").find({"id": {"$in": ids}}, NO_ID).to_list(length=len(ids) or 1)
    return {d["id"]: d for d in docs}
