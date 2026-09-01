from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
from app.models.career import CareerPath, CareerSelectRequest
from app.models.user import UserOut
from app.utils.security import require_student
from app.config import settings
from app.data.career_config import get_all_career_paths, get_career_path_by_id_or_title, CAREER_PATHS_CONFIG
from app.database import db_manager

router = APIRouter(tags=["Career Paths"])

@router.get("/career-paths", response_model=List[CareerPath])
async def get_career_paths():
    """Retrieve all available 9 career tracks with full configuration"""
    # If MongoDB has career paths, fetch from there
    if db_manager.is_connected and db_manager.db is not None:
        try:
            cursor = db_manager.db["career_paths"].find({})
            paths = await cursor.to_list(length=100)
            if paths and len(paths) >= 6:
                clean_paths = []
                for p in paths:
                    p.pop("_id", None)
                    clean_paths.append(CareerPath(**p))
                return clean_paths
        except Exception:
            pass

    return [CareerPath(**cp) for cp in get_all_career_paths()]

@router.get("/career-paths/{career_id}", response_model=CareerPath)
async def get_career_path_by_id(career_id: str):
    """Retrieve single career path configuration by ID or slug"""
    cp = get_career_path_by_id_or_title(career_id)
    return CareerPath(
        id=cp["id"],
        title=cp["title"],
        slug=cp.get("slug", cp["id"]),
        description=cp["description"],
        match_percentage=cp["match_percentage"],
        required_skills=cp["required_skills"],
        average_salary=cp["average_salary"],
        active_openings=cp["active_openings"],
        top_companies=cp["top_companies"],
        difficulty=cp["difficulty"],
        demand_level=cp.get("demand_level", "High Demand"),
    )

@router.post("/student/career-path")
async def select_career_path(
    req: CareerSelectRequest,
    current_user: UserOut = Depends(require_student)
):
    """Persist student's selected career path in MongoDB"""
    user_id = current_user.id
    target_path = req.career_path_title or req.career_path or (req.career_path_id and get_career_path_by_id_or_title(req.career_path_id)["title"]) or "Backend Developer"

    # Update memory store
    if user_id in db_manager._memory_store["users"]:
        db_manager._memory_store["users"][user_id]["current_path"] = target_path
        db_manager._memory_store["users"][user_id]["career_interest"] = target_path
        db_manager._memory_store["users"][user_id]["career_goal"] = target_path

    if user_id in db_manager._memory_store["student_profiles"]:
        db_manager._memory_store["student_profiles"][user_id]["career_path"] = target_path

    # Persist in MongoDB
    if db_manager.is_connected and db_manager.db is not None:
        try:
            await db_manager.db["users"].update_one(
                {"id": user_id},
                {"$set": {
                    "current_path": target_path,
                    "career_interest": target_path,
                    "career_goal": target_path,
                }}
            )
            await db_manager.db["student_profiles"].update_one(
                {"user_id": user_id},
                {"$set": {"career_path": target_path}},
                upsert=True
            )
        except Exception:
            pass

    return {
        "success": True,
        "message": f"Career path successfully updated to {target_path}",
        "career_path": target_path,
    }
