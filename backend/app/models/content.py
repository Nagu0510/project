"""Request bodies of the admin content editor. Field rules beyond types live in services/content_validation.py.

Every text field and list has a size cap (the same caps are checked by tests/test_security_hardening.py for all request models).
"""
from typing import Annotated, List, Optional

from pydantic import BaseModel, Field

Name = Annotated[str, Field(max_length=120)]       # a skill, topic, company, provider ...
Title = Annotated[str, Field(max_length=200)]
Text = Annotated[str, Field(max_length=5000)]      # a question, an explanation, a description
Code = Annotated[str, Field(max_length=20000)]


class QuestionIn(BaseModel):
    id: Optional[str] = Field(None, max_length=64)      # left out on create: one is generated
    skill: Name
    topic: Name
    subtopic: Optional[Name] = None
    difficulty: Name
    question_type: Name
    question_text: Text
    code: Optional[Code] = None
    language: Optional[Name] = None
    options: List[Annotated[str, Field(max_length=1000)]] = Field(..., max_length=10)
    correct_option_index: int
    explanation: Text
    practice: bool = True
    companies: List[Name] = Field([], max_length=20)


class ModuleIn(BaseModel):
    id: Optional[str] = Field(None, max_length=64)
    title: Title
    topics: List[Title] = Field([], max_length=50)
    hours: float = 0


class ResourceIn(BaseModel):
    provider: Name
    url: str = Field(..., max_length=500)


class CourseIn(BaseModel):
    slug: str = Field(..., max_length=100)
    title: Title
    level: Name
    description: Text = ""
    skills: List[Name] = Field([], max_length=50)
    prerequisites: List[Name] = Field([], max_length=50)
    modules: List[ModuleIn] = Field([], max_length=50)
    outcomes: List[Title] = Field([], max_length=50)
    practice_topics: List[Name] = Field([], max_length=50)
    assessment_skills: List[Name] = Field([], max_length=50)
    resources: List[ResourceIn] = Field([], max_length=20)


class MilestoneIn(BaseModel):
    id: str = Field(..., max_length=64)
    number: int
    title: Title
    description: Text = ""
    skills: List[Name] = Field([], max_length=50)
    estimated_time: str = Field("", max_length=60)
    action_label: Optional[str] = Field(None, max_length=60)


class CareerPathIn(BaseModel):
    title: Title
    required_skills: List[Name] = Field([], max_length=100)
    milestones: List[MilestoneIn] = Field([], max_length=50)
