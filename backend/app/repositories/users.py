from typing import Any, Dict, List, Optional

from app.repositories._base import NO_ID, col, find_many


async def get(user_id: str) -> Optional[Dict[str, Any]]:
    return await col("users").find_one({"id": user_id}, NO_ID)


async def update(user_id: str, fields: Dict[str, Any]) -> None:
    await col("users").update_one({"id": user_id}, {"$set": fields})


async def record_assessment(user_id: str, readiness: int, strengths: List[str], gaps: List[str], gap_topics: Optional[List[str]] = None) -> None:
    await col("users").update_one(
        {"id": user_id},
        {
            "$set": {"strong_skills": strengths, "gap_skills": gaps, "gap_topics": gap_topics or []},  # readiness is computed (services/readiness_service.py), never stored
            "$inc": {"assessments_completed": 1},
        },
    )


async def set_email_notifications(user_id: str, enabled: bool) -> None:
    await col("users").update_one({"id": user_id}, {"$set": {"email_notifications": enabled}})


async def unsubscribe(user_id: str, version: int) -> bool:
    """Turn email notifications off if the link's version is still current, and retire the link (works once)."""
    current = {"unsub_version": version} if version else {"$or": [{"unsub_version": 0}, {"unsub_version": {"$exists": False}}]}
    res = await col("users").update_one({"id": user_id, **current}, {"$set": {"email_notifications": False}, "$inc": {"unsub_version": 1}})
    return res.matched_count > 0


async def count_students() -> int:
    return await col("users").count_documents({"role": "student"})


async def list_students(limit: int = 500) -> List[Dict[str, Any]]:
    return await find_many("users", {"role": "student"}, sort=[("created_at", -1)], limit=limit)


async def average_readiness() -> int:
    """Mean readiness over students who have taken at least one assessment (0 if none)."""
    pipeline = [
        {"$match": {"role": "student", "assessments_completed": {"$gt": 0}}},
        {"$group": {"_id": None, "avg": {"$avg": "$readiness_score"}}},
    ]
    rows = await col("users").aggregate(pipeline).to_list(length=1)
    return int(round(rows[0]["avg"])) if rows and rows[0].get("avg") is not None else 0
