from typing import Any, Dict, List, Optional

from app.repositories._base import NO_ID, col, find_many


async def list_problems() -> List[Dict[str, Any]]:
    return await find_many("practice_problems", sort=[("id", 1)], limit=200)


async def get_problem(slug_or_id: str) -> Optional[Dict[str, Any]]:
    return await col("practice_problems").find_one({"$or": [{"slug": slug_or_id}, {"id": slug_or_id}]}, NO_ID)


# What the PUBLIC endpoints read: the database drops the hidden cases (which can be hundreds of KB each) and the hints before anything is
# sent to the app, and counts them instead. Hidden data never even reaches the Python process for a list or detail request.
_PUBLIC_STAGES = [
    {"$addFields": {
        "hint_count": {"$size": {"$ifNull": ["$hints", []]}},
        "total_cases": {"$size": {"$ifNull": ["$test_cases", []]}},
        "test_cases": {"$filter": {"input": {"$ifNull": ["$test_cases", []]}, "as": "c", "cond": {"$ne": ["$$c.hidden", True]}}},
    }},
    {"$project": {"_id": 0, "hints": 0}},
]


async def list_public_problems() -> List[Dict[str, Any]]:
    return await col("practice_problems").aggregate([*_PUBLIC_STAGES, {"$sort": {"difficulty_rank": 1, "id": 1}}]).to_list(200)


async def get_public_problem(slug_or_id: str) -> Optional[Dict[str, Any]]:
    rows = await col("practice_problems").aggregate([{"$match": {"$or": [{"slug": slug_or_id}, {"id": slug_or_id}]}}, *_PUBLIC_STAGES]).to_list(1)
    return rows[0] if rows else None


async def get_hints(slug_or_id: str) -> Optional[List[str]]:
    doc = await col("practice_problems").find_one({"$or": [{"slug": slug_or_id}, {"id": slug_or_id}]}, {"_id": 0, "hints": 1, "function_name": 1})
    return list(doc.get("hints") or []) if doc and doc.get("function_name") else None


async def insert_attempt(doc: Dict[str, Any]) -> None:
    await col("practice_attempts").insert_one(dict(doc))


async def solved_slugs(user_id: str) -> List[str]:
    """Problems this user has an Accepted submission for."""
    return sorted(await col("practice_attempts").distinct("problem_slug", {"user_id": user_id, "verdict": "Accepted"}))


async def attempts_for_user(user_id: str, limit: int = 2000) -> List[Dict[str, Any]]:
    return await find_many("practice_attempts", {"user_id": user_id}, sort=[("timestamp", -1)], limit=limit)


async def attempts_for_users(user_ids: List[str]) -> List[Dict[str, Any]]:
    return await find_many("practice_attempts", {"user_id": {"$in": list(user_ids)}}, sort=[("timestamp", -1)], limit=100000)


async def submissions_for(user_id: str, problem_slug: str, limit: int = 20) -> List[Dict[str, Any]]:
    """This user's judged submissions of one problem, newest first (code snapshots without a verdict are not submissions)."""
    return await find_many(
        "practice_attempts", {"user_id": user_id, "problem_slug": problem_slug, "verdict": {"$nin": ["", None]}}, sort=[("timestamp", -1)], limit=limit,
    )


async def acceptance_stats() -> Dict[str, Dict[str, int]]:
    """{problem_slug: {submissions, accepted}} over every judged submission of every student."""
    rows = await col("practice_attempts").aggregate([
        {"$match": {"problem_slug": {"$exists": True}, "verdict": {"$nin": ["", None]}}},
        {"$group": {"_id": "$problem_slug", "submissions": {"$sum": 1}, "accepted": {"$sum": {"$cond": [{"$eq": ["$verdict", "Accepted"]}, 1, 0]}}}},
    ]).to_list(None)
    return {row["_id"]: {"submissions": row["submissions"], "accepted": row["accepted"]} for row in rows}


# ---- "My submissions": one student's judged code submissions, paged and filtered ----------------------------------------------------------
def _submission_query(user_id: str, verdict: Optional[str], language: Optional[str], slugs: Optional[List[str]]) -> Dict[str, Any]:
    query: Dict[str, Any] = {"user_id": user_id, "problem_slug": {"$exists": True, "$nin": ["", None]}, "verdict": {"$nin": ["", None]}}
    if verdict:
        query["verdict"] = verdict
    if language:
        query["language"] = language
    if slugs is not None:  # a difficulty filter: only these problems
        query["problem_slug"] = {"$in": slugs}
    return query


async def count_submissions(user_id: str, verdict: Optional[str] = None, language: Optional[str] = None, slugs: Optional[List[str]] = None) -> int:
    return await col("practice_attempts").count_documents(_submission_query(user_id, verdict, language, slugs))


async def list_submissions(user_id: str, verdict: Optional[str] = None, language: Optional[str] = None, slugs: Optional[List[str]] = None,
                           skip: int = 0, limit: int = 20) -> List[Dict[str, Any]]:
    """One page, newest first. The code is not loaded for a list (it can be large): `get_submission` reads it for one row."""
    return await find_many("practice_attempts", _submission_query(user_id, verdict, language, slugs), sort=[("timestamp", -1)], skip=skip, limit=limit,
                           projection={"code": 0})


async def get_submission(user_id: str, submission_id: str) -> Optional[Dict[str, Any]]:
    """A judged submission, only if it belongs to this student (someone else's id is simply not found)."""
    return await col("practice_attempts").find_one({"id": submission_id, "user_id": user_id, "verdict": {"$nin": ["", None]}}, NO_ID)


async def submission_filters(user_id: str) -> Dict[str, List[str]]:
    """The verdicts and languages this student has used, for the filter menus."""
    return {
        "verdicts": sorted(v for v in await col("practice_attempts").distinct("verdict", {"user_id": user_id, "problem_slug": {"$exists": True}}) if v),
        "languages": sorted(v for v in await col("practice_attempts").distinct("language", {"user_id": user_id, "problem_slug": {"$exists": True}}) if v),
    }
