from enum import Enum

from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime


class QuestionStatus(str, Enum):
    needs_review = "needs_review"
    approved = "approved"
    published = "published"
    rejected = "rejected"


class QuestionStatusUpdate(BaseModel):
    new_status: QuestionStatus  # anything else is a 422


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
    source_kind: Optional[str] = None      # pdf | docx | txt | json | png | jpg | webp
    ocr_used: bool = False
    ocr_confidence: Optional[int] = None   # 0-100, only when OCR ran
    warnings: List[str] = []

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
    status: QuestionStatus = QuestionStatus.needs_review
    appearances_count: int = 1
    historical_occurrences: List[Dict[str, Any]] = []
    created_at: datetime = Field(default_factory=datetime.utcnow)
    approved_by: Optional[str] = None      # id of the admin who approved or published it
    approved_at: Optional[datetime] = None
    ocr_confidence: Optional[int] = None   # set when the paper was read by OCR
    low_confidence: bool = False           # OCR confidence under 60: read the text carefully before approving

class PreviousQuestion(BaseModel):
    id: str
    paper_id: Optional[str] = None
    title: str
    problem_slug: Optional[str] = None
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
    year: Optional[int] = None
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
