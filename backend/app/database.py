import logging
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from app.config import settings

logger = logging.getLogger("skillsense_db")

class Database:
    client: AsyncIOMotorClient = None
    db = None
    is_connected: bool = False
    
    # Resilient in-memory store matching all MongoDB collections
    _memory_store = {
        "users": {},
        "student_profiles": {},
        "career_paths": {},
        "assessments": {},
        "assessment_questions": {},
        "assessment_attempts": {},
        "roadmaps": {},
        "resume_analyses": {},
        "placements": {},
        "question_papers": {},
        "extracted_questions": {},
        "previous_questions": {},
        "practice_problems": {},
        "practice_attempts": {},
    }

db_manager = Database()

async def create_indexes():
    """Create essential MongoDB indexes on collection startup"""
    if not db_manager.is_connected or db_manager.db is None:
        return
    try:
        # User indexes
        await db_manager.db["users"].create_index("email", unique=True)
        await db_manager.db["users"].create_index("role")
        
        # Student profile index
        await db_manager.db["student_profiles"].create_index("user_id", unique=True)
        
        # Previous questions index
        await db_manager.db["previous_questions"].create_index([("topic", 1), ("status", 1)])
        await db_manager.db["previous_questions"].create_index("status")
        await db_manager.db["previous_questions"].create_index("company")
        
        # Question papers index
        await db_manager.db["question_papers"].create_index([("company", 1), ("year", -1)])
        
        # Extracted questions index
        await db_manager.db["extracted_questions"].create_index("paper_id")
        await db_manager.db["extracted_questions"].create_index("status")
        
        # Assessment attempts index
        await db_manager.db["assessment_attempts"].create_index("user_id")
        
        # Practice attempts index
        await db_manager.db["practice_attempts"].create_index([("user_id", 1), ("problem_slug", 1)])
        
        logger.info("MongoDB database indexes successfully verified.")
    except Exception as e:
        logger.warning(f"Index creation notice: {e}")

async def connect_to_mongo():
    """Initialize MongoDB connection and verify with ping"""
    try:
        db_manager.client = AsyncIOMotorClient(settings.MONGODB_URL, serverSelectionTimeoutMS=2000)
        # Verify connection
        await db_manager.client.admin.command('ping')
        db_manager.db = db_manager.client[settings.DATABASE_NAME]
        db_manager.is_connected = True
        logger.info(f"Connected to MongoDB at {settings.MONGODB_URL} (Database: {settings.DATABASE_NAME})")
        await create_indexes()
    except Exception as e:
        logger.warning(f"MongoDB connection notice ({e}). Operating with in-memory persistence store.")
        db_manager.is_connected = False

async def close_mongo_connection():
    """Close MongoDB connection cleanly on shutdown"""
    if db_manager.client:
        db_manager.client.close()
        logger.info("MongoDB connection closed cleanly.")

def get_db():
    return db_manager.db
