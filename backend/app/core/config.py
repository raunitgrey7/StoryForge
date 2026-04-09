# backend/app/core/config.py

from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict


BACKEND_DIR = Path(__file__).resolve().parents[2]
PROJECT_ROOT = BACKEND_DIR.parent


class Settings(BaseSettings):
    # Google AI Studio / Gemini
    GOOGLE_API_KEY_1: str | None = None
    GOOGLE_API_KEY_2: str | None = None
    GOOGLE_API_KEY_3: str | None = None
    GOOGLE_API_KEY_4: str | None = None
    GOOGLE_API_KEY_5: str | None = None

    # General
    ENV: str = "development"
    DEBUG: bool = True

    model_config = SettingsConfigDict(
        env_file=(
            str(BACKEND_DIR / ".env"),
            str(PROJECT_ROOT / ".env"),
        ),
        extra="ignore",
    )

    @property
    def google_api_keys(self) -> list[str]:
        keys = [
            self.GOOGLE_API_KEY_1,
            self.GOOGLE_API_KEY_2,
            self.GOOGLE_API_KEY_3,
            self.GOOGLE_API_KEY_4,
            self.GOOGLE_API_KEY_5,
        ]
        return [key.strip() for key in keys if key and key.strip()]


settings = Settings()
