"""The student's roadmap, built from their saved progress, their gap topics and the real course catalogue.

Everything here is pure: the router loads the data and passes it in, so the rules are easy to test.
Nothing is guessed from the milestone's position: a status is what the student saved, or "not_started",
or "locked" when the milestone is not unlocked yet.
"""
import re
from typing import Any, Dict, Iterable, List, Optional

from app.models.roadmap import RoadmapMilestone, RoadmapResponse

PASS_PERCENT = 70      # an assessment passed at this score unlocks the milestone it belongs to
SAVED_STATUSES = {"completed", "in_progress", "not_started"}  # "locked" is computed, never saved

# words too generic to show that a gap topic belongs to a milestone ("Python Fundamentals" is not "Python OOP")
_GENERIC = {
    "fundamentals", "basics", "core", "advanced", "internals", "architecture", "principles", "state", "queries",
    "language", "types", "control", "flow", "python", "java", "javascript", "react", "sql", "data", "learning",
    "concepts", "introduction", "systems", "design", "deployment", "model", "models", "framework", "with",
}


def _norm(text: str) -> str:
    return re.sub(r"[^a-z0-9+#]+", " ", (text or "").lower()).strip()


def _has(haystack: str, needle: str) -> bool:
    """Whole-word containment on normalised text."""
    return bool(needle) and f" {needle} " in f" {haystack} "


def _tokens(text: str) -> set:
    return {t for t in _norm(text).split() if len(t) >= 4 and t not in _GENERIC}


def matches_gaps(milestone: Dict[str, Any], gap_topics: Iterable[str]) -> bool:
    """True when a gap topic is (part of) one of the milestone's skills or its title, or shares a distinctive word with a skill."""
    skills = list(milestone.get("skills") or [])
    skill_words = set().union(*(_tokens(s) for s in skills)) if skills else set()
    for gap in gap_topics:
        g = _norm(gap)
        if not g:
            continue
        for phrase in skills + [milestone.get("title", "")]:
            p = _norm(phrase)
            if _has(p, g) or _has(g, p):
                return True
        if _tokens(gap) & skill_words:
            return True
    return False


LANGUAGES = {"c", "c++", "python", "java", "javascript"}  # a course whose first skill is one of these is a language course


def courses_for(milestone: Dict[str, Any], courses: List[Dict[str, Any]], path_text: str = "", limit: int = 2) -> List[Dict[str, Any]]:
    """Real courses whose skills appear in the milestone's title or skills, best match first (never invented).

    A language course (C, C++, Python, Java, JavaScript) is only offered when its language is named by the milestone or by
    the career path, so a Python "Functions" milestone is not sent to the C course.
    """
    text = _norm(" ".join([milestone.get("title", "")] + list(milestone.get("skills") or [])))
    path = _norm(path_text)
    scored = []
    for c in courses:
        skills = c.get("skills") or []
        primary = _norm(skills[0]) if skills else ""
        if primary in LANGUAGES and not (_has(text, primary) or _has(path, primary)):
            continue
        hits = sum(1 for skill in skills if len(skill) > 2 and _has(text, _norm(skill)))
        if hits:
            scored.append((-hits, c.get("position", 999), c))
    return [c for _, _, c in sorted(scored, key=lambda t: t[:2])[:limit]]


def build_roadmap(
    config: Dict[str, Any],
    progress: Dict[str, str],
    gap_topics: List[str],
    courses: List[Dict[str, Any]],
    sets_by_course: Dict[str, List[Dict[str, Any]]],
    best_scores: Dict[str, int],
) -> RoadmapResponse:
    """progress: {milestone_id: saved status}; best_scores: {assessment_id: best score}."""
    path_text = " ".join([config.get("title", "")] + list(config.get("required_skills") or []))
    built: List[RoadmapMilestone] = []
    previous_done = True  # the first milestone is always open
    for raw in sorted(config.get("milestones", []), key=lambda m: m.get("number", 0)):
        linked = courses_for(raw, courses, path_text)
        sets = [s for c in linked for s in sets_by_course.get(c["slug"], [])]
        set_scores = [best_scores[s["id"]] for s in sets if s["id"] in best_scores]
        passed = bool(set_scores) and max(set_scores) >= PASS_PERCENT

        saved = progress.get(raw["id"])
        status = saved if saved in SAVED_STATUSES else "not_started"
        if status == "not_started" and not (previous_done or passed):
            status = "locked"
        priority = status != "completed" and matches_gaps(raw, gap_topics)

        m = {**raw, "status": status, "is_priority_gap": priority,
             "score": max(set_scores) if set_scores else None,  # the best score on a related assessment, else nothing
             "course_slugs": [c["slug"] for c in linked],
             "courses": [{"slug": c["slug"], "title": c["title"]} for c in linked],
             "practice_sets": [{"id": s["id"], "title": s["title"], "difficulty": s["difficulty"]} for s in sets]}
        if priority:
            m["action_label"] = "Priority gap: practice now"
        built.append(RoadmapMilestone(**m))
        previous_done = status == "completed"

    # done first, then what is under way, then what to do next (priority gaps first), then what is still locked
    group = {"completed": 0, "in_progress": 1, "not_started": 2, "locked": 3}
    ordered = sorted(built, key=lambda m: (group[m.status], 0 if m.is_priority_gap else 1, m.number))
    done = sum(1 for m in built if m.status == "completed")
    active = next((m for m in ordered if m.status in ("in_progress", "not_started")), None)
    return RoadmapResponse(
        career_path=config["title"],
        current_milestone=active.number if active else (built[-1].number if built else 0),
        completion_percentage=int(done / len(built) * 100) if built else 0,
        milestones=ordered,
    )


def best_scores_from(attempts: Iterable[Dict[str, Any]]) -> Dict[str, int]:
    out: Dict[str, int] = {}
    for a in attempts:
        aid = a.get("assessment_id")
        if aid:
            out[aid] = max(out.get(aid, 0), int(a.get("overall_score") or 0))
    return out
