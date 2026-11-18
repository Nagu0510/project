from typing import Any, Dict, List, Optional

from app.database import require_db

NO_ID = {"_id": 0}


def col(name: str):
    return require_db()[name]


async def find_many(
    name: str,
    query: Optional[Dict[str, Any]] = None,
    *,
    sort: Optional[list] = None,
    skip: int = 0,
    limit: int = 500,
    projection: Optional[Dict[str, Any]] = None,
) -> List[Dict[str, Any]]:
    cursor = col(name).find(query or {}, {**NO_ID, **(projection or {})})
    if sort:
        cursor = cursor.sort(sort)
    return await cursor.skip(skip).limit(limit).to_list(length=limit)
