from typing import Any, Dict

from fastapi import APIRouter, Depends

from app.models.user import UserOut
from app.services.recommendation_service import build_for_user
from app.utils.security import require_student

router = APIRouter(prefix="/recommendations", tags=["Recommendations"])


@router.get("/courses")
async def recommended_courses(current_user: UserOut = Depends(require_student)) -> Dict[str, Any]:
    """Top 5 courses with a reason each, and a 4-week study plan, from this student's own career path, assessment and resume data."""
    return await build_for_user(current_user)
