"""Assessment attempts (collection: assessment_attempts)."""
from typing import Any, Dict, List, Optional

from app.repositories._base import col, find_many


async def insert(doc: Dict[str, Any]) -> None:
    await col("assessment_attempts").insert_one(dict(doc))


async def latest(user_id: str) -> Optional[Dict[str, Any]]:
    docs = await find_many("assessment_attempts", {"user_id": user_id}, sort=[("submitted_at", -1)], limit=1)
    return docs[0] if docs else None


NO_REVIEW = {"review": 0}  # the per-question review is large and only the results page needs it


async def for_user(user_id: str, limit: int = 100) -> List[Dict[str, Any]]:
    return await find_many("assessment_attempts", {"user_id": user_id}, sort=[("submitted_at", -1)], limit=limit, projection=NO_REVIEW)


async def for_users(user_ids: List[str]) -> List[Dict[str, Any]]:
    """Assessment attempts of several students at once (readiness for the admin lists)."""
    return await find_many("assessment_attempts", {"user_id": {"$in": list(user_ids)}}, sort=[("submitted_at", -1)], limit=100000, projection=NO_REVIEW)


async def set_next_steps(attempt_id: str, steps: List[Dict[str, Any]]) -> None:
    await col("assessment_attempts").update_one({"attempt_id": attempt_id}, {"$set": {"next_steps": steps}})
