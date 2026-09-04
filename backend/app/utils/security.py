from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from typing import Optional
from app.services.auth_service import decode_access_token
from app.database import db_manager
from app.models.user import UserOut

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)

async def get_current_user(token: Optional[str] = Depends(oauth2_scheme)) -> Optional[UserOut]:
    """Verify Bearer token and retrieve authenticated user"""
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication credentials were not provided",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = decode_access_token(token)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired access token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token subject identifier missing",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # 1. Check in MongoDB if connected
    if db_manager.is_connected and db_manager.db is not None:
        try:
            user_doc = await db_manager.db["users"].find_one({"id": user_id})
            if user_doc:
                user_doc.pop("_id", None)
                return UserOut(**user_doc)
        except Exception:
            pass

    # 2. Check in-memory store
    user_dict = db_manager._memory_store["users"].get(user_id)
    if user_dict:
        u_copy = dict(user_dict)
        u_copy.pop("_id", None)
        return UserOut(**u_copy)

    # If user record does not exist, reject with 401 (do not fake login)
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="User account not found or session terminated",
        headers={"WWW-Authenticate": "Bearer"},
    )

async def get_optional_current_user(token: Optional[str] = Depends(oauth2_scheme)) -> Optional[UserOut]:
    """Optionally verify Bearer token; returns None if not provided or invalid without raising exception"""
    if not token:
        return None
    try:
        return await get_current_user(token)
    except Exception:
        return None

async def require_student(current_user: UserOut = Depends(get_current_user)) -> UserOut:
    """Enforce student role permission"""
    if current_user.role != "student":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: Student privileges required",
        )
    return current_user

async def require_admin(current_user: UserOut = Depends(get_current_user)) -> UserOut:
    """Enforce admin role permission"""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: Administrator privileges required",
        )
    return current_user
