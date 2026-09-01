from fastapi import APIRouter, HTTPException, Query, Depends
from typing import List, Optional
from app.models.question_paper import QuestionMatchRequest, QuestionMatchResponse, PreviousQuestion
from app.services.question_matching_service import find_historical_question_match
from app.database import db_manager

router = APIRouter(tags=["Question Intelligence"])

COMPANIES_DATA = {
    "tcs": {
        "name": "Tata Consultancy Services (TCS)",
        "exam_patterns": ["TCS NQT (National Qualifier Test)", "TCS Digital Cadre", "TCS Prime Assessment"],
        "difficulty": "Medium",
        "total_questions": 1240,
        "top_topics": [
            {"topic": "Data Structures & Algorithms", "percentage": 38},
            {"topic": "Quantitative & Numerical Ability", "percentage": 30},
            {"topic": "Core Java / Python", "percentage": 18},
            {"topic": "SQL & DBMS Queries", "percentage": 14},
        ],
    },
    "infosys": {
        "name": "Infosys",
        "exam_patterns": ["Infosys Online Assessment", "Power Programmer Coding Round", "Specialist Programmer Drive"],
        "difficulty": "Medium-High",
        "total_questions": 890,
        "top_topics": [
            {"topic": "Greedy Algorithms & DP", "percentage": 42},
            {"topic": "Strings & Matrix Manipulation", "percentage": 28},
            {"topic": "Object Oriented Architecture", "percentage": 16},
            {"topic": "Database Indexing & Joins", "percentage": 14},
        ],
    },
    "accenture": {
        "name": "Accenture",
        "exam_patterns": ["Cognitive & Technical Assessment", "Coding Round Assessment", "Discovery Cadre Test"],
        "difficulty": "Medium",
        "total_questions": 710,
        "top_topics": [
            {"topic": "Arrays & Hash Table Traversal", "percentage": 35},
            {"topic": "Pseudocode & Bit Manipulation", "percentage": 25},
            {"topic": "Cloud & Security Fundamentals", "percentage": 22},
            {"topic": "SQL Relational Algebra", "percentage": 18},
        ],
    },
    "cognizant": {
        "name": "Cognizant",
        "exam_patterns": ["GenC Assessment", "GenC Elevate Coding Test", "GenC Next Advanced Track"],
        "difficulty": "Medium",
        "total_questions": 640,
        "top_topics": [
            {"topic": "Array Sorting & Stacks", "percentage": 34},
            {"topic": "Database Normalization", "percentage": 26},
            {"topic": "Aptitude & Logical Logic", "percentage": 22},
            {"topic": "Web Programming Fundamentals", "percentage": 18},
        ],
    },
}

INITIAL_PREVIOUS_QUESTIONS = [
    {
        "id": "prev-q-01",
        "title": "Two Sum (Array Traversal)",
        "problem_slug": "two-sum",
        "question_text": "Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.",
        "normalized_text": "given an array of integers nums and an integer target return indices of the two numbers such that they add up to target",
        "company": "TCS",
        "companies": ["TCS", "Infosys", "Accenture"],
        "exam": "TCS NQT — 2025",
        "exam_origin": "TCS NQT — 2025",
        "year": 2025,
        "role": "Systems Engineer / Digital Cadre",
        "topic": "Arrays",
        "subtopic": "Hash Map Traversal",
        "difficulty": "Medium",
        "question_type": "Coding",
        "frequency": 6,
        "appearances": 6,
        "badge": "Top Repeated",
        "badge_type": "lime",
        "description": "Appeared in TCS NQT 2025, Infosys Online Test 2024, and Accenture Coding Round 2026 with slight variable name variations.",
        "similarity": 94,
        "status": "published",
        "historical_occurrences": [
            {"company": "Infosys", "exam": "Online Test", "year": "2024"},
            {"company": "Accenture", "exam": "Coding Round", "year": "2026"},
            {"company": "Cognizant", "exam": "GenC Next", "year": "2025"},
        ],
    },
    {
        "id": "prev-q-02",
        "title": "Longest Substring Without Repeating Characters",
        "problem_slug": "longest-substring",
        "question_text": "Given a string s, find the length of the longest substring without duplicate characters using a sliding window.",
        "normalized_text": "given a string s find the length of the longest substring without duplicate characters using a sliding window",
        "company": "Infosys",
        "companies": ["Infosys", "TCS", "Cognizant"],
        "exam": "Infosys Online Assessment — 2026",
        "exam_origin": "Infosys Online Assessment — 2026",
        "year": 2026,
        "role": "Specialist Programmer",
        "topic": "Strings",
        "subtopic": "Sliding Window",
        "difficulty": "Medium",
        "question_type": "Coding",
        "frequency": 5,
        "appearances": 5,
        "badge": "Frequently Asked",
        "badge_type": "lime",
        "description": "High-frequency string manipulation problem with two pointers sliding window approach.",
        "similarity": 91,
        "status": "published",
        "historical_occurrences": [
            {"company": "TCS", "exam": "Digital Cadre", "year": "2025"},
            {"company": "Cognizant", "exam": "GenC Elevate", "year": "2024"},
        ],
    },
    {
        "id": "prev-q-03",
        "title": "Valid Parentheses (Bracket Matching)",
        "problem_slug": "valid-parentheses",
        "question_text": "Given a string s containing just the characters '(', ')', '{', '}', '[' and ']', determine if the input string is valid.",
        "normalized_text": "given a string s containing just the characters determine if the input string is valid stack",
        "company": "Cognizant",
        "companies": ["Cognizant", "TCS", "Infosys", "Wipro"],
        "exam": "Cognizant GenC — 2025",
        "exam_origin": "Cognizant GenC — 2025",
        "year": 2025,
        "role": "Associate Software Engineer",
        "topic": "Stacks",
        "subtopic": "LIFO Evaluation",
        "difficulty": "Easy",
        "question_type": "Coding",
        "frequency": 9,
        "appearances": 9,
        "badge": "Universal Classic",
        "badge_type": "emerald",
        "description": "Appeared in nearly every major campus recruitment test across Cognizant, TCS, and Infosys.",
        "similarity": 96,
        "status": "published",
        "historical_occurrences": [
            {"company": "TCS", "exam": "NQT", "year": "2024"},
            {"company": "Infosys", "exam": "Online Test", "year": "2025"},
            {"company": "Wipro", "exam": "Elite NLTH", "year": "2025"},
        ],
    },
    {
        "id": "prev-q-04",
        "title": "Reverse a Singly Linked List",
        "problem_slug": "reverse-linked-list",
        "question_text": "Given the head of a singly linked list, reverse the list, and return the reversed list iteratively or recursively.",
        "normalized_text": "given the head of a singly linked list reverse the list and return the reversed list iteratively or recursively",
        "company": "Accenture",
        "companies": ["Accenture", "TCS", "Capgemini"],
        "exam": "Accenture Technical Assessment — 2025",
        "exam_origin": "Accenture Technical Assessment — 2025",
        "year": 2025,
        "role": "Associate Software Engineer",
        "topic": "Linked Lists",
        "subtopic": "Pointer Manipulation",
        "difficulty": "Easy",
        "question_type": "Coding",
        "frequency": 7,
        "appearances": 7,
        "badge": "Core Foundational",
        "badge_type": "emerald",
        "description": "Classic pointer reversal problem frequently featured in initial placement coding screening.",
        "similarity": 95,
        "status": "published",
        "historical_occurrences": [
            {"company": "TCS", "exam": "NQT", "year": "2024"},
            {"company": "Capgemini", "exam": "Exceller", "year": "2025"},
        ],
    },
    {
        "id": "prev-q-05",
        "title": "SQL Department Highest Salary (Subquery / Window)",
        "problem_slug": "sql-department-salary",
        "question_text": "Write a SQL query to find employees who have the highest salary in each of the departments using DENSE_RANK() or subquery.",
        "normalized_text": "write a sql query to find employees who have the highest salary in each of the departments using dense rank or subquery",
        "company": "Accenture",
        "companies": ["Accenture", "TCS", "Deloitte"],
        "exam": "Accenture Technical MCQ — 2025",
        "exam_origin": "Accenture Technical MCQ — 2025",
        "year": 2025,
        "role": "Associate Software Engineer",
        "topic": "SQL & Databases",
        "subtopic": "Window Functions & Grouping",
        "difficulty": "Medium",
        "question_type": "MCQ",
        "frequency": 7,
        "appearances": 7,
        "badge": "High Frequency",
        "badge_type": "lime",
        "description": "Essential SQL query challenge testing knowledge of grouping, aggregate functions, and window ranking.",
        "similarity": 88,
        "status": "published",
        "historical_occurrences": [
            {"company": "TCS", "exam": "Digital Drive", "year": "2024"},
            {"company": "Deloitte", "exam": "National Drive", "year": "2025"},
        ],
    },
    {
        "id": "prev-q-06",
        "title": "LRU Cache Implementation",
        "problem_slug": "lru-cache",
        "question_text": "Design a data structure that follows the constraints of a Least Recently Used (LRU) cache with O(1) get and put operations.",
        "normalized_text": "design a data structure that follows the constraints of a least recently used lru cache with o1 get and put operations",
        "company": "Amazon",
        "companies": ["Amazon", "Microsoft", "TCS Prime"],
        "exam": "Amazon SDE-1 OA — 2024",
        "exam_origin": "Amazon SDE-1 OA — 2024",
        "year": 2024,
        "role": "Software Development Engineer (SDE-1)",
        "topic": "System Design & Architecture",
        "subtopic": "Doubly Linked List + Hash Map",
        "difficulty": "Hard",
        "question_type": "Coding",
        "frequency": 4,
        "appearances": 4,
        "badge": "Tier-1 Exclusive",
        "badge_type": "forest",
        "description": "Advanced problem combining hash map and doubly linked list data structures for constant time operations.",
        "similarity": 85,
        "status": "published",
        "historical_occurrences": [
            {"company": "Microsoft", "exam": "University Drive", "year": "2024"},
            {"company": "TCS Prime", "exam": "Prime Cadre", "year": "2025"},
        ],
    },
]

# Pre-seed previous questions
for q in INITIAL_PREVIOUS_QUESTIONS:
    db_manager._memory_store["previous_questions"][q["id"]] = q

@router.post("/question-intelligence/match", response_model=QuestionMatchResponse)
async def match_question(req: QuestionMatchRequest):
    result = find_historical_question_match(req.question_text, req.topic)
    return result

@router.get("/question-intelligence/companies")
async def get_companies():
    return COMPANIES_DATA

@router.get("/question-intelligence/company/{company_id}")
async def get_company_intelligence(company_id: str):
    cid = company_id.lower().strip()
    if cid in COMPANIES_DATA:
        return COMPANIES_DATA[cid]
    return COMPANIES_DATA["tcs"]

@router.get("/previous-questions", response_model=List[PreviousQuestion])
async def get_previous_questions(
    company: Optional[str] = Query(None),
    year: Optional[int] = Query(None),
    topic: Optional[str] = Query(None),
    difficulty: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
):
    questions = list(db_manager._memory_store["previous_questions"].values())

    if db_manager.is_connected and db_manager.db is not None:
        try:
            query = {"status": {"$in": ["approved", "published"]}}
            if company and company != "All":
                query["companies"] = company
            if year:
                query["year"] = year
            if topic and topic != "All":
                query["topic"] = {"$regex": topic, "$options": "i"}
            if difficulty and difficulty != "All":
                query["difficulty"] = difficulty
            if search:
                query["$or"] = [
                    {"title": {"$regex": search, "$options": "i"}},
                    {"topic": {"$regex": search, "$options": "i"}},
                    {"exam_origin": {"$regex": search, "$options": "i"}},
                ]

            cursor = db_manager.db["previous_questions"].find(query)
            db_qs = await cursor.to_list(length=200)
            if db_qs:
                return [PreviousQuestion(**q) for q in db_qs]
        except Exception:
            pass

    # Filter in-memory fallback
    filtered = []
    for q in questions:
        if company and company != "All" and company not in q.get("companies", [q.get("company")]):
            continue
        if year and q.get("year") != year:
            continue
        if topic and topic != "All" and topic.lower() not in q.get("topic", "").lower():
            continue
        if difficulty and difficulty != "All" and q.get("difficulty") != difficulty:
            continue
        if search:
            s_clean = search.lower()
            if not (s_clean in q.get("title", "").lower() or s_clean in q.get("topic", "").lower() or s_clean in q.get("exam_origin", "").lower()):
                continue
        filtered.append(PreviousQuestion(**q))

    return filtered
