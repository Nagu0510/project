from typing import Dict

from app.repositories._base import col


async def get_progress(user_id: str, career_path: str) -> Dict[str, str]:
    doc = await col("roadmaps").find_one({"user_id": user_id, "career_path": career_path})
    return (doc or {}).get("milestones_progress", {})


async def set_progress(user_id: str, career_path: str, milestone_id: str, status: str) -> None:
    await col("roadmaps").update_one(
        {"user_id": user_id, "career_path": career_path},
        {"$set": {f"milestones_progress.{milestone_id}": status}},
        upsert=True,
    )


async def for_users(user_ids):
    """Roadmap progress documents of several students: {(user_id, career_path): {milestone_id: status}}."""
    from app.repositories._base import find_many

    docs = await find_many("roadmaps", {"user_id": {"$in": list(user_ids)}}, limit=100000)
    return {(d["user_id"], d["career_path"]): d.get("milestones_progress", {}) for d in docs}
