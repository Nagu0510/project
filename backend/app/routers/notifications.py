from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from app.config import settings
from app.limiter import limiter
from app.models.user import UserOut
from app.repositories import notifications, users
from app.services import notification_service
from app.utils.security import require_student

router = APIRouter(prefix="/notifications", tags=["Notifications"])


class NotificationOut(BaseModel):
    id: str
    type: str = "info"
    title: str
    message: str = ""
    body: str = ""
    link: Optional[str] = None
    read: bool = False
    created_at: Optional[str] = None


@router.get("", response_model=List[NotificationOut])
async def my_notifications(current_user: UserOut = Depends(require_student)):
    """This student's own notifications, newest first. Empty until something real happens (for example finishing a course)."""
    return [
        NotificationOut(**{**n, "body": n.get("body") or n.get("message", ""), "created_at": n["created_at"].isoformat() if n.get("created_at") else None})
        for n in await notifications.list_for_user(current_user.id)
    ]


@router.post("/read-all")
async def read_all(current_user: UserOut = Depends(require_student)):
    return {"updated": await notifications.mark_all_read(current_user.id)}


@router.post("/{notification_id}/read")
async def read_one(notification_id: str, current_user: UserOut = Depends(require_student)):
    if not await notifications.mark_read(current_user.id, notification_id):
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"read": True}


class UnsubscribeBody(BaseModel):
    token: str = Field(min_length=20, max_length=2000)


@router.post("/unsubscribe")
@limiter.limit(settings.AUTH_RATE_LIMIT)
async def unsubscribe(request: Request, body: UnsubscribeBody):
    """One-click unsubscribe from the link in an email (no login). The signed token works once per student and turns
    email notifications off; a tampered, expired or already-used token is a 400."""
    claims = notification_service.read_unsubscribe_token(body.token)
    if claims is None:
        raise HTTPException(status_code=400, detail="This unsubscribe link is not valid.")
    if not await users.unsubscribe(claims["sub"], int(claims.get("ver") or 0)):
        raise HTTPException(status_code=400, detail="This unsubscribe link was already used or is no longer valid.")
    return {"unsubscribed": True, "message": "Email notifications are off. You can turn them on again in Settings."}
