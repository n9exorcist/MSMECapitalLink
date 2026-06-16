from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List

class Settings(BaseSettings):
    PROJECT_NAME: str = "MFOS API"
    VERSION: str = "2026.06"
    
    # Supabase Credentials
    SUPABASE_URL: str = ""
    SUPABASE_SERVICE_ROLE_KEY: str = ""
    SUPABASE_JWT_SECRET: str = "your-fallback-secret-here-for-local-dev"
    
    # AI Credentials
    ANTHROPIC_API_KEY: str = ""
    
    # CORS (Allows frontend to talk to backend)
    ALLOWED_ORIGINS: List[str] = [
        "http://localhost:8081",     # Expo Web
        "http://192.168.0.3:8081",   # LAN IP (Update if needed)
        "https://your-frontend.com"
    ]

    # Tell Pydantic to read the .env file and ignore any extra variables it finds
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

settings = Settings()