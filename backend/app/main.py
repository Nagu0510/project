from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
import asyncio
import logging

from app.config import settings
from pymongo.errors import PyMongoError
from slowapi.errors import RateLimitExceeded

from app.services.sandbox_errors import SandboxRateLimited, SandboxUnavailable
from app.database import connect_to_mongo, close_mongo_connection, db_manager, DatabaseUnavailable, ping_database
from app.limiter import limiter
from app.services.auth_service import ensure_demo_accounts
from app.services.scheduler import daily_loop
from app.routers import (
    auth,
    career,
    student,
    assessment,
    roadmap,
    resume,
    placement,
    question_intelligence,
    practice,
    admin,
    admin_content,
    courses,
    recommendations,
    notifications,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("skillsense_api")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Initializing SkillSense AI Backend Service...")
    try:
        await connect_to_mongo()
    except Exception as exc:
        logger.error("STARTUP CHECK FAILED: %s", exc)  # one clear line; connect_to_mongo never includes the URL
        raise
    logger.info("STARTUP CHECK OK: environment loaded, MongoDB reachable (database: %s)", settings.DATABASE_NAME)
    await ensure_demo_accounts()
    daily_task = None
    if settings.ENV != "test":  # the daily placement-deadline check; tests call it directly
        daily_task = asyncio.create_task(daily_loop())
    yield
    # Shutdown
    if daily_task:
        daily_task.cancel()
    await close_mongo_connection()

app = FastAPI(
    title=settings.PROJECT_NAME,
    version="1.0.0",
    description="SkillSense AI — Next-Gen Skill Assessment, Placement Intelligence & Career Development Platform API",
    lifespan=lifespan,
    docs_url=None if settings.is_production else "/docs",  # no interactive API docs in production
    redoc_url=None if settings.is_production else "/redoc",
    openapi_url=None if settings.is_production else "/openapi.json",
)

app.state.limiter = limiter


async def _rate_limited(request: Request, exc: RateLimitExceeded):
    """JSON in the same {detail} shape as every other error, so the frontend can show it."""
    return JSONResponse(
        status_code=429,
        headers={"Retry-After": "60"},
        content={"detail": f"Too many requests ({exc.detail}). Please wait a minute and try again."},
    )


async def _sandbox_unavailable(request: Request, exc: SandboxUnavailable):
    logger.error("Code sandbox unavailable: %s", exc)
    return JSONResponse(status_code=503, content={"detail": str(exc)})


app.add_exception_handler(RateLimitExceeded, _rate_limited)


async def _sandbox_rate_limited(request: Request, exc: SandboxRateLimited):
    return JSONResponse(status_code=429, headers={"Retry-After": "10"}, content={"detail": str(exc)})


app.add_exception_handler(SandboxUnavailable, _sandbox_unavailable)
app.add_exception_handler(SandboxRateLimited, _sandbox_rate_limited)


async def _service_unavailable(request: Request, exc: Exception):
    if isinstance(exc, PyMongoError):
        logger.error("Database error on %s: %s", request.url.path, exc)
    return JSONResponse(status_code=503, content={"detail": "Service temporarily unavailable. Please try again."})


app.add_exception_handler(DatabaseUnavailable, _service_unavailable)
app.add_exception_handler(PyMongoError, _service_unavailable)


async def _unexpected_error(request: Request, exc: Exception):
    """Anything unplanned: a generic JSON message for the client, the full traceback only in the server log."""
    logger.error("Unhandled error on %s %s", request.method, request.url.path, exc_info=exc)
    return JSONResponse(status_code=500, content={"detail": "Something went wrong on our side. Please try again."})


app.add_exception_handler(Exception, _unexpected_error)

# Configure CORS: the frontend URL only; the usual localhost dev origins are added outside production
origins = [settings.FRONTEND_URL]
if not settings.is_production:
    origins += [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Total-Count", "X-Page", "X-Page-Size"],
)

_warned_fallback_paths = set()


@app.middleware("http")
async def flag_memory_fallback(request: Request, call_next):
    """Loudly mark every request path served from the throwaway in-memory database."""
    response = await call_next(request)
    if db_manager.using_fallback:
        response.headers["X-Data-Store"] = "in-memory-fallback"
        if request.url.path not in _warned_fallback_paths:
            _warned_fallback_paths.add(request.url.path)
            logger.warning("%s is using the THROWAWAY in-memory database (ENABLE_MEMORY_FALLBACK).", request.url.path)
    return response


@app.get("/health", tags=["Health"])
async def health_check():
    """Real database status (connected/disconnected + database name); 503 when MongoDB is unreachable."""
    healthy = await ping_database()
    return JSONResponse(
        status_code=200 if healthy else 503,
        content={
            "status": "healthy" if healthy else "unhealthy",
            "database": "connected" if healthy else "disconnected",
            "database_name": settings.DATABASE_NAME,
        },
    )


# Root summary
@app.get("/", tags=["Root"])
async def root():
    return {
        "message": "Welcome to SkillSense AI REST API Service",
        "docs": None if settings.is_production else "/docs",
        "health": "/health",
    }

# Register Routers under /api
app.include_router(auth.router, prefix=settings.API_V1_STR)
app.include_router(career.router, prefix=settings.API_V1_STR)
app.include_router(student.router, prefix=settings.API_V1_STR)
app.include_router(assessment.router, prefix=settings.API_V1_STR)
app.include_router(roadmap.router, prefix=settings.API_V1_STR)
app.include_router(resume.router, prefix=settings.API_V1_STR)
app.include_router(placement.router, prefix=settings.API_V1_STR)
app.include_router(question_intelligence.router, prefix=settings.API_V1_STR)
app.include_router(practice.router, prefix=settings.API_V1_STR)
app.include_router(admin.router, prefix=settings.API_V1_STR)
app.include_router(admin_content.router, prefix=settings.API_V1_STR)
app.include_router(courses.router, prefix=settings.API_V1_STR)
app.include_router(courses.student_router, prefix=settings.API_V1_STR)
app.include_router(recommendations.router, prefix=settings.API_V1_STR)
app.include_router(notifications.router, prefix=settings.API_V1_STR)
