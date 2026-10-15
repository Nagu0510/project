"""In-app notifications and their email copies.

Every notification is stored in the `notifications` collection (the bell reads it from the API). A notification that
repeats an earlier event carries a `dedupe_key`, so the same event never notifies the same student twice, and an email
is only sent when the notification was newly created. Failures here are logged (error type only) and never break the
request or the background task that triggered them.

Emails (placement matches and deadlines only) go to a student only if their email is verified AND they turned on
"email notifications" in Settings (default off). Each carries a signed one-click unsubscribe link.
"""
import logging
import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from jose import JWTError, jwt

from app.config import settings
from app.repositories import jobs as job_runs
from app.repositories import notifications, placements, profiles, users
from app.services import email_service, placement_service
from app.utils.timeutil import utcnow

logger = logging.getLogger("skillsense_notifications")

UNSUBSCRIBE_DAYS = 90
DAILY_JOB = "placement_deadlines"


# ---- one notification -------------------------------------------------------------

async def notify(user_id: str, kind: str, title: str, body: str, link: Optional[str] = None, dedupe_key: Optional[str] = None) -> bool:
    """Create a notification. True when a new one was stored (False for a repeat or a failure)."""
    doc = {"id": f"notif-{uuid.uuid4().hex[:10]}", "user_id": user_id, "type": kind, "title": title, "message": body, "body": body, "link": link}
    try:
        if dedupe_key:
            return await notifications.create_once(doc, dedupe_key)
        await notifications.create(doc)
        return True
    except Exception as exc:  # never break the caller; the error type is logged, not the payload
        logger.error("Could not create a '%s' notification (%s).", kind, type(exc).__name__)
        return False


# ---- one-click unsubscribe -----------------------------------------------------------

def make_unsubscribe_token(user_id: str, version: int = 0) -> str:
    claims = {"sub": user_id, "type": "unsubscribe", "ver": version, "exp": datetime.now(timezone.utc) + timedelta(days=UNSUBSCRIBE_DAYS)}
    return jwt.encode(claims, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def read_unsubscribe_token(token: str) -> Optional[Dict[str, Any]]:
    """The token's claims if the signature, expiry and type are right; None for a tampered or expired token."""
    try:
        claims = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
    except JWTError:
        return None
    if claims.get("type") != "unsubscribe" or not claims.get("sub"):
        return None
    return claims


def unsubscribe_link(user: Dict[str, Any]) -> str:
    return f"{settings.FRONTEND_URL}/unsubscribe?token={make_unsubscribe_token(user['id'], int(user.get('unsub_version') or 0))}"


# ---- email copies -------------------------------------------------------------------

async def _email_copy(user: Dict[str, Any], kind: str, detail: str, link_path: str) -> bool:
    """Send the email copy if the student opted in and is verified. Logs the message type only."""
    if not email_service.may_send_placement_email(user):
        return False
    return await email_service.send_email(
        user["email"], kind, name=user.get("name", "there"), detail=detail,
        link=f"{settings.FRONTEND_URL}{link_path}", unsubscribe=unsubscribe_link(user),
    )


# ---- the triggers ---------------------------------------------------------------------

async def assessment_completed(user_id: str, attempt_id: str, title: str, score: int, gap_topics: List[str]) -> bool:
    gaps = f" Topics to work on: {', '.join(gap_topics[:3])}." if gap_topics else " No gap topics."
    return await notify(user_id, "assessment_completed", f"Assessment completed: {title}", f"You scored {score}%.{gaps}",
                        "/assessment-results", f"assessment:{attempt_id}")


async def courses_recommended(user: Any, limit: int = 3) -> int:
    """After a resume scan: tell the student about courses that are newly recommended for them (each course once)."""
    from app.services import recommendation_service

    try:
        rec = await recommendation_service.build_for_user(user)
    except Exception as exc:
        logger.error("Could not work out course recommendations (%s).", type(exc).__name__)
        return 0
    created = 0
    for item in rec.get("courses", [])[:limit]:
        if (item.get("progress") or {}).get("percent", 0) >= 100:
            continue
        reason = (item.get("reasons") or [""])[0]
        created += await notify(user.id, "course_recommended", f"New recommended course: {item['title']}",
                                reason or "Based on your latest resume scan.", f"/courses/{item['slug']}", f"reccourse:{item['slug']}")
    return created


async def paper_approved(paper: Dict[str, Any]) -> int:
    """An admin approved a paper: tell the students who have its company among their target companies."""
    company = (paper.get("company") or "").strip()
    if not company:
        return 0
    created = 0
    for user_id in await profiles.user_ids_targeting(company):
        created += await notify(user_id, "paper_approved", f"New {company} questions are available",
                                f"{paper.get('exam', 'A placement paper')} ({paper.get('year', '')}) was reviewed and its questions are now in Previous Questions.",
                                "/previous-questions", f"paper:{paper['id']}")
    return created


async def _students_with_profiles() -> List[Dict[str, Any]]:
    students = await users.list_students(limit=5000)
    by_id = {p["user_id"]: p for p in await profiles.list_all()}
    return [{**u, "_profile": by_id.get(u["id"], {})} for u in students]


async def placement_published(job: Dict[str, Any]) -> int:
    """A placement became visible: alert (and, if opted in, email) every student whose skills match it."""
    if job.get("status") != "published":
        return 0
    created = 0
    for student in await _students_with_profiles():
        if not placement_service.worth_an_alert(job, student.get("strong_skills") or [], student["_profile"]):
            continue
        pct, _ = placement_service.skill_match(job, student.get("strong_skills") or [])
        detail = f"{job['role']} at {job['company']} matches {pct}% of your skills."
        if await notify(student["id"], "placement_match", f"New placement: {job['company']}", detail, "/placements", f"placement:{job['id']}"):
            created += 1
            await _email_copy(student, "placement_match", detail, "/placements")
    return created


async def deadline_check(today: Optional[date] = None) -> int:
    """Alert matching students about published placements whose deadline is within 3 days. Safe to run twice: each
    student is notified (and emailed) once per placement."""
    today = today or utcnow().date()
    due = []
    for job in await placements.list_jobs(status="published"):
        left = placement_service.deadline_in_window(job, today)
        if left is not None:
            due.append((job, left))
    if not due:
        return 0
    created = 0
    for student in await _students_with_profiles():
        for job, left in due:
            skills = student.get("strong_skills") or []
            if not placement_service.worth_an_alert(job, skills, student["_profile"]):
                continue
            when = "today" if left == 0 else f"in {left} day{'s' if left != 1 else ''}"
            detail = f"The deadline for {job['role']} at {job['company']} is {when}."
            if await notify(student["id"], "placement_deadline", f"Deadline {when}: {job['company']}", detail, "/placements", f"deadline:{job['id']}"):
                created += 1
                await _email_copy(student, "placement_deadline", detail, "/placements")
    return created


# ---- the daily run -----------------------------------------------------------------------

async def run_daily_if_due(today: Optional[date] = None) -> bool:
    """Run the deadline check once per calendar day, even across restarts (the date is kept in the database).
    Returns True when it ran now. If the check fails the day is released, so the next attempt retries it."""
    today_text = (today or utcnow().date()).isoformat()
    if not await job_runs.claim_day(DAILY_JOB, today_text):
        return False
    try:
        await deadline_check(today)
    except Exception:
        await job_runs.release_day(DAILY_JOB, today_text)
        raise
    return True


