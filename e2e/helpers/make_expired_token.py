"""Print an already-expired access token signed with the backend's key (for the 401 test).

The signing key is used inside this process only and is never printed. Run from the repo root:
    backend/.venv/Scripts/python.exe e2e/helpers/make_expired_token.py
"""
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "backend"))

from jose import jwt  # noqa: E402

from app.config import settings  # noqa: E402

now = datetime.now(timezone.utc)
claims = {
    "sub": "usr-expired-token-test", "role": "student", "type": "access", "jti": "expired-token-test",
    "iat": int((now - timedelta(hours=2)).timestamp()), "exp": now - timedelta(hours=1),
}
print(jwt.encode(claims, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM))
