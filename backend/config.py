"""CircuitLens backend configuration.

Loads all settings from backend/.env using pydantic-settings.
Every module imports `settings` from here for a single source of truth.
"""

from pydantic_settings import BaseSettings
from functools import lru_cache
import os


class Settings(BaseSettings):
    """Typed, validated configuration loaded from .env."""

    # --- AWS ---
    AWS_ACCESS_KEY_ID: str
    AWS_SECRET_ACCESS_KEY: str
    AWS_DEFAULT_REGION: str = "us-east-1"

    # --- S3 ---
    S3_BUCKET_NAME: str

    # --- Gemini (primary LLM) ---
    GEMINI_API_KEY: str

    # --- Roboflow (optional until model is trained) ---
    ROBOFLOW_API_KEY: str = ""
    ROBOFLOW_PROJECT_ID: str = ""
    ROBOFLOW_MODEL_VERSION: str = ""

    # --- Bedrock (stretch goal) ---
    BEDROCK_MODEL_ID: str = "anthropic.claude-sonnet-4-20250514-v1:0"

    model_config = {
        "env_file": os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env"),
        "env_file_encoding": "utf-8",
        "extra": "ignore",
    }


@lru_cache
def get_settings() -> Settings:
    """Cached settings singleton — parsed once, reused everywhere."""
    return Settings()


settings = get_settings()
