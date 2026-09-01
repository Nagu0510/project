from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime

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
    starter_code: Dict[str, str] = {
        "python": "# Python 3 Solution\nclass Solution:\n    def solve(self):\n        pass\n",
        "java": "// Java 21 Solution\nclass Solution {\n    public void solve() {\n    }\n}\n",
        "javascript": "// JavaScript Solution\nfunction solve() {\n}\n",
    }
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
    execution_available: bool = False
    message: str = "Code saved. Secure isolated execution runtime configured."
    timestamp: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        extra = "ignore"
