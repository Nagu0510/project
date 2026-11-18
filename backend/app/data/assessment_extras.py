"""Joins the authored questions to the legacy bank, tags them, and builds the new assessment sets.

Company tags (TCS, Infosys, ...) mean "pattern-inspired practice": original questions grouped by the languages that company's
online tests are known to emphasise. They are NOT real past questions. Only a question from an admin-uploaded paper may be called
a previous-year question.
"""
from typing import Dict, List

from app.data.questions_c_cpp import CPP_QUESTIONS, C_QUESTIONS
from app.data.questions_ml_dl import DL_QUESTIONS, ML_QUESTIONS
from app.data.questions_py_java_js import JAVA_QUESTIONS, JS_QUESTIONS, PY_QUESTIONS

AUTHORED_QUESTIONS = C_QUESTIONS + CPP_QUESTIONS + PY_QUESTIONS + JAVA_QUESTIONS + JS_QUESTIONS + ML_QUESTIONS + DL_QUESTIONS

COMPANIES = ["TCS", "Infosys", "Wipro", "Accenture", "Cognizant", "Capgemini", "Amazon"]
# company -> the skills its practice set draws on
COMPANY_SKILLS: Dict[str, List[str]] = {
    "TCS": ["C", "Python"],
    "Infosys": ["Python", "Java"],
    "Wipro": ["C++", "Java"],
    "Accenture": ["JavaScript", "Java"],
    "Cognizant": ["Python", "JavaScript"],
    "Capgemini": ["Java", "C"],
    "Amazon": ["C++", "Python", "Machine Learning"],
}

# skill -> topics the validator accepts (legacy topics included)
SKILL_TOPICS: Dict[str, List[str]] = {
    "C": ["Basics & Types", "Operators & Control Flow", "Pointers", "Arrays & Strings", "Functions & Recursion", "Memory Management", "Structs & Files", "Preprocessor"],
    "C++": ["Language Basics", "Classes & Objects", "Inheritance & Polymorphism", "References & Pointers", "Templates & STL", "Memory & RAII", "Operators & Overloading", "Exceptions"],
    "Python": ["Python Fundamentals", "Functions & Scope", "Collections & Generators", "OOP Principles", "OOP Architecture", "Advanced Python", "Concurrency & Architecture"],
    "Java": ["Java Fundamentals", "Java Core", "Collections Framework", "Exception Handling", "Concurrency & Multithreading"],
    "JavaScript": ["JavaScript Core", "Asynchronous JS"],
    "Machine Learning": ["ML Fundamentals", "Supervised Learning", "Model Evaluation", "Feature Engineering", "Unsupervised Learning", "Overfitting & Tuning", "Math for ML"],
    "Deep Learning & AI": ["Neural Networks", "Training & Optimization", "CNNs & Vision", "NLP & Transformers", "Generative AI"],
    "React": ["React Hooks", "React Internals", "React State"],
    "SQL & Databases": ["Database Architecture", "SQL Fundamentals", "SQL Queries", "Window Functions"],
    "DSA": ["Advanced Data Structures", "Algorithms", "Arrays & Hash Tables", "Linked Lists"],
    "AI / Machine Learning": ["Deep Learning & NLP", "Machine Learning", "Machine Learning Core"],
    "Cloud / DevOps": ["CI/CD Deployment", "Containerization", "Kubernetes Orchestration"],
}
QUESTION_TYPES = ["Conceptual", "Code Output", "Find the Error", "Scenario"]

# skill -> (set career path label, course slug)
SET_SKILLS = {
    "C": ("Backend Developer", "c-programming"),
    "C++": ("Backend Developer", "cpp-oop"),
    "Python": ("Python Developer", "python-programming"),
    "Java": ("Java Developer", "java-programming"),
    "JavaScript": ("Frontend Developer", "javascript-essentials"),
    "Machine Learning": ("Data Scientist", "machine-learning"),
    "Deep Learning & AI": ("AI / Machine Learning Engineer", "deep-learning-ai"),
}
SLUG = {"C": "c", "C++": "cpp", "Python": "py", "Java": "java", "JavaScript": "js", "Machine Learning": "ml", "Deep Learning & AI": "dl"}


def _tag_companies() -> None:
    """Spread company tags over each skill's authored questions (each question gets the companies whose set uses its skill, rotated)."""
    by_skill: Dict[str, List[dict]] = {}
    for question in AUTHORED_QUESTIONS:
        by_skill.setdefault(question["skill"], []).append(question)
    for skill, questions in by_skill.items():
        companies = [c for c in COMPANIES if skill in COMPANY_SKILLS[c]]
        if not companies:
            continue
        for i, question in enumerate(questions):
            take = companies if len(companies) <= 2 else [companies[i % len(companies)], companies[(i + 1) % len(companies)]]
            question["companies"] = sorted(set(take), key=COMPANIES.index)


def _course_sets() -> List[dict]:
    sets = []
    for skill, (career, course) in SET_SKILLS.items():
        pool = [q for q in AUTHORED_QUESTIONS if q["skill"] == skill]
        easy = [q["id"] for q in pool if q["difficulty"] == "Easy"]
        medium = [q["id"] for q in pool if q["difficulty"] == "Medium"]
        hard = [q["id"] for q in pool if q["difficulty"] == "Hard"]
        # 8 questions per set: Medium is 8 Medium; Easy and Hard use the 6 questions of their level plus 2 Medium ones
        layouts = {"Easy": (easy + medium[:2], 12), "Medium": (medium, 16), "Hard": (hard + medium[-2:], 20)}
        for difficulty, (ids, minutes) in layouts.items():
            sets.append({
                "id": f"asm-{SLUG[skill]}-{difficulty.lower()}",
                "title": f"{skill} ({difficulty})",
                "skill": skill, "career_path": career, "difficulty": difficulty,
                "questions_count": len(ids), "duration_minutes": minutes, "question_ids": ids,
                "course_slug": course, "origin": "authored",
            })
    return sets


def _company_sets() -> List[dict]:
    sets = []
    for company in COMPANIES:
        skills = COMPANY_SKILLS[company]
        per_skill = -(-20 // len(skills))  # ceil(20 / skills)
        ids: List[str] = []
        for skill in skills:
            tagged = [q for q in AUTHORED_QUESTIONS if q["skill"] == skill and company in q["companies"]]
            ids += [q["id"] for q in tagged[:per_skill]]
        ids = ids[:20]
        sets.append({
            "id": f"asm-co-{company.lower()}",
            "title": f"{company}-style: {' and '.join(skills)} ({len(ids)} questions)",
            "skill": " + ".join(skills), "career_path": "Placement Practice", "difficulty": "Mixed",
            "questions_count": len(ids), "duration_minutes": 30, "question_ids": ids,
            "company": company, "origin": "authored",
        })
    return sets


def extend(bank: List[dict], sets: List[dict]) -> None:
    """Called once at the end of assessment_bank.py."""
    for question in bank:  # legacy questions: fill the new fields, rename the old type label
        question.setdefault("origin", "authored")
        question.setdefault("practice", True)
        question.setdefault("companies", [])
        if question.get("question_type") == "Scenario Based":
            question["question_type"] = "Scenario"
    _tag_companies()
    bank.extend(AUTHORED_QUESTIONS)
    sets.extend(_course_sets())
    sets.extend(_company_sets())
