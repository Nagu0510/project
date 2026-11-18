from typing import Any, Dict, Optional

from app.repositories._base import NO_ID, col


async def get(user_id: str) -> Optional[Dict[str, Any]]:
    return await col("student_profiles").find_one({"user_id": user_id}, NO_ID)


async def upsert(user_id: str, fields: Dict[str, Any]) -> None:
    await col("student_profiles").update_one({"user_id": user_id}, {"$set": fields}, upsert=True)


async def list_all(limit: int = 5000):
    from app.repositories._base import find_many

    return await find_many("student_profiles", limit=limit)


async def user_ids_targeting(company: str):
    """Students whose profile lists this company among their target companies (case-insensitive, exact name)."""
    import re

    from app.repositories._base import find_many

    rows = await find_many("student_profiles", {"target_companies": {"$regex": f"^{re.escape(company.strip())}$", "$options": "i"}}, limit=5000)
    return [r["user_id"] for r in rows]
