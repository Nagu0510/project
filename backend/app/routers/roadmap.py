from typing import Optional

from fastapi import APIRouter, Depends, HTTPException

from app.models.roadmap import ProgressUpdate, RoadmapResponse
from app.models.user import UserOut
from app.repositories import assessment_bank, attempts, career_paths, courses, roadmaps
from app.services.roadmap_service import SAVED_STATUSES, best_scores_from, build_roadmap
from app.utils.security import get_optional_current_user, require_student

router = APIRouter(prefix="/student/roadmap", tags=["Roadmaps"])


async def _build_for(config: dict, user: Optional[UserOut]) -> RoadmapResponse:
    """The roadmap of one career path for one student (or for a guest, who has no progress)."""
    sets_by_course: dict = {}
    for s in await assessment_bank.list_sets():
        if s.get("course_slug"):
            sets_by_course.setdefault(s["course_slug"], []).append(s)
    return build_roadmap(
        config,
        progress=await roadmaps.get_progress(user.id, config["title"]) if user else {},
        gap_topics=user.gap_topics if user else [],
        courses=await courses.list_courses(),
        sets_by_course=sets_by_course,
        best_scores=best_scores_from(await attempts.for_user(user.id)) if user else {},
    )


@router.get("", response_model=RoadmapResponse)
async def get_roadmap(
    career_path: Optional[str] = None,
    current_user: Optional[UserOut] = Depends(get_optional_current_user),
):
    identifier = career_path or (current_user.current_path if current_user else None)
    if not identifier:
        raise HTTPException(status_code=400, detail="Select a career path to see its roadmap.")
    config = await career_paths.find(identifier)
    if not config:
        raise HTTPException(status_code=404, detail="Career path not found")
    return await _build_for(config, current_user)


@router.put("/progress")
async def update_roadmap_progress(req: ProgressUpdate, current_user: UserOut = Depends(require_student)):
    if req.status not in SAVED_STATUSES:  # "locked" is worked out from the rules, a student cannot set it
        raise HTTPException(status_code=422, detail=f"status must be one of: {', '.join(sorted(SAVED_STATUSES))}")
    config = await career_paths.find(current_user.current_path or "")
    if not config:
        raise HTTPException(status_code=400, detail="Select a career path first.")
    if req.milestone_id not in {m["id"] for m in config.get("milestones", [])}:
        raise HTTPException(status_code=404, detail="Milestone not found on your current career path")

    if req.status != "not_started":
        current = next(m for m in (await _build_for(config, current_user)).milestones if m.id == req.milestone_id)
        if current.status == "locked":
            raise HTTPException(
                status_code=409,
                detail="This milestone is locked. Complete the previous milestone, or pass its assessment with 70% or more.",
            )

    await roadmaps.set_progress(current_user.id, config["title"], req.milestone_id, req.status)
    return {
        "success": True,
        "milestone_id": req.milestone_id,
        "status": req.status,
        "message": f"Milestone {req.milestone_id} marked as {req.status}",
    }


@router.put("/{step_id}/progress")
async def update_step_progress(step_id: str, req: ProgressUpdate, current_user: UserOut = Depends(require_student)):
    req.milestone_id = step_id
    return await update_roadmap_progress(req, current_user)
