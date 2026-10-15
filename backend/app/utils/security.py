from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer

from app.database import require_db
from app.models.user import UserOut, to_user_out
from app.services.auth_service import decode_token
from app.utils.timeutil import to_epoch

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)


def unauthorized(detail: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


async def load_user_for_token(payload: dict) -> dict:
    """Return the user document a verified token refers to, or raise 401.

    Rejects revoked tokens and tokens issued before the last password change.
    """
    db = require_db()
    if await db["revoked_tokens"].find_one({"jti": payload["jti"]}, {"_id": 1}):
        raise unauthorized("Session has been signed out")
    user = await db["users"].find_one({"id": payload["sub"]}, {"_id": 0})
    if not user:
        raise unauthorized("User account not found or session terminated")
    changed = user.get("password_changed_at")
    if changed and payload.get("iat", 0) < to_epoch(changed):
        raise unauthorized("Password was changed; please sign in again")
    return user


async def get_current_user(token: Optional[str] = Depends(oauth2_scheme)) -> UserOut:
    """Verify the Bearer access token and load the user (role always comes from the database)."""
    if not token:
        raise unauthorized("Authentication credentials were not provided")
    payload = decode_token(token, "access")
    if payload is None:
        raise unauthorized("Invalid or expired access token")
    return to_user_out(await load_user_for_token(payload))


async def get_optional_current_user(token: Optional[str] = Depends(oauth2_scheme)) -> Optional[UserOut]:
    """Like get_current_user but returns None for missing/invalid credentials."""
    if not token:
        return None
    try:
        return await get_current_user(token)
    except HTTPException:
        return None


async def require_student(current_user: UserOut = Depends(get_current_user)) -> UserOut:
    if current_user.role != "student":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: Student privileges required",
        )
    return current_user


async def require_admin(current_user: UserOut = Depends(get_current_user)) -> UserOut:
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: Administrator privileges required",
        )
    return current_user
