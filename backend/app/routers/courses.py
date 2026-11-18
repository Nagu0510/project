import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from app.models.course import CourseDetail, CourseProgress, CourseSummary, ProgressIn
from app.models.user import UserOut
from app.repositories import courses, notifications
from app.utils.security import require_student

router = APIRouter(prefix="/courses", tags=["Courses"])
student_router = APIRouter(prefix="/student", tags=["Students"])


def _summary(doc: dict) -> CourseSummary:
    return CourseSummary(**{**doc, "modules_count": len(doc.get("modules", []))})


def _detail(doc: dict) -> CourseDetail:
    modules = doc.get("modules", [])
    return CourseDetail(**{**doc, "modules_count": len(modules),
                           "estimated_hours": doc.get("estimated_hours") or sum(m.get("hours", 0) for m in modules)})


@router.get("", response_model=List[CourseSummary])
async def list_courses(skill: Optional[str] = Query(None), level: Optional[str] = Query(None)):
    """The course catalog, optionally filtered by a covered skill (exact, case-insensitive) or level."""
    result = []
    for doc in await courses.list_courses():
        if level and level != "All" and doc.get("level", "").lower() != level.lower():
            continue
        if skill and skill != "All" and skill.lower() not in {str(s).lower() for s in doc.get("skills", [])}:
            continue
        result.append(_summary(doc))
    return result


@router.get("/{slug}", response_model=CourseDetail)
async def get_course(slug: str):
    doc = await courses.get(slug)
    if not doc or doc.get("active") is False:
        raise HTTPException(status_code=404, detail="Course not found")
    return _detail(doc)


def _progress(doc: dict, progress: Optional[dict]) -> CourseProgress:
    module_ids = [m["id"] for m in doc.get("modules", [])]
    done = [m for m in (progress or {}).get("modules_done", []) if m in module_ids]
    return CourseProgress(
        course_slug=doc["slug"], title=doc.get("title", ""), modules_done=done, modules_total=len(module_ids),
        percent=int(100 * len(done) / len(module_ids)) if module_ids else 0,
        completed=bool(module_ids) and len(done) == len(module_ids), updated_at=(progress or {}).get("updated_at"),
    )


@router.post("/{slug}/progress", response_model=CourseProgress)
async def mark_module(slug: str, body: ProgressIn, current_user: UserOut = Depends(require_student)):
    """Mark one module done (or undo it). Progress belongs to the logged-in student only."""
    doc = await courses.get(slug)
    if not doc:
        raise HTTPException(status_code=404, detail="Course not found")
    module_ids = [m["id"] for m in doc.get("modules", [])]
    if body.module_id not in module_ids:
        raise HTTPException(status_code=404, detail="Module not found in this course")
    stored = await courses.set_module_done(current_user.id, slug, body.module_id, body.done, module_ids)
    if stored.get("just_completed"):  # a real event worth a notification
        await notifications.create({
            "id": f"notif-{uuid.uuid4().hex[:10]}", "user_id": current_user.id, "type": "course_completed",
            "title": f"You finished {doc['title']}", "message": "Every module is done. Take the matching assessment to confirm what you learned.",
            "link": f"/courses/{slug}",
        })
    return _progress(doc, stored)


@student_router.get("/courses", response_model=List[CourseProgress])
async def my_courses(current_user: UserOut = Depends(require_student)):
    """The student's progress in every course they have started."""
    by_slug = {c["slug"]: c for c in await courses.list_courses()}
    return [_progress(by_slug[p["course_slug"]], p) for p in await courses.progress_for_user(current_user.id) if p["course_slug"] in by_slug]
