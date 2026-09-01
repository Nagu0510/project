import asyncio
import logging
from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorClient
from app.config import settings
from app.services.auth_service import hash_password
from app.data.career_config import get_all_career_paths
from app.data.assessment_bank import ASSESSMENT_QUESTION_BANK, ASSESSMENT_SETS
from app.routers.practice import EXPANDED_CODING_PROBLEMS

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("skillsense_seed")

SEED_USERS = [
    {
        "id": "usr-student-01",
        "name": "Nagappa Gongadi",
        "email": "nagappa@skillsense.ai",
        "password": hash_password("password123"),
        "role": "student",
        "college": "Engineering College",
        "department": "Computer Science & Engineering",
        "year": "Final Year (2026)",
        "career_goal": "Backend Developer",
        "career_interest": "Backend Developer",
        "current_path": "Backend Developer",
        "preferred_language": "Python 3",
        "skill_level": "Intermediate",
        "readiness_score": 87,
        "skill_progress": 74,
        "assessments_completed": 1,
        "strong_skills": ["Python", "SQL", "Java", "REST APIs"],
        "gap_skills": ["System Design", "Docker", "Kubernetes"],
        "created_at": datetime.utcnow(),
    },
    {
        "id": "usr-admin-01",
        "name": "SkillSense Admin",
        "email": "admin@skillsense.ai",
        "password": hash_password("admin123"),
        "role": "admin",
        "created_at": datetime.utcnow(),
    },
]

SEED_PREVIOUS_QUESTIONS = [
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
        "created_at": datetime.utcnow(),
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
        "created_at": datetime.utcnow(),
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
        "created_at": datetime.utcnow(),
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
        "created_at": datetime.utcnow(),
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
        "created_at": datetime.utcnow(),
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
        "created_at": datetime.utcnow(),
    },
]

SEED_QUESTION_PAPERS = [
    {
        "id": "qp-2025-01",
        "company": "TCS (Tata Consultancy Services)",
        "exam": "TCS NQT — National Qualifier Test",
        "year": 2025,
        "paper_type": "Mixed (MCQ + Coding)",
        "role": "Systems Engineer / Digital Cadre",
        "description": "Full placement question paper with coding problems and technical MCQ sections.",
        "questions_count": 48,
        "status": "Extracted",
        "uploaded_at": datetime.utcnow(),
    },
    {
        "id": "qp-2025-02",
        "company": "Infosys",
        "exam": "Infosys Specialist Programmer Assessment",
        "year": 2025,
        "paper_type": "Coding",
        "role": "Specialist Programmer (Power Programmer)",
        "description": "3 Advanced Data Structure and Dynamic Programming coding challenges.",
        "questions_count": 3,
        "status": "Extracted",
        "uploaded_at": datetime.utcnow(),
    },
    {
        "id": "qp-2024-03",
        "company": "Accenture",
        "exam": "Accenture Technical & Cognitive Assessment",
        "year": 2024,
        "paper_type": "Technical MCQ",
        "role": "Associate Software Engineer",
        "description": "50 Technical MCQs covering SQL, Pseudocode, Networking, and Cloud.",
        "questions_count": 50,
        "status": "Approved",
        "uploaded_at": datetime.utcnow(),
    },
]

async def seed_database():
    logger.info("Connecting to MongoDB for seeding...")
    client = AsyncIOMotorClient(settings.MONGODB_URL, serverSelectionTimeoutMS=2500)

    try:
        await client.admin.command('ping')
        db = client[settings.DATABASE_NAME]
        logger.info(f"MongoDB connected: {settings.DATABASE_NAME}")

        # Seed Users
        for u in SEED_USERS:
            await db["users"].update_one({"id": u["id"]}, {"$set": dict(u)}, upsert=True)
        logger.info(f"Seeded {len(SEED_USERS)} users.")

        # Seed 9 Career Paths
        career_paths = get_all_career_paths()
        for cp in career_paths:
            await db["career_paths"].update_one({"id": cp["id"]}, {"$set": dict(cp)}, upsert=True)
        logger.info(f"Seeded {len(career_paths)} career paths.")

        # Seed Assessment Sets
        for asm in ASSESSMENT_SETS:
            await db["assessments"].update_one({"id": asm["id"]}, {"$set": dict(asm)}, upsert=True)
        logger.info(f"Seeded {len(ASSESSMENT_SETS)} assessment sets.")

        # Seed Assessment Questions
        for q in ASSESSMENT_QUESTION_BANK:
            await db["assessment_questions"].update_one({"id": q["id"]}, {"$set": dict(q)}, upsert=True)
        logger.info(f"Seeded {len(ASSESSMENT_QUESTION_BANK)} assessment questions.")

        # Seed Coding Problems
        for p in EXPANDED_CODING_PROBLEMS:
            await db["practice_problems"].update_one({"slug": p["slug"]}, {"$set": dict(p)}, upsert=True)
        logger.info(f"Seeded {len(EXPANDED_CODING_PROBLEMS)} coding practice problems.")

        # Seed Previous Questions
        for pq in SEED_PREVIOUS_QUESTIONS:
            await db["previous_questions"].update_one({"id": pq["id"]}, {"$set": dict(pq)}, upsert=True)
        logger.info(f"Seeded {len(SEED_PREVIOUS_QUESTIONS)} previous questions.")

        # Seed Question Papers
        for qp in SEED_QUESTION_PAPERS:
            await db["question_papers"].update_one({"id": qp["id"]}, {"$set": dict(qp)}, upsert=True)
        logger.info(f"Seeded {len(SEED_QUESTION_PAPERS)} question papers.")

        client.close()
        logger.info("Database seeding completed successfully!")
    except Exception as e:
        logger.warning(f"Seeding notice: MongoDB connection not available ({e}). In-memory store will serve pre-seeded data automatically.")

if __name__ == "__main__":
    asyncio.run(seed_database())
