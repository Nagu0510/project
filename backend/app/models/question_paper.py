from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime

class QuestionPaperMetadata(BaseModel):
    id: str
    company: str
    exam: str
    year: int
    paper_type: str = "Mixed"  # 'Technical MCQ' | 'Coding' | 'Mixed'
    role: str = "Software Engineer"
    description: Optional[str] = None
    questions_count: int = 0
    status: str = "Extracted"  # 'Extracted' | 'Processing' | 'Approved'
    uploaded_at: datetime = Field(default_factory=datetime.utcnow)

class ExtractedQuestion(BaseModel):
    id: str
    paper_id: str
    question_text: str
    normalized_text: str
    company: str
    exam: str
    year: int
    role: str = "Software Engineer"
    topic: str
    subtopic: str = "General"
    difficulty: str = "Medium"
    status: str = "needs_review"  # 'needs_review' | 'approved' | 'published' | 'rejected'
    appearances_count: int = 1
    historical_occurrences: List[Dict[str, Any]] = []
    created_at: datetime = Field(default_factory=datetime.utcnow)

class PreviousQuestion(BaseModel):
    id: str
    paper_id: Optional[str] = None
    title: str
    problem_slug: Optional[str] = "two-sum"
    question_text: str
    normalized_text: Optional[str] = None
    company: str
    companies: List[str] = []
    exam: str
    exam_origin: str
    year: int
    role: Optional[str] = "Software Engineer"
    topic: str
    subtopic: Optional[str] = None
    difficulty: str = "Medium"
    question_type: str = "Coding"
    frequency: int = 1
    appearances: int = 1
    badge: str = "Frequently Asked"
    badge_type: str = "lime"
    description: Optional[str] = None
    similarity: float = 0.90
    status: str = "published"
    historical_occurrences: List[Dict[str, Any]] = []
    created_at: datetime = Field(default_factory=datetime.utcnow)

class QuestionMatchRequest(BaseModel):
    question_id: Optional[str] = None
    question_text: str
    topic: Optional[str] = None

class MatchDetail(BaseModel):
    company: str
    exam: str
    year: int
    similarity: float

class QuestionMatchResponse(BaseModel):
    matched: bool
    similarity: float = 0.0
    topic: str = "General"
    difficulty: str = "Medium"
    exam_origin: str = ""
    appearances_count: int = 0
    companies: List[str] = []
    best_match: Optional[MatchDetail] = None
    matches: List[MatchDetail] = []
    historical_occurrences: List[Dict[str, Any]] = []
