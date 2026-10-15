from typing import Any, Dict, List, Optional

from app.repositories._base import col, find_many


async def list_paths() -> List[Dict[str, Any]]:
    return await find_many("career_paths", sort=[("position", 1)], limit=100)


async def find(identifier: str) -> Optional[Dict[str, Any]]:
    """Strict lookup by id, slug or exact title (case-insensitive). None when unknown."""
    wanted = (identifier or "").lower().strip()
    if not wanted:
        return None
    for path in await list_paths():
        if wanted in (path["id"].lower(), (path.get("slug") or "").lower(), path["title"].lower()):
            return path
    return None


async def count() -> int:
    return await col("career_paths").count_documents({})
