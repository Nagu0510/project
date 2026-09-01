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
    difficulty: str = "Medium"  # 'Easy' | 'Medium' | 'Hard'
    question_type: str = "Coding"  # 'MCQ' | 'Coding' | 'System Design'
    frequency: int = 1
    appearances: int = 1
    badge: str = "Frequently Asked"
    badge_type: str = "lime"
    description: Optional[str] = None
    similarity: int = 90
    status: str = "published"  # 'approved' | 'published' | 'archived'
    historical_occurrences: List[Dict[str, Any]] = []
    created_at: datetime = Field(default_factory=datetime.utcnow)

class QuestionMatchRequest(BaseModel):
    question_text: str
    topic: Optional[str] = None

class QuestionMatchResponse(BaseModel):
    matched: bool
    similarity: float
    topic: str
    difficulty: str
    exam_origin: str
    appearances_count: int
    companies: List[str]
    historical_occurrences: List[Dict[str, Any]] = []
