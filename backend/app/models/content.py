"""Request bodies of the admin content editor. Field rules beyond types live in services/content_validation.py."""
from typing import List, Optional

from pydantic import BaseModel, Field


class QuestionIn(BaseModel):
    id: Optional[str] = Field(None, max_length=64)      # left out on create: one is generated
    skill: str
    topic: str
    subtopic: Optional[str] = None
    difficulty: str
    question_type: str
    question_text: str
    code: Optional[str] = None
    language: Optional[str] = None
    options: List[str]
    correct_option_index: int
    explanation: str
    practice: bool = True
    companies: List[str] = []


class ModuleIn(BaseModel):
    id: Optional[str] = None
    title: str
    topics: List[str] = []
    hours: float = 0


class ResourceIn(BaseModel):
    provider: str
    url: str


class CourseIn(BaseModel):
    slug: str
    title: str
    level: str
    description: str = ""
    skills: List[str] = []
    prerequisites: List[str] = []
    modules: List[ModuleIn] = []
    outcomes: List[str] = []
    practice_topics: List[str] = []
    assessment_skills: List[str] = []
    resources: List[ResourceIn] = []


class MilestoneIn(BaseModel):
    id: str
    number: int
    title: str
    description: str = ""
    skills: List[str] = []
    estimated_time: str = ""
    action_label: Optional[str] = None


class CareerPathIn(BaseModel):
    title: str
    required_skills: List[str] = []
    milestones: List[MilestoneIn] = []
