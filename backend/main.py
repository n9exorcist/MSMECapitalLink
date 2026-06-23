from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from core.config import settings
from core.database import get_db  # <-- Import from here
from routers import client360 

# Import our modular routers
from routers import health, dashboard
from routers import clients, data_entry

# Initialize FastAPI
app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION
)

# Set up CORS - MUST be explicit origin when allow_credentials=True
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000", 
        "https://msmecapitallink-production.up.railway.app" # Your Railway frontend domain
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def root():
    return {"status": "ok", "service": "msme-capital-link-api"}

# Register routers
app.include_router(health.router, prefix="/api/v1")
app.include_router(dashboard.router, prefix="/api/v1")

# Because your router files ALREADY HAVE prefix="/msme" defined inside them:
# You must include them WITHOUT an additional prefix here.
app.include_router(clients.router) 
app.include_router(data_entry.router)
app.include_router(client360.router)