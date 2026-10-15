from pydantic import BaseModel, Field
from typing import List, Optional


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


class CategoryScore(BaseModel):
    key: str
    label: str
    score: int
    max: int
    explanation: str


class ResumeFix(BaseModel):
    rank: int
    category: str
    title: str
    detail: str
    points: int  # expected gain in the overall score if fixed
    example: str
    course_slug: Optional[str] = None   # a catalog course that closes this gap, when there is one
    course_title: Optional[str] = None


class SkillEvidence(BaseModel):
    name: str
    category: str
    evidence: str  # claimed | demonstrated | verified
    required: bool = False
    note: str = ""


class JdMatch(BaseModel):
    keywords: List[str] = []
    matched: List[str] = []
    missing: List[str] = []
    match_percent: Optional[int] = None  # None when the description has no recognizable skills
    note: str = ""


class BulletTip(BaseModel):
    original: str
    issues: List[str]
    advice: str
    template: str  # a fill-in-the-blanks pattern, never a rewritten claim
    template_note: str = "Template only: fill every <...> with facts from your own work. Do not add anything you did not do."


class LearningStep(BaseModel):
    skill: str
    title: str
    course_slug: Optional[str] = None
    kind: str = "plain"  # 'course' (from the courses collection) | 'plain'


class Comparison(BaseModel):
    previous_score: int
    delta: int
    previous_date: Optional[str] = None
    changes: List[str] = []


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

    # ATS-style estimate with a transparent breakdown
    score_label: str = "ATS-style score (estimate)"
    categories: List[CategoryScore] = []
    fixes: List[ResumeFix] = []
    skills: List[SkillEvidence] = []
    role_match: int = 0
    matched_requirements: List[str] = []
    missing_requirements: List[str] = []
    jd: Optional[JdMatch] = None
    bullet_coach: List[BulletTip] = []
    learning_steps: List[LearningStep] = []
    comparison: Optional[Comparison] = None

    analysis_id: str = ""
    skill_contexts: dict = {}  # skill -> the project or job where it appears

    # how the text was read
    extracted_text: str = ""
    text_hash: str = ""
    source: str = "text"
    ocr_used: bool = False
    ocr_engine: Optional[str] = None
    ocr_confidence: Optional[int] = None
    pages_processed: int = 1
    warnings: List[str] = []


class ResumeTextRequest(BaseModel):
    text: str = Field(min_length=1, max_length=60000)
    career_path: Optional[str] = None
    job_description: Optional[str] = Field(default=None, max_length=8000)


class ResumeHistoryItem(BaseModel):
    created_at: str
    overall_score: int
    career_path: str = ""
    jd_used: bool = False
    jd_match: Optional[int] = None
    ocr_used: bool = False
    ocr_confidence: Optional[int] = None
    source: str = ""
    categories: List[dict] = []
    id: str = ""
