"""What the admin content editor reads and writes: assessment questions, courses and career paths (all of them, active or not).

Anything an admin creates or changes is flagged `edited_by_admin: true`, which `python -m app.seed` never overwrites.
"""
import re
from typing import Any, Dict, List, Optional, Tuple

from app.repositories._base import NO_ID, col, find_many


# ---- assessment questions -------------------------------------------------------------

def _question_query(skill: Optional[str], difficulty: Optional[str], active: Optional[bool], search: Optional[str]) -> Dict[str, Any]:
    query: Dict[str, Any] = {}
    if skill:
        query["skill"] = skill
    if difficulty:
        query["difficulty"] = difficulty
    if active is True:
        query["active"] = {"$ne": False}
    elif active is False:
        query["active"] = False
    if search:
        pattern = {"$regex": re.escape(search), "$options": "i"}
        query["$or"] = [{"question_text": pattern}, {"id": pattern}, {"topic": pattern}]
    return query


async def list_questions(skill=None, difficulty=None, active=None, search=None, skip: int = 0, limit: int = 50) -> Tuple[List[Dict[str, Any]], int]:
    query = _question_query(skill, difficulty, active, search)
    rows = await find_many("assessment_questions", query, sort=[("id", 1)], skip=skip, limit=limit)
    return rows, await col("assessment_questions").count_documents(query)


async def get_question(question_id: str) -> Optional[Dict[str, Any]]:
    return await col("assessment_questions").find_one({"id": question_id}, NO_ID)


async def question_index() -> List[Dict[str, Any]]:
    """Just what is needed to spot a duplicate id or duplicate text."""
    return await col("assessment_questions").find({}, {"_id": 0, "id": 1, "question_text": 1, "code": 1}).to_list(length=20000)


async def topics_in_use() -> Dict[str, List[str]]:
    rows = await col("assessment_questions").find({}, {"_id": 0, "skill": 1, "topic": 1}).to_list(length=20000)
    out: Dict[str, set] = {}
    for r in rows:
        out.setdefault(r.get("skill"), set()).add(r.get("topic"))
    return {k: sorted(v) for k, v in out.items()}


async def insert_question(doc: Dict[str, Any]) -> None:
    await col("assessment_questions").insert_one(dict(doc))


async def update_question(question_id: str, fields: Dict[str, Any]) -> bool:
    res = await col("assessment_questions").update_one({"id": question_id}, {"$set": fields})
    return res.matched_count > 0


# ---- courses ---------------------------------------------------------------------------------

async def all_courses() -> List[Dict[str, Any]]:
    return await find_many("courses", sort=[("position", 1), ("title", 1)], limit=500)


async def get_course(slug: str) -> Optional[Dict[str, Any]]:
    return await col("courses").find_one({"slug": slug}, NO_ID)


async def insert_course(doc: Dict[str, Any]) -> None:
    await col("courses").insert_one(dict(doc))


async def update_course(slug: str, fields: Dict[str, Any]) -> bool:
    res = await col("courses").update_one({"slug": slug}, {"$set": fields})
    return res.matched_count > 0


# ---- career paths -------------------------------------------------------------------------------

async def all_paths() -> List[Dict[str, Any]]:
    return await find_many("career_paths", sort=[("position", 1)], limit=100)


async def update_path(path_id: str, fields: Dict[str, Any]) -> bool:
    res = await col("career_paths").update_one({"id": path_id}, {"$set": fields})
    return res.matched_count > 0


async def rename_path_everywhere(old_title: str, new_title: str) -> Dict[str, int]:
    """A career path is referred to by its title in saved roadmap progress and in student records: keep them pointing at it."""
    moved = {}
    moved["roadmaps"] = (await col("roadmaps").update_many({"career_path": old_title}, {"$set": {"career_path": new_title}})).modified_count
    moved["users"] = 0
    for field in ("current_path", "career_interest", "career_goal"):
        moved["users"] += (await col("users").update_many({field: old_title}, {"$set": {field: new_title}})).modified_count
    moved["profiles"] = (await col("student_profiles").update_many({"career_path": old_title}, {"$set": {"career_path": new_title}})).modified_count
    return moved
