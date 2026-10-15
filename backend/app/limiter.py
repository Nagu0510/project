from slowapi import Limiter
from slowapi.util import get_remote_address

from app.config import settings
from app.services.auth_service import decode_token


def user_or_ip(request) -> str:
    """Rate-limit key: the authenticated user (from the access token) when there is one, else the client IP."""
    header = request.headers.get("authorization", "")
    if header.lower().startswith("bearer "):
        payload = decode_token(header[7:].strip(), "access")
        if payload:
            return f"user:{payload['sub']}"
    return get_remote_address(request)

# ponytail: keyed by client IP and in-process memory. Behind a reverse proxy configure
# uvicorn --proxy-headers so the real client IP is used; use a Redis storage_uri for
# multi-worker deployments.
limiter = Limiter(key_func=get_remote_address, enabled=settings.ENV != "test")
