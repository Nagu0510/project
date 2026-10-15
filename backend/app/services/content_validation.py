"""The content rules for assessment questions, courses and career paths.

`backend/scripts/validate_questions.py` (the seed data check) and the admin content editor use these same functions, so a
question or course the editor accepts is one the script would accept. Each function returns a list of plain-language
problems; an empty list means valid.
"""
import re
from typing import Any, Dict, Iterable, List, Optional

from app.data.assessment_extras import COMPANIES, QUESTION_TYPES, SKILL_TOPICS
from app.data.skills import SKILLS_BY_NAME

DIFFICULTIES = {"Easy", "Medium", "Hard"}
LEVELS = {"Beginner", "Intermediate", "Advanced"}
SLUG_RE = re.compile(r"[a-z0-9][a-z0-9-]{1,60}")
ID_RE = re.compile(r"[A-Za-z0-9][A-Za-z0-9_-]{1,60}")


def duplicate_key(q: Dict[str, Any]) -> str:
    """Two questions with the same text and code are duplicates."""
    return re.sub(r"\s+", " ", ((q.get("question_text") or "") + " " + (q.get("code") or "")).lower()).strip()


def question_problems(q: Dict[str, Any], extra_topics: Optional[Dict[str, Iterable[str]]] = None) -> List[str]:
    """Structure of one question: options, answer index, skill and topic, type, explanation, tags. Uniqueness is checked
    separately (`duplicate_key`, unique ids) because it needs the other questions."""
    problems: List[str] = []
    opts = q.get("options")
    if not isinstance(opts, list) or len(opts) != 4 or not all(isinstance(o, str) and o.strip() for o in opts):
        problems.append("needs exactly 4 non-empty text options")
    elif len({o.strip().lower() for o in opts}) != 4:
        problems.append("two options are identical")
    idx = q.get("correct_option_index")
    if not isinstance(idx, int) or isinstance(idx, bool) or not 0 <= idx <= 3:
        problems.append(f"invalid correct_option_index {idx!r} (use 0, 1, 2 or 3)")
    if not (q.get("question_text") or "").strip():
        problems.append("question_text is empty")
    skill, topic = q.get("skill"), q.get("topic")
    if skill not in SKILL_TOPICS:
        problems.append(f"unknown skill {skill!r}")
    else:
        allowed = set(SKILL_TOPICS[skill]) | set((extra_topics or {}).get(skill, ()))
        if topic not in allowed:
            problems.append(f"unknown topic {topic!r} for skill {skill!r}")
    if q.get("difficulty") not in DIFFICULTIES:
        problems.append(f"bad difficulty {q.get('difficulty')!r}")
    if q.get("question_type") not in QUESTION_TYPES:
        problems.append(f"bad question_type {q.get('question_type')!r}")
    if not (q.get("explanation") or "").strip():
        problems.append("missing explanation")
    if q.get("origin") != "authored":
        problems.append(f"origin must be 'authored', got {q.get('origin')!r}")
    if not isinstance(q.get("practice"), bool):
        problems.append("practice must be true or false")
    if not isinstance(q.get("companies"), list) or any(c not in COMPANIES for c in q["companies"]):
        problems.append(f"bad company tags {q.get('companies')!r}")
    if q.get("question_type") == "Code Output" and not q.get("code") and not re.search(r"`[^`]+`", q.get("question_text") or ""):
        problems.append("Code Output question has no code to check")
    return problems


def course_problems(c: Dict[str, Any], other_slugs: Iterable[str]) -> List[str]:
    """Structure of one course. `other_slugs` are the slugs of the other courses (for prerequisites)."""
    problems: List[str] = []
    slug = c.get("slug") or ""
    if not SLUG_RE.fullmatch(slug):
        problems.append("slug must be 2-60 lowercase letters, digits or dashes")
    if not (c.get("title") or "").strip():
        problems.append("title is empty")
    if c.get("level") not in LEVELS:
        problems.append(f"level must be one of {', '.join(sorted(LEVELS))}")
    bad = [s for s in c.get("skills") or [] if s not in SKILLS_BY_NAME]
    if bad:
        problems.append(f"skills not in the skill catalogue: {bad}")
    bad_assess = [s for s in c.get("assessment_skills") or [] if s not in SKILL_TOPICS]
    if bad_assess:
        problems.append(f"assessment_skills with no question bank: {bad_assess}")
    modules = c.get("modules") or []
    if not 6 <= len(modules) <= 10:
        problems.append(f"{len(modules)} modules (need 6 to 10)")
    ids = [m.get("id") for m in modules]
    if len(set(ids)) != len(ids) or any(not i for i in ids):
        problems.append("module ids must be unique and not empty")
    for m in modules:
        if not (m.get("title") or "").strip() or not m.get("topics") or not isinstance(m.get("hours"), (int, float)) or m["hours"] <= 0:
            problems.append(f"module {m.get('id')!r} needs a title, topics and hours above 0")
    resources = c.get("resources") or []
    if not 2 <= len(resources) <= 3:
        problems.append("needs 2 or 3 resources")
    for r in resources:
        if not re.fullmatch(r"https://[^/\s]+/?", r.get("url") or ""):
            problems.append(f"resource {r.get('provider')!r} must be a provider home page (https://host/), not a deep link")
    known = set(other_slugs)
    if any(p not in known for p in c.get("prerequisites") or []):
        problems.append("unknown prerequisite course")
    return problems


def career_path_problems(cfg: Dict[str, Any], other_titles: Iterable[str]) -> List[str]:
    """Title, required skills and milestones of a career path."""
    problems: List[str] = []
    title = (cfg.get("title") or "").strip()
    if not title:
        problems.append("title is empty")
    elif title.lower() in {t.lower() for t in other_titles}:
        problems.append(f"another career path is already called {title!r}")
    skills = cfg.get("required_skills")
    if not isinstance(skills, list) or not skills or any(not isinstance(s, str) or not s.strip() or len(s) > 80 for s in skills):
        problems.append("required_skills needs at least one non-empty skill (80 characters at most each)")
    milestones = cfg.get("milestones")
    if not isinstance(milestones, list) or not milestones:
        problems.append("needs at least one milestone")
        return problems
    ids = [m.get("id") for m in milestones]
    if len(set(ids)) != len(ids) or any(not isinstance(i, str) or not ID_RE.fullmatch(i) for i in ids):
        problems.append("milestone ids must be unique (letters, digits, - and _)")
    numbers = sorted(m.get("number") for m in milestones)
    if numbers != list(range(1, len(milestones) + 1)):
        problems.append("milestone numbers must run 1, 2, 3 ... without gaps or repeats")
    for m in milestones:
        if not (m.get("title") or "").strip():
            problems.append(f"milestone {m.get('id')!r} has no title")
        if not isinstance(m.get("skills"), list) or not m["skills"] or any(not isinstance(s, str) or not s.strip() for s in m["skills"]):
            problems.append(f"milestone {m.get('id')!r} needs at least one skill")
    return problems
