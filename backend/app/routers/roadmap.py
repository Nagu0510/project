from fastapi import APIRouter, Depends, HTTPException, status
from typing import Optional
from app.models.roadmap import RoadmapResponse, ProgressUpdate
from app.models.user import UserOut
from app.utils.security import require_student
from app.services.roadmap_service import generate_personalized_roadmap
from app.database import db_manager

router = APIRouter(prefix="/student/roadmap", tags=["Roadmaps"])

@router.get("", response_model=RoadmapResponse)
async def get_roadmap(
    career_path: Optional[str] = None,
    current_user: Optional[UserOut] = Depends(require_student)
):
    target_path = career_path or (current_user.current_path if current_user else "Backend Developer") or "Backend Developer"
    gaps = current_user.gap_skills if current_user else ["System Design", "Docker", "DSA"]

    # Generate personalized career roadmap
    roadmap_res = generate_personalized_roadmap(target_path, gaps)

    if current_user:
        user_id = current_user.id
        saved_progress = None

        # Check MongoDB first
        if db_manager.is_connected and db_manager.db is not None:
            try:
                db_roadmap = await db_manager.db["roadmaps"].find_one({"user_id": user_id, "career_path": target_path})
                if not db_roadmap:
                    # Also check generic user_id
                    db_roadmap = await db_manager.db["roadmaps"].find_one({"user_id": user_id})
                if db_roadmap:
                    saved_progress = db_roadmap.get("milestones_progress", {})
            except Exception:
                pass

        # Check memory store fallback
        if not saved_progress:
            saved_progress = db_manager._memory_store.get("roadmaps", {}).get(user_id, {})

        if saved_progress:
            completed_count = 0
            for m in roadmap_res.milestones:
                if m.id in saved_progress:
                    m.status = saved_progress[m.id]
                if m.status == "completed":
                    completed_count += 1
            if len(roadmap_res.milestones) > 0:
                roadmap_res.completion_percentage = int((completed_count / len(roadmap_res.milestones)) * 100)

    return roadmap_res

@router.put("/progress")
async def update_roadmap_progress(
    req: ProgressUpdate,
    current_user: UserOut = Depends(require_student)
):
    user_id = current_user.id
    target_path = current_user.current_path or "Backend Developer"

    if "roadmaps" not in db_manager._memory_store:
        db_manager._memory_store["roadmaps"] = {}
    if user_id not in db_manager._memory_store["roadmaps"]:
        db_manager._memory_store["roadmaps"][user_id] = {}

    db_manager._memory_store["roadmaps"][user_id][req.milestone_id] = req.status

    if db_manager.is_connected and db_manager.db is not None:
        try:
            await db_manager.db["roadmaps"].update_one(
                {"user_id": user_id},
                {
                    "$set": {
                        f"milestones_progress.{req.milestone_id}": req.status,
                        "career_path": target_path,
                    }
                },
                upsert=True
            )
        except Exception:
            pass

    return {
        "success": True,
        "milestone_id": req.milestone_id,
        "status": req.status,
        "message": f"Milestone {req.milestone_id} marked as {req.status}",
    }

@router.put("/{step_id}/progress")
async def update_step_progress(
    step_id: str,
    req: ProgressUpdate,
    current_user: UserOut = Depends(require_student)
):
    req.milestone_id = step_id
    return await update_roadmap_progress(req, current_user)
