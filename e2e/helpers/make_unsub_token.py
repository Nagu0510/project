"""Print a one-click unsubscribe token for a generated test student (browser tests only).

    backend/.venv/Scripts/python.exe e2e/helpers/make_unsub_token.py p3-test-<timestamp>@example.com

Only generated p3-test-*@example.com accounts are accepted. Prints the signed token and nothing else (never the signing key).
"""
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "backend"))

from pymongo import MongoClient  # noqa: E402

from app.config import settings  # noqa: E402
from app.services.notification_service import make_unsubscribe_token  # noqa: E402

email = (sys.argv[1] if len(sys.argv) > 1 else "").lower().strip()
if not re.fullmatch(r"p3-test-[\w.-]+@example\.com", email):
    sys.exit("Refusing: not a generated p3-test-*@example.com address.")

options = {"tls": True} if settings.MONGODB_URL.startswith("mongodb+srv://") else {}
db = MongoClient(settings.MONGODB_URL, serverSelectionTimeoutMS=8000, **options)[settings.DATABASE_NAME]
user = db["users"].find_one({"email": email})
if not user:
    sys.exit("test user not found")
print(make_unsubscribe_token(user["id"], int(user.get("unsub_version") or 0)))
