from datetime import datetime
from typing import Any, Dict

from fastapi import APIRouter, Depends, Response

from app.models.user import StudentDashboardData, StudentProfile, StudentSettings, UserOut
from app.repositories import profiles, resumes, roadmaps, users
from app.services import readiness_service, report_service
from app.utils.security import require_student

router = APIRouter(prefix="/student", tags=["Students"])


async def _snapshot(user_id: str) -> Dict[str, Any]:
    """Everything the dashboard shows, computed from this student's stored records (a new student is all zeros)."""
    doc = await users.get(user_id) or {}
    raw = (await readiness_service.load_raw([{**doc, "id": user_id}]))[user_id]
    result = readiness_service.compute(raw)
    config = raw["config"]

    total = active = 0
    if config:
        milestones = config.get("milestones", [])
        progress = await roadmaps.get_progress(user_id, config.get("title", ""))
        total = len(milestones)
        active = next((m.get("number", i + 1) for i, m in enumerate(milestones) if progress.get(m["id"]) != "completed"), total)

    assessments = sorted(raw["assessment_attempts"], key=lambda a: a.get("submitted_at") or datetime.min)
    latest = assessments[-1] if assessments else None
    resume_docs = await resumes.history(user_id, 30)
    return {
        "career_path": raw["career_path"],
        "readiness_score": result["overall"],
        "assessment_score": int(latest["overall_score"]) if latest else 0,
        "assessments_completed": result["assessments_taken"],
        "roadmap_progress": int(raw["roadmap_pct"] or 0),
        "strong_skills": (latest or {}).get("strengths", []),
        "gap_skills": (latest or {}).get("skill_gaps", []),
        "active_milestone": active,
        "total_milestones": total,
        "result": result,
        "score_history": readiness_service.score_history(assessments, resume_docs),
        "resume_score": int(raw["resume_score"] or 0),
    }


@router.get("/profile", response_model=StudentProfile)
async def get_profile(current_user: UserOut = Depends(require_student)):
    # Start from the account itself, then layer the saved profile on top (a profile document
    # created by a partial update may not carry every field).
    base = {
        "user_id": current_user.id,
        "name": current_user.name,
        "email": current_user.email,
        "college": current_user.college,
        "department": current_user.department,
        "current_year": current_user.year,
        "career_path": current_user.current_path,
        "preferred_language": current_user.preferred_language,
        "skill_level": current_user.skill_level,
        "skills": current_user.strong_skills,
    }
    doc = await profiles.get(current_user.id) or {}
    base.update({k: v for k, v in doc.items() if v is not None})
    return StudentProfile(**base)


@router.put("/profile", response_model=StudentProfile)
async def update_profile(updated: StudentProfile, current_user: UserOut = Depends(require_student)):
    profile_data = updated.model_dump()
    profile_data["user_id"] = current_user.id
    profile_data["email"] = current_user.email  # the verified email can't be edited here

    await profiles.upsert(current_user.id, profile_data)
    await users.update(current_user.id, {
        "name": updated.name,
        "current_path": updated.career_path,
        "college": updated.college,
        "department": updated.department,
        "year": updated.current_year,
        "preferred_language": updated.preferred_language,
        "skill_level": updated.skill_level,
    })
    return StudentProfile(**profile_data)


@router.put("/settings")
async def update_settings(body: StudentSettings, current_user: UserOut = Depends(require_student)):
    """Email notifications for placement matches and deadlines (default off; sent only to a verified address)."""
    await users.set_email_notifications(current_user.id, body.email_notifications)
    return {"email_notifications": body.email_notifications, "email_verified": current_user.email_verified}


@router.get("/report.pdf")
async def download_report(current_user: UserOut = Depends(require_student)):
    """The student's own career report as a PDF: readiness and its parts, strengths and gaps, latest ATS-style score and top fixes,
    recommended courses. A student with no data gets a valid report that says so."""
    pdf = report_service.build_pdf(await report_service.gather(current_user))
    return Response(content=pdf, media_type="application/pdf", headers={"Content-Disposition": 'attachment; filename="skillsense-career-report.pdf"'})


@router.get("/progress")
async def get_student_progress(current_user: UserOut = Depends(require_student)):
    snap = await _snapshot(current_user.id)
    return {
        "readiness_score": snap["readiness_score"],
        "readiness_parts": snap["result"]["parts"],
        "streak_days": snap["result"]["streak_days"],
        "skill_progress": snap["roadmap_progress"],
        "assessments_completed": snap["assessments_completed"],
        "strong_skills": snap["strong_skills"],
        "gap_skills": snap["gap_skills"],
        "active_milestone": snap["active_milestone"],
        "total_milestones": snap["total_milestones"],
    }


@router.get("/dashboard", response_model=StudentDashboardData)
async def get_student_dashboard(current_user: UserOut = Depends(require_student)):
    snap = await _snapshot(current_user.id)
    return StudentDashboardData(
        career_path=snap["career_path"],
        career_readiness=snap["readiness_score"],
        assessment_score=snap["assessment_score"],
        roadmap_progress=snap["roadmap_progress"],
        assessments_completed=snap["assessments_completed"],
        strengths=snap["strong_skills"],
        skill_gaps=snap["gap_skills"],
        active_milestone=snap["active_milestone"],
        total_milestones=snap["total_milestones"],
        readiness_parts=snap["result"]["parts"],
        score_history=snap["score_history"],
        streak_days=snap["result"]["streak_days"],
        active_days_14=snap["result"]["active_days_14"],
        problems_solved=snap["result"]["problems_solved"],
        problems_attempted=snap["result"]["problems_attempted"],
        resume_score=snap["resume_score"],
        has_data=snap["result"]["has_data"],
    )
