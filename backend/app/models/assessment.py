from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime

class QuestionOption(BaseModel):
    id: str
    text: str

class HistoricalOccurrence(BaseModel):
    company: str
    exam: str
    year: str

class HistoricalMatch(BaseModel):
    company: str
    exam: str
    year: str
    topic: str
    difficulty: str
    similarity: int
    appearances_count: int
    other_appearances: List[HistoricalOccurrence] = []

class AssessmentQuestion(BaseModel):
    id: str
    number: int = 1
    title: str
    skill: Optional[str] = "Engineering"
    topic: str = "Core Engineering"
    subtopic: Optional[str] = "Fundamentals"
    difficulty: str = "Medium"
    question_type: Optional[str] = "Multiple Choice"
    question_text: str
    options: List[str]
    correct_option_index: Optional[int] = None  # Strictly hidden during live assessment tests
    previous_match: Optional[HistoricalMatch] = None

    class Config:
        extra = "ignore"

class AssessmentSummary(BaseModel):
    id: str
    title: str
    skill: str
    career_path: str
    difficulty: str  # 'Easy' | 'Medium' | 'Hard'
    questions_count: int
    duration_minutes: int
    best_score: Optional[int] = None
    attempts_count: int = 0

    class Config:
        extra = "ignore"

class AssessmentDetail(BaseModel):
    id: str
    title: str
    skill: str
    career_path: str
    difficulty: str
    questions_count: int
    duration_minutes: int
    questions: List[AssessmentQuestion]

    class Config:
        extra = "ignore"

class AssessmentSubmission(BaseModel):
    assessment_id: str
    answers: Dict[str, int]  # question_id -> selected_option_index
    time_taken_seconds: int

class TopicScore(BaseModel):
    topic: str
    score: int
    total: int

class AssessmentResult(BaseModel):
    attempt_id: str
    user_id: str
    assessment_id: Optional[str] = "asm-default"
    assessment_title: Optional[str] = "Diagnostic Technical Evaluation"
    difficulty: Optional[str] = "Medium"
    overall_score: int
    readiness_score: int
    correct_count: int
    total_questions: int
    topic_scores: List[TopicScore] = []
    strengths: List[str] = []
    skill_gaps: List[str] = []
    recommended_practice: Optional[str] = None
    recommended_roadmap_step: str = "Milestone 04: Relational Databases & SQL"
    submitted_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        extra = "ignore"

class PracticeVerifyRequest(BaseModel):
    question_id: str
    selected_option_index: int

class PracticeVerifyResponse(BaseModel):
    question_id: str
    is_correct: bool
    correct_option_index: int
    explanation: str
