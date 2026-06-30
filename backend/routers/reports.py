# backend/routers/reports.py
# Document generation: GET /msme/{msme_id}/documents/{doc_key} builds a document's
# context (from the shared read-model), renders its Jinja template to A4 PDF via the
# warm Chromium worker, and streams it back as a download. Documents are registered in
# reports/registry.py — this route is generic over all of them.
#
# GET /msme/{id}/reports/health is kept as a back-compat alias for the existing console
# tile + owner-app wiring.
#
# Handlers are async and offload the blocking context build + render to a worker thread;
# rendering itself happens in a separate process (see reports/render.py).

import io
import re

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from fastapi.concurrency import run_in_threadpool

from core.database import get_db
from reports.registry import get_spec, DocSpec
from reports.render import render_html
from reports.render_pool import render_pdf

router = APIRouter(prefix="/msme", tags=["reports"])


def _slug(name: str) -> str:
    """'Sri Sai Interiors' -> 'Sri_Sai_Interiors' (filename-safe)."""
    s = re.sub(r"[^\w\s-]", "", name or "").strip()
    s = re.sub(r"[\s-]+", "_", s)
    return s or "client"


def _render(spec: DocSpec, context: dict) -> bytes:
    return render_pdf(render_html(spec.template, context))


async def _generate(spec: DocSpec, msme_id: str, db) -> StreamingResponse:
    try:
        context = await run_in_threadpool(spec.context_builder, db, msme_id)
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001
        raise HTTPException(500, f"Failed to build {spec.key} document context: {e!r}")

    try:
        pdf = await run_in_threadpool(_render, spec, context)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(500, f"Failed to render {spec.key} PDF: {e!r}")

    filename = f"{spec.filename_prefix}_{_slug(context.get('client_name', ''))}.pdf"
    return StreamingResponse(
        io.BytesIO(pdf),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/{msme_id}/documents/{doc_key}")
async def generate_document(msme_id: str, doc_key: str, db=Depends(get_db)):
    spec = get_spec(doc_key)
    if not spec:
        raise HTTPException(404, f"Unknown document type: {doc_key}")
    return await _generate(spec, msme_id, db)


@router.get("/{msme_id}/reports/health")
async def health_report(msme_id: str, db=Depends(get_db)):
    # back-compat alias → the registered "health" document
    return await _generate(get_spec("health"), msme_id, db)
