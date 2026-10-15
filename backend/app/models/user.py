from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.utils.timeutil import utcnow

PASSWORD_HINT = "Password must be 8-72 characters and include at least one letter and one number."


def check_password_policy(password: str) -> str:
    if len(password) < 8 or len(password.encode("utf-8")) > 72:
        raise ValueError(PASSWORD_HINT)
    if not any(c.isalpha() for c in password) or not any(c.isdigit() for c in password):
        raise ValueError(PASSWORD_HINT)
    return password


class UserBase(BaseModel):
    email: EmailStr
    name: str
    role: str = "student"  # 'student' | 'admin'


class UserCreate(BaseModel):
    """Role is never accepted from the client; unknown fields are ignored."""
    name: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    password: str
    college: Optional[str] = None
    department: Optional[str] = None
    year: Optional[str] = None
    career_goal: Optional[str] = None
    career_interest: Optional[str] = None
    preferred_language: Optional[str] = None
    skill_level: Optional[str] = None

    @field_validator("name")
    @classmethod
    def _strip_name(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 2:
            raise ValueError("Name must be at least 2 characters.")
        return v

    @field_validator("password")
    @classmethod
    def _password_policy(cls, v: str) -> str:
        return check_password_policy(v)


class AdminLogin(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1, max_length=128)


class UserLogin(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1, max_length=128)


class PasswordChangeRequest(BaseModel):
    # Omitted by accounts that have no password yet (Google sign-in): the call then *sets* one.
    current_password: Optional[str] = Field(None, max_length=128)
    new_password: str

    @field_validator("new_password")
    @classmethod
    def _password_policy(cls, v: str) -> str:
        return check_password_policy(v)


class GoogleLoginRequest(BaseModel):
    credential: str = Field(..., min_length=20, max_length=4096)


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str = Field(..., min_length=20, max_length=200)
    new_password: str

    @field_validator("new_password")
    @classmethod
    def _password_policy(cls, v: str) -> str:
        return check_password_policy(v)


class UserOut(UserBase):
    id: str
    college: Optional[str] = None
    department: Optional[str] = None
    year: Optional[str] = None
    career_interest: Optional[str] = None
    current_path: Optional[str] = None
    preferred_language: Optional[str] = None
    skill_level: Optional[str] = None
    readiness_score: int = 0
    skill_progress: int = 0
    assessments_completed: int = 0
    strong_skills: List[str] = []
    gap_skills: List[str] = []
    gap_topics: List[str] = []
    picture: Optional[str] = None
    email_verified: bool = False
    email_notifications: bool = False  # placement email copies: off until the student turns it on in Settings
    auth_provider: str = "password"  # 'password' | 'google' | 'both'
    has_password: bool = True
    created_at: datetime = Field(default_factory=utcnow)


def to_user_out(doc: dict) -> UserOut:
    """Build the public user view from a stored document (never exposes the hash itself)."""
    has_password = bool(doc.get("password"))
    provider = doc.get("auth_provider") or ("google" if doc.get("google_sub") and not has_password else "password")
    return UserOut(**{**doc, "has_password": has_password, "auth_provider": provider})


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class StudentProfile(BaseModel):
    user_id: str
    name: str
    email: str
    college: Optional[str] = None
    department: Optional[str] = None
    current_year: Optional[str] = None
    career_path: Optional[str] = None
    preferred_language: Optional[str] = None
    skill_level: Optional[str] = None
    skills: List[str] = []
    target_companies: List[str] = []
    # placement eligibility (all optional; without them a student is shown "Add CGPA to see eligibility")
    cgpa: Optional[float] = Field(None, ge=0, le=10)
    branch: Optional[str] = Field(None, max_length=80)
    graduation_year: Optional[int] = Field(None, ge=2000, le=2040)


class StudentSettings(BaseModel):
    email_notifications: bool


class StudentDashboardData(BaseModel):
    career_path: str
    career_readiness: int
    assessment_score: int
    roadmap_progress: int
    assessments_completed: int
    strengths: List[str]
    skill_gaps: List[str]
    active_milestone: int = 0
    total_milestones: int = 0
    # computed from the student's own records (services/readiness_service.py); a new student is all zeros
    readiness_parts: List[dict] = []
    score_history: List[dict] = []
    streak_days: int = 0
    active_days_14: int = 0
    problems_solved: int = 0
    problems_attempted: int = 0
    resume_score: int = 0
    has_data: bool = False
