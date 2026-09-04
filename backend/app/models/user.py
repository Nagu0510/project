from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime

class UserBase(BaseModel):
    email: EmailStr
    name: str
    role: str = "student"  # 'student' | 'admin'

class UserCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=6, max_length=128)
    college: Optional[str] = "Engineering College"
    department: Optional[str] = "Computer Science & Engineering"
    year: Optional[str] = "Final Year (2026)"
    career_goal: Optional[str] = "Backend Developer"
    career_interest: Optional[str] = "Backend Developer"
    preferred_language: Optional[str] = "Python 3"
    skill_level: Optional[str] = "Intermediate"

class AdminLogin(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=4)

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserOut(UserBase):
    id: str
    college: Optional[str] = None
    department: Optional[str] = None
    year: Optional[str] = None
    career_interest: Optional[str] = None
    current_path: Optional[str] = None
    preferred_language: Optional[str] = None
    skill_level: Optional[str] = None
    readiness_score: int = 87
    skill_progress: int = 74
    assessments_completed: int = 1
    strong_skills: List[str] = []
    gap_skills: List[str] = []
    created_at: datetime = Field(default_factory=datetime.utcnow)

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut

class StudentProfile(BaseModel):
    user_id: str
    name: str
    email: str
    college: Optional[str] = "Engineering College"
    department: Optional[str] = "Computer Science & Engineering"
    current_year: Optional[str] = "Final Year (2026)"
    career_path: Optional[str] = "Backend Developer"
    preferred_language: Optional[str] = "Python 3"
    skill_level: Optional[str] = "Intermediate"
    skills: List[str] = []
    target_companies: List[str] = ["TCS", "Infosys", "Accenture"]

class StudentDashboardData(BaseModel):
    career_path: str
    career_readiness: int
    assessment_score: int
    roadmap_progress: int
    assessments_completed: int
    strengths: List[str]
    skill_gaps: List[str]
    active_milestone: int = 4
    total_milestones: int = 10
