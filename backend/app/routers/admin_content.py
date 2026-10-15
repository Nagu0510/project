"""Admin content editor: assessment questions, courses and career paths.

Create, edit and deactivate (never hard-delete, so student history stays intact). Every change is checked with the same rules
as `backend/scripts/validate_questions.py` (services/content_validation.py); a problem is a 422 whose `detail` is
{"message", "errors": [..]}. Everything an admin touches is flagged `edited_by_admin`, so `python -m app.seed` leaves it alone.
Admin only: students get 403, anonymous callers 401.
"""
import re
import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response

from app.data.assessment_extras import COMPANIES, QUESTION_TYPES, SKILL_TOPICS
from app.data.skills import SKILLS_BY_NAME
from app.models.content import CareerPathIn, CourseIn, QuestionIn
from app.models.user import UserOut
from app.repositories import content
from app.routers.admin import _page_headers, page_params
from app.services import content_validation as rules
from app.utils.security import require_admin
from app.utils.timeutil import utcnow

router = APIRouter(prefix="/admin/content", tags=["Admin Content"])


def _invalid(errors: List[str]) -> HTTPException:
    return HTTPException(status_code=422, detail={"message": "Please fix the problems below.", "errors": errors})


@router.get("/meta")
async def content_meta(current_user: UserOut = Depends(require_admin)):
    """The choices the editor forms offer: skills and their topics, difficulties, question types, company tags, course levels."""
    return {
        "skill_topics": SKILL_TOPICS,
        "topics_in_use": await content.topics_in_use(),
        "difficulties": sorted(rules.DIFFICULTIES, key=["Easy", "Medium", "Hard"].index),
        "question_types": QUESTION_TYPES,
        "companies": COMPANIES,
        "course_levels": ["Beginner", "Intermediate", "Advanced"],
        "catalogue_skills": sorted(SKILLS_BY_NAME),
    }


# ---- questions ----------------------------------------------------------------------------------

def _question_doc(body: QuestionIn, question_id: str) -> dict:
    data = body.model_dump()
    return {
        **data,
        "id": question_id,
        "title": (data["question_text"].strip().split("\n")[0])[:80],
        "subtopic": data.get("subtopic") or data["topic"],
        "code": (data.get("code") or None),
        "origin": "authored",
        "options": [o.strip() for o in data["options"]],
        "explanation": data["explanation"].strip(),
        "question_text": data["question_text"].strip(),
    }


async def _question_errors(doc: dict, ignore_id: Optional[str] = None) -> List[str]:
    errors = rules.question_problems(doc, extra_topics=await content.topics_in_use())
    if not rules.ID_RE.fullmatch(doc["id"]):
        errors.append("id must be 2-60 letters, digits, - or _")
    key = rules.duplicate_key(doc)
    for other in await content.question_index():
        if other["id"] == ignore_id:
            continue
        if other["id"] == doc["id"]:
            errors.append(f"a question with id {doc['id']!r} already exists")
        if rules.duplicate_key(other) == key:
            errors.append(f"duplicate question text (same as {other['id']})")
    return errors


@router.get("/questions")
async def list_questions(
    response: Response,
    skill: Optional[str] = None,
    difficulty: Optional[str] = None,
    active: Optional[bool] = None,
    search: Optional[str] = Query(None, max_length=100),
    paging: dict = Depends(page_params),
    current_user: UserOut = Depends(require_admin),
):
    """One page of the bank WITH answer keys (admin only), active or not. X-Total-Count has the total."""
    rows, total = await content.list_questions(skill, difficulty, active, search, paging["skip"], paging["limit"])
    _page_headers(response, total, paging)
    return [{**r, "active": r.get("active", True)} for r in rows]


@router.post("/questions", status_code=201)
async def create_question(body: QuestionIn, current_user: UserOut = Depends(require_admin)):
    question_id = (body.id or "").strip() or f"adm-{uuid.uuid4().hex[:8]}"
    doc = _question_doc(body, question_id)
    errors = await _question_errors(doc)
    if errors:
        raise _invalid(errors)
    doc.update(active=True, edited_by_admin=True, created_by=current_user.id, updated_at=utcnow())
    await content.insert_question(doc)
    return doc


@router.put("/questions/{question_id}")
async def edit_question(question_id: str, body: QuestionIn, current_user: UserOut = Depends(require_admin)):
    existing = await content.get_question(question_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Question not found")
    if body.id and body.id != question_id:
        raise _invalid(["the id of an existing question cannot be changed"])
    doc = _question_doc(body, question_id)
    errors = await _question_errors(doc, ignore_id=question_id)
    if errors:
        raise _invalid(errors)
    fields = {k: v for k, v in doc.items() if k != "id"}
    fields.update(edited_by_admin=True, updated_by=current_user.id, updated_at=utcnow())
    await content.update_question(question_id, fields)
    return {**existing, **fields, "id": question_id}


async def _set_question_active(question_id: str, active: bool, admin: UserOut) -> dict:
    if not await content.update_question(question_id, {"active": active, "edited_by_admin": True, "updated_by": admin.id, "updated_at": utcnow()}):
        raise HTTPException(status_code=404, detail="Question not found")
    return {"id": question_id, "active": active}


@router.post("/questions/{question_id}/deactivate")
async def deactivate_question(question_id: str, current_user: UserOut = Depends(require_admin)):
    """Hide a question from practice and from new assessment sessions (it stays in the database)."""
    return await _set_question_active(question_id, False, current_user)


@router.post("/questions/{question_id}/activate")
async def activate_question(question_id: str, current_user: UserOut = Depends(require_admin)):
    return await _set_question_active(question_id, True, current_user)


# ---- courses ---------------------------------------------------------------------------------------

def _course_doc(body: CourseIn, position: int) -> dict:
    data = body.model_dump()
    slug = data["slug"].strip()
    modules = [{"id": m.get("id") or f"{slug}-m{i}", "title": m["title"].strip(), "topics": m["topics"], "hours": m["hours"]} for i, m in enumerate(data["modules"], 1)]
    return {
        **data, "slug": slug, "title": data["title"].strip(), "modules": modules, "position": position,
        "estimated_hours": sum(m["hours"] for m in modules),
    }


@router.get("/courses")
async def list_courses(current_user: UserOut = Depends(require_admin)):
    return [{**c, "active": c.get("active", True)} for c in await content.all_courses()]


@router.post("/courses", status_code=201)
async def create_course(body: CourseIn, current_user: UserOut = Depends(require_admin)):
    existing = await content.all_courses()
    doc = _course_doc(body, position=max([c.get("position", 0) for c in existing] + [0]) + 1)
    errors = rules.course_problems(doc, {c["slug"] for c in existing} | {doc["slug"]})
    if doc["slug"] in {c["slug"] for c in existing}:
        errors.append(f"a course with slug {doc['slug']!r} already exists")
    if errors:
        raise _invalid(errors)
    doc.update(active=True, edited_by_admin=True, created_by=current_user.id, updated_at=utcnow())
    await content.insert_course(doc)
    return doc


@router.put("/courses/{slug}")
async def edit_course(slug: str, body: CourseIn, current_user: UserOut = Depends(require_admin)):
    existing = await content.get_course(slug)
    if not existing:
        raise HTTPException(status_code=404, detail="Course not found")
    if body.slug != slug:
        raise _invalid(["the slug of an existing course cannot be changed (progress is stored under it)"])
    doc = _course_doc(body, position=existing.get("position", 0))
    errors = rules.course_problems(doc, {c["slug"] for c in await content.all_courses()})
    if errors:
        raise _invalid(errors)
    fields = {k: v for k, v in doc.items() if k != "slug"}
    fields.update(edited_by_admin=True, updated_by=current_user.id, updated_at=utcnow())
    await content.update_course(slug, fields)
    return {**existing, **fields, "slug": slug}


async def _set_course_active(slug: str, active: bool, admin: UserOut) -> dict:
    if not await content.update_course(slug, {"active": active, "edited_by_admin": True, "updated_by": admin.id, "updated_at": utcnow()}):
        raise HTTPException(status_code=404, detail="Course not found")
    return {"slug": slug, "active": active}


@router.post("/courses/{slug}/deactivate")
async def deactivate_course(slug: str, current_user: UserOut = Depends(require_admin)):
    """Hide a course from the catalogue and from recommendations (student progress is kept)."""
    return await _set_course_active(slug, False, current_user)


@router.post("/courses/{slug}/activate")
async def activate_course(slug: str, current_user: UserOut = Depends(require_admin)):
    return await _set_course_active(slug, True, current_user)


# ---- career paths ----------------------------------------------------------------------------------------

@router.get("/career-paths")
async def list_career_paths(current_user: UserOut = Depends(require_admin)):
    return await content.all_paths()


@router.put("/career-paths/{path_id}")
async def edit_career_path(path_id: str, body: CareerPathIn, current_user: UserOut = Depends(require_admin)):
    """Title, required skills and milestones. Saved roadmap progress follows a renamed path."""
    paths = await content.all_paths()
    existing = next((p for p in paths if p["id"] == path_id), None)
    if not existing:
        raise HTTPException(status_code=404, detail="Career path not found")
    data = body.model_dump()
    data["title"] = data["title"].strip()
    errors = rules.career_path_problems(data, [p["title"] for p in paths if p["id"] != path_id])
    if errors:
        raise _invalid(errors)

    old_by_id = {m["id"]: m for m in existing.get("milestones", [])}
    milestones = []
    for m in sorted(data["milestones"], key=lambda m: m["number"]):
        merged = {**old_by_id.get(m["id"], {}), **{k: v for k, v in m.items() if v is not None}}
        merged.setdefault("action_label", "Explore Concepts")
        milestones.append(merged)
    fields = {"title": data["title"], "required_skills": data["required_skills"], "milestones": milestones,
              "edited_by_admin": True, "updated_by": current_user.id, "updated_at": utcnow()}
    await content.update_path(path_id, fields)
    moved = {}
    if data["title"] != existing["title"]:
        moved = await content.rename_path_everywhere(existing["title"], data["title"])
    return {**existing, **fields, "renamed_records": moved}
