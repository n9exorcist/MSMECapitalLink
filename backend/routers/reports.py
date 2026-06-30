# backend/routers/reports.py
# GET /msme/{msme_id}/reports/health → builds the report context (reusing the SAME
# client360 computation), renders the Jinja template, and returns an A4 PDF rendered
# via Chromium/Playwright.
#
# This handler is SYNC (`def`, not `async def`) on purpose: render uses the sync
# Playwright API, which cannot run inside the event loop. FastAPI runs sync handlers
# in a worker thread, so launching Chromium here is safe.
#
# Mount in main.py:
#     from routers import reports
#     app.include_router(reports.router)

import io
import re

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from fastapi.concurrency import run_in_threadpool

from core.database import get_db
from reports.context import build_health_report_context
from reports.render import render_health_report_pdf_subprocess

router = APIRouter(prefix="/msme", tags=["reports"])


def _slug(name: str) -> str:
    """'Sri Sai Interiors' -> 'Sri_Sai_Interiors' (filename-safe)."""
    s = re.sub(r"[^\w\s-]", "", name or "").strip()
    s = re.sub(r"[\s-]+", "_", s)
    return s or "client"


@router.get("/{msme_id}/reports/health")
async def health_report(msme_id: str, db=Depends(get_db)):
    # build_health_report_context does blocking Supabase calls — run it off the
    # event loop so we don't stall the server while gathering the three sources.
    try:
        context = await run_in_threadpool(build_health_report_context, db, msme_id)
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001
        raise HTTPException(500, f"Failed to build report context: {e!r}")

    # Render in a separate process (see render.py) — the only path that works under
    # uvicorn --reload on Windows. Blocking, so offload it off the event loop.
    try:
        pdf = await run_in_threadpool(render_health_report_pdf_subprocess, context)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(500, f"Failed to render report PDF: {e!r}")

    filename = f"MFOS_Health_Report_{_slug(context.get('client_name', ''))}.pdf"
    return StreamingResponse(
        io.BytesIO(pdf),
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{filename}"'},
    )
