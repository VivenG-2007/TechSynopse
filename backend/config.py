import os
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List

class Settings(BaseSettings):
    # API Keys
    GROQ_API_KEY: str = ""
    OPENAI_API_KEY: str = ""
    GITHUB_TOKEN: str = ""
    GITHUB_WEBHOOK_SECRET: str = "default_secret"
    
    # URLs
    LOKI_URL: str = "http://localhost:3100"
    NEXT_PUBLIC_API_URL: str = "http://localhost:8000"
    
    # App Settings
    ENV: str = "development"
    ALLOWED_ORIGINS: List[str] = ["*"]
    LOG_LEVEL: str = "INFO"
    PORT: int = 8000
    
    # Rate Limiting
    RATE_LIMIT_PER_MINUTE: int = 60

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

settings = Settings()
