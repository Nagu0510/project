from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime

from app.utils.timeutil import utcnow

class TestCase(BaseModel):
    input: str
    expected_output: str
    is_hidden: bool = False

    class Config:
        extra = "ignore"

class ProblemExample(BaseModel):
    input: str
    output: str
    explanation: Optional[str] = None

class CodingProblem(BaseModel):
    id: str
    title: str
    slug: str
    difficulty: str  # 'Easy' | 'Medium' | 'Hard'
    category: str
    topic: str
    description: str
    input_format: str = ""
    output_format: str = ""
    constraints: List[str] = []
    tags: List[str] = []
    starter_code: Dict[str, str] = {}
    sample_test_cases: List[TestCase] = []
    hidden_test_cases: List[TestCase] = []
    test_cases: List[TestCase] = []
    examples: List[ProblemExample] = []
    companies: List[str] = []
    appearances: int = 1
    hints: List[str] = []

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
    verdict: str = ""  # Accepted | Wrong Answer | Runtime Error | Time Limit Exceeded | Compile Error
    runtime_ms: Optional[int] = None
    timestamp: datetime = Field(default_factory=utcnow)

    class Config:
        extra = "ignore"

class CodeRunRequest(BaseModel):
    problem_id: Optional[str] = None
    problem_slug: Optional[str] = None
    language: str
    source_code: str
    stdin: Optional[str] = ""

class CodeRunResponse(BaseModel):
    status: str
    stdout: str
    stderr: str
    compile_output: Optional[str] = ""
    runtime_ms: int = 0
    memory_kb: Optional[int] = None  # not measured

class CodeSubmitRequest(BaseModel):
    problem_id: Optional[str] = None
    problem_slug: Optional[str] = None
    language: str
    source_code: str

class CodeSubmitResponse(BaseModel):
    status: str  # Accepted | Wrong Answer | Runtime Error | Time Limit Exceeded | Compile Error | Judge unavailable
    passed_count: int
    total_count: int
    stdout: str
    stderr: str
    compile_output: Optional[str] = ""
    runtime_ms: int = 0
    memory_kb: Optional[int] = None  # not measured
    test_results: List[Dict[str, Any]] = []
    failed_case: Optional[int] = None  # 1-based number of the first failing test case
    message: str = ""
