"""Check the production settings BEFORE you deploy:   python scripts/check_production_env.py   (run from backend/)

It reads backend/.env (or --env-file PATH) and the process environment (the environment wins, like the app) and reports missing or unsafe
settings: debug on, a weak JWT secret, a wildcard or non-HTTPS frontend origin, the in-memory database, a local MongoDB, the local-code
sandbox, a weak bcrypt cost, half-configured email, demo accounts. Add --check-db to also look for demo data in the database.

It prints setting NAMES and fixed messages only, never a value. Exit code 0 = no FAIL (warnings may remain), 1 = at least one FAIL.
"""
import argparse
import os
import sys
from pathlib import Path
from typing import Dict, List, Mapping, Optional, Tuple

BACKEND_DIR = Path(__file__).resolve().parent.parent
WEAK_MARKERS = ("change", "secret", "your_jwt", "replace_with", "password", "example", "test", "default", "demo", "12345")
TRUE = {"1", "true", "yes", "on"}
Finding = Tuple[str, str, str]  # (level, setting, message)


def truthy(value: Optional[str]) -> bool:
    return (value or "").strip().lower() in TRUE


def load_env(env_file: Optional[Path]) -> Dict[str, str]:
    """backend/.env (if it exists) overlaid by the process environment."""
    values: Dict[str, str] = {}
    path = env_file or BACKEND_DIR / ".env"
    if path.exists():
        from dotenv import dotenv_values

        values.update({k: v for k, v in dotenv_values(path).items() if v is not None})
    values.update(os.environ)
    return values


def check(env: Mapping[str, str], demo_records: Optional[int] = None) -> List[Finding]:
    """The findings for these settings. `demo_records` = how many demo-flagged users the database has (None = not checked)."""
    out: List[Finding] = []

    def fail(name: str, msg: str) -> None:
        out.append(("FAIL", name, msg))

    def warn(name: str, msg: str) -> None:
        out.append(("WARN", name, msg))

    def ok(name: str, msg: str) -> None:
        out.append(("OK", name, msg))

    get = lambda k, d="": (env.get(k) or d).strip()  # noqa: E731

    if get("ENV", "development") != "production":
        fail("ENV", "must be 'production' (it turns off /docs, /redoc and /openapi.json, enables HSTS and the strict secret check)")
    else:
        ok("ENV", "production")
    for name in ("DEBUG", "APP_DEBUG", "FASTAPI_DEBUG"):
        if truthy(env.get(name)):
            fail(name, "debug mode is on; turn it off")

    secret = get("JWT_SECRET_KEY")
    if not secret:
        fail("JWT_SECRET_KEY", "is missing; the app will not start without it")
    elif len(secret) < 32:
        fail("JWT_SECRET_KEY", "is shorter than 32 characters")
    elif any(m in secret.lower() for m in WEAK_MARKERS):
        fail("JWT_SECRET_KEY", "looks like a placeholder or a guessable word; generate a random one")
    elif len(set(secret)) < 12:
        fail("JWT_SECRET_KEY", "has too little variety (repeated characters); generate a random one")
    else:
        ok("JWT_SECRET_KEY", "long and random-looking")

    if truthy(env.get("ENABLE_MEMORY_FALLBACK")):
        fail("ENABLE_MEMORY_FALLBACK", "the throwaway in-memory database must be off in production")

    mongo = get("MONGODB_URL")
    if not mongo:
        fail("MONGODB_URL", "is missing (the default is a local MongoDB)")
    elif any(h in mongo for h in ("localhost", "127.0.0.1", "0.0.0.0", "[::1]")):
        fail("MONGODB_URL", "points at this machine; use your MongoDB Atlas connection string")
    elif not mongo.startswith("mongodb+srv://") and "tls=true" not in mongo.lower() and "ssl=true" not in mongo.lower():
        warn("MONGODB_URL", "is not mongodb+srv:// and does not ask for TLS")
    else:
        ok("MONGODB_URL", "a remote database")

    front = get("FRONTEND_URL")
    if not front:
        fail("FRONTEND_URL", "is missing; it is the only origin CORS allows")
    elif "*" in front:
        fail("FRONTEND_URL", "contains a wildcard; CORS must name your real frontend origin")
    elif front.lower().startswith("http://") or not front.lower().startswith("https://"):
        fail("FRONTEND_URL", "must be an https:// origin")
    elif any(h in front for h in ("localhost", "127.0.0.1")):
        fail("FRONTEND_URL", "points at this machine; use your deployed frontend origin")
    elif front.endswith("/"):
        warn("FRONTEND_URL", "ends with '/'; CORS origins are compared exactly, write it without the trailing slash")
    else:
        ok("FRONTEND_URL", "an https origin")
    for name in ("CORS_ORIGINS", "CORS_ALLOW_ORIGINS", "ALLOWED_ORIGINS"):
        if "*" in get(name):
            fail(name, "contains a wildcard origin")

    mode = get("SANDBOX_MODE", "online")
    if mode == "subprocess":
        fail("SANDBOX_MODE", "'subprocess' runs student code on the server without isolation; use 'online' (or 'docker')")
    elif mode == "online" and get("CODE_PROVIDER", "judge0_ce") == "judge0_ce" and not get("CODE_API_URL"):
        warn("CODE_PROVIDER", "is the free shared Judge0 instance: it can be slow or busy; consider your own CODE_API_URL")
    else:
        ok("SANDBOX_MODE", mode)

    try:
        rounds = int(get("BCRYPT_ROUNDS", "12"))
    except ValueError:
        rounds = 0
    if rounds < 10:
        fail("BCRYPT_ROUNDS", "is too low (or not a number); 12 is the default")
    elif rounds < 12:
        warn("BCRYPT_ROUNDS", "is below 12")

    if truthy(env.get("EMAIL_ENABLED")):
        if not (get("SMTP_USER") and get("SMTP_APP_PASSWORD")):
            fail("EMAIL_ENABLED", "is on but SMTP_USER or SMTP_APP_PASSWORD is missing")
        else:
            ok("EMAIL_ENABLED", "on, with SMTP credentials set")
    else:
        warn("EMAIL_ENABLED", "is off: verification and password-reset links are only logged, so users cannot receive them")

    if not get("GOOGLE_CLIENT_ID"):
        warn("GOOGLE_CLIENT_ID", "is empty: the Google sign-in button stays hidden (fine if you do not use it)")

    try:
        if int(get("ACCESS_TOKEN_EXPIRE_MINUTES", "30")) > 60:
            warn("ACCESS_TOKEN_EXPIRE_MINUTES", "is above 60; short access tokens limit the damage of a leak")
    except ValueError:
        fail("ACCESS_TOKEN_EXPIRE_MINUTES", "is not a number")

    for name in ("DEMO_MODE", "ENABLE_DEMO_ACCOUNTS", "DEMO_ACCOUNTS", "ENABLE_DEMO_LOGIN"):
        if truthy(env.get(name)):
            fail(name, "demo accounts are enabled; production must have none")
    if demo_records:
        fail("database", f"contains {demo_records} demo student record(s); remove them with: python scripts/seed_demo_data.py --yes --reset")
    elif demo_records == 0:
        ok("database", "no demo students")
    return out


def demo_count(env: Mapping[str, str]) -> Optional[int]:
    """Demo-flagged users in the database (None if it cannot be reached; the error type is printed, never the URL)."""
    try:
        from pymongo import MongoClient

        url = env.get("MONGODB_URL") or ""
        client = MongoClient(url, serverSelectionTimeoutMS=8000, **({"tls": True} if url.startswith("mongodb+srv://") else {}))
        return client[env.get("DATABASE_NAME") or "skillsense_ai"]["users"].count_documents({"demo": True})
    except Exception as exc:
        print(f"[WARN] database: could not check for demo data ({type(exc).__name__})")
        return None


def main(argv: Optional[List[str]] = None) -> int:
    ap = argparse.ArgumentParser(description="Report missing or unsafe production settings (never prints a value).")
    ap.add_argument("--env-file", type=Path, help="read this file instead of backend/.env")
    ap.add_argument("--check-db", action="store_true", help="also connect to MONGODB_URL and look for demo students")
    args = ap.parse_args(argv)
    env = load_env(args.env_file)
    findings = check(env, demo_count(env) if args.check_db else None)
    for level, name, message in findings:
        print(f"[{level}] {name}: {message}")
    fails = sum(1 for f in findings if f[0] == "FAIL")
    warns = sum(1 for f in findings if f[0] == "WARN")
    print(f"\nProduction check: {'FAILED' if fails else 'OK'} ({fails} problem{'s' if fails != 1 else ''} to fix, {warns} warning{'s' if warns != 1 else ''}).")
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
