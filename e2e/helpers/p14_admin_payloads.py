"""Prints the REAL responses of the admin analytics and export endpoints, computed by the real backend code on the real database.

Used by e2e/p14-improvements.spec.js when no admin login (ADMIN_TEST_EMAIL / ADMIN_TEST_PASSWORD) is configured. The browser session is stubbed
in that case, so this process calls the real FastAPI app in-process (httpx ASGI transport, the rate limiter and every route as they are)
with ONLY the admin check replaced for this one process. The running server, the database and every account are untouched; nothing is written.
Output: one JSON object on stdout. Never prints a connection string or a secret.
"""
import asyncio
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))

import httpx  # noqa: E402

from app.database import close_mongo_connection, connect_to_mongo  # noqa: E402
from app.main import app  # noqa: E402
from app.models.user import UserOut  # noqa: E402
from app.utils.security import require_admin  # noqa: E402


async def main() -> int:
    await connect_to_mongo()
    app.dependency_overrides[require_admin] = lambda: UserOut(id="usr-p14-probe", name="Probe", email="probe@example.org", role="admin")
    try:
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://probe") as client:
            out = {}
            for key, path in (("analytics", "/api/admin/analytics"), ("students", "/api/admin/students"), ("students_csv", "/api/admin/students/export.csv"),
                              ("results_csv", "/api/admin/assessment-results/export.csv")):
                r = await client.get(path)
                if r.status_code != 200:
                    print(json.dumps({"error": f"{path} answered {r.status_code}"}))
                    return 1
                out[key] = r.json() if key in ("analytics", "students") else r.text
            print(json.dumps(out))
            return 0
    finally:
        app.dependency_overrides.clear()
        await close_mongo_connection()


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
