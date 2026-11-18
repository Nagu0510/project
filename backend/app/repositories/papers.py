from typing import Any, Dict, List, Optional

from app.repositories._base import NO_ID, col, find_many


async def list_papers(limit: int = 200) -> List[Dict[str, Any]]:
    return await find_many("question_papers", sort=[("uploaded_at", -1)], limit=limit)


async def get(paper_id: str) -> Optional[Dict[str, Any]]:
    return await col("question_papers").find_one({"id": paper_id}, NO_ID)


async def insert(doc: Dict[str, Any]) -> None:
    await col("question_papers").insert_one(dict(doc))


async def mark_approved(paper_id: str) -> bool:
    """Flag the paper as approved. True only the first time (so the students are told once)."""
    res = await col("question_papers").update_one(
        {"id": paper_id, "status": {"$ne": "Approved"}}, {"$set": {"status": "Approved"}}
    )
    return res.modified_count > 0


async def count() -> int:
    return await col("question_papers").count_documents({})
