"""Numbers for the admin Analytics page, computed from stored records (pure functions: easy to test with known data).

Demo students (see scripts/seed_demo_data.py) are real documents flagged `demo: true`, so they appear here like anyone else.
"""
from collections import defaultdict
from datetime import date, datetime, timedelta
from typing import Any, Dict, Iterable, List, Optional

from app.services import readiness_service as rs

BUCKETS = ((0, 19), (20, 39), (40, 59), (60, 79), (80, 100))
ACTIVITY_DAYS = 30
ACTIVE_WINDOW = 7
WEAKEST_LIMIT = 8
MIN_QUESTIONS = 3  # a topic needs at least this many answered questions to be ranked (one unlucky question is not a weakness)


def readiness_distribution(rows: Iterable[Dict[str, Any]]) -> Dict[str, Any]:
    """How many students fall in each readiness band. A student with no data at all is counted apart (their 0 is 'nothing recorded', not 'weak')."""
    counts = [0] * len(BUCKETS)
    no_data = 0
    for r in rows:
        if not r.get("has_data"):
            no_data += 1
            continue
        score = int(r.get("readiness_score") or 0)
        for i, (low, high) in enumerate(BUCKETS):
            if low <= score <= high:
                counts[i] += 1
                break
    return {"buckets": [{"label": f"{low}-{high}", "min": low, "max": high, "count": n} for (low, high), n in zip(BUCKETS, counts)], "no_data": no_data}


def weakest_skills(assessment_attempts: Iterable[Dict[str, Any]], limit: int = WEAKEST_LIMIT, min_questions: int = MIN_QUESTIONS) -> List[Dict[str, Any]]:
    """Topics ranked from the lowest average score. Each topic's average is weighted by its number of questions, over every stored attempt;
    a topic with fewer than `min_questions` answered questions is left out."""
    points: Dict[str, float] = defaultdict(float)
    questions: Dict[str, int] = defaultdict(int)
    attempts: Dict[str, int] = defaultdict(int)
    students: Dict[str, set] = defaultdict(set)
    for a in assessment_attempts:
        for t in a.get("topic_scores") or []:
            topic, total = t.get("topic"), int(t.get("total") or 0)
            if not topic or total <= 0:
                continue
            points[topic] += float(t.get("score") or 0) * total
            questions[topic] += total
            attempts[topic] += 1
            students[topic].add(a.get("user_id"))
    rows = [{"topic": t, "average": round(points[t] / questions[t]), "questions": questions[t], "attempts": attempts[t], "students": len(students[t])} for t in questions if questions[t] >= min_questions]
    rows.sort(key=lambda r: (r["average"], -r["questions"], r["topic"]))
    return rows[:limit]


def _day(value) -> Optional[date]:
    return value.date() if isinstance(value, datetime) else None


def activity_over_time(assessment_attempts: Iterable[Dict[str, Any]], practice_attempts: Iterable[Dict[str, Any]], today: date, days: int = ACTIVITY_DAYS) -> List[Dict[str, Any]]:
    """One row per day for the last `days` days (oldest first, zeros included): assessments taken, code/quiz submissions, distinct active students."""
    start = today - timedelta(days=days - 1)
    assessments: Dict[date, int] = defaultdict(int)
    submissions: Dict[date, int] = defaultdict(int)
    active: Dict[date, set] = defaultdict(set)
    for a in assessment_attempts:
        d = _day(a.get("submitted_at"))
        if d and start <= d <= today:
            assessments[d] += 1
            active[d].add(a.get("user_id"))
    for a in practice_attempts:
        d = _day(a.get("timestamp"))
        if d and start <= d <= today and rs.is_submission(a):
            submissions[d] += 1
            active[d].add(a.get("user_id"))
    return [{"date": (start + timedelta(days=i)).isoformat(), "assessments": assessments[start + timedelta(days=i)],
             "submissions": submissions[start + timedelta(days=i)], "active_students": len(active[start + timedelta(days=i)])} for i in range(days)]


def active_students(raw_by_user: Dict[str, Dict[str, Any]], today: date, window: int = ACTIVE_WINDOW) -> int:
    """Students with an assessment or a submission in the last `window` days (today included)."""
    first = today - timedelta(days=window - 1)
    count = 0
    for raw in raw_by_user.values():
        days = rs.activity_days(raw.get("assessment_attempts") or [], raw.get("practice_attempts") or [])
        if any(first <= d <= today for d in days):
            count += 1
    return count


def build(rows: List[Dict[str, Any]], raw_by_user: Dict[str, Dict[str, Any]], today: date) -> Dict[str, Any]:
    """Everything the page adds on top of the existing analytics counters."""
    assessed = [r for r in rows if r["assessments_completed"] > 0]
    all_assessments = [a for raw in raw_by_user.values() for a in raw.get("assessment_attempts") or []]
    all_practice = [a for raw in raw_by_user.values() for a in raw.get("practice_attempts") or []]
    return {
        "active_students_7d": active_students(raw_by_user, today),
        "average_readiness": int(round(sum(r["readiness_score"] for r in assessed) / len(assessed))) if assessed else 0,
        "readiness_distribution": readiness_distribution(rows),
        "weakest_skills": weakest_skills(all_assessments),
        "activity": activity_over_time(all_assessments, all_practice, today),
    }
