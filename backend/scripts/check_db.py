"""Check the MongoDB connection:  python scripts/check_db.py   (run from backend/)

Prints OK plus the collection names, or the error type only. Never prints the connection string.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from pymongo import MongoClient  # noqa: E402

try:
    from app.config import settings  # noqa: E402
except Exception as exc:  # backend/.env is missing a value or has a bad one: say which, in one line (values are never printed)
    problems = [f"{'.'.join(str(x) for x in e.get('loc', ())) or 'settings'}: {e.get('msg', '')}" for e in getattr(exc, "errors", lambda: [])()]
    print("FAILED: backend/.env is not ready -> " + ("; ".join(problems) or type(exc).__name__))
    sys.exit(1)


def main() -> int:
    try:
        options = {"tls": True} if settings.MONGODB_URL.startswith("mongodb+srv://") else {}
        client = MongoClient(settings.MONGODB_URL, serverSelectionTimeoutMS=8000, **options)
        client.admin.command("ping")
        names = sorted(client[settings.DATABASE_NAME].list_collection_names())
    except Exception as exc:  # report the type only: driver messages can echo host details
        print(f"FAILED: {type(exc).__name__}")
        return 1
    print(f"OK: connected, database '{settings.DATABASE_NAME}'")
    print("Collections:", ", ".join(names) if names else "(none yet)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
