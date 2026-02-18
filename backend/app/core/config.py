# backend/app/core/config.py

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Google AI Studio / Gemini
    GOOGLE_API_KEY: str

    # General
    ENV: str = "development"
    DEBUG: bool = True

    class Config:
        env_file = ".env"


settings = Settings()
