"""Demo data for showing the admin pages and charts: fake students and their activity over the last 30 days.

SAFETY RULES
  * Every record created here carries `demo: true`. `reset` removes ONLY records with that flag (users: also an @example.test address and an
    id starting `usr-demo-`), so a real student is never touched.
  * Demo students cannot sign in: they have no password (`password: None`) and an @example.test address (the reserved test domain).
  * Ids are fixed (`usr-demo-01`, `att-demo-01-003`, ...) and records are written with upsert, so running `seed` again replaces the same
    records instead of adding new ones. The data is generated from a seeded random generator: the same call gives the same students.

Used by backend/scripts/seed_demo_data.py (which needs an explicit --yes). Content (assessments, problems, career paths) must already be seeded.
"""
import random
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from app.utils.timeutil import utcnow

EMAIL_DOMAIN = "example.test"
ID_PREFIX = "usr-demo-"
MAX_COUNT = 100
COLLECTIONS = ["users", "student_profiles", "assessment_attempts", "roadmaps", "resume_analyses", "practice_attempts", "notifications"]
VERDICTS_BAD = ["Wrong Answer", "Wrong Answer", "Runtime Error", "Time Limit Exceeded", "Compile Error"]
LANGUAGES = ["python", "python", "python", "java", "javascript", "cpp"]
COLLEGES = ["Demo Institute of Technology", "Sample College of Engineering", "Example University"]


class DemoDataError(Exception):
    """The demo data cannot be created (for example the content has not been seeded yet)."""


def demo_email(n: int) -> str:
    return f"demo{n:02d}@{EMAIL_DOMAIN}"


def _band(pct: int) -> str:
    return "strong" if pct >= 80 else "developing" if pct >= 60 else "gap"


def _when(now: datetime, rng: random.Random, max_days: int = 29, min_days: int = 0) -> datetime:
    return (now - timedelta(days=rng.randint(min_days, max_days))).replace(hour=rng.randint(7, 22), minute=rng.randint(0, 59), second=rng.randint(0, 59), microsecond=0)


async def _upsert(db, collection: str, key: Dict[str, Any], doc: Dict[str, Any]) -> None:
    await db[collection].replace_one(key, {**doc, **key, "demo": True}, upsert=True)


async def seed(db, count: int = 25, now: Optional[datetime] = None) -> Dict[str, int]:
    """Create (or refresh) `count` demo students and their records. Returns how many documents of each kind were written."""
    if not 1 <= count <= MAX_COUNT:
        raise DemoDataError(f"count must be between 1 and {MAX_COUNT}")
    now = now or utcnow()
    assessments = await db["assessments"].find({}, {"_id": 0}).to_list(500)
    questions = {q["id"]: q for q in await db["assessment_questions"].find({}, {"_id": 0}).to_list(2000)}
    problems = [p for p in await db["practice_problems"].find({}, {"_id": 0, "slug": 1, "difficulty": 1, "function_name": 1}).to_list(200) if p.get("function_name")]
    paths = await db["career_paths"].find({}, {"_id": 0}).sort("slug", 1).to_list(50)
    if not (assessments and problems and paths):
        raise DemoDataError("The content is missing. Run `python -m app.seed` first, then seed the demo data.")
    assessments.sort(key=lambda a: a["id"])
    problems.sort(key=lambda p: p["slug"])
    made = {name: 0 for name in COLLECTIONS}

    for n in range(1, count + 1):
        rng = random.Random(f"skillsense-demo-{n}")
        uid = f"{ID_PREFIX}{n:02d}"
        ability = rng.choice([0.28, 0.4, 0.5, 0.58, 0.66, 0.74, 0.82, 0.9])  # how well this student answers
        busy = rng.choice([0, 1, 1, 2, 2, 3])                               # 0 = signed up and did little
        path = paths[(n - 1) % len(paths)]
        created = _when(now, rng, 40, 12)

        await _upsert(db, "users", {"id": uid}, {
            "name": f"Demo Student {n:02d}", "email": demo_email(n), "password": None, "auth_provider": "demo", "email_verified": True, "role": "student",
            "college": rng.choice(COLLEGES), "department": rng.choice(["Computer Science", "Information Technology", "Electronics"]), "year": rng.choice(["2", "3", "4"]),
            "career_goal": path["title"], "career_interest": path["title"], "current_path": path["title"], "preferred_language": rng.choice(["Python", "Java", "JavaScript"]),
            "skill_level": rng.choice(["Beginner", "Intermediate"]), "skill_progress": 0, "strong_skills": [], "gap_skills": [], "gap_topics": [],
            "assessments_completed": 0, "created_at": created,
        })
        made["users"] += 1
        await _upsert(db, "student_profiles", {"user_id": uid}, {"name": f"Demo Student {n:02d}", "email": demo_email(n), "career_path": path["title"], "skills": [], "target_companies": []})
        made["student_profiles"] += 1

        # ---- assessments: scores follow the student's ability; each attempt is on its own day
        track_sets = [a for a in assessments if a.get("career_path") == path["title"]] or assessments
        count_assessments = 0 if busy == 0 else rng.randint(1, 2 + busy)
        days = sorted(rng.sample(range(0, 29), min(count_assessments, 29)), reverse=True)
        taken = 0
        strong: List[str] = []
        gaps: List[str] = []
        gap_topics: List[str] = []
        for k, day in enumerate(days, 1):
            asm = rng.choice(track_sets if rng.random() < 0.7 else assessments)
            by_topic: Dict[str, List[bool]] = {}
            skills: Dict[str, List[bool]] = {}
            for qid in asm.get("question_ids", []):
                q = questions.get(qid) or {}
                right = rng.random() < max(0.05, min(0.97, ability + rng.uniform(-0.18, 0.18)))
                by_topic.setdefault(q.get("topic") or "General", []).append(right)
                skills.setdefault(q.get("skill") or asm.get("skill", ""), []).append(right)
            total = sum(len(v) for v in by_topic.values())
            correct = sum(sum(v) for v in by_topic.values())
            if not total:
                continue
            topic_scores = [{"topic": t, "score": int(sum(v) / len(v) * 100), "total": len(v), "band": _band(int(sum(v) / len(v) * 100))} for t, v in by_topic.items()]
            overall = int(correct / total * 100)
            strong = [s for s, v in skills.items() if _band(int(sum(v) / len(v) * 100)) == "strong"]
            gaps = [s for s, v in skills.items() if _band(int(sum(v) / len(v) * 100)) == "gap"]
            gap_topics = [t["topic"] for t in topic_scores if t["band"] == "gap"]
            submitted = (now - timedelta(days=day)).replace(hour=rng.randint(8, 21), minute=rng.randint(0, 59), second=0, microsecond=0)
            await _upsert(db, "assessment_attempts", {"attempt_id": f"att-demo-{n:02d}-{k:03d}"}, {
                "user_id": uid, "assessment_id": asm["id"], "assessment_title": asm["title"], "difficulty": asm.get("difficulty", "Medium"), "overall_score": overall,
                "readiness_score": overall, "correct_count": correct, "total_questions": total, "topic_scores": topic_scores, "strengths": strong, "skill_gaps": gaps,
                "gap_topics": gap_topics, "time_taken_seconds": rng.randint(240, int(asm.get("duration_minutes", 15)) * 60), "submitted_at": submitted, "review": [], "next_steps": [],
            })
            made["assessment_attempts"] += 1
            taken += 1
            await _upsert(db, "notifications", {"id": f"notif-demo-{n:02d}-a{k:03d}"}, {
                "user_id": uid, "type": "assessment", "title": "Assessment completed", "message": f"You scored {overall}% on {asm['title']}.", "body": f"You scored {overall}% on {asm['title']}.",
                "link": "/assessment-results", "read": rng.random() < 0.6, "created_at": submitted,
            })
            made["notifications"] += 1
        if taken:
            await db["users"].update_one({"id": uid}, {"$set": {"assessments_completed": taken, "strong_skills": strong, "gap_skills": gaps, "gap_topics": gap_topics}})

        # ---- roadmap progress: a prefix of the milestones completed, one in progress
        milestones = path.get("milestones") or []
        if milestones and busy:
            done = min(len(milestones), int(len(milestones) * ability * rng.uniform(0.3, 0.9)) + (1 if busy > 1 else 0))
            progress = {m["id"]: "completed" if i < done else "in_progress" if i == done else "not_started" for i, m in enumerate(milestones)}
            await _upsert(db, "roadmaps", {"user_id": uid, "career_path": path["title"]}, {"milestones_progress": progress})
            made["roadmaps"] += 1

        # ---- resume scans
        for r in range(rng.randint(0, 2) if busy else 0):
            score = int(max(20, min(96, 30 + ability * 60 + rng.uniform(-12, 12))))
            await _upsert(db, "resume_analyses", {"id": f"res-demo-{n:02d}-{r + 1}"}, {
                "user_id": uid, "overall_score": score, "career_path": path["title"], "role": path["title"], "created_at": _when(now, rng, 28),
            })
            made["resume_analyses"] += 1

        # ---- practice submissions: mixed verdicts; a few students keep a daily streak
        submissions = 0 if busy == 0 else rng.randint(2, 6) * busy
        streak_days = rng.randint(3, 12) if n % 5 == 1 and busy else 0
        slots = [now - timedelta(days=d) for d in range(streak_days)] + [_when(now, rng) for _ in range(max(0, submissions - streak_days))]
        for k, moment in enumerate(sorted(slots), 1):
            problem = rng.choice(problems)
            hardness = {"Easy": 0.0, "Medium": 0.15, "Hard": 0.3}.get(problem.get("difficulty", "Easy"), 0.1)
            accepted = rng.random() < max(0.05, ability - hardness) or (k <= streak_days and rng.random() < 0.8)
            verdict = "Accepted" if accepted else rng.choice(VERDICTS_BAD)
            when = moment.replace(hour=rng.randint(8, 22), minute=rng.randint(0, 59), second=0, microsecond=0)
            if when > now:
                when = now - timedelta(minutes=rng.randint(1, 600))
            await _upsert(db, "practice_attempts", {"id": f"att-demo-p{n:02d}-{k:03d}"}, {
                "user_id": uid, "problem_slug": problem["slug"], "language": rng.choice(LANGUAGES), "code": "# Demo data: this is not a real submission.\n", "message": f"Status: {verdict}",
                "is_correct": accepted, "verdict": verdict, "runtime_ms": rng.randint(8, 900), "memory_kb": rng.randint(9000, 40000),
                "passed_count": 8 if accepted else rng.randint(1, 7), "total_count": 8, "timestamp": when, "created_at": when, "execution_available": True,
            })
            made["practice_attempts"] += 1
    return made


async def reset(db) -> Dict[str, int]:
    """Remove the demo records, and only those. Returns how many documents were removed per collection."""
    removed = {}
    for name in COLLECTIONS:
        if name == "users":  # three conditions at once: flagged, the reserved test domain, and a demo id
            query = {"demo": True, "email": {"$regex": f"@{EMAIL_DOMAIN}$"}, "id": {"$regex": f"^{ID_PREFIX}"}}
        else:
            query = {"demo": True, "user_id": {"$regex": f"^{ID_PREFIX}"}}
        removed[name] = (await db[name].delete_many(query)).deleted_count
    return removed


async def count_demo(db) -> Dict[str, int]:
    return {name: await db[name].count_documents({"demo": True}) for name in COLLECTIONS}
