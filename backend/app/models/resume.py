from pydantic import BaseModel
from typing import List, Optional, Dict, Any

class ResumeStrength(BaseModel):
    skill: str
    reason: str

class ResumeGap(BaseModel):
    skill: str
    reason: str

class CompanyMatch(BaseModel):
    company: str
    role: str
    match_percentage: int
    status: str  # 'Eligible' | 'Possibly Eligible' | 'Needs Skill Improvement' | 'Not Eligible'
    missing_skills: List[str] = []
    location: Optional[str] = None

class ResumeAnalysisResult(BaseModel):
    overall_score: int
    headline: str
    recommended_path: str
    extracted_text_snippet: Optional[str] = None
    detected_skills: List[str] = []
    strong_skills: List[str] = []
    missing_skills: List[str] = []
    strengths: List[ResumeStrength] = []
    gaps: List[ResumeGap] = []
    company_matches: List[CompanyMatch] = []
    recommendations: List[str] = []
    ats_compatibility: str = "High"
    parsed_skills: List[str] = []
    missing_critical_skills: List[str] = []
