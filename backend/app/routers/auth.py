import hashlib
import logging
import secrets
import uuid
from datetime import datetime, timedelta

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Request, Response, status
from google.auth.exceptions import TransportError
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError

from app.config import settings
from app.database import require_db
from app.limiter import limiter
from app.models.user import (
    AdminLogin,
    ForgotPasswordRequest,
    GoogleLoginRequest,
    PasswordChangeRequest,
    ResetPasswordRequest,
    Token,
    UserCreate,
    UserLogin,
    UserOut,
    to_user_out,
)
from app.services import auth_service
from app.services.auth_service import (
    DUMMY_HASH,
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    is_legacy_hash,
    verify_password,
)
from app.services.email_service import send_email
from app.utils.security import get_current_user, load_user_for_token, unauthorized
from app.utils.timeutil import utcnow

logger = logging.getLogger("skillsense_auth")
router = APIRouter(prefix="/auth", tags=["Authentication"])

REFRESH_COOKIE = "skillsense_refresh"
MAX_FAILED_LOGINS = 5
LOCKOUT = timedelta(minutes=15)
RESET_TTL = timedelta(minutes=30)
VERIFY_TTL = timedelta(hours=24)
GENERIC_LOGIN_ERROR = "Invalid email or password"
GENERIC_RESET_MESSAGE = "If an account exists for that email, a password reset link has been sent."


def _hash_token(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


def _set_refresh_cookie(response: Response, user_id: str, role: str) -> None:
    response.set_cookie(
        REFRESH_COOKIE,
        create_refresh_token(user_id, role),
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400,
        httponly=True,
        samesite="lax",
        secure=settings.is_production,
        path=f"{settings.API_V1_STR}/auth",
    )


def _clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(REFRESH_COOKIE, path=f"{settings.API_V1_STR}/auth")


def _start_session(response: Response, user: dict) -> Token:
    _set_refresh_cookie(response, user["id"], user["role"])
    return Token(access_token=create_access_token(user["id"], user["role"]), user=to_user_out(user))


def _lock_check(user: dict, now: datetime) -> None:
    locked_until = user.get("locked_until")
    if locked_until and locked_until > now:
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            "Too many failed sign-in attempts. Please try again later.",
            headers={"Retry-After": str(int((locked_until - now).total_seconds()))},
        )


async def _authenticate(email: str, password: str, role: str) -> dict:
    """Check credentials for exactly one role, with lockout; always the same error on failure."""
    db = require_db()
    user = await db["users"].find_one({"email": email.lower().strip()}, {"_id": 0})
    # Unknown email, wrong role, or an account with no password (Google-only): same error, similar timing.
    if not user or user.get("role") != role or not user.get("password"):
        verify_password(password, DUMMY_HASH)
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, GENERIC_LOGIN_ERROR)

    now = utcnow()
    _lock_check(user, now)

    if not verify_password(password, user["password"]):
        updated = await db["users"].find_one_and_update(
            {"id": user["id"]}, {"$inc": {"failed_logins": 1}},
            return_document=ReturnDocument.AFTER, projection={"failed_logins": 1},
        )
        if updated and updated.get("failed_logins", 0) >= MAX_FAILED_LOGINS:
            await db["users"].update_one(
                {"id": user["id"]}, {"$set": {"locked_until": now + LOCKOUT, "failed_logins": 0}}
            )
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, GENERIC_LOGIN_ERROR)

    changes = {"failed_logins": 0, "locked_until": None, "last_login_at": now}
    if is_legacy_hash(user["password"]):
        changes["password"] = hash_password(password)  # upgrade old SHA-256 hash to bcrypt
        user["password"] = changes["password"]
    await db["users"].update_one({"id": user["id"]}, {"$set": changes})
    return user


async def _issue_token(collection: str, user_id: str, ttl: timedelta) -> str:
    """Create a single-use random token. Only its SHA-256 hash is stored; the raw value goes in the email."""
    raw = secrets.token_urlsafe(32)
    db = require_db()
    await db[collection].delete_many({"user_id": user_id})
    await db[collection].insert_one({"user_id": user_id, "token_hash": _hash_token(raw), "expires_at": utcnow() + ttl})
    return raw


async def _queue_verification_email(background: BackgroundTasks, user: dict) -> None:
    raw = await _issue_token("email_verifications", user["id"], VERIFY_TTL)
    background.add_task(
        send_email, user["email"], "verify_email",
        name=user.get("name", ""), link=f"{settings.FRONTEND_URL}/verify-email?token={raw}", expires="24 hours",
    )


def _provider_after_password_set(user: dict) -> str:
    return "both" if user.get("google_sub") else "password"


@router.post("/register", response_model=Token, status_code=status.HTTP_201_CREATED)
@limiter.limit(settings.AUTH_RATE_LIMIT)
async def register(request: Request, response: Response, user_in: UserCreate, background: BackgroundTasks):
    db = require_db()
    email = user_in.email.lower().strip()
    if await db["users"].find_one({"email": email}, {"_id": 1}):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "An account with this email already exists")

    user_id = f"usr-{uuid.uuid4().hex[:8]}"
    path = user_in.career_goal or user_in.career_interest
    new_user = {
        "id": user_id,
        "name": user_in.name,
        "email": email,
        "password": hash_password(user_in.password),
        "auth_provider": "password",
        "email_verified": False,
        "role": "student",  # never taken from the client
        "college": user_in.college,
        "department": user_in.department,
        "year": user_in.year,
        "career_goal": path,
        "career_interest": path,
        "current_path": path,
        "preferred_language": user_in.preferred_language,
        "skill_level": user_in.skill_level,
        "readiness_score": 0,
        "skill_progress": 0,
        "assessments_completed": 0,
        "strong_skills": [],
        "gap_skills": [],
        "created_at": utcnow(),
    }
    try:
        await db["users"].insert_one(dict(new_user))  # unique index on email closes the race
    except DuplicateKeyError:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "An account with this email already exists")

    await db["student_profiles"].insert_one({
        "user_id": user_id,
        "name": user_in.name,
        "email": email,
        "college": user_in.college,
        "department": user_in.department,
        "current_year": user_in.year,
        "career_path": path,
        "preferred_language": user_in.preferred_language,
        "skill_level": user_in.skill_level,
        "skills": [],
        "target_companies": [],
    })
    await _queue_verification_email(background, new_user)
    return _start_session(response, new_user)


@router.post("/login", response_model=Token)
@limiter.limit(settings.AUTH_RATE_LIMIT)
async def login(request: Request, response: Response, credentials: UserLogin):
    user = await _authenticate(credentials.email, credentials.password, "student")
    return _start_session(response, user)


@router.post("/admin/login", response_model=Token)
@limiter.limit(settings.AUTH_RATE_LIMIT)
async def admin_login(request: Request, response: Response, credentials: AdminLogin):
    user = await _authenticate(credentials.email, credentials.password, "admin")
    return _start_session(response, user)


@router.post("/google", response_model=Token)
@limiter.limit(settings.AUTH_RATE_LIMIT)
async def google_login(request: Request, response: Response, data: GoogleLoginRequest, background: BackgroundTasks):
    """Sign in (or sign up) a student with a Google ID token. Admin accounts can never use this."""
    if not settings.GOOGLE_CLIENT_ID:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Google sign-in is not configured.")
    try:
        claims = await auth_service.verify_google_credential(data.credential)
    except TransportError:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Could not reach Google. Please try again.")
    except ValueError:  # bad signature, expired, wrong audience or issuer
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Google sign-in failed. Please try again.")
    if claims.get("email_verified") is not True or not claims.get("email") or not claims.get("sub"):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Your Google email address is not verified.")

    db = require_db()
    sub = claims["sub"]
    email = claims["email"].lower().strip()
    user = await db["users"].find_one({"google_sub": sub}, {"_id": 0}) or await db["users"].find_one({"email": email}, {"_id": 0})
    now = utcnow()

    if user:
        if user.get("role") != "student":
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Google sign-in is only available for student accounts.")
        if user.get("google_sub") and user["google_sub"] != sub:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "This email is linked to a different Google account.")
        _lock_check(user, now)
        changes = {
            "google_sub": sub,
            "email_verified": True,  # Google has verified this address
            "auth_provider": "both" if user.get("password") else "google",
            "failed_logins": 0,
            "locked_until": None,
            "last_login_at": now,
        }
        if not user.get("picture") and claims.get("picture"):
            changes["picture"] = claims["picture"]
        await db["users"].update_one({"id": user["id"]}, {"$set": changes})
        user.update(changes)
    else:
        user = {
            "id": f"usr-{uuid.uuid4().hex[:8]}",
            "name": (claims.get("name") or email.split("@")[0]).strip()[:100],
            "email": email,
            "password": None,
            "google_sub": sub,
            "auth_provider": "google",
            "email_verified": True,
            "picture": claims.get("picture"),
            "role": "student",
            "readiness_score": 0,
            "skill_progress": 0,
            "assessments_completed": 0,
            "strong_skills": [],
            "gap_skills": [],
            "created_at": now,
            "last_login_at": now,
        }
        try:
            await db["users"].insert_one(dict(user))
        except DuplicateKeyError:
            raise HTTPException(status.HTTP_409_CONFLICT, "Please try signing in again.")
        await db["student_profiles"].insert_one({
            "user_id": user["id"], "name": user["name"], "email": email, "skills": [], "target_companies": [],
        })
        background.add_task(send_email, email, "welcome", name=user["name"], link=settings.FRONTEND_URL)

    return _start_session(response, user)


@router.post("/refresh", response_model=Token)
@limiter.limit(settings.REFRESH_RATE_LIMIT)
async def refresh(request: Request, response: Response):
    """Exchange the httpOnly refresh cookie for a new access token."""
    raw = request.cookies.get(REFRESH_COOKIE)
    payload = decode_token(raw, "refresh") if raw else None
    if payload is None:
        raise unauthorized("Session expired; please sign in again")
    user = await load_user_for_token(payload)
    return Token(access_token=create_access_token(user["id"], user["role"]), user=to_user_out(user))


@router.post("/logout")
async def logout(request: Request, response: Response):
    """Revoke the refresh token (cookie) and the access token (header) if present."""
    db = require_db()
    candidates = [(request.cookies.get(REFRESH_COOKIE), "refresh")]
    header = request.headers.get("authorization", "")
    if header.lower().startswith("bearer "):
        candidates.append((header[7:].strip(), "access"))
    for raw, kind in candidates:
        payload = decode_token(raw, kind) if raw else None
        if payload:
            await db["revoked_tokens"].update_one(
                {"jti": payload["jti"]},
                {"$set": {"jti": payload["jti"], "expires_at": datetime.utcfromtimestamp(payload["exp"])}},
                upsert=True,
            )
    _clear_refresh_cookie(response)
    return {"success": True}


@router.get("/me", response_model=UserOut)
async def get_me(current_user: UserOut = Depends(get_current_user)):
    return current_user


@router.post("/change-password")
@limiter.limit(settings.AUTH_RATE_LIMIT)
async def change_password(
    request: Request,
    response: Response,
    data: PasswordChangeRequest,
    current_user: UserOut = Depends(get_current_user),
):
    """Change the password, or *set* one for an account that has none (Google sign-in)."""
    db = require_db()
    user = await db["users"].find_one({"id": current_user.id}, {"_id": 0})
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User account not found")
    if user.get("password"):
        if not data.current_password or not verify_password(data.current_password, user["password"]):
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Current password is incorrect")
        if data.new_password == data.current_password:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "New password must be different from the current one")

    # password_changed_at invalidates every token issued before now (access and refresh).
    await db["users"].update_one(
        {"id": user["id"]},
        {"$set": {
            "password": hash_password(data.new_password),
            "auth_provider": _provider_after_password_set(user),
            "password_changed_at": utcnow(),
            "failed_logins": 0,
            "locked_until": None,
        }},
    )
    _set_refresh_cookie(response, user["id"], user["role"])  # keep this device signed in
    return {
        "success": True,
        "message": "Password saved. Other devices have been signed out.",
        "access_token": create_access_token(user["id"], user["role"]),
    }


@router.post("/forgot-password")
@limiter.limit("5/minute")
async def forgot_password(request: Request, data: ForgotPasswordRequest, background: BackgroundTasks):
    db = require_db()
    email = data.email.lower().strip()
    user = await db["users"].find_one({"email": email}, {"id": 1, "name": 1})
    if user:
        raw = await _issue_token("password_resets", user["id"], RESET_TTL)
        background.add_task(
            send_email, email, "reset_password",
            name=user.get("name", ""), link=f"{settings.FRONTEND_URL}/reset-password?token={raw}", expires="30 minutes",
        )
    return {"message": GENERIC_RESET_MESSAGE}


@router.post("/reset-password")
@limiter.limit("10/minute")
async def reset_password(request: Request, data: ResetPasswordRequest):
    db = require_db()
    # find_one_and_delete makes the token single-use even under concurrent requests
    record = await db["password_resets"].find_one_and_delete(
        {"token_hash": _hash_token(data.token), "expires_at": {"$gt": utcnow()}}
    )
    if not record:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This reset link is invalid or has expired.")
    user = await db["users"].find_one({"id": record["user_id"]}, {"_id": 0}) or {}
    await db["users"].update_one(
        {"id": record["user_id"]},
        {"$set": {
            "password": hash_password(data.new_password),
            "auth_provider": _provider_after_password_set(user),
            "password_changed_at": utcnow(),
            "failed_logins": 0,
            "locked_until": None,
        }},
    )
    return {"success": True, "message": "Password reset. You can now sign in."}


@router.post("/send-verification")
@limiter.limit("5/minute")
async def send_verification(
    request: Request, background: BackgroundTasks, current_user: UserOut = Depends(get_current_user)
):
    """(Re)send the email-verification link to the signed-in user."""
    if current_user.email_verified:
        return {"message": "Your email is already verified."}
    await _queue_verification_email(background, {"id": current_user.id, "email": current_user.email, "name": current_user.name})
    return {"message": "Verification email sent. Check your inbox."}


@router.get("/verify-email")
@limiter.limit("20/minute")
async def verify_email(request: Request, background: BackgroundTasks, token: str = Query(..., min_length=20, max_length=200)):
    db = require_db()
    record = await db["email_verifications"].find_one_and_delete(
        {"token_hash": _hash_token(token), "expires_at": {"$gt": utcnow()}}
    )
    if not record:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This verification link is invalid or has expired.")
    user = await db["users"].find_one_and_update(
        {"id": record["user_id"]}, {"$set": {"email_verified": True}}, projection={"_id": 0, "email": 1, "name": 1},
    )
    if user:
        background.add_task(send_email, user["email"], "welcome", name=user.get("name", ""), link=settings.FRONTEND_URL)
    return {"success": True, "message": "Email verified. Thank you!"}
