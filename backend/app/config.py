from pathlib import Path
from typing import Literal, Optional

from pydantic import SecretStr, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent

_WEAK_MARKERS = ("change", "secret", "your_jwt", "replace_with", "password", "example")


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=BACKEND_DIR / ".env", extra="ignore", case_sensitive=True,
        hide_input_in_errors=True
    )

    PROJECT_NAME: str = "SkillSense AI"
    API_V1_STR: str = "/api"
    ENV: Literal["development", "test", "production"] = "development"

    MONGODB_URL: str = "mongodb://localhost:27017"
    DATABASE_NAME: str = "skillsense_ai"

    # No default on purpose: the app must refuse to start without a real secret.
    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    BCRYPT_ROUNDS: int = 12
    AUTH_RATE_LIMIT: str = "10/minute"
    REFRESH_RATE_LIMIT: str = "60/minute"  # every page load refreshes; keep above AUTH_RATE_LIMIT

    FRONTEND_URL: str = "http://localhost:5173"
    SIMILARITY_THRESHOLD: float = 0.80

    # online (default): a hosted compiler API called from the backend. No Docker or local compilers needed.
    # subprocess / docker: run code on this machine (see code_execution_service.py for the trade-offs).
    SANDBOX_MODE: Literal["online", "subprocess", "docker"] = "online"
    CODE_PROVIDER: Literal["judge0_ce", "judge0_rapidapi", "judge0", "piston"] = "judge0_ce"
    CODE_API_URL: Optional[str] = None  # provider base URL; judge0_ce / judge0_rapidapi / piston have defaults
    CODE_API_KEY: Optional[SecretStr] = None  # backend only; never sent to the browser
    CODE_REQUEST_TIMEOUT: int = 15  # seconds per provider request
    ENABLE_DEMO_ACCOUNTS: bool = False
    DEMO_STUDENT_PASSWORD: Optional[str] = None
    DEMO_ADMIN_PASSWORD: Optional[str] = None
    ENABLE_MEMORY_FALLBACK: bool = False
    CODE_RATE_LIMIT: str = "10/minute"  # code runs + submissions per user, shared
    SANDBOX_MAX_CONCURRENT: int = 4

    # Resume analyzer: OCR for scanned PDFs and images. rapidocr = pip package (default); tesseract = needs the tesseract program.
    OCR_ENGINE: Literal["rapidocr", "tesseract"] = "rapidocr"
    RESUME_RATE_LIMIT: str = "12/minute"  # resume analyses per user

    # Google sign-in (students only). Empty = the endpoint reports "not configured".
    GOOGLE_CLIENT_ID: Optional[str] = None

    # Email over SMTP (Gmail: smtp.gmail.com:587 with an App Password). Off by default.
    EMAIL_ENABLED: bool = False
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: Optional[str] = None
    SMTP_APP_PASSWORD: Optional[SecretStr] = None
    EMAIL_FROM: Optional[str] = None

    @model_validator(mode="after")
    def _check_secret(self) -> "Settings":
        secret = self.JWT_SECRET_KEY or ""
        if len(secret) < 32:
            raise ValueError(
                "JWT_SECRET_KEY must be at least 32 characters. Generate one with: "
                'python -c "import secrets;print(secrets.token_urlsafe(64))"'
            )
        if self.ENV == "production" and any(m in secret.lower() for m in _WEAK_MARKERS):
            raise ValueError("JWT_SECRET_KEY looks like a placeholder; use a random value in production.")
        if self.ENV == "production" and (self.ENABLE_DEMO_ACCOUNTS or self.ENABLE_MEMORY_FALLBACK):
            raise ValueError("ENABLE_DEMO_ACCOUNTS and ENABLE_MEMORY_FALLBACK must be false in production.")
        if self.SANDBOX_MODE == "online" and self.CODE_PROVIDER == "judge0_rapidapi" and not self.CODE_API_KEY:
            raise ValueError("CODE_PROVIDER=judge0_rapidapi requires CODE_API_KEY (your RapidAPI key).")
        if self.SANDBOX_MODE == "online" and self.CODE_PROVIDER == "judge0" and not self.CODE_API_URL:
            raise ValueError("CODE_PROVIDER=judge0 requires CODE_API_URL (your Judge0 server).")
        if self.EMAIL_ENABLED and not (self.SMTP_USER and self.SMTP_APP_PASSWORD):
            raise ValueError("EMAIL_ENABLED=true requires SMTP_USER and SMTP_APP_PASSWORD.")
        return self

    @property
    def is_production(self) -> bool:
        return self.ENV == "production"


settings = Settings()
