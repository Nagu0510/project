"""Career readiness, computed from a student's own stored records. Nothing is stored or invented: no data for a part = 0 for that part.

  40%  average of the LATEST score of each assessment the student took
  20%  coding accuracy: problems with an Accepted submission / problems attempted (the student's own submissions)
  15%  learning: the mean of the roadmap completion and of the progress in the courses they started (only parts that have data)
  15%  the latest ATS-style resume score
  10%  consistency: active days in the last 14 (an assessment or a coding / practice submission on that day)

`compute` is a pure function of plain records (easy to test); `load_raw` and `readiness_for_users` read the collections.
"""
from collections import defaultdict
from datetime import date, datetime, timedelta
from typing import Any, Dict, Iterable, List, Optional

from app.utils.timeutil import utcnow

WEIGHTS = {"assessments": 0.40, "coding": 0.20, "learning": 0.15, "resume": 0.15, "consistency": 0.10}
LABELS = {
    "assessments": "Assessments",
    "coding": "Coding accuracy",
    "learning": "Roadmap and courses",
    "resume": "Resume (ATS-style score)",
    "consistency": "Consistency",
}
WINDOW_DAYS = 14


# ---------------------------------------------------------------------------
# Classifying practice records
# ---------------------------------------------------------------------------
def is_submission(a: Dict[str, Any]) -> bool:
    """An answer the student submitted: a judged code submission or an answered question. Code snapshots are not attempts."""
    if a.get("question_id"):
        return True
    if not a.get("problem_slug"):
        return False
    return bool(a.get("verdict")) or str(a.get("message", "")).startswith("Status:")  # older submits had no verdict field


def is_accepted(a: Dict[str, Any]) -> bool:
    return a.get("verdict") == "Accepted" or (not a.get("verdict") and bool(a.get("is_correct")) and bool(a.get("problem_slug")))


def _day(value) -> Optional[date]:
    return value.date() if isinstance(value, datetime) else None


def activity_days(assessment_attempts: Iterable[Dict[str, Any]], practice_attempts: Iterable[Dict[str, Any]]) -> set:
    days = {_day(a.get("submitted_at")) for a in assessment_attempts}
    days |= {_day(a.get("timestamp")) for a in practice_attempts if is_submission(a)}
    days.discard(None)
    return days


def streak_days(days: set, today: date) -> int:
    """Consecutive days with at least one attempt, counting back from today (or from yesterday if today has none yet)."""
    day = today if today in days else today - timedelta(days=1)
    streak = 0
    while day in days:
        streak += 1
        day -= timedelta(days=1)
    return streak


# ---------------------------------------------------------------------------
# The calculation
# ---------------------------------------------------------------------------
def compute(raw: Dict[str, Any], today: Optional[date] = None) -> Dict[str, Any]:
    """raw: assessment_attempts, practice_attempts, roadmap_pct (or None), course_pcts (list), resume_score (or None)."""
    today = today or utcnow().date()
    assessments = raw.get("assessment_attempts") or []
    practice = raw.get("practice_attempts") or []

    # 1. assessments: latest score per assessment, averaged
    latest: Dict[str, Dict[str, Any]] = {}
    for a in sorted(assessments, key=lambda a: a.get("submitted_at") or datetime.min):
        latest[a.get("assessment_id") or a.get("attempt_id") or str(id(a))] = a
    scores = [int(a.get("overall_score") or 0) for a in latest.values()]
    assess_value = round(sum(scores) / len(scores)) if scores else 0

    # 2. coding accuracy: Accepted problems / attempted problems
    subs = [a for a in practice if is_submission(a) and a.get("problem_slug")]
    attempted = {a["problem_slug"] for a in subs}
    solved = {a["problem_slug"] for a in subs if is_accepted(a)}
    coding_value = round(100 * len(solved) / len(attempted)) if attempted else 0

    # 3. learning: roadmap completion and progress in started courses; only the parts that have data are averaged
    pieces = []
    if raw.get("roadmap_pct"):  # 0% done is 'no data', like a course with no module done
        pieces.append(raw["roadmap_pct"])
    course_pcts = raw.get("course_pcts") or []
    if course_pcts:
        pieces.append(sum(course_pcts) / len(course_pcts))
    learning_value = round(sum(pieces) / len(pieces)) if pieces else 0

    # 4. latest ATS-style resume score
    resume_score = raw.get("resume_score")
    resume_value = int(resume_score) if resume_score is not None else 0

    # 5. consistency: active days in the last 14
    days = activity_days(assessments, practice)
    window = {today - timedelta(days=i) for i in range(WINDOW_DAYS)}
    active_14 = len(days & window)
    consistency_value = round(100 * active_14 / WINDOW_DAYS)

    values = {
        "assessments": (assess_value, bool(scores), f"{len(scores)} assessment{'s' if len(scores) != 1 else ''}, average of the latest scores" if scores else "No assessment taken yet"),
        "coding": (coding_value, bool(attempted), f"{len(solved)} of {len(attempted)} attempted problems Accepted" if attempted else "No coding problem attempted yet"),
        "learning": (learning_value, bool(pieces), " and ".join(p for p in (
            f"roadmap {int(raw['roadmap_pct'])}% done" if raw.get("roadmap_pct") else "",
            f"{len(course_pcts)} course{'s' if len(course_pcts) != 1 else ''} started" if course_pcts else "") if p) or "No roadmap or course progress yet"),
        "resume": (resume_value, resume_score is not None, "Latest ATS-style score (estimate)" if resume_score is not None else "No resume analysed yet"),
        "consistency": (consistency_value, active_14 > 0, f"{active_14} active day{'s' if active_14 != 1 else ''} in the last {WINDOW_DAYS}" if active_14 else f"No activity in the last {WINDOW_DAYS} days"),
    }
    parts = [
        {"key": k, "label": LABELS[k], "weight": int(WEIGHTS[k] * 100), "value": v, "points": round(WEIGHTS[k] * v, 1), "has_data": has, "detail": detail}
        for k, (v, has, detail) in values.items()
    ]
    overall = int(round(sum(WEIGHTS[k] * values[k][0] for k in WEIGHTS)))
    mcq = [a for a in practice if a.get("question_id")]
    return {
        "overall": overall,
        "has_data": any(p["has_data"] for p in parts),
        "parts": parts,
        "streak_days": streak_days(days, today),
        "active_days_14": active_14,
        "assessments_taken": len(assessments),
        "problems_attempted": len(attempted),
        "problems_solved": len(solved),
        "questions_answered": len(mcq),
        "questions_correct": sum(1 for a in mcq if a.get("is_correct")),
        "submissions": sum(1 for a in practice if is_submission(a)),
        "correct_submissions": sum(1 for a in practice if is_submission(a) and (a.get("is_correct") or is_accepted(a))),
        "last_active": max(days).isoformat() if days else None,
    }


# ---------------------------------------------------------------------------
# Loading the records (one query per collection, for one student or many)
# ---------------------------------------------------------------------------
async def load_raw(user_docs: List[Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
    from app.repositories import attempts, career_paths, courses, practice, resumes, roadmaps

    ids = [u["id"] for u in user_docs]
    if not ids:
        return {}
    by_user_assess: Dict[str, list] = defaultdict(list)
    for a in await attempts.for_users(ids):
        by_user_assess[a["user_id"]].append(a)
    by_user_practice: Dict[str, list] = defaultdict(list)
    for a in await practice.attempts_for_users(ids):
        by_user_practice[a["user_id"]].append(a)
    resume_latest = await resumes.latest_for_users(ids)

    module_totals = {c["slug"]: len(c.get("modules", [])) for c in await courses.list_courses()}
    course_pcts: Dict[str, list] = defaultdict(list)
    for p in await courses.progress_for_users(ids):
        total = module_totals.get(p["course_slug"], 0)
        done = len([m for m in p.get("modules_done", []) if m])
        if total and done:
            course_pcts[p["user_id"]].append(100 * min(done, total) / total)

    configs = {c["title"].lower(): c for c in await career_paths.list_paths()}
    progress = await roadmaps.for_users(ids)
    out = {}
    for u in user_docs:
        path = u.get("current_path") or u.get("career_interest") or ""
        config = configs.get(path.lower()) if path else None
        roadmap_pct = None
        if config and config.get("milestones"):
            done = progress.get((u["id"], config["title"]), {})
            roadmap_pct = 100 * sum(1 for m in config["milestones"] if done.get(m["id"]) == "completed") / len(config["milestones"])
        resume = resume_latest.get(u["id"])
        out[u["id"]] = {
            "assessment_attempts": by_user_assess.get(u["id"], []),
            "practice_attempts": by_user_practice.get(u["id"], []),
            "roadmap_pct": roadmap_pct,
            "course_pcts": course_pcts.get(u["id"], []),
            "resume_score": resume.get("overall_score") if resume else None,
            "career_path": path,
            "config": config,
        }
    return out


async def readiness_for_users(user_docs: List[Dict[str, Any]], today: Optional[date] = None) -> Dict[str, Dict[str, Any]]:
    raw = await load_raw(user_docs)
    return {uid: compute(r, today) for uid, r in raw.items()}


async def readiness_for_user(user_doc: Dict[str, Any], today: Optional[date] = None) -> Dict[str, Any]:
    return (await readiness_for_users([user_doc], today))[user_doc["id"]]


def score_history(assessment_attempts: List[Dict[str, Any]], resume_docs: List[Dict[str, Any]], limit: int = 30) -> List[Dict[str, Any]]:
    """Real scores over time: each assessment attempt and each resume analysis, oldest first."""
    rows = [
        {"date": a["submitted_at"].isoformat(), "kind": "assessment", "score": int(a.get("overall_score") or 0), "label": a.get("assessment_title") or "Assessment"}
        for a in assessment_attempts if isinstance(a.get("submitted_at"), datetime)
    ] + [
        {"date": r["created_at"].isoformat(), "kind": "resume", "score": int(r.get("overall_score") or 0), "label": "Resume analysis"}
        for r in resume_docs if isinstance(r.get("created_at"), datetime)
    ]
    return sorted(rows, key=lambda r: r["date"])[-limit:]
