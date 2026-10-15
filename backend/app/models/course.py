from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


class CourseModule(BaseModel):
    id: str
    title: str
    topics: List[str] = []
    hours: float = 0


class CourseResource(BaseModel):
    provider: str
    url: str  # the provider's official home page, never a deep link


class CourseSummary(BaseModel):
    slug: str
    title: str
    level: str = "Beginner"
    description: str = ""
    skills: List[str] = []
    prerequisites: List[str] = []
    modules_count: int = 0
    estimated_hours: float = 0

    class Config:
        extra = "ignore"


class CourseDetail(CourseSummary):
    modules: List[CourseModule] = []
    outcomes: List[str] = []
    practice_topics: List[str] = []
    assessment_skills: List[str] = []
    resources: List[CourseResource] = []


class ProgressIn(BaseModel):
    module_id: str = Field(min_length=1, max_length=80)
    done: bool = True


class CourseProgress(BaseModel):
    course_slug: str
    title: str = ""
    modules_done: List[str] = []
    modules_total: int = 0
    percent: int = 0
    completed: bool = False
    updated_at: Optional[datetime] = None
