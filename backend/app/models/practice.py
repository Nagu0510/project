from pydantic import BaseModel, Field
from typing import Annotated, Any, Dict, List, Optional
from datetime import datetime

from app.utils.timeutil import utcnow

class ProblemParam(BaseModel):
    name: str
    type: str


class ProblemExample(BaseModel):
    input: str                      # one "name = value" line per parameter
    output: str
    explanation: Optional[str] = None


class CodingProblem(BaseModel):
    """What a student may see of a problem. Hidden test cases, hints and solutions are not part of this model at all."""
    id: str
    title: str
    slug: str
    difficulty: str  # 'Easy' | 'Medium' | 'Hard'
    difficulty_rank: int = 0
    category: str = ""
    topic: str = ""
    description: str
    constraints: List[str] = []
    tags: List[str] = []
    function_name: str
    params: List[ProblemParam] = []
    return_type: str
    examples: List[ProblemExample] = []
    example_args: List[List[Any]] = []      # values of the shown examples, for the editable "Case 1..n" inputs
    starter_code: Dict[str, str] = {}
    c_available: bool = True
    c_disabled_reason: str = ""
    time_limit_ms: int = 2000
    expected_complexity: str = ""
    hint_count: int = 0
    total_cases: int = 0
    shown_cases: int = 0
    submissions_count: int = 0              # judged submissions by all students
    acceptance_rate: Optional[int] = None   # percent Accepted, only when there is at least one judged submission

    class Config:
        extra = "ignore"


class PracticeAttempt(BaseModel):
    id: str
    user_id: str
    problem_slug: str
    language: str
    code: str
    execution_available: bool = True
    message: str = "Code execution snapshot recorded."
    is_correct: bool = False
    verdict: str = ""  # Accepted | Wrong Answer | Runtime Error | Time Limit Exceeded | Output Limit Exceeded | Compile Error
    runtime_ms: Optional[int] = None
    memory_kb: Optional[int] = None
    passed_count: Optional[int] = None
    total_count: Optional[int] = None
    timestamp: datetime = Field(default_factory=utcnow)
    created_at: datetime = Field(default_factory=utcnow)

    class Config:
        extra = "ignore"


CaseText = Annotated[str, Field(max_length=20_000)]  # one test case: "name = value" lines, one per parameter


class CodeRunRequest(BaseModel):
    problem_slug: Optional[str] = Field(None, max_length=100)
    problem_id: Optional[str] = Field(None, max_length=100)
    language: str = Field(..., max_length=30)
    source_code: str = Field(..., max_length=200_000)  # the 20 KB limit is checked (413) in the router; this only stops absurd bodies
    cases: Optional[List[CaseText]] = Field(None, max_length=8)  # omitted = run the shown examples; otherwise these cases (examples edited or custom)


class RunCaseOut(BaseModel):
    index: int
    input: str
    custom: bool = False
    status: str                     # Passed | Wrong Answer | Runtime Error | Time Limit Exceeded | Output Limit Exceeded | Finished | Not run
    passed: Optional[bool] = None   # None for a custom case (nothing to compare with) and for a case that was not run
    your_output: Optional[str] = None
    expected: Optional[str] = None
    runtime_ms: int = 0
    stdout: str = ""
    error: Optional[str] = None
    error_line: Optional[int] = None


class CodeRunResponse(BaseModel):
    status: str                     # Accepted | Finished | Wrong Answer | Runtime Error | Time Limit Exceeded | Output Limit Exceeded | Compile Error
    message: str = ""
    compile_output: str = ""
    error_lines: List[int] = []
    runtime_ms: int = 0
    memory_kb: Optional[int] = None
    cases: List[RunCaseOut] = []


class CodeSubmitRequest(BaseModel):
    problem_id: Optional[str] = Field(None, max_length=100)
    problem_slug: Optional[str] = Field(None, max_length=100)
    language: str = Field(..., max_length=30)
    source_code: str = Field(..., max_length=200_000)


class PracticeAttemptBody(BaseModel):
    """A saved code snapshot."""
    language: str = Field("python", max_length=30)
    code: str = Field("", max_length=200_000)


class PracticeAnswerBody(BaseModel):
    """The option a student picked (either name is accepted; the frontend may send either)."""
    selected_option_index: Optional[int] = Field(None, ge=0, le=50)
    selected_option: Optional[int] = Field(None, ge=0, le=50)

class CodeSubmitResponse(BaseModel):
    status: str  # Accepted | Wrong Answer | Runtime Error | Time Limit Exceeded | Output Limit Exceeded | Compile Error | Judge unavailable
    passed_count: int = 0
    total_count: int = 0
    runtime_ms: int = 0
    memory_kb: Optional[int] = None
    expected_complexity: str = ""
    failed_case: Optional[int] = None      # 1-based number of the first failing test case
    failed_detail: Optional[Dict[str, Any]] = None  # input / your output / expected: ONLY when that case is a shown example
    message: str = ""
    compile_output: str = ""
    error_lines: List[int] = []
    stdout: str = ""
    stderr: str = ""
    test_results: List[Dict[str, Any]] = []  # [{case, passed, is_hidden, status}]: no data of hidden cases


class SubmissionOut(BaseModel):
    id: str
    language: str
    verdict: str
    runtime_ms: Optional[int] = None
    memory_kb: Optional[int] = None
    passed_count: Optional[int] = None
    total_count: Optional[int] = None
    created_at: datetime
    code: str


class HintOut(BaseModel):
    level: int
    total: int
    hint: str


# ---- daily challenge, streaks and "My submissions" ---------------------------------------------------------------------------------------
class DailyProblem(BaseModel):
    slug: str
    title: str
    difficulty: str
    topic: str = ""


class DailyChallengeOut(BaseModel):
    date: str                        # the UTC day this challenge belongs to
    problem: Optional[DailyProblem] = None
    solved_today: bool = False
    current_streak: int = 0
    best_streak: int = 0
    last_solved_day: Optional[str] = None
    day_offset_minutes: int = 0      # the student's stored day boundary (UTC shift), see services/daily_challenge_service.py


class BadgeOut(BaseModel):
    key: str
    label: str
    kind: str
    target: int
    progress: int
    earned: bool


class AchievementsOut(BaseModel):
    current_streak: int = 0
    best_streak: int = 0
    last_solved_day: Optional[str] = None
    problems_solved: int = 0
    badges: List[BadgeOut] = []
    day_offset_minutes: int = 0


class DayOffsetBody(BaseModel):
    day_offset_minutes: int = Field(..., ge=-720, le=840)


class SubmissionRow(BaseModel):
    id: str
    problem_slug: str
    problem_title: str
    difficulty: str = ""
    language: str
    verdict: str
    runtime_ms: Optional[int] = None
    passed_count: Optional[int] = None
    total_count: Optional[int] = None
    created_at: datetime


class SubmissionPage(BaseModel):
    items: List[SubmissionRow]
    total: int
    page: int
    page_size: int
    verdicts: List[str] = []
    languages: List[str] = []


class SubmissionDetail(SubmissionRow):
    code: str
    memory_kb: Optional[int] = None
