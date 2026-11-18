"""Extracted questions (admin review queue) and previous questions (published to students)."""
from typing import Any, Dict, List, Optional

from app.repositories._base import NO_ID, col, find_many

PUBLIC_STATUSES = ["approved", "published"]


# ---- extracted_questions ------------------------------------------------

async def insert_extracted(docs: List[Dict[str, Any]]) -> None:
    if docs:
        await col("extracted_questions").insert_many([dict(d) for d in docs])


def _extracted_query(paper_id: Optional[str], status: Optional[str]) -> Dict[str, Any]:
    query: Dict[str, Any] = {}
    if paper_id:
        query["paper_id"] = paper_id
    if status:
        query["status"] = status
    return query


async def list_extracted(paper_id: Optional[str] = None, skip: int = 0, limit: int = 500, status: Optional[str] = None) -> List[Dict[str, Any]]:
    return await find_many("extracted_questions", _extracted_query(paper_id, status), skip=skip, limit=limit)


async def get_extracted(question_id: str) -> Optional[Dict[str, Any]]:
    return await col("extracted_questions").find_one({"id": question_id}, NO_ID)


async def count_extracted_for(paper_id: Optional[str] = None, status: Optional[str] = None) -> int:
    return await col("extracted_questions").count_documents(_extracted_query(paper_id, status))


async def set_extracted_status(question_id: str, status: str, approved_by: Optional[str] = None, approved_at=None) -> None:
    """Store the new status. Approving or publishing records who and when; any other status clears that record."""
    fields = {"status": status, "approved_by": approved_by, "approved_at": approved_at}
    await col("extracted_questions").update_one({"id": question_id}, {"$set": fields})


async def remove_previous(question_id: str) -> None:
    """Take the question out of the pool students search (reject, back to needs_review, delete)."""
    await col("previous_questions").delete_one({"id": f"pq-{question_id}"})


async def delete_extracted(question_id: str) -> bool:
    res = await col("extracted_questions").delete_one({"id": question_id})
    await col("previous_questions").delete_one({"id": f"pq-{question_id}"})  # drop its published copy too
    return res.deleted_count > 0


async def count_extracted() -> int:
    return await col("extracted_questions").count_documents({})


# ---- previous_questions -------------------------------------------------

async def upsert_previous(doc: Dict[str, Any]) -> None:
    await col("previous_questions").update_one({"id": doc["id"]}, {"$set": doc}, upsert=True)


async def find_previous(query: Dict[str, Any], skip: int = 0, limit: int = 200) -> List[Dict[str, Any]]:
    return await find_many("previous_questions", query, skip=skip, limit=limit)


async def public_previous(limit: int = 2000) -> List[Dict[str, Any]]:
    return await find_many("previous_questions", {"status": {"$in": PUBLIC_STATUSES}}, limit=limit)


async def published_previous(limit: int = 5000) -> List[Dict[str, Any]]:
    """Only published questions: this is what the TF-IDF match index is built from."""
    return await find_many("previous_questions", {"status": "published"}, limit=limit)


async def public_extracted(limit: int = 2000) -> List[Dict[str, Any]]:
    return await find_many("extracted_questions", {"status": {"$in": PUBLIC_STATUSES}}, limit=limit)


async def count_previous(query: Dict[str, Any] = None) -> int:
    return await col("previous_questions").count_documents(query or {})
