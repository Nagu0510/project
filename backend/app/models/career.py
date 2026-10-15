from pydantic import BaseModel
from typing import List, Optional

class CareerPath(BaseModel):
    id: str
    title: str
    slug: Optional[str] = None
    description: str
    match_percentage: int = 0  # computed per student from their skills (0 for guests); never stored
    required_skills: List[str]
    average_salary: str
    active_openings: int
    top_companies: List[str]
    difficulty: str
    demand_level: Optional[str] = "High Demand"

    class Config:
        extra = "ignore"

class CareerSelectRequest(BaseModel):
    career_path_id: Optional[str] = None
    career_path_title: Optional[str] = None
    career_path: Optional[str] = None
