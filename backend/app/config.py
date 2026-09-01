from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    PROJECT_NAME: str = "SkillSense AI"
    API_V1_STR: str = "/api"
    MONGODB_URL: str = "mongodb://localhost:27017"
    DATABASE_NAME: str = "skillsense_ai"
    JWT_SECRET_KEY: str = "skillsense_ai_super_secret_jwt_key_2026_change_in_production"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    FRONTEND_URL: str = "http://localhost:5173"
    SIMILARITY_THRESHOLD: float = 0.80

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()
