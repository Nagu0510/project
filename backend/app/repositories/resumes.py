"""Resume analyses (collection: resume_analyses). Every analysis is kept as history: scores, skills and a text hash. Never the file."""
from typing import Any, Dict, List, Optional

from app.repositories._base import col, find_many
from app.utils.timeutil import utcnow


async def save(user_id: str, analysis: Dict[str, Any]) -> None:
    await col("resume_analyses").insert_one({**analysis, "user_id": user_id, "created_at": utcnow()})


async def history(user_id: str, limit: int = 10) -> List[Dict[str, Any]]:
    return await find_many("resume_analyses", {"user_id": user_id}, sort=[("created_at", -1)], limit=limit)


async def get(user_id: str, analysis_id: str) -> Optional[Dict[str, Any]]:
    """One stored analysis, only if it belongs to this student."""
    return await col("resume_analyses").find_one({"user_id": user_id, "id": analysis_id}, {"_id": 0})


async def latest(user_id: str) -> Optional[Dict[str, Any]]:
    docs = await history(user_id, 1)
    return docs[0] if docs else None


async def latest_for_users(user_ids: List[str]) -> Dict[str, Dict[str, Any]]:
    """The newest analysis of each student (scores only are needed, but the documents are small)."""
    docs = await find_many("resume_analyses", {"user_id": {"$in": list(user_ids)}}, sort=[("created_at", -1)], limit=100000)
    latest: Dict[str, Dict[str, Any]] = {}
    for doc in docs:
        latest.setdefault(doc["user_id"], doc)
    return latest
