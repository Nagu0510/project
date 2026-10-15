import re
import json
import uuid
from typing import List, Dict, Any
from app.models.question_paper import ExtractedQuestion

TOPICS_TAXONOMY = {
    "array": ("Arrays & Data Structures", "Arrays"),
    "vector": ("Arrays & Data Structures", "Dynamic Arrays"),
    "hash": ("Arrays & Data Structures", "Hash Maps"),
    "map": ("Arrays & Data Structures", "Hash Maps"),
    "string": ("Strings & Algorithms", "Pattern Matching"),
    "substring": ("Strings & Algorithms", "Sliding Window"),
    "palindrome": ("Strings & Algorithms", "Two Pointers"),
    "stack": ("Stacks & Queues", "LIFO Operations"),
    "queue": ("Stacks & Queues", "FIFO Operations"),
    "linked list": ("Linked Lists", "Pointers"),
    "tree": ("Trees & Binary Search Trees", "Tree Traversal"),
    "bst": ("Trees & Binary Search Trees", "Search Trees"),
    "graph": ("Graphs & BFS/DFS", "Graph Traversal"),
    "bfs": ("Graphs & BFS/DFS", "Breadth First Search"),
    "dfs": ("Graphs & BFS/DFS", "Depth First Search"),
    "dijkstra": ("Graphs & BFS/DFS", "Shortest Path"),
    "dp": ("Dynamic Programming", "Memoization & Tabulation"),
    "dynamic": ("Dynamic Programming", "Optimal Substructure"),
    "fibonacci": ("Dynamic Programming", "Recurrence"),
    "knapsack": ("Dynamic Programming", "0/1 Knapsack"),
    "greedy": ("Greedy Algorithms", "Optimization"),
    "sort": ("Sorting & Searching", "Quick / Merge Sort"),
    "binary search": ("Sorting & Searching", "Logarithmic Search"),
    "sql": ("SQL & Databases", "Queries & Joins"),
    "table": ("SQL & Databases", "Schema Design"),
    "join": ("SQL & Databases", "Relational Joins"),
    "index": ("SQL & Databases", "Indexing & Optimization"),
    "database": ("SQL & Databases", "RDBMS Concepts"),
    "acid": ("SQL & Databases", "Transactions"),
    "thread": ("Operating Systems", "Concurrency & Multithreading"),
    "process": ("Operating Systems", "Process Scheduling"),
    "deadlock": ("Operating Systems", "Synchronization"),
    "memory": ("Operating Systems", "Virtual Memory & Paging"),
    "tcp": ("Computer Networks", "Transport Layer"),
    "http": ("Computer Networks", "Application Layer & REST"),
    "ip": ("Computer Networks", "Routing & Addressing"),
    "dns": ("Computer Networks", "Domain Resolution"),
    "oop": ("Object Oriented Programming", "Encapsulation & Polymorphism"),
    "class": ("Object Oriented Programming", "Class & Object Architecture"),
    "inheritance": ("Object Oriented Programming", "Inheritance Hierarchy"),
    "system": ("System Design", "Scalability & Microservices"),
    "cache": ("System Design", "Caching & Redis"),
    "load balancer": ("System Design", "High Availability"),
    "python": ("Python Core", "Syntax & Builtins"),
    "java": ("Java Core", "JVM & Collections"),
    "javascript": ("JavaScript Core", "Async & Event Loop"),
    "aptitude": ("General Aptitude", "Quantitative Analysis"),
    "percentage": ("General Aptitude", "Arithmetic"),
    "probability": ("General Aptitude", "Combinatorics"),
    "syllogism": ("Logical Reasoning", "Deductive Logic"),
    "seating": ("Logical Reasoning", "Arrangements"),
}

def extract_questions_from_json(paper_id: str, json_str: str, company: str, exam: str, year: int, role: str) -> List[ExtractedQuestion]:
    """Parse question paper represented as JSON"""
    try:
        data = json.loads(json_str)
    except Exception:
        return []

    items = []
    if isinstance(data, list):
        items = data
    elif isinstance(data, dict):
        items = data.get("questions") or data.get("items") or data.get("problems") or [data]

    extracted = []
    for idx, item in enumerate(items):
        if not isinstance(item, dict):
            continue
        text = item.get("question") or item.get("question_text") or item.get("title") or item.get("text") or ""
        if not text or len(str(text).strip()) < 5:
            continue
        
        topic = item.get("topic") or item.get("category") or "Core Computer Science"
        subtopic = item.get("subtopic") or topic.split("&")[0].strip()
        difficulty = item.get("difficulty") or "Medium"
        options = item.get("options")
        if isinstance(options, list):
            text += "\n" + "\n".join([f"- {opt}" for opt in options])

        extracted.append(
            ExtractedQuestion(
                id=f"ext-q-{uuid.uuid4().hex[:8]}",
                paper_id=paper_id,
                question_text=str(text).strip(),
                normalized_text=" ".join(re.findall(r'\w+', str(text).lower())),
                company=company,
                exam=exam,
                year=year,
                role=role,
                topic=topic,
                subtopic=subtopic,
                difficulty=difficulty,
                status="needs_review",
                appearances_count=item.get("appearances", 1),
                historical_occurrences=[{"company": company, "exam": exam, "year": str(year)}],
            )
        )
    return extracted

def extract_questions_from_text(
    paper_id: str,
    raw_text: str,
    company: str,
    exam: str,
    year: int,
    role: str
) -> List[ExtractedQuestion]:
    """Extract and categorize questions from plain text / PDF / DOCX in sequential order"""
    if not raw_text or not raw_text.strip():
        return []

    # Check if text is JSON
    if raw_text.strip().startswith("{") or raw_text.strip().startswith("["):
        json_qs = extract_questions_from_json(paper_id, raw_text, company, exam, year, role)
        if json_qs:
            return json_qs

    # Normalize line endings
    text = raw_text.replace('\r\n', '\n').strip()

    # Match common question patterns at line starts:
    # 1. / 1) / [1] / (1) / Q1. / Question 1: / Problem 1 - / Section A: Q1
    pattern = re.compile(
        r'(?:^|\n)\s*(?:Q(?:uestion)?\s*(\d+)[\.:\)\-]|Problem\s*(\d+)[\.:\)\-]|\[(\d+)\]|\((\d+)\)|(\d+)[\.:\)])\s*',
        re.IGNORECASE
    )

    matches = list(pattern.finditer(text))
    extracted = []

    if matches and len(matches) >= 1:
        for idx in range(len(matches)):
            curr_match = matches[idx]
            start_pos = curr_match.end()
            end_pos = matches[idx + 1].start() if idx + 1 < len(matches) else len(text)
            
            q_num = curr_match.group(1) or curr_match.group(2) or curr_match.group(3) or curr_match.group(4) or curr_match.group(5) or str(idx + 1)
            q_body = text[start_pos:end_pos].strip()

            if len(q_body) < 8:
                continue

            # Detect topic & subtopic
            body_lower = q_body.lower()
            detected_topic = "Core Computer Science"
            detected_subtopic = "General Programming"

            for kw, (top_name, sub_name) in TOPICS_TAXONOMY.items():
                if kw in body_lower:
                    detected_topic = top_name
                    detected_subtopic = sub_name
                    break

            # Estimate difficulty
            difficulty = "Medium"
            if any(k in body_lower for k in ["hard", "optimal", "complex", "amortized", "concurrency", "distributed", "segment tree"]):
                difficulty = "Hard"
            elif any(k in body_lower for k in ["easy", "define", "basic", "what is", "syntax", "simple"]):
                difficulty = "Easy"

            normalized = " ".join(re.findall(r'\w+', body_lower))

            extracted.append(
                ExtractedQuestion(
                    id=f"ext-q-{uuid.uuid4().hex[:8]}",
                    paper_id=paper_id,
                    question_text=f"Q{q_num}. {q_body}",
                    normalized_text=normalized,
                    company=company,
                    exam=exam,
                    year=year,
                    role=role,
                    topic=detected_topic,
                    subtopic=detected_subtopic,
                    difficulty=difficulty,
                    status="needs_review",
                    appearances_count=1,
                    historical_occurrences=[{"company": company, "exam": exam, "year": str(year)}],
                )
            )

    # If single question or unformatted block of reasonable length
    if not extracted and len(text) >= 15:
        paragraphs = [p.strip() for p in text.split('\n\n') if len(p.strip()) >= 15]
        for p_idx, p in enumerate(paragraphs[:20]):
            body_lower = p.lower()
            detected_topic = "Core Computer Science"
            detected_subtopic = "General Concepts"
            for kw, (top_name, sub_name) in TOPICS_TAXONOMY.items():
                if kw in body_lower:
                    detected_topic = top_name
                    detected_subtopic = sub_name
                    break

            difficulty = "Medium"
            if "hard" in body_lower or "optimal" in body_lower or "complex" in body_lower:
                difficulty = "Hard"
            elif "define" in body_lower or "basic" in body_lower:
                difficulty = "Easy"

            extracted.append(
                ExtractedQuestion(
                    id=f"ext-q-{uuid.uuid4().hex[:8]}",
                    paper_id=paper_id,
                    question_text=f"Q{p_idx + 1}. {p}",
                    normalized_text=" ".join(re.findall(r'\w+', body_lower)),
                    company=company,
                    exam=exam,
                    year=year,
                    role=role,
                    topic=detected_topic,
                    subtopic=detected_subtopic,
                    difficulty=difficulty,
                    status="needs_review",
                    appearances_count=1,
                    historical_occurrences=[{"company": company, "exam": exam, "year": str(year)}],
                )
            )

    return extracted

