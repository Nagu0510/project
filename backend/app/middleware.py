"""Request-level protections: a cap on request body size (M-03)."""
import json

from starlette.requests import Request

from app.config import settings
from app.limiter import default_limit_allows

MAX_JSON_BYTES = 1 * 1024 * 1024          # every JSON body in this API is far smaller (the largest field is 200 KB of code)
MAX_UPLOAD_BYTES = 10 * 1024 * 1024       # multipart: resume / question paper (8 MB file limit) plus form overhead


class BodyTooLarge(BaseException):
    """A BaseException on purpose: FastAPI turns any Exception raised while reading a body into a 400, this must reach the middleware."""


class BodySizeLimitMiddleware:
    """Refuse an oversized request body with 413 before it is read into memory.

    The Content-Length header is checked first; for chunked bodies (no length) the bytes are counted as they arrive.
    """

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        headers = {k: v for k, v in scope["headers"]}
        limit = MAX_UPLOAD_BYTES if headers.get(b"content-type", b"").startswith(b"multipart/") else MAX_JSON_BYTES
        declared = headers.get(b"content-length")
        if declared is not None and declared.isdigit() and int(declared) > limit:
            return await self._refuse(send, limit)

        seen = 0
        started = False

        async def counting_receive():
            nonlocal seen
            message = await receive()
            if message["type"] == "http.request":
                seen += len(message.get("body", b""))
                if seen > limit:
                    raise BodyTooLarge()
            return message

        async def tracking_send(message):
            nonlocal started
            if message["type"] == "http.response.start":
                started = True
            await send(message)

        try:
            await self.app(scope, counting_receive, tracking_send)
        except BodyTooLarge:
            if not started:
                await self._refuse(send, limit)

    @staticmethod
    async def _refuse(send, limit):
        body = json.dumps({"detail": f"The request is larger than the {limit // (1024 * 1024)} MB limit."}).encode()
        await send({"type": "http.response.start", "status": 413, "headers": [(b"content-type", b"application/json"), (b"content-length", str(len(body)).encode()), (b"connection", b"close")]})
        await send({"type": "http.response.body", "body": body})


API_CSP = "default-src 'none'; frame-ancestors 'none'"   # the API serves JSON only: nothing in a response may load or frame anything
DOC_PATHS = ("/docs", "/redoc", "/openapi.json")          # Swagger UI loads scripts from a CDN; these pages exist outside production only


class SecurityHeadersMiddleware:
    """Add the standard security headers to every API response (M-02). HSTS is sent only when ENV=production, i.e. behind HTTPS."""

    def __init__(self, app, hsts: bool = False):
        self.app = app
        self.hsts = hsts

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        path = scope.get("path", "")

        async def with_headers(message):
            if message["type"] == "http.response.start":
                present = {k.lower() for k, _ in message["headers"]}
                extra = {
                    b"x-content-type-options": b"nosniff",
                    b"x-frame-options": b"DENY",
                    b"referrer-policy": b"no-referrer",
                    b"permissions-policy": b"camera=(), microphone=(), geolocation=(), payment=(), usb=()",
                }
                if not path.startswith(DOC_PATHS):
                    extra[b"content-security-policy"] = API_CSP.encode()
                if path.startswith("/api/auth"):
                    extra[b"cache-control"] = b"no-store"  # tokens and user records are never cached
                if self.hsts:
                    extra[b"strict-transport-security"] = b"max-age=31536000; includeSubDomains"
                message["headers"] = list(message["headers"]) + [(k, v) for k, v in extra.items() if k not in present]
            await send(message)

        await self.app(scope, receive, with_headers)


class DefaultRateLimitMiddleware:
    """Every route gets at least the DEFAULT_RATE_LIMIT budget (M-04); routes with their own @limiter.limit keep the stricter one too."""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http" or scope["method"] == "OPTIONS" or default_limit_allows(Request(scope)):
            return await self.app(scope, receive, send)
        body = json.dumps({"detail": f"Too many requests ({settings.DEFAULT_RATE_LIMIT.replace('/', ' per ')}). Please wait a minute and try again."}).encode()
        await send({"type": "http.response.start", "status": 429, "headers": [(b"content-type", b"application/json"), (b"content-length", str(len(body)).encode()), (b"retry-after", b"60")]})
        await send({"type": "http.response.body", "body": body})
