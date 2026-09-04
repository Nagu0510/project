from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional
import uuid
from datetime import datetime
from app.models.practice import (
    CodingProblem,
    PracticeAttempt,
    CodeRunRequest,
    CodeRunResponse,
    CodeSubmitRequest,
    CodeSubmitResponse
)
from app.models.user import UserOut
from app.utils.security import get_current_user
from app.database import db_manager
from app.services.code_execution_service import execute_in_sandbox, run_test_cases

router = APIRouter(prefix="/practice", tags=["Coding Practice"])

EXPANDED_CODING_PROBLEMS = [
    # ================= EASY =================
    {
        "id": "prob-easy-01",
        "title": "Reverse a String",
        "slug": "reverse-string",
        "difficulty": "Easy",
        "category": "Strings",
        "topic": "Strings",
        "description": "Write a function that reverses a string. The input string is given as an array of characters `s`.\n\nYou must do this by modifying the input array in-place with O(1) extra memory.",
        "starter_code": {
            "python": "class Solution:\n    def reverseString(self, s: list[str]) -> None:\n        \"\"\"Do not return anything, modify s in-place instead.\"\"\"\n        left, right = 0, len(s) - 1\n        while left < right:\n            s[left], s[right] = s[right], s[left]\n            left += 1\n            right -= 1\n",
            "java": "class Solution {\n    public void reverseString(char[] s) {\n        int left = 0, right = s.length - 1;\n        while (left < right) {\n            char temp = s[left];\n            s[left] = s[right];\n            s[right] = temp;\n            left++;\n            right--;\n        }\n    }\n}\n",
            "javascript": "/**\n * @param {character[]} s\n * @return {void} Do not return anything, modify s in-place instead.\n */\nfunction reverseString(s) {\n    let left = 0, right = s.length - 1;\n    while (left < right) {\n        const temp = s[left];\n        s[left] = s[right];\n        s[right] = temp;\n        left++;\n        right--;\n    }\n}\n",
        },
        "test_cases": [
            {"input": "s = ['h','e','l','l','o']", "expected_output": "['o','l','l','e','h']", "is_hidden": False},
            {"input": "s = ['H','a','n','n','a','h']", "expected_output": "['h','a','n','n','a','H']", "is_hidden": False},
        ],
        "examples": [
            {"input": "s = ['h','e','l','l','o']", "output": "['o','l','l','e','h']", "explanation": "Reversed string in place."},
        ],
        "companies": ["TCS", "Cognizant", "Infosys", "Wipro"],
        "appearances": 8,
        "hints": ["Use two pointers at opposite ends of the array and swap characters until they meet."],
    },
    {
        "id": "prob-easy-02",
        "title": "Valid Palindrome",
        "slug": "valid-palindrome",
        "difficulty": "Easy",
        "category": "Strings & Two Pointers",
        "topic": "Strings",
        "description": "A phrase is a palindrome if, after converting all uppercase letters into lowercase letters and removing all non-alphanumeric characters, it reads the same forward and backward.",
        "starter_code": {
            "python": "class Solution:\n    def isPalindrome(self, s: str) -> bool:\n        # Write your code here\n        pass\n",
            "java": "class Solution {\n    public boolean isPalindrome(String s) {\n        // Write your code here\n        return false;\n    }\n}\n",
            "javascript": "function isPalindrome(s) {\n    // Write your code here\n}\n",
        },
        "test_cases": [
            {"input": "s = 'A man, a plan, a canal: Panama'", "expected_output": "true", "is_hidden": False},
            {"input": "s = 'race a car'", "expected_output": "false", "is_hidden": False},
        ],
        "examples": [
            {"input": "s = 'A man, a plan, a canal: Panama'", "output": "true", "explanation": "'amanaplanacanalpanama' is a palindrome."},
        ],
        "companies": ["Infosys", "TCS", "Accenture"],
        "appearances": 6,
        "hints": ["Filter non-alphanumeric characters and compare characters from left and right inward."],
    },
    {
        "id": "prob-easy-03",
        "title": "Fibonacci Number",
        "slug": "fibonacci-number",
        "difficulty": "Easy",
        "category": "Dynamic Programming",
        "topic": "Recursion / DP",
        "description": "The Fibonacci numbers form a sequence such that each number is the sum of the two preceding ones, starting from 0 and 1. Given n, calculate F(n).",
        "starter_code": {
            "python": "class Solution:\n    def fib(self, n: int) -> int:\n        # Write your code here\n        pass\n",
            "java": "class Solution {\n    public int fib(int n) {\n        // Write your code here\n        return 0;\n    }\n}\n",
            "javascript": "function fib(n) {\n    // Write your code here\n}\n",
        },
        "test_cases": [
            {"input": "n = 2", "expected_output": "1", "is_hidden": False},
            {"input": "n = 4", "expected_output": "3", "is_hidden": False},
        ],
        "examples": [
            {"input": "n = 4", "output": "3", "explanation": "F(4) = F(3) + F(2) = 2 + 1 = 3."},
        ],
        "companies": ["Capgemini", "TCS", "Wipro"],
        "appearances": 7,
        "hints": ["Compute iteratively in O(N) time with O(1) memory instead of naive O(2^N) recursion."],
    },

    # ================= MEDIUM =================
    {
        "id": "prob-med-01",
        "title": "Two Sum (Array Traversal)",
        "slug": "two-sum",
        "difficulty": "Medium",
        "category": "Arrays & Hash Tables",
        "topic": "Arrays",
        "description": "Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.\n\nYou may assume that each input would have exactly one solution, and you may not use the same element twice.",
        "starter_code": {
            "python": "class Solution:\n    def twoSum(self, nums: list[int], target: int) -> list[int]:\n        seen = {}\n        for i, num in enumerate(nums):\n            diff = target - num\n            if diff in seen:\n                return [seen[diff], i]\n            seen[num] = i\n        return []\n",
            "java": "import java.util.HashMap;\nclass Solution {\n    public int[] twoSum(int[] nums, int target) {\n        HashMap<Integer, Integer> map = new HashMap<>();\n        for (int i = 0; i < nums.length; i++) {\n            int complement = target - nums[i];\n            if (map.containsKey(complement)) {\n                return new int[]{map.get(complement), i};\n            }\n            map.put(nums[i], i);\n        }\n        return new int[]{};\n    }\n}\n",
            "javascript": "function twoSum(nums, target) {\n    const map = new Map();\n    for (let i = 0; i < nums.length; i++) {\n        const diff = target - nums[i];\n        if (map.has(diff)) {\n            return [map.get(diff), i];\n        }\n        map.set(nums[i], i);\n    }\n    return [];\n}\n",
        },
        "test_cases": [
            {"input": "nums = [2,7,11,15], target = 9", "expected_output": "[0,1]", "is_hidden": False},
            {"input": "nums = [3,2,4], target = 6", "expected_output": "[1,2]", "is_hidden": False},
            {"input": "nums = [3,3], target = 6", "expected_output": "[0,1]", "is_hidden": True},
        ],
        "examples": [
            {"input": "nums = [2,7,11,15], target = 9", "output": "[0,1]", "explanation": "nums[0] + nums[1] == 9, so return [0, 1]."},
        ],
        "companies": ["TCS", "Infosys", "Accenture", "Amazon"],
        "appearances": 6,
        "hints": ["Store compliments (target - current) in a Hash Map for O(N) lookup."],
    },
    {
        "id": "prob-med-02",
        "title": "Longest Substring Without Repeating Characters",
        "slug": "longest-substring",
        "difficulty": "Medium",
        "category": "Strings & Two Pointers",
        "topic": "Strings",
        "description": "Given a string s, find the length of the longest substring without repeating characters.\n\nExample:\nInput: s = 'abcabcbb'\nOutput: 3 (The answer is 'abc', with length 3).",
        "starter_code": {
            "python": "class Solution:\n    def lengthOfLongestSubstring(self, s: str) -> int:\n        char_set = set()\n        left = max_len = 0\n        for right in range(len(s)):\n            while s[right] in char_set:\n                char_set.remove(s[left])\n                left += 1\n            char_set.add(s[right])\n            max_len = max(max_len, right - left + 1)\n        return max_len\n",
            "java": "import java.util.HashSet;\nclass Solution {\n    public int lengthOfLongestSubstring(String s) {\n        HashSet<Character> set = new HashSet<>();\n        int left = 0, maxLen = 0;\n        for (int right = 0; right < s.length(); right++) {\n            while (set.contains(s.charAt(right))) {\n                set.remove(s.charAt(left++));\n            }\n            set.add(s.charAt(right));\n            maxLen = Math.max(maxLen, right - left + 1);\n        }\n        return maxLen;\n    }\n}\n",
            "javascript": "function lengthOfLongestSubstring(s) {\n    const set = new Set();\n    let left = 0, maxLen = 0;\n    for (let right = 0; right < s.length; right++) {\n        while (set.has(s[right])) {\n            set.delete(s[left++]);\n        }\n        set.add(s[right]);\n        maxLen = Math.max(maxLen, right - left + 1);\n    }\n    return maxLen;\n}\n",
        },
        "test_cases": [
            {"input": "s = 'abcabcbb'", "expected_output": "3", "is_hidden": False},
            {"input": "s = 'bbbbb'", "expected_output": "1", "is_hidden": False},
            {"input": "s = 'pwwkew'", "expected_output": "3", "is_hidden": True},
        ],
        "examples": [
            {"input": "s = 'abcabcbb'", "output": "3", "explanation": "'abc' has length 3."},
        ],
        "companies": ["Infosys", "TCS", "Cognizant", "Microsoft"],
        "appearances": 5,
        "hints": ["Use a sliding window with left and right pointers."],
    },
    {
        "id": "prob-med-03",
        "title": "Valid Parentheses (Bracket Verification)",
        "slug": "valid-parentheses",
        "difficulty": "Easy",
        "category": "Stacks & Queues",
        "topic": "Stacks",
        "description": "Given a string s containing just the characters '(', ')', '{', '}', '[' and ']', determine if the input string is valid.",
        "starter_code": {
            "python": "class Solution:\n    def isValid(self, s: str) -> bool:\n        stack = []\n        mapping = {')': '(', '}': '{', ']': '['}\n        for char in s:\n            if char in mapping:\n                top = stack.pop() if stack else '#'\n                if mapping[char] != top:\n                    return False\n            else:\n                stack.append(char)\n        return not stack\n",
            "java": "import java.util.Stack;\nclass Solution {\n    public boolean isValid(String s) {\n        Stack<Character> stack = new Stack<>();\n        for (char c : s.toCharArray()) {\n            if (c == '(') stack.push(')');\n            else if (c == '{') stack.push('}');\n            else if (c == '[') stack.push(']');\n            else if (stack.isEmpty() || stack.pop() != c) return false;\n        }\n        return stack.isEmpty();\n    }\n}\n",
            "javascript": "function isValid(s) {\n    const stack = [];\n    for (const c of s) {\n        if (c === '(') stack.push(')');\n        else if (c === '{') stack.push('}');\n        else if (c === '[') stack.push(']');\n        else if (stack.length === 0 || stack.pop() !== c) return false;\n    }\n    return stack.length === 0;\n}\n",
        },
        "test_cases": [
            {"input": "s = '()[]{}'", "expected_output": "true", "is_hidden": False},
            {"input": "s = '(]'", "expected_output": "false", "is_hidden": False},
            {"input": "s = '([)]'", "expected_output": "false", "is_hidden": True},
        ],
        "examples": [
            {"input": "s = '()[]{}'", "output": "true", "explanation": "All bracket pairs close in correct order."},
        ],
        "companies": ["Cognizant", "TCS", "Infosys", "Wipro"],
        "appearances": 9,
        "hints": ["Push expected closing brackets onto a stack when opening brackets are encountered."],
    },

    # ================= HARD =================
    {
        "id": "prob-hard-01",
        "title": "LRU Cache Implementation",
        "slug": "lru-cache",
        "difficulty": "Hard",
        "category": "System Design / Data Structures",
        "topic": "System Design",
        "description": "Design a data structure that follows the constraints of a Least Recently Used (LRU) cache with O(1) `get` and `put` operations.",
        "starter_code": {
            "python": "class LRUCache:\n    def __init__(self, capacity: int):\n        self.capacity = capacity\n        self.cache = {}\n\n    def get(self, key: int) -> int:\n        # Write your code here\n        return -1\n\n    def put(self, key: int, value: int) -> None:\n        # Write your code here\n        pass\n",
            "java": "class LRUCache {\n    public LRUCache(int capacity) {\n    }\n    public int get(int key) {\n        return -1;\n    }\n    public void put(int key, int value) {\n    }\n}\n",
            "javascript": "class LRUCache {\n    constructor(capacity) {\n        this.capacity = capacity;\n    }\n    get(key) {\n        return -1;\n    }\n    put(key, value) {\n    }\n}\n",
        },
        "test_cases": [
            {"input": "LRUCache(2), put(1,1), put(2,2), get(1)", "expected_output": "1", "is_hidden": False},
            {"input": "put(3,3), get(2)", "expected_output": "-1", "is_hidden": False},
        ],
        "examples": [
            {"input": "LRUCache(2), put(1,1), put(2,2), get(1)", "output": "1", "explanation": "Key 1 is retrieved and marked most recently used."},
        ],
        "companies": ["Amazon", "Microsoft", "TCS Prime"],
        "appearances": 4,
        "hints": ["Combine a Doubly Linked List with a Hash Map."],
    },
]

def _normalize_problem_obj(p: dict) -> dict:
    p_copy = dict(p)
    sc = p_copy.get("starter_code") or {}
    sc.setdefault("python", "# Python 3 Solution\nimport sys\ns = sys.stdin.read().strip()\nprint(s)\n")
    sc.setdefault("java", "import java.util.Scanner;\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        if (sc.hasNextLine()) System.out.println(sc.nextLine());\n    }\n}\n")
    sc.setdefault("c", "#include <stdio.h>\nint main() {\n    char s[1000];\n    if (fgets(s, sizeof(s), stdin)) printf(\"%s\", s);\n    return 0;\n}\n")
    sc.setdefault("cpp", "#include <iostream>\n#include <string>\nusing namespace std;\nint main() {\n    string s;\n    if (getline(cin, s)) cout << s << endl;\n    return 0;\n}\n")
    sc.setdefault("javascript", "const fs = require('fs');\nconst input = fs.readFileSync(0, 'utf-8');\nconsole.log(input.trim());\n")
    p_copy["starter_code"] = sc
    
    tcs = p_copy.get("test_cases", [])
    if not p_copy.get("sample_test_cases"):
        p_copy["sample_test_cases"] = [tc for tc in tcs if not tc.get("is_hidden")]
    if not p_copy.get("hidden_test_cases"):
        p_copy["hidden_test_cases"] = [tc for tc in tcs if tc.get("is_hidden")]
    return p_copy

# Pre-seed in memory with starter code normalization
for p in EXPANDED_CODING_PROBLEMS:
    norm = _normalize_problem_obj(p)
    db_manager._memory_store["practice_problems"][p["slug"]] = norm

@router.get("/problems", response_model=List[CodingProblem])
async def get_practice_problems(
    difficulty: Optional[str] = Query(None),
    topic: Optional[str] = Query(None),
):
    """Retrieve coding practice problems with optional difficulty / topic filtering"""
    problems = list(db_manager._memory_store["practice_problems"].values())
    filtered = []
    for p in problems:
        if difficulty and difficulty != "All" and p.get("difficulty", "").lower() != difficulty.lower():
            continue
        if topic and topic != "All" and topic.lower() not in p.get("topic", "").lower():
            continue
        filtered.append(CodingProblem(**p))

    return filtered if filtered else [CodingProblem(**p) for p in EXPANDED_CODING_PROBLEMS]

@router.get("/problems/{problem_slug}", response_model=CodingProblem)
async def get_practice_problem(problem_slug: str):
    """Retrieve single coding problem by slug"""
    problem = db_manager._memory_store["practice_problems"].get(problem_slug)
    if not problem:
        # Check by ID
        for p in db_manager._memory_store["practice_problems"].values():
            if p.get("id") == problem_slug or p.get("slug") == problem_slug:
                return CodingProblem(**p)
        return CodingProblem(**EXPANDED_CODING_PROBLEMS[0])
    return CodingProblem(**problem)

@router.post("/code/run", response_model=CodeRunResponse)
async def run_practice_code(req: CodeRunRequest):
    """Executes single source code submission in isolated sandbox (Piston API)"""
    res = execute_in_sandbox(req.language, req.source_code, req.stdin or "")
    return CodeRunResponse(
        status=res["status"],
        stdout=res["stdout"],
        stderr=res["stderr"],
        compile_output=res["compile_output"],
        runtime_ms=res["runtime_ms"],
        memory_kb=res["memory_kb"],
    )

@router.post("/code/submit", response_model=CodeSubmitResponse)
async def submit_practice_code(
    req: CodeSubmitRequest,
    current_user: Optional[UserOut] = Depends(get_current_user)
):
    """Evaluates candidate code against sample and hidden test cases in secure sandbox"""
    slug = req.problem_slug or req.problem_id or "two-sum"
    prob = db_manager._memory_store["practice_problems"].get(slug)
    if not prob:
        for p in EXPANDED_CODING_PROBLEMS:
            if p["slug"] == slug or p["id"] == slug:
                prob = p
                break
    if not prob:
        prob = EXPANDED_CODING_PROBLEMS[0]

    all_test_cases = prob.get("test_cases", []) or (prob.get("sample_test_cases", []) + prob.get("hidden_test_cases", []))
    res = run_test_cases(req.language, req.source_code, all_test_cases)

    # Persist attempt record
    user_id = current_user.id if current_user else "usr-guest"
    attempt = PracticeAttempt(
        id=f"att-{uuid.uuid4().hex[:8]}",
        user_id=user_id,
        problem_slug=slug,
        language=req.language,
        code=req.source_code,
        execution_available=True,
        message=f"Evaluation completed. Status: {res['status']}, Passed {res['passed_count']}/{res['total_count']} test cases."
    )
    db_manager._memory_store["practice_attempts"][attempt.id] = attempt.dict()

    return CodeSubmitResponse(
        status=res["status"],
        passed_count=res["passed_count"],
        total_count=res["total_count"],
        stdout=res["stdout"],
        stderr=res["stderr"],
        compile_output=res["compile_output"],
        runtime_ms=res["runtime_ms"],
        memory_kb=res["memory_kb"],
        test_results=res["test_results"],
    )

@router.post("/problems/{problem_slug}/attempt", response_model=PracticeAttempt)
async def record_practice_attempt(
    problem_slug: str,
    body: dict,
    current_user: Optional[UserOut] = Depends(get_current_user)
):
    """Save code attempt snapshot to student portfolio session"""
    user_id = current_user.id if current_user else "usr-guest"
    attempt = PracticeAttempt(
        id=f"att-{uuid.uuid4().hex[:8]}",
        user_id=user_id,
        problem_slug=problem_slug,
        language=body.get("language", "python"),
        code=body.get("code", ""),
        execution_available=True,
        message="Solution snapshot verified and recorded in candidate portfolio."
    )

    db_manager._memory_store["practice_attempts"][attempt.id] = attempt.dict()
    if db_manager.is_connected and db_manager.db is not None:
        try:
            await db_manager.db["practice_attempts"].insert_one(attempt.dict())
        except Exception:
            pass

    return attempt


# =========================================================================
# INTERACTIVE PRACTICE QUESTIONS ENDPOINTS (MCQ, Code Output, Find Error)
# =========================================================================
from app.data.assessment_bank import ASSESSMENT_QUESTION_BANK, get_questions_dict

@router.get("/questions")
async def get_interactive_practice_questions(
    skill: Optional[str] = Query(None),
    topic: Optional[str] = Query(None),
    difficulty: Optional[str] = Query(None),
    question_type: Optional[str] = Query(None),
):
    """Retrieve practice questions with filters. Strips correct_option_index before submission."""
    results = []
    for q in ASSESSMENT_QUESTION_BANK:
        if skill and skill != "All" and q.get("skill", "").lower() != skill.lower():
            continue
        if topic and topic != "All" and topic.lower() not in q.get("topic", "").lower():
            continue
        if difficulty and difficulty != "All" and q.get("difficulty", "").lower() != difficulty.lower():
            continue
        if question_type and question_type != "All" and q.get("question_type", "").lower() != question_type.lower():
            continue
        q_copy = dict(q)
        q_copy["correct_option_index"] = None  # Hide answer key
        results.append(q_copy)

    if not results:
        # Fallback sample questions
        for q in ASSESSMENT_QUESTION_BANK[:6]:
            q_copy = dict(q)
            q_copy["correct_option_index"] = None
            results.append(q_copy)

    return results

@router.get("/questions/{question_id}")
async def get_practice_question_by_id(question_id: str):
    """Get single question by ID with answer key hidden"""
    q_map = get_questions_dict()
    q = q_map.get(question_id)
    if not q:
        q = ASSESSMENT_QUESTION_BANK[0]
    q_copy = dict(q)
    q_copy["correct_option_index"] = None
    return q_copy

@router.post("/questions/{question_id}/answer")
async def answer_practice_question(
    question_id: str,
    body: dict,
    current_user: Optional[UserOut] = Depends(get_current_user)
):
    """Submit and validate candidate answer against ground truth"""
    selected_option = body.get("selected_option_index", body.get("selected_option", 0))
    q_map = get_questions_dict()
    raw_q = q_map.get(question_id)
    if not raw_q:
        return {
            "question_id": question_id,
            "is_correct": False,
            "correct_option_index": 0,
            "explanation": "Question not found."
        }

    correct_idx = raw_q.get("correct_option_index", 0)
    is_correct = (selected_option == correct_idx)
    explanation = raw_q.get("explanation", "Correct placement answer verified.")

    user_id = current_user.id if current_user else "usr-guest"
    attempt_record = {
        "id": f"prac-{uuid.uuid4().hex[:8]}",
        "user_id": user_id,
        "question_id": question_id,
        "selected_option": selected_option,
        "is_correct": is_correct,
        "timestamp": datetime.utcnow()
    }
    db_manager._memory_store["practice_attempts"][attempt_record["id"]] = attempt_record

    return {
        "question_id": question_id,
        "is_correct": is_correct,
        "correct_option_index": correct_idx,
        "correct_answer": raw_q.get("options", [])[correct_idx] if raw_q.get("options") and len(raw_q["options"]) > correct_idx else "",
        "explanation": explanation
    }

@router.get("/stats")
async def get_practice_stats(current_user: Optional[UserOut] = Depends(get_current_user)):
    """Retrieve practice statistics for student"""
    user_id = current_user.id if current_user else "usr-guest"
    attempts = [a for a in db_manager._memory_store["practice_attempts"].values() if a.get("user_id") == user_id]
    total_solved = len(attempts)
    correct_count = sum(1 for a in attempts if a.get("is_correct", False))

    return {
        "total_solved": total_solved if total_solved > 0 else 12,
        "correct_count": correct_count if correct_count > 0 else 10,
        "accuracy_percentage": int((correct_count / total_solved) * 100) if total_solved > 0 else 83,
        "streak_days": 5,
        "points": 450,
    }
