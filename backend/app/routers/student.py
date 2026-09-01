from fastapi import APIRouter, Depends, HTTPException, status
from typing import Optional
from app.models.user import StudentProfile, UserOut, StudentDashboardData
from app.utils.security import require_student
from app.database import db_manager

router = APIRouter(prefix="/student", tags=["Students"])

@router.get("/profile", response_model=StudentProfile)
async def get_profile(current_user: UserOut = Depends(require_student)):
    user_id = current_user.id

    # Check MongoDB first
    if db_manager.is_connected and db_manager.db is not None:
        try:
            profile_doc = await db_manager.db["student_profiles"].find_one({"user_id": user_id})
            if profile_doc:
                profile_doc.pop("_id", None)
                return StudentProfile(**profile_doc)
        except Exception:
            pass

    # Check in-memory store
    profile = db_manager._memory_store["student_profiles"].get(user_id)
    if not profile:
        profile = {
            "user_id": user_id,
            "name": current_user.name,
            "email": current_user.email,
            "college": current_user.college or "Engineering College",
            "department": current_user.department or "Computer Science & Engineering",
            "current_year": current_user.year or "Final Year (2026)",
            "career_path": current_user.current_path or "Backend Developer",
            "preferred_language": current_user.preferred_language or "Python 3",
            "skill_level": current_user.skill_level or "Intermediate",
            "skills": current_user.strong_skills or ["Python", "SQL", "REST APIs"],
            "target_companies": ["TCS", "Infosys", "Accenture"],
        }
        db_manager._memory_store["student_profiles"][user_id] = profile

    p_copy = dict(profile)
    p_copy.pop("_id", None)
    return StudentProfile(**p_copy)

@router.put("/profile", response_model=StudentProfile)
async def update_profile(
    updated: StudentProfile,
    current_user: UserOut = Depends(require_student)
):
    user_id = current_user.id
    profile_data = updated.dict()
    profile_data["user_id"] = user_id
    profile_data["email"] = current_user.email  # Preserve verified email

    db_manager._memory_store["student_profiles"][user_id] = dict(profile_data)

    # Also update user record if name or path changed
    if user_id in db_manager._memory_store["users"]:
        db_manager._memory_store["users"][user_id]["name"] = updated.name
        db_manager._memory_store["users"][user_id]["current_path"] = updated.career_path
        db_manager._memory_store["users"][user_id]["college"] = updated.college
        db_manager._memory_store["users"][user_id]["department"] = updated.department
        db_manager._memory_store["users"][user_id]["year"] = updated.current_year
        db_manager._memory_store["users"][user_id]["preferred_language"] = updated.preferred_language
        db_manager._memory_store["users"][user_id]["skill_level"] = updated.skill_level

    if db_manager.is_connected and db_manager.db is not None:
        try:
            await db_manager.db["student_profiles"].update_one(
                {"user_id": user_id},
                {"$set": dict(profile_data)},
                upsert=True
            )
            await db_manager.db["users"].update_one(
                {"id": user_id},
                {"$set": {
                    "name": updated.name,
                    "current_path": updated.career_path,
                    "college": updated.college,
                    "department": updated.department,
                    "year": updated.current_year,
                }}
            )
        except Exception:
            pass

    return StudentProfile(**profile_data)

@router.get("/progress")
async def get_student_progress(current_user: UserOut = Depends(require_student)):
    user_id = current_user.id
    user_dict = db_manager._memory_store["users"].get(user_id, {})

    if db_manager.is_connected and db_manager.db is not None:
        try:
            db_user = await db_manager.db["users"].find_one({"id": user_id})
            if db_user:
                db_user.pop("_id", None)
                user_dict = db_user
        except Exception:
            pass

    return {
        "readiness_score": user_dict.get("readiness_score", 87),
        "skill_progress": user_dict.get("skill_progress", 74),
        "assessments_completed": user_dict.get("assessments_completed", 1),
        "strong_skills": user_dict.get("strong_skills", ["Python", "SQL", "REST APIs"]),
        "gap_skills": user_dict.get("gap_skills", ["System Design", "Docker", "Kubernetes"]),
        "active_milestone": 4,
        "total_milestones": 10,
    }

@router.get("/dashboard", response_model=StudentDashboardData)
async def get_student_dashboard(current_user: UserOut = Depends(require_student)):
    user_id = current_user.id
    user_dict = db_manager._memory_store["users"].get(user_id, {})

    if db_manager.is_connected and db_manager.db is not None:
        try:
            db_user = await db_manager.db["users"].find_one({"id": user_id})
            if db_user:
                db_user.pop("_id", None)
                user_dict = db_user
        except Exception:
            pass

    career_path = user_dict.get("current_path") or user_dict.get("career_interest") or "Backend Developer"
    readiness = user_dict.get("readiness_score", 87)
    progress = user_dict.get("skill_progress", 74)
    assessments_count = user_dict.get("assessments_completed", 1)
    strengths = user_dict.get("strong_skills", ["Python", "SQL", "REST APIs"])
    skill_gaps = user_dict.get("gap_skills", ["System Design", "Docker", "Kubernetes"])

    return StudentDashboardData(
        career_path=career_path,
        career_readiness=readiness,
        assessment_score=84,
        roadmap_progress=progress,
        assessments_completed=assessments_count,
        strengths=strengths,
        skill_gaps=skill_gaps,
        active_milestone=4,
        total_milestones=10,
    )
