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
    code: Optional[str] = None            # the snippet a Code Output / Find the Error question refers to
    language: Optional[str] = None
    origin: str = "authored"
    companies: List[str] = []             # 'pattern-inspired practice' tags, not real past questions
    practice: bool = True
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
    company: Optional[str] = None
    course_slug: Optional[str] = None

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

class AssessmentSession(BaseModel):
    """A timed attempt. The questions are the ones THIS session will be scored on (shuffled, no answer keys)."""
    session_id: str
    assessment_id: str
    title: str
    difficulty: str = "Medium"
    status: str = "started"
    user_id: str = ""
    total_questions: int = 0
    duration_seconds: int = 0
    started_at: str                  # ISO-8601 UTC with a trailing Z
    expires_at: str
    server_time: str
    seconds_remaining: int           # use this for the countdown: it does not depend on the browser clock
    resumed: bool = False            # True when an unexpired session was reopened (refresh / new tab)
    answers: Dict[str, int] = {}     # answers saved so far (restored after a refresh)
    questions: List[AssessmentQuestion] = []

class SessionAnswers(BaseModel):
    answers: Dict[str, int]          # question_id -> selected_option_index

class AssessmentSubmission(BaseModel):
    session_id: str                  # from POST /assessments/{id}/start; the session decides what is scored
    assessment_id: Optional[str] = None
    answers: Dict[str, int] = {}     # question_id -> selected_option_index (final answers; saved ones are used for gaps)
    time_taken_seconds: int = 0      # informational only: the server measures the time itself

class TopicScore(BaseModel):
    topic: str
    score: int
    total: int
    band: str = "gap"                # 'gap' (<60) | 'developing' (60-79) | 'strong' (80+)

class ReviewItem(BaseModel):
    question_id: str
    number: int
    topic: str = ""
    skill: str = ""
    question_text: str
    code: Optional[str] = None
    language: Optional[str] = None
    options: List[str]
    your_answer_index: Optional[int] = None
    correct_option_index: int
    correct_answer: str = ""
    is_correct: bool
    explanation: str = ""

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
    session_id: Optional[str] = None
    time_taken_seconds: int = 0
    gap_topics: List[str] = []
    review: List[ReviewItem] = []     # answer keys appear here only, after the session was submitted
    next_steps: List[dict] = []       # course links for the gap topics (set when the result is read)

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
