import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status

from app.models.placement import PlacementJob, PlacementJobCreate, PlacementStatus, PlacementStatusUpdate
from app.models.user import UserOut
from app.repositories import placements, profiles
from app.services import notification_service, placement_service
from app.utils.security import get_current_user, require_admin

router = APIRouter(prefix="/placements", tags=["Placements"])

HIDDEN_FROM_STUDENTS = ["draft", "closed"]


@router.get("", response_model=List[PlacementJob])
async def get_placement_jobs(
    status_filter: Optional[PlacementStatus] = None,
    current_user: UserOut = Depends(get_current_user),
):
    if current_user.role == "admin":  # admins manage the raw records, with their real status
        return [PlacementJob(**j) for j in await placements.list_jobs(status=status_filter.value if status_filter else None)]
    jobs = await placements.list_jobs(exclude_statuses=HIDDEN_FROM_STUDENTS)
    profile = await profiles.get(current_user.id) or {}
    return [PlacementJob(**placement_service.student_view(j, current_user.strong_skills, profile)) for j in jobs]


def _job_from_payload(job_id: str, payload: PlacementJobCreate, **extra) -> dict:
    return {
        "id": job_id,
        "company": payload.company,
        "role": payload.role,
        "package": payload.package,
        "location": payload.location,
        "deadline": payload.deadline,
        "drive_date": payload.drive_date,
        "hiring_batch": payload.hiring_batch,
        "required_skills": payload.required_skills,
        "preferred_skills": payload.preferred_skills,
        "minimum_cgpa": payload.minimum_cgpa,
        "eligible_branches": payload.eligible_branches,
        "graduation_year": payload.graduation_year,
        "backlog_criteria": payload.backlog_criteria,
        "application_link": payload.application_link,
        "description": payload.description or "",
        **extra,
    }


@router.post("", response_model=PlacementJob, status_code=status.HTTP_201_CREATED)
async def create_placement_job(new_job: PlacementJobCreate, current_user: UserOut = Depends(require_admin)):
    job = _job_from_payload(f"job-{uuid.uuid4().hex[:8]}", new_job, status=(new_job.status or PlacementStatus.published).value)
    await placements.insert(job)
    await notification_service.placement_published(job)  # no-op unless it is published; then matching students are told
    return PlacementJob(**job)


@router.get("/{job_id}", response_model=PlacementJob)
async def get_placement_job_by_id(job_id: str, current_user: UserOut = Depends(get_current_user)):
    job = await placements.get(job_id)
    if not job or (current_user.role != "admin" and job.get("status") in HIDDEN_FROM_STUDENTS):
        raise HTTPException(status_code=404, detail="Placement opportunity not found")
    return PlacementJob(**job)


@router.put("/{job_id}", response_model=PlacementJob)
async def update_placement_job(job_id: str, updated_job: PlacementJobCreate, current_user: UserOut = Depends(require_admin)):
    existing = await placements.get(job_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Placement opportunity not found")
    new_status = (updated_job.status.value if updated_job.status else existing.get("status", "published"))
    job = _job_from_payload(job_id, updated_job, status=new_status)
    await placements.replace(job_id, job)
    if existing.get("status") != "published" and new_status == "published":
        await notification_service.placement_published(job)
    return PlacementJob(**job)


@router.patch("/{job_id}/status")
async def update_placement_status(job_id: str, body: PlacementStatusUpdate, current_user: UserOut = Depends(require_admin)):
    """Body: {"new_status": "draft" | "published" | "closed"}; any other value is a 422."""
    existing = await placements.get(job_id)
    if not existing or not await placements.set_status(job_id, body.new_status.value):
        raise HTTPException(status_code=404, detail="Placement opportunity not found")
    if existing.get("status") != "published" and body.new_status == PlacementStatus.published:
        await notification_service.placement_published({**existing, "status": "published"})
    return {"success": True, "job_id": job_id, "status": body.new_status.value}


@router.delete("/{job_id}")
async def delete_placement_job(job_id: str, current_user: UserOut = Depends(require_admin)):
    if not await placements.delete(job_id):
        raise HTTPException(status_code=404, detail="Placement opportunity not found")
    return {"success": True, "message": f"Placement {job_id} deleted successfully"}
