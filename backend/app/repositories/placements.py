from typing import Any, Dict, List, Optional

from app.repositories._base import NO_ID, col, find_many


async def list_jobs(*, exclude_statuses: Optional[List[str]] = None, status: Optional[str] = None) -> List[Dict[str, Any]]:
    query: Dict[str, Any] = {}
    if status:
        query["status"] = status
    elif exclude_statuses:
        query["status"] = {"$nin": exclude_statuses}
    return await find_many("placements", query, limit=500)


async def get(job_id: str) -> Optional[Dict[str, Any]]:
    return await col("placements").find_one({"id": job_id}, NO_ID)


async def insert(doc: Dict[str, Any]) -> None:
    await col("placements").insert_one(dict(doc))


async def replace(job_id: str, doc: Dict[str, Any]) -> None:
    await col("placements").replace_one({"id": job_id}, dict(doc))


async def set_status(job_id: str, status: str) -> bool:
    res = await col("placements").update_one({"id": job_id}, {"$set": {"status": status}})
    return res.matched_count > 0


async def delete(job_id: str) -> bool:
    res = await col("placements").delete_one({"id": job_id})
    return res.deleted_count > 0


async def count_active() -> int:
    return await col("placements").count_documents({"status": {"$nin": ["draft", "closed"]}})
