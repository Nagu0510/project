"""Delete the end-to-end test student and everything it created.

    backend/.venv/Scripts/python.exe e2e/helpers/cleanup_test_user.py p3-test-<timestamp>@example.com

Refuses to touch any address that is not a generated p3-test-*@example.com account.
Prints record counts only, never the connection string.
"""
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "backend"))

from pymongo import MongoClient  # noqa: E402

from app.config import settings  # noqa: E402

email = (sys.argv[1] if len(sys.argv) > 1 else "").lower().strip()
if not re.fullmatch(r"p3-test-[\w.-]+@example\.com", email):
    sys.exit("Refusing: not a generated p3-test-*@example.com address.")

options = {"tls": True} if settings.MONGODB_URL.startswith("mongodb+srv://") else {}
db = MongoClient(settings.MONGODB_URL, serverSelectionTimeoutMS=8000, **options)[settings.DATABASE_NAME]
user = db["users"].find_one({"email": email})
if not user:
    print("test user not found (nothing to delete)")
    sys.exit(0)
uid = user["id"]
removed = {
    "users": db["users"].delete_one({"id": uid}).deleted_count,
    "student_profiles": db["student_profiles"].delete_many({"user_id": uid}).deleted_count,
    "practice_attempts": db["practice_attempts"].delete_many({"user_id": uid}).deleted_count,
    "assessment_attempts": db["assessment_attempts"].delete_many({"user_id": uid}).deleted_count,
    "roadmaps": db["roadmaps"].delete_many({"user_id": uid}).deleted_count,
    "email_verifications": db["email_verifications"].delete_many({"user_id": uid}).deleted_count,
    "password_resets": db["password_resets"].delete_many({"user_id": uid}).deleted_count,
    "resume_analyses": db["resume_analyses"].delete_many({"user_id": uid}).deleted_count,
    "assessment_sessions": db["assessment_sessions"].delete_many({"user_id": uid}).deleted_count,
    "course_progress": db["course_progress"].delete_many({"user_id": uid}).deleted_count,
    "notifications": db["notifications"].delete_many({"user_id": uid}).deleted_count,
}
print("removed:", removed)
