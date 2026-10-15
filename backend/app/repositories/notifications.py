from typing import Any, Dict, List

from app.repositories._base import col, find_many
from app.utils.timeutil import utcnow


async def create(doc: Dict[str, Any]) -> None:
    await col("notifications").insert_one({"read": False, "created_at": utcnow(), **doc})


async def create_once(doc: Dict[str, Any], dedupe_key: str) -> bool:
    """Insert unless this student already has a notification with the same dedupe key. True when it was created."""
    res = await col("notifications").update_one(
        {"user_id": doc["user_id"], "dedupe_key": dedupe_key},
        {"$setOnInsert": {"read": False, "created_at": utcnow(), **{k: v for k, v in doc.items() if k != "user_id"}}},
        upsert=True,
    )
    return res.upserted_id is not None


async def list_for_user(user_id: str, unread_only: bool = False, limit: int = 50) -> List[Dict[str, Any]]:
    query: Dict[str, Any] = {"user_id": user_id}
    if unread_only:
        query["read"] = False
    return await find_many("notifications", query, sort=[("created_at", -1)], limit=limit)


async def unread_count(user_id: str) -> int:
    return await col("notifications").count_documents({"user_id": user_id, "read": False})


async def mark_read(user_id: str, notification_id: str) -> bool:
    res = await col("notifications").update_one(
        {"user_id": user_id, "id": notification_id}, {"$set": {"read": True}}
    )
    return res.matched_count > 0


async def mark_all_read(user_id: str) -> int:
    res = await col("notifications").update_many({"user_id": user_id, "read": False}, {"$set": {"read": True}})
    return res.modified_count


async def delete(user_id: str, notification_id: str) -> bool:
    res = await col("notifications").delete_one({"user_id": user_id, "id": notification_id})
    return res.deleted_count > 0
