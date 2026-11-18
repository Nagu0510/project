"""Regression tests for the security audit fixes (see SECURITY_AUDIT.md). One section per finding id."""
import asyncio
import re
from datetime import datetime, timedelta, timezone
from pathlib import Path

import jwt
import pytest
from google.oauth2 import id_token

from app.config import Settings, settings
from app.limiter import reset_default_limits
from app.routers import auth as auth_router
from app.services import auth_service, notification_service
from tests.conftest import PASSWORD, bearer, register

APP_DIR = Path(__file__).resolve().parent.parent / "app"


# --------------------------------------------------------------------------- M-06 / L-03: PyJWT, fixed algorithm family
def test_python_jose_is_gone_from_the_code():
    offenders = [str(p) for p in APP_DIR.rglob("*.py") if re.search(r"^\s*(from|import)\s+jose\b", p.read_text(encoding="utf-8"), re.M)]
    assert offenders == []
    assert "jose" not in (APP_DIR.parent / "requirements.txt").read_text(encoding="utf-8").lower()


def _token(secret=None, alg="HS256", **claims):
    base = {"sub": "usr-1", "role": "student", "type": "access", "jti": "j1", "iat": int(datetime.now(timezone.utc).timestamp()),
            "exp": datetime.now(timezone.utc) + timedelta(minutes=5)}
    base.update(claims)
    return jwt.encode({k: v for k, v in base.items() if v is not None}, secret or settings.JWT_SECRET_KEY, algorithm=alg)


def test_tokens_round_trip_and_bad_ones_are_refused():
    good = auth_service.create_access_token("usr-1", "student")
    assert auth_service.decode_token(good, "access")["sub"] == "usr-1"
    assert auth_service.decode_token(good, "refresh") is None                       # wrong type
    assert auth_service.decode_token(good[:-3] + "AAA", "access") is None           # tampered signature
    assert auth_service.decode_token(_token(secret="another-secret-" + "y" * 40), "access") is None  # signed with another key
    assert auth_service.decode_token(_token(exp=datetime.now(timezone.utc) - timedelta(seconds=5)), "access") is None  # expired
    assert auth_service.decode_token(_token(exp=None), "access") is None            # no expiry at all
    assert auth_service.decode_token(_token(iat=None), "access") is None            # no issue time
    assert auth_service.decode_token(_token(alg="HS512"), "access") is None         # a different algorithm than configured
    none_token = jwt.encode({"sub": "usr-1", "type": "access", "jti": "j", "iat": 1, "exp": 4102444800}, key=None, algorithm="none")
    assert auth_service.decode_token(none_token, "access") is None                  # the unsigned "none" algorithm


def test_unsubscribe_tokens_still_work_on_pyjwt():
    token = notification_service.make_unsubscribe_token("usr-1", 2)
    assert notification_service.read_unsubscribe_token(token)["ver"] == 2
    assert notification_service.read_unsubscribe_token(token[:-3] + "AAA") is None


def test_only_hmac_algorithms_are_accepted_in_settings(monkeypatch):
    monkeypatch.setenv("JWT_SECRET_KEY", "k" * 40)
    for bad in ("none", "RS256", "ES256"):
        with pytest.raises(Exception):
            Settings(JWT_ALGORITHM=bad, _env_file=None)
    assert Settings(JWT_ALGORITHM="HS384", _env_file=None).JWT_ALGORITHM == "HS384"


# --------------------------------------------------------------------------- H-01: Google must not keep an attacker's password
GOOGLE_CLIENT = "test-client.apps.googleusercontent.com"


@pytest.fixture
def google(monkeypatch):
    monkeypatch.setattr(settings, "GOOGLE_CLIENT_ID", GOOGLE_CLIENT)
    issued = {}

    def fake_verify(credential, request, audience=None):
        claims = issued.get(credential)
        if claims is None or claims["aud"] != audience:
            raise ValueError("bad token")
        return claims

    monkeypatch.setattr(id_token, "verify_oauth2_token", fake_verify)

    def make(sub, email):
        credential = f"cred-{len(issued)}-" + "x" * 30
        issued[credential] = {"sub": sub, "email": email, "email_verified": True, "aud": GOOGLE_CLIENT, "name": "Victim"}
        return credential

    return make


async def test_google_link_drops_the_password_of_an_unverified_account_and_revokes_its_sessions(client, db, google):
    # the attacker registers the victim's address with the attacker's own password (never verified) and holds a session
    attacker = await register(client, email="victim@example.com", name="Attacker", password="Attack3rPass1")
    attacker_token = attacker.json()["access_token"]
    assert (await db["users"].find_one({"email": "victim@example.com"}))["email_verified"] is False
    await asyncio.sleep(1.1)  # token times are whole seconds

    # the real owner signs in with Google
    r = await client.post("/api/auth/google", json={"credential": google("g-victim", "victim@example.com")})
    assert r.status_code == 200 and r.json()["user"]["email_verified"] is True
    stored = await db["users"].find_one({"email": "victim@example.com"})
    assert stored["password"] is None and stored["google_sub"] == "g-victim" and stored["auth_provider"] == "google"

    login = await client.post("/api/auth/login", json={"email": "victim@example.com", "password": "Attack3rPass1"})
    assert login.status_code == 401                                                       # the attacker's password is dead
    assert (await client.get("/api/auth/me", headers=bearer(attacker_token))).status_code == 401  # and so is the attacker's session
    assert (await client.get("/api/auth/me", headers=bearer(r.json()["access_token"]))).status_code == 200  # the owner is fine


async def test_google_link_keeps_the_password_of_a_verified_account(client, db, google):
    await register(client, email="owner@example.com", name="Owner", password=PASSWORD)
    await db["users"].update_one({"email": "owner@example.com"}, {"$set": {"email_verified": True}})
    r = await client.post("/api/auth/google", json={"credential": google("g-owner", "owner@example.com")})
    assert r.status_code == 200
    assert (await db["users"].find_one({"email": "owner@example.com"}))["auth_provider"] == "both"
    assert (await client.post("/api/auth/login", json={"email": "owner@example.com", "password": PASSWORD})).status_code == 200


# --------------------------------------------------------------------------- M-01: refresh-token rotation


def current_cookie(client):
    """The one refresh cookie in the jar (value, domain)."""
    found = [(c.value, c.domain) for c in client.cookies.jar if c.name == "skillsense_refresh"]
    assert len(found) == 1, found
    return found[0]


def replace_cookie(client, value, domain):
    client.cookies.clear()
    client.cookies.set("skillsense_refresh", value, domain=domain, path="/api/auth")

async def test_each_refresh_issues_a_new_cookie_and_the_old_one_dies(client, student, monkeypatch):
    monkeypatch.setattr(auth_router, "ROTATION_GRACE", timedelta(0))  # no grace: a replay is a replay
    first, domain = current_cookie(client)
    assert first
    r = await client.post("/api/auth/refresh")
    assert r.status_code == 200
    second = current_cookie(client)[0]
    assert second and second != first                              # rotated
    assert (await client.get("/api/auth/me", headers=bearer(r.json()["access_token"]))).status_code == 200

    # replaying the spent cookie fails
    replace_cookie(client, first, domain)
    assert (await client.post("/api/auth/refresh")).status_code == 401
    # the newer cookie still works and rotates again
    replace_cookie(client, second, domain)
    assert (await client.post("/api/auth/refresh")).status_code == 200
    assert current_cookie(client)[0] not in (first, second)


async def test_two_tabs_refreshing_at_once_are_not_signed_out(client, student):
    old, domain = current_cookie(client)
    assert (await client.post("/api/auth/refresh")).status_code == 200      # tab 1 rotates
    newer = current_cookie(client)[0]
    replace_cookie(client, old, domain)        # tab 2 still sends the old cookie, a moment later
    r = await client.post("/api/auth/refresh")
    assert r.status_code == 200 and r.json()["user"]["email"] == student["email"]   # allowed inside the grace window
    assert current_cookie(client)[0] == old                  # but it did not hand out yet another refresh cookie
    assert newer != old


async def test_logout_kills_the_refresh_cookie_even_inside_the_grace_window(client, student):
    cookie, domain = current_cookie(client)
    await client.post("/api/auth/logout", headers=bearer(student["token"]))
    replace_cookie(client, cookie, domain)
    assert (await client.post("/api/auth/refresh")).status_code == 401


async def test_a_password_change_still_revokes_refresh_cookies(client, student):
    await asyncio.sleep(1.1)
    old, domain = current_cookie(client)
    r = await client.post("/api/auth/change-password", headers=bearer(student["token"]), json={"current_password": PASSWORD, "new_password": "N3wSecret99x"})
    assert r.status_code == 200
    replace_cookie(client, old, domain)
    assert (await client.post("/api/auth/refresh")).status_code == 401


# --------------------------------------------------------------------------- H-02: resume files cannot exhaust memory
import io
import zipfile

from app.services import resume_extract


def _upload(client, student, name, data):
    return client.post("/api/resume/analyze", files={"file": (name, data, "application/octet-stream")}, data={"career_path": "backend"}, headers=bearer(student["token"]))


def test_render_dpi_is_capped_for_oversized_pages():
    assert resume_extract.render_dpi(595, 842) == resume_extract.OCR_DPI                     # A4 untouched
    dpi = resume_extract.render_dpi(2000, 2000)                                                # about 28 in square: shrunk
    assert resume_extract.MIN_RENDER_DPI <= dpi < resume_extract.OCR_DPI
    assert (2000 / 72 * dpi) * (2000 / 72 * dpi) <= resume_extract.MAX_RENDER_PIXELS
    with pytest.raises(resume_extract.ResumeFileError):
        resume_extract.render_dpi(14400, 14400)                                                # 200 in square: refused


async def test_a_huge_page_pdf_is_refused_not_rendered(client, student, db):
    import fitz
    from app.seed import seed_collections

    await seed_collections(db)

    doc = fitz.open()
    doc.new_page(width=14400, height=14400)  # blank, so it would be sent to OCR at full size
    data = doc.tobytes()
    doc.close()
    r = await _upload(client, student, "huge.pdf", data)
    assert r.status_code == 413 and "too large" in r.json()["detail"], r.text


async def test_a_zip_bomb_docx_is_refused(client, student, db):
    from app.seed import seed_collections

    await seed_collections(db)
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("word/document.xml", b"\0" * (resume_extract.MAX_DOCX_UNZIPPED + 1024 * 1024))  # tiny when compressed
    assert len(buf.getvalue()) < resume_extract.MAX_BYTES
    r = await _upload(client, student, "bomb.docx", buf.getvalue())
    assert r.status_code == 413 and "unreasonable size" in r.json()["detail"]


# --------------------------------------------------------------------------- H-03: the public matcher has size and rate limits
async def test_match_endpoint_rejects_oversized_input(client):
    assert (await client.post("/api/question-intelligence/match", json={"question_text": "word " * 2000})).status_code == 422   # 10,000 chars
    assert (await client.post("/api/question-intelligence/match", json={"question_text": "ok", "topic": "t" * 101})).status_code == 422
    assert (await client.post("/api/question-intelligence/match", json={"question_text": "What is a stack?"})).status_code == 200


async def test_match_endpoint_is_rate_limited(client):
    from app.limiter import limiter

    limiter.enabled = True
    limiter.reset()
    reset_default_limits()
    try:
        codes = [(await client.post("/api/question-intelligence/match", json={"question_text": "What is a stack?"})).status_code for _ in range(31)]
        assert codes[:30] == [200] * 30 and codes[30] == 429
    finally:
        limiter.enabled = False
        limiter.reset()
        reset_default_limits()


# --------------------------------------------------------------------------- M-03: every request model has size limits
def _request_models():
    import importlib
    import pkgutil

    import app.routers as routers_pkg
    from pydantic import BaseModel

    found = {}
    for info in pkgutil.iter_modules(routers_pkg.__path__):
        module = importlib.import_module(f"app.routers.{info.name}")
        for route in getattr(getattr(module, "router", None), "routes", []):
            dependant = getattr(route, "dependant", None)
            for param in (dependant.body_params if dependant else []):
                annotation = param.field_info.annotation
                if isinstance(annotation, type) and issubclass(annotation, BaseModel):
                    found[annotation] = f"{info.name} {route.path}"
                elif annotation is dict:
                    found[f"dict body of {route.path}"] = route.path
    return found


def _uncapped(model, path, out, depth=0):
    import typing

    from pydantic import BaseModel

    for name, field in model.model_fields.items():
        t = field.annotation
        if typing.get_origin(t) is typing.Union:
            options = [a for a in typing.get_args(t) if a is not type(None)]
            t = options[0] if len(options) == 1 else t
        origin = typing.get_origin(t)
        label = f"{path}.{name}"
        capped = any(getattr(m, "max_length", None) is not None for m in field.metadata)
        if t is str and not capped:
            out.append(f"{label} (text)")
        elif origin in (list, dict) or t is dict:
            if not capped:
                out.append(f"{label} (list/dict)")
            for arg in typing.get_args(t):
                if isinstance(arg, type) and issubclass(arg, BaseModel) and depth < 4:
                    _uncapped(arg, label + "[]", out, depth + 1)
        elif isinstance(t, type) and issubclass(t, BaseModel) and depth < 4:
            _uncapped(t, label, out, depth + 1)


def test_every_request_model_field_has_a_size_limit():
    from pydantic import BaseModel

    models = _request_models()
    assert len(models) > 25                                  # the sweep really found the request bodies
    problems = []
    for model, where in models.items():
        if isinstance(model, str):
            problems.append(model)                           # an untyped `body: dict` is never acceptable
        else:
            _uncapped(model, model.__name__, problems)
    assert problems == [], "request fields without a max_length: " + ", ".join(problems)


async def test_oversized_profile_and_registration_fields_are_422(client, student):
    h = bearer(student["token"])
    assert (await client.post("/api/auth/register", json={"name": "Big Fields", "email": "big@example.com", "password": PASSWORD, "college": "c" * 2000})).status_code == 422
    assert (await client.post("/api/auth/register", json={"name": "Big Pass", "email": "bigp@example.com", "password": "a1" * 500})).status_code == 422
    profile = (await client.get("/api/student/profile", headers=h)).json()
    assert (await client.put("/api/student/profile", headers=h, json={**profile, "college": "c" * 2000})).status_code == 422
    assert (await client.put("/api/student/profile", headers=h, json={**profile, "skills": ["Python"] * 500})).status_code == 422
    assert (await client.put("/api/student/profile", headers=h, json={**profile, "skills": ["x" * 500]})).status_code == 422
    assert (await client.put("/api/student/profile", headers=h, json=profile)).status_code == 200


async def test_practice_bodies_are_typed_and_limited(client, student, db):
    from app.seed import seed_collections

    await seed_collections(db)
    h = bearer(student["token"])
    assert (await client.post("/api/practice/problems/sum-two-numbers/attempt", headers=h, json={"language": "python", "code": "x" * 300_000})).status_code == 422
    assert (await client.post("/api/practice/problems/sum-two-numbers/attempt", headers=h, json={"language": "python", "code": "print(1)"})).status_code == 200
    q = (await client.get("/api/practice/questions", headers=h)).json()[0]["id"]
    for bad in ({"selected_option_index": {"$gt": 0}}, {"selected_option_index": "x"}, {"selected_option_index": 10**9}, {"selected_option_index": -1}):
        assert (await client.post(f"/api/practice/questions/{q}/answer", headers=h, json=bad)).status_code == 422, bad
    assert (await client.post(f"/api/practice/questions/{q}/answer", headers=h, json={"selected_option_index": 0})).status_code == 200


# --------------------------------------------------------------------------- M-03: request body size cap
async def test_oversized_json_body_is_refused_with_413(client):
    r = await client.post("/api/auth/login", content=b'{"email":"a@example.com","password":"' + b"x" * (2 * 1024 * 1024) + b'"}', headers={"content-type": "application/json"})
    assert r.status_code == 413 and "limit" in r.json()["detail"]


async def test_chunked_body_without_a_length_is_cut_off_too(client):
    async def chunks():
        for _ in range(40):
            yield b"x" * 65536                                # 2.5 MB, no Content-Length header

    r = await client.post("/api/auth/login", content=chunks(), headers={"content-type": "application/json"})
    assert r.status_code == 413


async def test_normal_and_upload_sized_requests_still_pass(client, student):
    assert (await client.post("/api/auth/login", json={"email": student["email"], "password": PASSWORD})).status_code == 200


# --------------------------------------------------------------------------- M-07: a 422 never repeats what was submitted
async def test_validation_errors_do_not_echo_the_submitted_password(client):
    secret = "short1"                                          # too short: rejected by the password policy
    r = await client.post("/api/auth/register", json={"name": "Echo Test", "email": "echo@example.com", "password": secret})
    assert r.status_code == 422
    assert secret not in r.text
    entry = r.json()["detail"][0]
    assert set(entry) == {"loc", "msg", "type"} and "Password must be" in entry["msg"]       # same useful message, no `input` / `ctx`
    r = await client.post("/api/auth/change-password", json={"current_password": "x", "new_password": secret})
    assert secret not in r.text


# --------------------------------------------------------------------------- M-11: application links are http(s) only
async def test_placement_application_link_must_be_http_or_https(client, admin):
    ha = bearer(admin["token"])
    job = {"company": "Acme", "role": "Dev", "required_skills": ["Python"]}
    for bad in ("javascript:alert(1)", "data:text/html,<b>x</b>", "ftp://files.example.com/a", "//evil.example/x", "https://"):
        assert (await client.post("/api/placements", headers=ha, json={**job, "application_link": bad})).status_code == 422, bad
    ok = await client.post("/api/placements", headers=ha, json={**job, "application_link": "https://careers.example.com/apply"})
    assert ok.status_code == 201 and ok.json()["application_link"] == "https://careers.example.com/apply"
    pid = ok.json()["id"]
    assert (await client.put(f"/api/placements/{pid}", headers=ha, json={**job, "application_link": "javascript:alert(1)"})).status_code == 422


# --------------------------------------------------------------------------- M-02: security headers
EXPECTED_HEADERS = {
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
    "referrer-policy": "no-referrer",
}


async def test_api_responses_carry_security_headers(client, student):
    for r in (await client.get("/health"), await client.get("/api/auth/me", headers=bearer(student["token"])), await client.get("/api/does-not-exist")):
        for name, value in EXPECTED_HEADERS.items():
            assert r.headers.get(name) == value, (r.url, name)
        assert "frame-ancestors 'none'" in r.headers["content-security-policy"]
        assert "camera=()" in r.headers["permissions-policy"]
        assert "strict-transport-security" not in r.headers                    # HTTPS-only header: never in development
    assert (await client.get("/api/auth/me", headers=bearer(student["token"]))).headers["cache-control"] == "no-store"
    assert "content-security-policy" not in (await client.get("/docs")).headers  # Swagger UI needs its CDN scripts (not served in production)


async def test_hsts_is_sent_only_when_asked_for():
    from app.middleware import SecurityHeadersMiddleware

    async def inner(scope, receive, send):
        await send({"type": "http.response.start", "status": 200, "headers": []})
        await send({"type": "http.response.body", "body": b""})

    async def headers_of(hsts):
        seen = {}

        async def send(message):
            if message["type"] == "http.response.start":
                seen.update({k.decode(): v.decode() for k, v in message["headers"]})

        async def receive():
            return {"type": "http.request", "body": b""}

        await SecurityHeadersMiddleware(inner, hsts=hsts)({"type": "http", "path": "/api/x", "headers": []}, receive, send)
        return seen

    assert "strict-transport-security" not in await headers_of(False)
    assert "max-age=" in (await headers_of(True))["strict-transport-security"]


async def test_cors_allows_only_the_needed_methods_and_headers(client):
    ask = {"Origin": "http://localhost:5173", "Access-Control-Request-Method": "POST"}
    r = await client.options("/api/auth/login", headers={**ask, "Access-Control-Request-Headers": "content-type,authorization"})
    assert r.status_code == 200 and r.headers["access-control-allow-origin"] == "http://localhost:5173"
    assert (await client.options("/api/auth/login", headers={**ask, "Access-Control-Request-Headers": "x-anything"})).status_code == 400   # not on the list
    assert (await client.options("/api/auth/login", headers={**ask, "Access-Control-Request-Method": "TRACE"})).status_code == 400
    assert "access-control-allow-origin" not in (await client.options("/api/auth/login", headers={**ask, "Origin": "https://evil.example"})).headers


def test_vite_serves_the_security_headers_and_google_sign_in_is_allowed():
    config = (APP_DIR.parent.parent / "vite.config.js").read_text(encoding="utf-8")
    for needle in ("headers: dev", "headers: prod", "X-Content-Type-Options", "X-Frame-Options", "Referrer-Policy", "Permissions-Policy", "frame-ancestors 'none'",
                   "https://accounts.google.com/gsi/client", "https://accounts.google.com/gsi/style", "frame-src https://accounts.google.com/gsi/",
                   "https://fonts.googleapis.com", "https://fonts.gstatic.com", "ws://localhost:*", "xfwd: true"):
        assert needle in config, needle


# --------------------------------------------------------------------------- M-04: every route has a rate limit
@pytest.fixture
def limits_on():
    from app.limiter import limiter

    limiter.enabled = True
    limiter.reset()
    reset_default_limits()
    yield limiter
    limiter.enabled = False
    limiter.reset()
    reset_default_limits()


async def test_routes_without_their_own_limit_get_the_default_per_user_limit(client, student, limits_on):
    h = bearer(student["token"])
    other = (await client.post("/api/auth/register", json={"name": "Other One", "email": "other1@example.com", "password": "Sup3rSecret1"})).json()
    codes = [(await client.get("/api/notifications", headers=h)).status_code for _ in range(240)]
    assert set(codes) == {200}
    blocked = await client.get("/api/notifications", headers=h)
    assert blocked.status_code == 429 and "Too many requests" in blocked.json()["detail"] and blocked.headers["retry-after"]
    assert (await client.get("/api/notifications", headers=bearer(other["access_token"]))).status_code == 200      # the budget is per user, not shared
    assert (await client.get("/api/previous-questions")).status_code == 200                                         # an anonymous client has its own


async def test_stricter_route_limits_still_win_over_the_default(client, limits_on):
    codes = [(await client.post("/api/auth/login", json={"email": "nobody@example.com", "password": "Wrong1234"})).status_code for _ in range(11)]
    assert codes[:10] == [401] * 10 and codes[10] == 429


async def test_admin_paper_upload_is_rate_limited(client, admin, limits_on):
    ha = bearer(admin["token"])
    data = {"company": "Acme", "exam": "Test", "year": "2025"}
    codes = [(await client.post("/api/admin/question-papers/upload", headers=ha, data=data, files={"file": ("a.txt", b"", "text/plain")})).status_code for _ in range(11)]
    assert codes[-1] == 429 and 429 not in codes[:10]


# --------------------------------------------------------------------------- M-05: limits use the real client address behind a proxy
async def test_rate_limit_key_is_the_forwarded_client_only_from_a_trusted_proxy(client, limits_on):
    import httpx
    from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware

    from app.main import app

    async def attempts(peer, forwarded, count):
        transport = httpx.ASGITransport(app=ProxyHeadersMiddleware(app, trusted_hosts="127.0.0.1"), client=(peer, 5000))
        async with httpx.AsyncClient(transport=transport, base_url="http://t") as c:
            return [(await c.post("/api/auth/login", headers={"X-Forwarded-For": forwarded(i)}, json={"email": "nobody@example.com", "password": "Wrong1234"})).status_code for i in range(count)]

    # the dev proxy / reverse proxy (trusted peer 127.0.0.1) forwards two different people: separate buckets
    assert (await attempts("127.0.0.1", lambda i: "203.0.113.10", 10)) == [401] * 10
    assert (await attempts("127.0.0.1", lambda i: "203.0.113.10", 1)) == [429]       # person A is out of attempts
    assert (await attempts("127.0.0.1", lambda i: "203.0.113.11", 1)) == [401]       # person B is not locked out by A
    # anyone else sending X-Forwarded-For is ignored: rotating the header does not give a fresh bucket
    codes = await attempts("198.51.100.9", lambda i: f"203.0.113.{100 + i}", 11)
    assert codes[:10] == [401] * 10 and codes[10] == 429


# --------------------------------------------------------------------------- M-09 (code part): no demo accounts, no DEMO_* settings
def test_demo_account_settings_and_code_are_gone():
    assert not [n for n in Settings.model_fields if n.startswith("DEMO_") or n == "ENABLE_DEMO_ACCOUNTS"]
    assert not hasattr(auth_service, "ensure_demo_accounts")
    for path in list(APP_DIR.rglob("*.py")) + [APP_DIR.parent / ".env.example"]:
        assert "DEMO_" not in path.read_text(encoding="utf-8"), path
