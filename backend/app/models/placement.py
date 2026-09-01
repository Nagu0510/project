from pydantic import BaseModel
from typing import List, Optional

class PlacementJob(BaseModel):
    id: str
    company: str
    role: str
    package: str
    location: str
    deadline: str
    match_percentage: int
    status: str
    hiring_batch: str
    required_skills: List[str]
    missing_skills: List[str]
    description: str

class CompanyInsight(BaseModel):
    name: str
    industry: str
    exam_patterns: List[str]
    difficulty: str
    total_questions: int
    top_topics: List[dict]
