from pydantic import BaseModel
from typing import List, Optional

class RoadmapMilestone(BaseModel):
    id: str
    number: int
    title: str
    description: str
    status: str = "locked"  # 'completed' | 'in_progress' | 'not_started' | 'locked'
    skills: List[str] = []
    estimated_time: str
    score: Optional[int] = None
    action_label: str = "Explore Concepts"
    is_priority_gap: bool = False
    course_slugs: List[str] = []       # real courses (from the courses collection) that teach this milestone
    courses: List[dict] = []           # {slug, title}
    practice_sets: List[dict] = []     # {id, title, difficulty} assessment sets of those courses

    class Config:
        extra = "ignore"

class RoadmapResponse(BaseModel):
    career_path: str
    current_milestone: int
    completion_percentage: int
    milestones: List[RoadmapMilestone]

    class Config:
        extra = "ignore"

class ProgressUpdate(BaseModel):
    milestone_id: str
    status: str  # 'completed' | 'in_progress' | 'not_started' | 'locked'
