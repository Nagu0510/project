from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException

from app.models.career import CareerPath, CareerSelectRequest
from app.models.user import UserOut
from app.repositories import career_paths, profiles, users
from app.utils.security import get_optional_current_user, require_student

router = APIRouter(tags=["Career Paths"])


async def _known_skills(user: Optional[UserOut]) -> set:
    """Skills this student has shown: their latest resume analysis plus anything verified by their own assessments and submissions."""
    if user is None or user.role != "student":
        return set()
    from app.repositories import resumes
    from app.services import resume_service

    resume = await resumes.latest(user.id)
    return set(resume.get("detected_skills", []) if resume else []) | set(await resume_service.verified_skills(user.id))


def _match(path: dict, known: set) -> int:
    """Share of the path's required skills the student already shows. Nothing known = 0, never a default."""
    from app.data import skills as catalog

    labels = path.get("required_skills", [])
    if not labels or not known:
        return 0
    hit = sum(1 for label in labels if set(catalog.requirement_alternatives(label)) & known)
    return int(round(100 * hit / len(labels)))


@router.get("/career-paths", response_model=List[CareerPath])
async def get_career_paths(current_user: Optional[UserOut] = Depends(get_optional_current_user)):
    """All career tracks, from the career_paths collection. match_percentage is computed for the signed-in student (0 otherwise)."""
    known = await _known_skills(current_user)
    return [CareerPath(**{**cp, "match_percentage": _match(cp, known)}) for cp in await career_paths.list_paths()]


@router.get("/career-paths/{career_id}", response_model=CareerPath)
async def get_career_path_by_id(career_id: str, current_user: Optional[UserOut] = Depends(get_optional_current_user)):
    cp = await career_paths.find(career_id)
    if not cp:
        raise HTTPException(status_code=404, detail="Career path not found")
    return CareerPath(**{**cp, "slug": cp.get("slug", cp["id"]), "match_percentage": _match(cp, await _known_skills(current_user))})


@router.post("/student/career-path")
async def select_career_path(req: CareerSelectRequest, current_user: UserOut = Depends(require_student)):
    """Persist the student's selected career path."""
    identifier = req.career_path_title or req.career_path or req.career_path_id
    cp = await career_paths.find(identifier)
    if not cp:
        raise HTTPException(status_code=400, detail="Unknown career path")
    target_path = cp["title"]

    await users.update(current_user.id, {
        "current_path": target_path,
        "career_interest": target_path,
        "career_goal": target_path,
    })
    await profiles.upsert(current_user.id, {"career_path": target_path})

    return {
        "success": True,
        "message": f"Career path successfully updated to {target_path}",
        "career_path": target_path,
    }
