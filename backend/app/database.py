import logging

from motor.motor_asyncio import AsyncIOMotorClient

from app.config import settings

logger = logging.getLogger("skillsense_db")


class Database:
    client = None
    db = None
    is_connected: bool = False
    # True only when ENABLE_MEMORY_FALLBACK started a throwaway mongomock database.
    using_fallback: bool = False


db_manager = Database()


class DatabaseUnavailable(Exception):
    """Raised when MongoDB can't be reached; mapped to HTTP 503 in main.py."""


def require_db():
    if db_manager.db is None or not db_manager.is_connected:
        raise DatabaseUnavailable("Database is unavailable")
    return db_manager.db


async def ping_database() -> bool:
    """Live check used by /health (a stale is_connected flag would hide an outage)."""
    if db_manager.db is None or not db_manager.is_connected:
        return False
    try:
        await db_manager.db.command("ping")
        return True
    except Exception as exc:  # any driver error means "not healthy"
        logger.error("Database ping failed (%s)", type(exc).__name__)
        return False


async def create_indexes() -> None:
    """Create the indexes the app relies on. Failures propagate: a missing unique index is a bug."""
    db = require_db()

    await db["users"].create_index("email", unique=True)
    await db["users"].create_index("id", unique=True)
    await db["users"].create_index("role")
    await db["student_profiles"].create_index("user_id", unique=True)

    # Auth: revoked token ids and password reset tokens expire on their own
    await db["revoked_tokens"].create_index("jti", unique=True)
    await db["revoked_tokens"].create_index("expires_at", expireAfterSeconds=0)
    await db["password_resets"].create_index("token_hash", unique=True)
    await db["password_resets"].create_index("expires_at", expireAfterSeconds=0)
    await db["email_verifications"].create_index("token_hash", unique=True)
    await db["email_verifications"].create_index("expires_at", expireAfterSeconds=0)
    await db["users"].create_index("google_sub", unique=True, sparse=True)

    await db["roadmaps"].create_index([("user_id", 1), ("career_path", 1)], unique=True)
    await db["assessment_attempts"].create_index([("user_id", 1), ("submitted_at", -1)])
    await db["resume_analyses"].create_index([("user_id", 1), ("created_at", -1)])
    await db["practice_attempts"].create_index([("user_id", 1), ("problem_slug", 1)])
    await db["practice_problems"].create_index("slug", unique=True)

    # Content collections (seeded from app/data, editable by admins)
    await db["assessments"].create_index("id", unique=True)
    await db["assessment_questions"].create_index("id", unique=True)
    await db["career_paths"].create_index("slug", unique=True)
    await db["courses"].create_index("slug", unique=True)
    await db["course_progress"].create_index([("user_id", 1), ("course_slug", 1)], unique=True)
    await db["notifications"].create_index([("user_id", 1), ("read", 1), ("created_at", -1)])
    await db["notifications"].create_index([("user_id", 1), ("dedupe_key", 1)])
    await db["job_runs"].create_index("name", unique=True)
    await db["assessment_sessions"].create_index("session_id", unique=True)
    if not db_manager.using_fallback:  # TTL indexes are skipped on the in-memory database
        # keep sessions a day past expiry so "expired" and "already submitted" can still be reported
        await db["assessment_sessions"].create_index("expires_at", expireAfterSeconds=86400)

    await db["placements"].create_index("id", unique=True)
    await db["placements"].create_index([("company", 1), ("role", 1)])
    await db["question_papers"].create_index("id", unique=True)
    await db["question_papers"].create_index([("company", 1), ("year", -1)])
    await db["extracted_questions"].create_index("id", unique=True)
    await db["extracted_questions"].create_index("paper_id")
    await db["extracted_questions"].create_index("status")
    await db["previous_questions"].create_index("id", unique=True)
    await db["previous_questions"].create_index([("topic", 1), ("status", 1)])
    await db["previous_questions"].create_index("company")
    if not db_manager.using_fallback:  # mongomock has no text index support
        await db["previous_questions"].create_index([("question_text", "text")])

    logger.info("MongoDB indexes verified.")


async def connect_to_mongo() -> None:
    """Connect and verify with a ping.

    Never logs the connection string (it contains credentials) or the driver's message, only the
    error type. On failure this raises, except in development when ENABLE_MEMORY_FALLBACK=true
    explicitly asks for a throwaway in-memory database (data is lost on restart).
    """
    try:
        client = AsyncIOMotorClient(
            settings.MONGODB_URL,
            serverSelectionTimeoutMS=8000,
            tls=settings.MONGODB_URL.startswith("mongodb+srv://"),  # Atlas always requires TLS
        )
        await client.admin.command("ping")
        db_manager.client = client
        db_manager.db = client[settings.DATABASE_NAME]
        db_manager.is_connected = True
        db_manager.using_fallback = False
        logger.info("Connected to MongoDB (database: %s)", settings.DATABASE_NAME)
    except Exception as exc:
        reason = type(exc).__name__
        if not (settings.ENABLE_MEMORY_FALLBACK and settings.ENV == "development"):
            logger.error(
                "MongoDB connection failed (%s). Check MONGODB_URL, the database user's password, "
                "and that this machine's IP is allowed in Atlas > Network Access.", reason,
            )
            raise RuntimeError(f"Could not connect to MongoDB ({reason}). See the log above.") from None
        from mongomock_motor import AsyncMongoMockClient

        logger.warning("=" * 70)
        logger.warning("MongoDB unreachable (%s).", reason)
        logger.warning("ENABLE_MEMORY_FALLBACK=true: using a THROWAWAY in-memory database.")
        logger.warning("All data is lost on restart. Never use this outside local development.")
        logger.warning("=" * 70)
        db_manager.client = AsyncMongoMockClient()
        db_manager.db = db_manager.client[settings.DATABASE_NAME]
        db_manager.is_connected = True
        db_manager.using_fallback = True

    await create_indexes()
    if db_manager.using_fallback:
        from app.seed import seed_collections

        await seed_collections(db_manager.db)  # nothing else would populate an empty throwaway DB


async def close_mongo_connection() -> None:
    if db_manager.client is not None:
        db_manager.client.close()
        db_manager.is_connected = False
        logger.info("MongoDB connection closed.")
