"""Transactional email over SMTP (Gmail: STARTTLS on smtp.gmail.com:587 with an App Password).

Sending runs in a worker thread so the event loop is never blocked. When EMAIL_ENABLED is false, or
sending fails, the message *type* is logged (never the password or the message) and, in development
only, the link is printed to the console so flows stay testable without a mail server.
"""
import asyncio
import html
import logging
import smtplib
import ssl
from email.message import EmailMessage
from pathlib import Path
from string import Template
from typing import Tuple

from app.config import settings

logger = logging.getLogger("skillsense_email")

TEMPLATE_DIR = Path(__file__).resolve().parent.parent / "templates" / "email"
APP_NAME = "SkillSense AI"

_SUBJECTS = {
    "welcome": f"Welcome to {APP_NAME}",
    "reset_password": f"Reset your {APP_NAME} password",
    "verify_email": f"Confirm your email for {APP_NAME}",
    "placement_match": f"A new placement matches your skills ({APP_NAME})",
    "placement_deadline": f"A placement deadline is close ({APP_NAME})",
}
_TEXT = {
    "welcome": "Hi $name,\n\nYour $app_name account is ready. Open it here: $link\n",
    "reset_password": (
        "Hi $name,\n\nUse this link to choose a new password (works once, expires in $expires):\n$link\n\n"
        "If you didn't ask for this, ignore this email.\n"
    ),
    "verify_email": "Hi $name,\n\nConfirm your email address (link expires in $expires):\n$link\n",
    "placement_match": "Hi $name,\n\n$detail\n$link\n\nYou get this because email notifications are on in Settings. Unsubscribe: $unsubscribe\n",
    "placement_deadline": "Hi $name,\n\n$detail\n$link\n\nYou get this because email notifications are on in Settings. Unsubscribe: $unsubscribe\n",
}


def render(kind: str, **ctx) -> Tuple[str, str, str]:
    """Return (subject, html, plain_text) for a message kind."""
    if kind not in _SUBJECTS:
        raise ValueError(f"Unknown email kind: {kind}")
    values = {"app_name": APP_NAME, "name": "there", "link": "", "expires": "", "detail": "", "unsubscribe": "", **ctx}
    safe = {k: html.escape(str(v), quote=True) for k, v in values.items()}
    body = Template((TEMPLATE_DIR / f"{kind}.html").read_text(encoding="utf-8")).safe_substitute(safe)
    page = Template((TEMPLATE_DIR / "layout.html").read_text(encoding="utf-8")).safe_substitute(
        title=html.escape(_SUBJECTS[kind]), preheader=html.escape(_SUBJECTS[kind]), app_name=APP_NAME, body=body
    )
    text = Template(_TEXT[kind]).safe_substitute({k: str(v) for k, v in values.items()})
    return _SUBJECTS[kind], page, text


def _smtp_send(to: str, subject: str, html_body: str, text_body: str) -> None:
    sender = settings.EMAIL_FROM or settings.SMTP_USER
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = sender
    msg["To"] = to
    msg.set_content(text_body)
    msg.add_alternative(html_body, subtype="html")
    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15) as smtp:
        smtp.starttls(context=ssl.create_default_context())
        smtp.login(settings.SMTP_USER, settings.SMTP_APP_PASSWORD.get_secret_value())
        smtp.send_message(msg)


def _dev_echo(kind: str, to: str, link: str) -> None:
    if settings.ENV == "development" and link:
        print(f"[dev email] {kind} -> {to}\n            {link}", flush=True)


async def send_email(to: str, kind: str, **ctx) -> bool:
    """Send one message; returns True only if SMTP accepted it. Never raises."""
    link = ctx.get("link", "")
    try:
        subject, html_body, text_body = render(kind, **ctx)
    except (ValueError, OSError) as exc:
        logger.error("Could not render '%s' email (%s).", kind, type(exc).__name__)
        return False

    if not settings.EMAIL_ENABLED:
        logger.info("Email disabled: '%s' message not sent.", kind)
        _dev_echo(kind, to, link)
        return False
    try:
        await asyncio.to_thread(_smtp_send, to, subject, html_body, text_body)
    except Exception as exc:  # smtplib/ssl/socket errors; log the type only (messages can echo credentials)
        logger.error("Sending '%s' email failed (%s).", kind, type(exc).__name__)
        _dev_echo(kind, to, link)
        return False
    logger.info("Sent '%s' email.", kind)
    return True


def may_send_placement_email(user: dict) -> bool:
    """Placement emails go only to a verified address AND only if the student turned email notifications on (default off)."""
    return bool(user.get("email_verified")) and bool(user.get("email_notifications"))
