from limits import parse
from limits.storage import MemoryStorage
from limits.strategies import FixedWindowRateLimiter
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

# ponytail: in-process memory. Behind a reverse proxy start uvicorn with --proxy-headers --forwarded-allow-ips <the proxy's
# address> (never "*") so request.client is the real client; use a Redis storage_uri for multi-worker deployments.
limiter = Limiter(key_func=get_remote_address, enabled=settings.ENV != "test")


# The default limit for EVERY route (middleware.DefaultRateLimitMiddleware): slowapi's own default_limits cannot see the endpoints of
# routers added with include_router, so the same `limits` library is used directly. The stricter @limiter.limit routes also keep theirs.
_default_storage = MemoryStorage()
_default_strategy = FixedWindowRateLimiter(_default_storage)
_default_item = parse(settings.DEFAULT_RATE_LIMIT)


def default_limit_allows(request) -> bool:
    """Count one request against the caller's default budget (per signed-in user, else per client address)."""
    if not limiter.enabled:
        return True
    return _default_strategy.hit(_default_item, user_or_ip(request))


def reset_default_limits() -> None:
    _default_storage.reset()
