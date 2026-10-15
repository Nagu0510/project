"""Move the deadline of a generated test student's open assessment session (browser tests only).

    backend/.venv/Scripts/python.exe e2e/helpers/move_session_deadline.py p3-test-<timestamp>@example.com <seconds>

<seconds> is counted from now; a negative number puts the deadline in the past. Only the newest unsubmitted
session of a generated p3-test-*@example.com account is touched. Prints the session id and nothing secret.
"""
import re
import sys
from datetime import timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "backend"))

from pymongo import MongoClient  # noqa: E402

from app.config import settings  # noqa: E402
from app.utils.timeutil import utcnow  # noqa: E402

email = (sys.argv[1] if len(sys.argv) > 1 else "").lower().strip()
if not re.fullmatch(r"p3-test-[\w.-]+@example\.com", email):
    sys.exit("Refusing: not a generated p3-test-*@example.com address.")
seconds = int(sys.argv[2])

options = {"tls": True} if settings.MONGODB_URL.startswith("mongodb+srv://") else {}
db = MongoClient(settings.MONGODB_URL, serverSelectionTimeoutMS=8000, **options)[settings.DATABASE_NAME]
user = db["users"].find_one({"email": email})
if not user:
    sys.exit("test user not found")
session = db["assessment_sessions"].find_one({"user_id": user["id"], "submitted_at": None}, sort=[("started_at", -1)])
if not session:
    sys.exit("no open session for this test user")
db["assessment_sessions"].update_one({"session_id": session["session_id"]}, {"$set": {"expires_at": utcnow() + timedelta(seconds=seconds)}})
print(session["session_id"])
