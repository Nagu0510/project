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
        "python": "# Python 3 Solution\nprint('Hello World')\n",
        "java": "public class Main {\n    public static void main(String[] args) {\n        System.out.println(\"Hello World\");\n    }\n}\n",
        "c": "#include <stdio.h>\n\nint main() {\n    printf(\"Hello World\\n\");\n    return 0;\n}\n",
        "cpp": "#include <iostream>\nusing namespace std;\n\nint main() {\n    cout << \"Hello World\" << endl;\n    return 0;\n}\n",
        "javascript": "// JavaScript Solution\nconsole.log('Hello World');\n",
    }
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
    timestamp: datetime = Field(default_factory=datetime.utcnow)

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
    memory_kb: int = 0

class CodeSubmitRequest(BaseModel):
    problem_id: Optional[str] = None
    problem_slug: Optional[str] = None
    language: str
    source_code: str

class CodeSubmitResponse(BaseModel):
    status: str  # 'Accepted' | 'Wrong Answer' | 'Compile Error' | 'Runtime Error'
    passed_count: int
    total_count: int
    stdout: str
    stderr: str
    compile_output: Optional[str] = ""
    runtime_ms: int = 0
    memory_kb: int = 0
    test_results: List[Dict[str, Any]] = []
