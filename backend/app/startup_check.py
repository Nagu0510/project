"""One-line startup check.

  python -m app.startup_check        (run from backend/, used by run_skillsense.bat)

Prints a single `STARTUP CHECK OK ...` or `STARTUP CHECK FAILED: ...` line and exits 0/1.
Reports only whether values are set, never the values (and never the connection string).
"""
import asyncio
import importlib
import sys

REQUIRED_MODULES = ("fastapi", "motor", "slowapi", "jose", "bcrypt", "google.oauth2.id_token", "sklearn")


def missing_modules() -> list[str]:
    missing = []
    for name in REQUIRED_MODULES:
        try:
            importlib.import_module(name)
        except Exception:  # ImportError, or a DLL load error: either way the backend can't start
            missing.append(name.split(".")[0])
    return missing


def env_problems(settings) -> list[str]:
    problems = []
    if settings.ENV != "test" and settings.MONGODB_URL == "mongodb://localhost:27017" and not settings.ENABLE_MEMORY_FALLBACK:
        problems.append("MONGODB_URL is not set (still the localhost default)")
    return problems


async def atlas_problem(settings) -> str | None:
    from motor.motor_asyncio import AsyncIOMotorClient

    client = AsyncIOMotorClient(
        settings.MONGODB_URL,
        serverSelectionTimeoutMS=8000,
        tls=settings.MONGODB_URL.startswith("mongodb+srv://"),
    )
    try:
        await client.admin.command("ping")
        return None
    except Exception as exc:  # report the type only: driver messages can echo host names
        return f"MongoDB unreachable ({type(exc).__name__}): check MONGODB_URL, the database user's password, and Atlas > Network Access"
    finally:
        client.close()


def summarize(problems: list[str], database: str = "") -> str:
    if problems:
        return "STARTUP CHECK FAILED: " + "; ".join(problems)
    return f"STARTUP CHECK OK: environment loaded, MongoDB reachable{f' (database: {database})' if database else ''}"


def main() -> int:
    missing = missing_modules()
    if missing:
        print(summarize([f"missing Python packages: {', '.join(missing)} (run: pip install -r requirements.txt in backend/.venv)"]))
        return 1
    try:
        from app.config import settings
    except Exception as exc:  # pydantic ValidationError: names the bad field, input is hidden
        fields = sorted({str(e["loc"][0]) for e in getattr(exc, "errors", lambda: [])() if e.get("loc")}) or [type(exc).__name__]
        print(summarize([f"backend/.env is invalid or incomplete: {', '.join(fields)}"]))
        return 1
    problems = env_problems(settings)
    db_problem = asyncio.run(atlas_problem(settings))
    if db_problem:
        problems.append(db_problem)
    print(summarize(problems, settings.DATABASE_NAME))
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
