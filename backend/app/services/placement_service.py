"""How a placement opportunity looks for one student: skill match and eligibility, from the student's own data only.

Nothing is guessed. A student with no assessed skills has no match (match_known is False), and a criterion the
student has not filled in on their profile (CGPA, branch, graduation year) leaves eligibility "unknown" with a
message saying what to add.
"""
from datetime import date, datetime
from typing import Any, Dict, List, Optional, Tuple

MATCH_FOR_ALERT = 50   # percent of the required skills a student must have for a "new placement" alert
DEADLINE_DAYS = 3


def skill_match(job: Dict[str, Any], user_skills: List[str]) -> Tuple[int, List[str]]:
    """(match percentage, missing required skills). Skills are compared case-insensitively, either way round."""
    skills = [s.lower() for s in user_skills]
    required = job.get("required_skills") or []
    missing = [r for r in required if not any(us in r.lower() or r.lower() in us for us in skills)]
    pct = int((len(required) - len(missing)) / len(required) * 100) if required else 0
    return pct, missing


def _year(value: Any) -> Optional[int]:
    try:
        return int(str(value).strip())
    except (TypeError, ValueError):
        return None


def eligibility(job: Dict[str, Any], profile: Dict[str, Any]) -> Dict[str, Any]:
    """{state: eligible | not_eligible | unknown, message, missing, reasons} for the criteria the job states."""
    missing: List[str] = []
    reasons: List[str] = []

    min_cgpa = job.get("minimum_cgpa")
    if min_cgpa:
        cgpa = profile.get("cgpa")
        if cgpa is None:
            missing.append("CGPA")
        elif cgpa < min_cgpa:
            reasons.append(f"Minimum CGPA is {min_cgpa}; yours is {cgpa}")

    branches = [b.strip().lower() for b in job.get("eligible_branches") or [] if b and b.strip()]
    if branches:
        branch = (profile.get("branch") or "").strip().lower()
        if not branch:
            missing.append("branch")
        elif not any(b in branch or branch in b for b in branches):
            reasons.append(f"Open to: {', '.join(job['eligible_branches'])}")

    wanted_year = _year(job.get("graduation_year"))
    if wanted_year:
        year = profile.get("graduation_year")
        if year is None:
            missing.append("graduation year")
        elif year != wanted_year:
            reasons.append(f"For the {wanted_year} batch; yours is {year}")

    if reasons:
        state, message = "not_eligible", "; ".join(reasons)
    elif missing:
        state, message = "unknown", f"Add {' and '.join(missing) if len(missing) < 3 else ', '.join(missing)} to see eligibility"
    elif not (min_cgpa or branches or wanted_year):
        state, message = "eligible", "No eligibility criteria listed"
    else:
        state, message = "eligible", "You meet the listed eligibility criteria"
    return {"state": state, "message": message, "missing": missing, "reasons": reasons}


def student_view(job: Dict[str, Any], user_skills: List[str], profile: Dict[str, Any]) -> Dict[str, Any]:
    """The job as one student sees it. The display status is only set when there is real data behind it."""
    pct, missing = skill_match(job, user_skills)
    known = bool(user_skills)
    elig = eligibility(job, profile)
    view = dict(job)
    view.update(match_known=known, match_percentage=pct if known else 0, missing_skills=missing[:2] if known else [], eligibility=elig)
    if job.get("status", "published") in ("published", "Ready to Apply", "Skill Gap Identified"):
        if known and elig["state"] != "unknown":
            view["status"] = "Ready to Apply" if (pct >= 80 and elig["state"] == "eligible") else "Skill Gap Identified"
        else:
            view["status"] = "published"  # not enough data to say either
    return view


def worth_an_alert(job: Dict[str, Any], user_skills: List[str], profile: Dict[str, Any]) -> bool:
    """A student is told about a job when they have the skills for half of it and are not ruled out by its criteria."""
    if not user_skills:
        return False
    pct, _ = skill_match(job, user_skills)
    return pct >= MATCH_FOR_ALERT and eligibility(job, profile)["state"] != "not_eligible"


def deadline_in_window(job: Dict[str, Any], today: date, days: int = DEADLINE_DAYS) -> Optional[int]:
    """Days until the deadline when it is today or within `days` days, else None."""
    raw = job.get("deadline")
    if not raw:
        return None
    try:
        when = datetime.fromisoformat(str(raw)[:10]).date()
    except ValueError:
        return None
    left = (when - today).days
    return left if 0 <= left <= days else None
