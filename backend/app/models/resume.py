from pydantic import BaseModel
from typing import List, Optional

class ResumeStrength(BaseModel):
    skill: str
    reason: str

class ResumeGap(BaseModel):
    skill: str
    reason: str

class ResumeAnalysisResult(BaseModel):
    overall_score: int
    headline: str
    recommended_path: str
    extracted_text_snippet: Optional[str] = None
    strengths: List[ResumeStrength]
    gaps: List[ResumeGap]
    ats_compatibility: str = "High"
    parsed_skills: List[str]
    missing_critical_skills: List[str]
