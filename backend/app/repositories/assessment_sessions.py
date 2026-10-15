"""Timed assessment sessions (collection: assessment_sessions).

A TTL index removes a session a day after `expires_at`, so an expired or already-submitted session is
still found (and can be reported as such) shortly after it ends.
"""
from typing import Any, Dict, Optional

from app.repositories._base import NO_ID, col


async def create(doc: Dict[str, Any]) -> None:
    await col("assessment_sessions").insert_one(dict(doc))


async def get(session_id: str) -> Optional[Dict[str, Any]]:
    return await col("assessment_sessions").find_one({"session_id": session_id}, NO_ID)


async def find_open(user_id: str, assessment_id: str, now) -> Optional[Dict[str, Any]]:
    """The student's newest unsubmitted, unexpired session for this assessment (reopened after a refresh)."""
    docs = await col("assessment_sessions").find(
        {"user_id": user_id, "assessment_id": assessment_id, "submitted_at": None, "expires_at": {"$gt": now}}, NO_ID
    ).sort("started_at", -1).to_list(length=1)
    return docs[0] if docs else None


async def save_answers(session_id: str, answers: Dict[str, int]) -> bool:
    """Replace the saved answers of a session that is still open."""
    res = await col("assessment_sessions").update_one(
        {"session_id": session_id, "submitted_at": None}, {"$set": {"answers": answers}}
    )
    return res.matched_count > 0


async def mark_submitted(session_id: str, submitted_at) -> bool:
    """Atomically flag the session as submitted. False if it was already submitted (or doesn't exist)."""
    res = await col("assessment_sessions").update_one(
        {"session_id": session_id, "submitted_at": None}, {"$set": {"submitted_at": submitted_at}}
    )
    return res.modified_count > 0


async def release(session_id: str) -> None:
    """Undo mark_submitted when storing the attempt failed, so the student does not lose the session."""
    await col("assessment_sessions").update_one({"session_id": session_id}, {"$set": {"submitted_at": None}})


async def delete(session_id: str) -> bool:
    res = await col("assessment_sessions").delete_one({"session_id": session_id})
    return res.deleted_count > 0
