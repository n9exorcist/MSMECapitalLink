from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from core.config import settings

# Import our new modular routers
from routers import health, dashboard

# Initialize FastAPI
app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION
)

# Set up CORS using your config settings
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow everything for now to rule this out
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register the routers we just built
app.include_router(health.router, prefix="/api/v1")
app.include_router(dashboard.router, prefix="/api/v1")

# (You can add ai.py or others here later!)