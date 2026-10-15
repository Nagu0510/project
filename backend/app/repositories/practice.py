from typing import Any, Dict, List, Optional

from app.repositories._base import NO_ID, col, find_many


async def list_problems() -> List[Dict[str, Any]]:
    return await find_many("practice_problems", sort=[("id", 1)], limit=200)


async def get_problem(slug_or_id: str) -> Optional[Dict[str, Any]]:
    return await col("practice_problems").find_one({"$or": [{"slug": slug_or_id}, {"id": slug_or_id}]}, NO_ID)


async def insert_attempt(doc: Dict[str, Any]) -> None:
    await col("practice_attempts").insert_one(dict(doc))


async def solved_slugs(user_id: str) -> List[str]:
    """Problems this user has an Accepted submission for."""
    return sorted(await col("practice_attempts").distinct("problem_slug", {"user_id": user_id, "verdict": "Accepted"}))


async def attempts_for_user(user_id: str, limit: int = 2000) -> List[Dict[str, Any]]:
    return await find_many("practice_attempts", {"user_id": user_id}, sort=[("timestamp", -1)], limit=limit)


async def attempts_for_users(user_ids: List[str]) -> List[Dict[str, Any]]:
    return await find_many("practice_attempts", {"user_id": {"$in": list(user_ids)}}, sort=[("timestamp", -1)], limit=100000)
