from fastapi import APIRouter, HTTPException, status, Depends
from datetime import datetime
import uuid
from app.models.user import UserCreate, UserLogin, AdminLogin, UserOut, Token, StudentProfile
from app.services.auth_service import hash_password, verify_password, create_access_token
from app.database import db_manager
from app.utils.security import get_current_user

router = APIRouter(prefix="/auth", tags=["Authentication"])

# Pre-seeded test accounts
DEFAULT_STUDENT = {
    "id": "usr-student-01",
    "name": "Nagappa Gongadi",
    "email": "nagappa@skillsense.ai",
    "password": hash_password("password123"),
    "role": "student",
    "college": "Engineering College",
    "department": "Computer Science & Engineering",
    "year": "Final Year (2026)",
    "career_goal": "Backend Developer",
    "career_interest": "Backend Developer",
    "current_path": "Backend Developer",
    "preferred_language": "Python 3",
    "skill_level": "Intermediate",
    "readiness_score": 87,
    "skill_progress": 74,
    "assessments_completed": 1,
    "strong_skills": ["Python", "SQL", "Java", "REST APIs"],
    "gap_skills": ["System Design", "Docker", "Kubernetes"],
    "created_at": datetime.utcnow(),
}

DEFAULT_ADMIN = {
    "id": "usr-admin-01",
    "name": "SkillSense Admin",
    "email": "admin@skillsense.ai",
    "password": hash_password("admin123"),
    "role": "admin",
    "created_at": datetime.utcnow(),
}

# Pre-seed in-memory store
db_manager._memory_store["users"][DEFAULT_STUDENT["id"]] = DEFAULT_STUDENT
db_manager._memory_store["users"][DEFAULT_ADMIN["id"]] = DEFAULT_ADMIN

@router.post("/register", response_model=Token, status_code=status.HTTP_201_CREATED)
async def register(user_in: UserCreate):
    email_clean = user_in.email.lower().strip()

    # Check duplicate in memory
    for u in db_manager._memory_store["users"].values():
        if u["email"].lower() == email_clean:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="An account with this email already exists")

    # Check duplicate in MongoDB
    if db_manager.is_connected and db_manager.db is not None:
        try:
            existing = await db_manager.db["users"].find_one({"email": email_clean})
            if existing:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="An account with this email already exists")
        except HTTPException:
            raise
        except Exception:
            pass

    user_id = f"usr-{uuid.uuid4().hex[:8]}"
    career_path_choice = user_in.career_goal or user_in.career_interest or "Backend Developer"

    new_user = {
        "id": user_id,
        "name": user_in.name,
        "email": email_clean,
        "password": hash_password(user_in.password),
        "role": "student",  # Strictly student role (no admin signup)
        "college": user_in.college or "Engineering College",
        "department": user_in.department or "Computer Science & Engineering",
        "year": user_in.year or "Final Year (2026)",
        "career_goal": career_path_choice,
        "career_interest": career_path_choice,
        "current_path": career_path_choice,
        "preferred_language": user_in.preferred_language or "Python 3",
        "skill_level": user_in.skill_level or "Intermediate",
        "readiness_score": 78,
        "skill_progress": 55,
        "assessments_completed": 0,
        "strong_skills": ["Python"],
        "gap_skills": ["System Design", "Docker", "DSA"],
        "created_at": datetime.utcnow(),
    }

    student_profile = {
        "user_id": user_id,
        "name": user_in.name,
        "email": email_clean,
        "college": user_in.college or "Engineering College",
        "department": user_in.department or "Computer Science & Engineering",
        "current_year": user_in.year or "Final Year (2026)",
        "career_path": career_path_choice,
        "preferred_language": user_in.preferred_language or "Python 3",
        "skill_level": user_in.skill_level or "Intermediate",
        "skills": ["Python"],
        "target_companies": ["TCS", "Infosys", "Accenture"],
    }

    db_manager._memory_store["users"][user_id] = dict(new_user)
    db_manager._memory_store["student_profiles"][user_id] = dict(student_profile)

    # Persist in MongoDB
    if db_manager.is_connected and db_manager.db is not None:
        try:
            await db_manager.db["users"].insert_one(dict(new_user))
            await db_manager.db["student_profiles"].insert_one(dict(student_profile))
        except Exception:
            pass

    token = create_access_token({
        "sub": user_id,
        "email": email_clean,
        "role": "student",
        "name": user_in.name,
        "career_interest": career_path_choice,
        "current_path": career_path_choice,
    })

    user_out_data = dict(new_user)
    user_out_data.pop("_id", None)
    return Token(access_token=token, user=UserOut(**user_out_data))

@router.post("/login", response_model=Token)
async def login(credentials: UserLogin):
    email_clean = credentials.email.lower().strip()
    user = None

    # Check MongoDB first if connected
    if db_manager.is_connected and db_manager.db is not None:
        try:
            db_user = await db_manager.db["users"].find_one({"email": email_clean})
            if db_user:
                user = dict(db_user)
                user.pop("_id", None)
        except Exception:
            user = None

    # Check memory fallback
    if not user:
        for u in db_manager._memory_store["users"].values():
            if u["email"].lower() == email_clean:
                user = dict(u)
                user.pop("_id", None)
                break

    if not user or not verify_password(credentials.password, user["password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    # If an admin tries to log in via standard student portal, let them or route appropriately
    token = create_access_token({
        "sub": user["id"],
        "email": user["email"],
        "role": user.get("role", "student"),
        "name": user.get("name", "Student User"),
        "career_interest": user.get("career_interest", "Backend Developer"),
        "current_path": user.get("current_path", "Backend Developer"),
    })

    return Token(access_token=token, user=UserOut(**user))

@router.post("/admin/login", response_model=Token)
async def admin_login(credentials: AdminLogin):
    email_clean = credentials.email.lower().strip()
    user = None

    if db_manager.is_connected and db_manager.db is not None:
        try:
            db_user = await db_manager.db["users"].find_one({"email": email_clean, "role": "admin"})
            if db_user:
                user = dict(db_user)
                user.pop("_id", None)
        except Exception:
            user = None

    if not user:
        for u in db_manager._memory_store["users"].values():
            if u["email"].lower() == email_clean and u.get("role") == "admin":
                user = dict(u)
                user.pop("_id", None)
                break

    if not user or not verify_password(credentials.password, user["password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid administrator credentials",
        )

    token = create_access_token({
        "sub": user["id"],
        "email": user["email"],
        "role": "admin",
        "name": user.get("name", "Administrator"),
    })

    return Token(access_token=token, user=UserOut(**user))

@router.get("/me", response_model=UserOut)
async def get_me(current_user: UserOut = Depends(get_current_user)):
    """Return authenticated profile from token"""
    return current_user
