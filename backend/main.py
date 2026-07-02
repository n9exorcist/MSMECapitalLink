# Verify TLS against the OS trust store (e.g. the Windows certificate store) instead of
# only certifi's bundle, so Supabase/httpx calls succeed behind a corporate TLS-inspection
# proxy whose root CA is installed in the OS store but not in certifi. MUST run before
# httpx/supabase build any SSL context. Harmless elsewhere (the OS store also trusts public
# CAs, so Railway/Linux is unaffected). Best-effort: skip cleanly if truststore is missing.
try:
    import truststore as _truststore
    _truststore.inject_into_ssl()
except Exception:
    pass

import threading
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from core.config import settings
from core.database import get_db  # <-- Import from here
from routers import client360
from routers import admin
from routers import documents
from routers import reports
from routers import ai

# Import our modular routers
from routers import health, dashboard
from routers import clients, data_entry

# Warm the report renderer (launch Chromium in the worker) at startup, off-thread so
# boot isn't blocked, and stop the worker on shutdown.
@asynccontextmanager
async def lifespan(app: FastAPI):
    from reports.render_pool import prewarm, shutdown
    threading.Thread(target=prewarm, daemon=True).start()
    yield
    shutdown()


# Initialize FastAPI
app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    lifespan=lifespan,
)

# Set up CORS - MUST be explicit origin when allow_credentials=True
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://msme-capital-link.vercel.app",
        "https://msme-capital-link-git-main-n9exorcists-projects.vercel.app",
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
app.include_router(admin.router)
app.include_router(documents.router)
app.include_router(reports.router)
app.include_router(ai.router)