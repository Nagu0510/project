"""Course recommendations from three signals, minus what the student already finished.

  +3  per required skill of the chosen career path that the student does not show yet (resume skills + verified skills)
  +2  per skill gap in the latest assessment (and +1 per topic scored under 60%)
  +2  per skill missing in the latest resume analysis
Completed courses are never recommended. With no data at all the result is beginner courses with the reason "Start here".
"""
from typing import Any, Dict, List, Optional, Set

from app.data import skills as catalog

LEVEL_ORDER = {"Beginner": 0, "Intermediate": 1, "Advanced": 2}
HOURS_PER_WEEK = 8
PLAN_WEEKS = 4
LIMIT = 5


def _lower(items) -> Set[str]:
    return {str(i).lower() for i in items}


def _covers(course: Dict[str, Any], names) -> bool:
    return bool(_lower(course.get("skills", [])) & _lower(names))


def _progress_of(course: Dict[str, Any], progress: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    module_ids = [m["id"] for m in course.get("modules", [])]
    done = [m for m in (progress or {}).get("modules_done", []) if m in module_ids]
    total = len(module_ids)
    return {"done": len(done), "total": total, "percent": int(100 * len(done) / total) if total else 0,
            "completed": bool(total) and len(done) == total, "done_ids": done}


def recommend(
    courses: List[Dict[str, Any]],
    progress: Dict[str, Dict[str, Any]],
    role: Optional[Dict[str, Any]],
    known_skills: Set[str],
    assessment: Optional[Dict[str, Any]],
    resume: Optional[Dict[str, Any]],
) -> Dict[str, Any]:
    has_data = bool(role or assessment or resume)
    states = {c["slug"]: _progress_of(c, progress.get(c["slug"])) for c in courses}
    open_courses = [c for c in courses if not states[c["slug"]]["completed"]]  # finished courses disappear

    # a requirement is credited to ONE course: the first alternative (in the order skills.py lists them) that an open course covers
    def owner(label: str) -> Optional[str]:
        for alternative in catalog.requirement_alternatives(label):
            covering = [c for c in open_courses if _covers(c, [alternative])]
            if covering:
                return min(covering, key=lambda c: c.get("position", 999))["slug"]
        return None

    signals: Dict[str, Dict[str, Any]] = {}

    def credit(slug: Optional[str], points: int, reason: str) -> None:
        if slug:
            entry = signals.setdefault(slug, {"score": 0, "reasons": []})
            entry["score"] += points
            entry["reasons"].append(reason)

    if role:
        for label in role.get("required_skills", []):
            alternatives = catalog.requirement_alternatives(label)
            if alternatives and not set(alternatives) & known_skills:
                credit(owner(label), 3, f"Your {role['title']} path needs {label}")
    if assessment:
        for gap in assessment.get("skill_gaps", []):
            for course in open_courses:
                if gap.lower() in _lower(course.get("assessment_skills", [])) or gap.lower() in _lower(course.get("skills", [])):
                    credit(course["slug"], 2, f"Your last assessment showed a gap in {gap}")
        for topic in assessment.get("topic_scores", []):
            if topic.get("score", 100) < 60:
                for course in open_courses:
                    if topic.get("topic", "").lower() in _lower(course.get("practice_topics", [])):
                        credit(course["slug"], 1, f"You scored {topic['score']}% on {topic['topic']}")
    if resume:
        for label in resume.get("missing_skills", []):
            credit(owner(label), 2, f"Your latest resume analysis is missing {label}")

    by_slug = {c["slug"]: c for c in open_courses}
    scored: List[Dict[str, Any]] = [{"course": by_slug[slug], **entry} for slug, entry in signals.items()]

    scored.sort(key=lambda r: (-r["score"], LEVEL_ORDER.get(r["course"].get("level"), 9), r["course"].get("position", 999)))
    picked = scored[:LIMIT]

    if not has_data:
        starters = [c for c in open_courses if c.get("level") == "Beginner" and not c.get("prerequisites")]
        picked = [{"course": c, "score": 0, "reasons": ["Start here"]} for c in sorted(starters, key=lambda c: c.get("position", 999))[:LIMIT]]
    elif len(picked) < LIMIT:
        chosen = {r["course"]["slug"] for r in picked}
        rest = sorted((c for c in open_courses if c["slug"] not in chosen),
                      key=lambda c: (LEVEL_ORDER.get(c.get("level"), 9), c.get("position", 999)))
        picked += [{"course": c, "score": 0, "reasons": ["A good next step to broaden your skills"]} for c in rest[:LIMIT - len(picked)]]

    items = []
    for r in picked:
        c, st = r["course"], states[r["course"]["slug"]]
        reasons = list(dict.fromkeys(r["reasons"]))
        if st["done"]:
            reasons.insert(0, f"Continue where you left off ({st['done']} of {st['total']} modules done)")
        items.append({
            "slug": c["slug"], "title": c["title"], "level": c.get("level", ""), "estimated_hours": c.get("estimated_hours", 0),
            "modules_count": len(c.get("modules", [])), "skills": c.get("skills", []), "score": r["score"],
            "reason": "; ".join(reasons[:2]), "reasons": reasons,
            "progress": {k: st[k] for k in ("done", "total", "percent")},
        })
    return {"has_data": has_data, "career_path": role["title"] if role else "", "courses": items,
            "plan": build_plan(items, {c["slug"]: c for c in courses}, states)}


def build_plan(items: List[Dict[str, Any]], by_slug: Dict[str, Dict[str, Any]], states: Dict[str, Dict[str, Any]]) -> Dict[str, Any]:
    """Fill four weeks (about 8 hours each) with the unfinished modules of the top three courses, in order."""
    queue = []
    for item in items[:3]:
        course = by_slug[item["slug"]]
        done = set(states[item["slug"]]["done_ids"])
        for module in course.get("modules", []):
            if module["id"] not in done:
                queue.append({"course_slug": course["slug"], "course_title": course["title"], "module_id": module["id"],
                              "title": module["title"], "hours": module.get("hours", 0)})
    weeks: List[Dict[str, Any]] = []
    for number in range(1, PLAN_WEEKS + 1):
        modules, hours = [], 0.0
        while queue and (not modules or hours + queue[0]["hours"] <= HOURS_PER_WEEK):
            module = queue.pop(0)
            modules.append(module)
            hours += module["hours"]
        weeks.append({"week": number, "hours": hours, "modules": modules,
                      "focus": ", ".join(dict.fromkeys(m["course_title"] for m in modules)) or "Rest, review and practice"})
    return {"hours_per_week": HOURS_PER_WEEK, "weeks": weeks, "total_hours": sum(w["hours"] for w in weeks),
            "modules_after_week_4": len(queue)}


async def build_for_user(user) -> Dict[str, Any]:
    """Gather this student's own data and recommend. Nothing from other students is read."""
    from app.repositories import attempts, career_paths, courses, resumes
    from app.services import resume_service

    role = await career_paths.find(user.current_path or "") if user.current_path else None
    resume = await resumes.latest(user.id)
    known = set(resume.get("detected_skills", [])) if resume else set()
    known |= set(await resume_service.verified_skills(user.id))
    progress = {p["course_slug"]: p for p in await courses.progress_for_user(user.id)}
    all_courses = await courses.list_courses()
    result = recommend(all_courses, progress, role, known, await attempts.latest(user.id), resume)
    result["next_practice_set"] = await _next_practice_set(result["courses"], all_courses)
    return result


async def _next_practice_set(recommended: List[Dict[str, Any]], all_courses: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """An assessment set for the top recommended course: Easy while the student is early in it, Medium once they are half way."""
    from app.repositories import assessment_bank

    if not recommended:
        return None
    top = recommended[0]
    course = next(c for c in all_courses if c["slug"] == top["slug"])
    sets = await assessment_bank.list_sets()
    own = [s for s in sets if s.get("course_slug") == course["slug"]]
    pool = own or [s for s in sets if not s.get("company") and s.get("skill") in course.get("assessment_skills", [])]
    if not pool:
        return None
    wanted = "Medium" if top["progress"]["percent"] >= 50 else "Easy"
    chosen = next((s for s in pool if s["difficulty"] == wanted), pool[0])
    return {"id": chosen["id"], "title": chosen["title"], "skill": chosen["skill"], "difficulty": chosen["difficulty"],
            "questions_count": chosen["questions_count"], "course_title": course["title"]}
