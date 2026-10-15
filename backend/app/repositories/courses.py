from typing import Any, Dict, List, Optional

from app.repositories._base import NO_ID, col, find_many


async def create(doc: Dict[str, Any]) -> None:
    await col("courses").insert_one(dict(doc))  # slug is unique: DuplicateKeyError if it exists


async def get(slug: str) -> Optional[Dict[str, Any]]:
    return await col("courses").find_one({"slug": slug}, NO_ID)


async def list_courses(skill: Optional[str] = None, limit: int = 200) -> List[Dict[str, Any]]:
    """Active courses only: an admin can deactivate one (it stays in the database)."""
    query: Dict[str, Any] = {"active": {"$ne": False}}
    if skill:
        query["skills"] = skill
    return await find_many("courses", query, sort=[("position", 1), ("title", 1)], limit=limit)


async def update(slug: str, fields: Dict[str, Any]) -> bool:
    res = await col("courses").update_one({"slug": slug}, {"$set": fields})
    return res.matched_count > 0


async def delete(slug: str) -> bool:
    res = await col("courses").delete_one({"slug": slug})
    return res.deleted_count > 0


# ---- student progress (collection: course_progress, one document per student and course) ----

async def progress_for_user(user_id: str) -> List[Dict[str, Any]]:
    return await find_many("course_progress", {"user_id": user_id}, sort=[("updated_at", -1)], limit=200)


async def set_module_done(user_id: str, course_slug: str, module_id: str, done: bool, all_modules: List[str]) -> Dict[str, Any]:
    """Mark one module done or not done. Returns the stored progress document."""
    from app.utils.timeutil import utcnow

    before = await col("course_progress").find_one({"user_id": user_id, "course_slug": course_slug}, NO_ID)
    update: Dict[str, Any] = {"$addToSet": {"modules_done": module_id}} if done else {"$pull": {"modules_done": module_id}}
    update["$set"] = {"updated_at": utcnow()}
    await col("course_progress").update_one({"user_id": user_id, "course_slug": course_slug}, update, upsert=True)
    doc = await col("course_progress").find_one({"user_id": user_id, "course_slug": course_slug}, NO_ID)
    finished = bool(all_modules) and set(all_modules) <= set(doc.get("modules_done", []))
    await col("course_progress").update_one(
        {"user_id": user_id, "course_slug": course_slug},
        {"$set": {"completed": finished, "completed_at": utcnow() if finished else None}},
    )
    return {**doc, "completed": finished, "just_completed": finished and not (before or {}).get("completed")}


async def progress_for_users(user_ids: List[str]) -> List[Dict[str, Any]]:
    return await find_many("course_progress", {"user_id": {"$in": list(user_ids)}}, limit=100000)
