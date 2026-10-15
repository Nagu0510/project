from enum import Enum

from pydantic import BaseModel
from typing import Any, Dict, List, Optional, Union


class PlacementStatus(str, Enum):
    draft = "draft"
    published = "published"
    closed = "closed"


class PlacementStatusUpdate(BaseModel):
    new_status: PlacementStatus  # anything else is a 422


class PlacementJob(BaseModel):
    id: str
    company: str
    role: str
    package: Optional[str] = None
    location: Optional[str] = None
    deadline: Optional[str] = None  # ISO date, e.g. 2027-03-15
    drive_date: Optional[str] = None
    match_percentage: int = 0
    status: str = "published"  # 'published' | 'draft' | 'closed' | 'Ready to Apply'
    hiring_batch: Optional[str] = None
    required_skills: List[str] = []
    preferred_skills: List[str] = []
    missing_skills: List[str] = []
    minimum_cgpa: Optional[float] = None
    eligible_branches: List[str] = []
    graduation_year: Optional[Union[str, int]] = None
    backlog_criteria: Optional[Union[str, int]] = None
    application_link: Optional[str] = None
    description: str = ""
    match_known: bool = False                      # False when the student has no assessed skills yet: the match is then not shown
    eligibility: Optional[Dict[str, Any]] = None   # {state: eligible|not_eligible|unknown, message, missing, reasons}

class PlacementJobCreate(BaseModel):
    company: str
    role: str
    package: Optional[str] = None
    location: Optional[str] = None
    deadline: Optional[str] = None  # ISO date, e.g. 2027-03-15
    drive_date: Optional[str] = None
    hiring_batch: Optional[str] = None
    required_skills: List[str] = []
    preferred_skills: List[str] = []
    minimum_cgpa: Optional[float] = None
    eligible_branches: List[str] = []
    graduation_year: Optional[Union[str, int]] = None
    backlog_criteria: Optional[Union[str, int]] = None
    application_link: Optional[str] = None
    description: Optional[str] = ""
    status: Optional[PlacementStatus] = PlacementStatus.published

class CompanyInsight(BaseModel):
    name: str
    industry: str
    exam_patterns: List[str]
    difficulty: str
    total_questions: int
    top_topics: List[dict]

