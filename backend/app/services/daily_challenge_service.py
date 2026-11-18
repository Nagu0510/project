"""Daily challenge and streaks, built on the student's existing practice submissions (no second judge path).

DAY RULES (one place, so the app never mixes clocks):
  * Every timestamp is stored in UTC (naive UTC datetimes, `utcnow()`).
  * The DAILY CHALLENGE belongs to a UTC calendar day: everybody gets the same problem on the same UTC date, chosen from the date alone.
  * A STREAK DAY is the student's own local day: the UTC timestamp shifted by the student's stored `day_offset_minutes`
    (default 0 = UTC, range -720..840, saved with PUT /student/day-offset, which the browser sends once from its own clock).
  * A streak day is a day with at least one Accepted code submission (any problem), however many that day: it counts once.
  * The CURRENT streak is the run of consecutive streak days ending today, or ending yesterday while today has no Accepted submission yet
    (a streak is only broken once a whole day has passed without one). After a missed day it is 0.
  * The BEST streak is the longest such run ever.
"""
import hashlib
from datetime import date, datetime, timedelta
from typing import Any, Dict, Iterable, List, Optional, Set

from app.services import readiness_service as rs
from app.utils.timeutil import utcnow

MIN_OFFSET, MAX_OFFSET = -720, 840  # UTC-12:00 .. UTC+14:00
STREAK_BADGES = (("streak-7", "7-day streak", 7), ("streak-30", "30-day streak", 30))
SOLVED_BADGE = ("solved-10", "10 problems solved", 10)


def clamp_offset(minutes: Any) -> int:
    try:
        value = int(minutes)
    except (TypeError, ValueError):
        return 0
    return max(MIN_OFFSET, min(MAX_OFFSET, value))


def local_day(ts: datetime, offset_minutes: int = 0) -> date:
    """The student's calendar day of a UTC timestamp."""
    return (ts + timedelta(minutes=clamp_offset(offset_minutes))).date()


# ---------------------------------------------------------------------------------------------------------- the problem of the day
def _cycle_order(pool: List[Dict[str, Any]], cycle: int) -> List[Dict[str, Any]]:
    """Every problem once, in an order that depends only on the cycle number (a hash, so it looks random but is the same for everyone)."""
    return sorted(pool, key=lambda p: hashlib.sha256(f"skillsense-daily-{cycle}:{p['slug']}".encode()).hexdigest())


def problem_for_day(problems: Iterable[Dict[str, Any]], day: date) -> Optional[Dict[str, Any]]:
    """The same problem for everyone on the same UTC date, chosen from the date alone. The days are cut into cycles as long as the list of
    problems; inside a cycle every problem appears exactly once, in a hashed order, and the first problem of a cycle is never the last of the
    cycle before (so the same problem never comes two days in a row)."""
    pool = sorted((p for p in problems if p.get("function_name") and p.get("slug")), key=lambda p: p.get("id") or p["slug"])
    if not pool:
        return None
    n = len(pool)
    if n <= 2:
        return pool[day.toordinal() % n]
    cycle, position = divmod(day.toordinal(), n)
    order = _cycle_order(pool, cycle)
    if order[0]["slug"] == _cycle_order(pool, cycle - 1)[-1]["slug"]:
        order[0], order[1] = order[1], order[0]
    return order[position]


# ---------------------------------------------------------------------------------------------------------- streaks
def accepted_attempts(attempts: Iterable[Dict[str, Any]]) -> List[Dict[str, Any]]:
    return [a for a in attempts if a.get("problem_slug") and rs.is_submission(a) and rs.is_accepted(a) and isinstance(a.get("timestamp"), datetime)]


def accepted_days(attempts: Iterable[Dict[str, Any]], offset_minutes: int = 0) -> Set[date]:
    return {local_day(a["timestamp"], offset_minutes) for a in accepted_attempts(attempts)}


def streaks(days: Set[date], today: date) -> Dict[str, Any]:
    """current / best streak and the last day with an Accepted submission."""
    current = 0
    day = today if today in days else today - timedelta(days=1)
    while day in days:
        current += 1
        day -= timedelta(days=1)
    best = run = 0
    previous: Optional[date] = None
    for d in sorted(days):
        run = run + 1 if previous is not None and d - previous == timedelta(days=1) else 1
        best = max(best, run)
        previous = d
    return {"current": current, "best": best, "last_day": max(days).isoformat() if days else None}


def badges(best_streak: int, solved_count: int) -> List[Dict[str, Any]]:
    out = [{"key": key, "label": label, "target": target, "progress": min(best_streak, target), "earned": best_streak >= target, "kind": "streak"}
           for key, label, target in STREAK_BADGES]
    key, label, target = SOLVED_BADGE
    out.append({"key": key, "label": label, "target": target, "progress": min(solved_count, target), "earned": solved_count >= target, "kind": "solved"})
    return out


# ---------------------------------------------------------------------------------------------------------- what the API returns
def summarize(attempts: List[Dict[str, Any]], offset_minutes: int, now: Optional[datetime] = None) -> Dict[str, Any]:
    now = now or utcnow()
    offset = clamp_offset(offset_minutes)
    good = accepted_attempts(attempts)
    result = streaks({local_day(a["timestamp"], offset) for a in good}, local_day(now, offset))
    solved = {a["problem_slug"] for a in good}
    return {"current_streak": result["current"], "best_streak": result["best"], "last_solved_day": result["last_day"],
            "problems_solved": len(solved), "badges": badges(result["best"], len(solved)), "day_offset_minutes": offset}


def solved_today(attempts: Iterable[Dict[str, Any]], slug: str, now: Optional[datetime] = None) -> bool:
    """Was the challenge of this UTC day solved on this UTC day?"""
    today = (now or utcnow()).date()
    return any(a["problem_slug"] == slug and a["timestamp"].date() == today for a in accepted_attempts(attempts))
