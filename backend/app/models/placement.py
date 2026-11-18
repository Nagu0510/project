from enum import Enum

from urllib.parse import urlparse

from pydantic import BaseModel, Field, field_validator
from typing import Annotated, Any, Dict, List, Optional, Union

Short = Annotated[str, Field(max_length=100)]


def check_http_link(value: Optional[str]) -> Optional[str]:
    """An application link is shown to students as a link: only http(s) with a host is accepted (never javascript: or data:)."""
    if value is None or not value.strip():
        return None
    value = value.strip()
    parsed = urlparse(value)
    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        raise ValueError("The application link must start with http:// or https://")
    return value


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
    company: str = Field(..., max_length=150)
    role: str = Field(..., max_length=150)
    package: Optional[str] = Field(None, max_length=60)
    location: Optional[str] = Field(None, max_length=150)
    deadline: Optional[str] = Field(None, max_length=40)  # ISO date, e.g. 2027-03-15
    drive_date: Optional[str] = Field(None, max_length=40)
    hiring_batch: Optional[str] = Field(None, max_length=40)
    required_skills: List[Short] = Field([], max_length=50)
    preferred_skills: List[Short] = Field([], max_length=50)
    minimum_cgpa: Optional[float] = Field(None, ge=0, le=10)
    eligible_branches: List[Short] = Field([], max_length=50)
    graduation_year: Optional[Union[Annotated[str, Field(max_length=40)], int]] = None
    backlog_criteria: Optional[Union[Annotated[str, Field(max_length=40)], int]] = None
    application_link: Optional[str] = Field(None, max_length=500)
    description: Optional[str] = Field("", max_length=5000)
    status: Optional[PlacementStatus] = PlacementStatus.published

    @field_validator("application_link")
    @classmethod
    def _http_link_only(cls, v):
        return check_http_link(v)

class CompanyInsight(BaseModel):
    name: str
    industry: str
    exam_patterns: List[str]
    difficulty: str
    total_questions: int
    top_topics: List[dict]


class PlacementApplication(BaseModel):
    id: str
    job_id: str
    user_id: str
    student_name: str
    student_email: str
    company: str
    role: str
    status: str = "submitted"
    submitted_at: str
