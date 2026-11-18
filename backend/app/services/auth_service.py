import asyncio
import hashlib
import hmac
import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token
import jwt

from app.config import settings

logger = logging.getLogger("skillsense_auth")

# Format used before bcrypt: sha256(salt + password). Verify-only; upgraded on next login.
_LEGACY_SALT = "skillsense_ai_salt_2026_"
_BCRYPT_MAX_BYTES = 72


def _pw_bytes(password: str) -> bytes:
    return password.encode("utf-8")[:_BCRYPT_MAX_BYTES]


def hash_password(password: str) -> str:
    return bcrypt.hashpw(_pw_bytes(password), bcrypt.gensalt(settings.BCRYPT_ROUNDS)).decode()


def is_legacy_hash(hashed: str) -> bool:
    return not hashed.startswith("$2")


def verify_password(plain: str, hashed: str) -> bool:
    if not hashed:
        return False
    if is_legacy_hash(hashed):
        legacy = hashlib.sha256((_LEGACY_SALT + plain).encode()).hexdigest()
        return hmac.compare_digest(legacy, hashed)
    try:
        return bcrypt.checkpw(_pw_bytes(plain), hashed.encode())
    except ValueError:
        return False


# Verified against when the email is unknown so response time doesn't reveal which emails exist.
DUMMY_HASH = hash_password("timing-equalisation-only")


# ---- tokens -------------------------------------------------------------

def _encode(user_id: str, role: str, token_type: str, ttl: timedelta) -> str:
    now = datetime.now(timezone.utc)
    claims = {
        "sub": user_id,
        "role": role,
        "type": token_type,
        "jti": uuid.uuid4().hex,
        "iat": int(now.timestamp()),
        "exp": now + ttl,
    }
    return jwt.encode(claims, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def create_access_token(user_id: str, role: str) -> str:
    return _encode(user_id, role, "access", timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES))


def create_refresh_token(user_id: str, role: str) -> str:
    return _encode(user_id, role, "refresh", timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS))


def decode_token(token: str, expected_type: str) -> Optional[dict]:
    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM], options={"require": ["exp", "iat"]})
    except jwt.PyJWTError:
        return None
    if payload.get("type") != expected_type or not payload.get("sub") or not payload.get("jti"):
        return None
    return payload


# ---- Google sign-in -------------------------------------------------------

async def verify_google_credential(credential: str) -> dict:
    """Verify a Google ID token (signature, expiry, issuer, audience == our client id).

    Raises ValueError for an invalid token and google.auth.exceptions.TransportError if Google's
    certificates can't be fetched. The blocking HTTP call runs in a worker thread.
    """
    def _verify() -> dict:
        return id_token.verify_oauth2_token(credential, google_requests.Request(), settings.GOOGLE_CLIENT_ID)

    return await asyncio.to_thread(_verify)
