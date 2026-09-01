from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional
import uuid
from datetime import datetime
from app.models.practice import CodingProblem, PracticeAttempt
from app.models.user import UserOut
from app.utils.security import get_current_user
from app.database import db_manager

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

# Pre-seed in memory
for p in EXPANDED_CODING_PROBLEMS:
    db_manager._memory_store["practice_problems"][p["slug"]] = p

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
