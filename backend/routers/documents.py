"""routers/documents.py

CFO console uploads source docs → store the raw file in Supabase Storage, parse
bank statements into cash_position, GST returns into monthly_sales +
compliance_filings, and financial statements into a review payload the advisor
confirms before it's saved. Every upload is recorded in `documents`.

Mount in main.py:
    from routers import documents
    app.include_router(documents.router)
"""
import mimetypes
from datetime import datetime, timezone

from fastapi import APIRouter, UploadFile, File, Form, HTTPException

from core.database import get_db
from services.statement_parser import parse_bank_statement
from services.gstr3b import parse_gstr3b
from services.financial_statement import parse_financial_statement

router = APIRouter(prefix="/msme", tags=["documents"])

BUCKET = "documents"


@router.post("/{msme_id}/documents")
async def upload_document(
    msme_id: str,
    file: UploadFile = File(...),
    doc_type: str = Form("other"),
):
    db = get_db()
    raw = await file.read()
    if not raw:
        raise HTTPException(400, "Empty file")

    ts = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S")
    safe = (file.filename or "upload").replace("/", "_").replace(" ", "_")
    path = f"{msme_id}/{doc_type}/{ts}_{safe}"
    ctype = file.content_type or mimetypes.guess_type(safe)[0] or "application/octet-stream"

    # 1) store the raw file (service-role key bypasses Storage RLS)
    try:
        db.storage.from_(BUCKET).upload(path, raw, {"content-type": ctype, "upsert": "true"})
    except Exception as e:  # noqa: BLE001
        raise HTTPException(500, f"Storage upload failed: {e}")

    # 2) record the document (processing)
    ins = db.table("documents").insert({
        "msme_id": msme_id, "doc_type": doc_type, "file_name": safe,
        "storage_path": path, "mime_type": ctype, "size_bytes": len(raw),
        "status": "processing",
    }).execute()
    doc_id = ins.data[0]["id"]

    extracted = None        # structured cash extraction (bank statements)
    review = None           # financial-statement figures awaiting advisor confirm
    status = "stored"
    try:
        # 3) parse bank statements → cash_position
        if doc_type == "bank_statement":
            extracted = parse_bank_statement(raw)
            good = (
                extracted["parsed"]
                and extracted["confidence"] in ("high", "medium")
                and extracted["closing_balance"] is not None
            )
            if good:
                as_of = extracted["period_to"] or datetime.now().date().isoformat()
                # replace any prior snapshot for the same statement period
                db.table("cash_position").delete() \
                    .eq("msme_id", msme_id).eq("as_of_date", as_of).execute()
                db.table("cash_position").insert({
                    "msme_id": msme_id, "as_of_date": as_of,
                    "period_from": extracted["period_from"],
                    "period_to": extracted["period_to"],
                    "closing_balance": extracted["closing_balance"],
                    "opening_balance": extracted["opening_balance"],
                    "total_inflow": extracted["total_inflow"],
                    "total_outflow": extracted["total_outflow"],
                    "avg_daily_outflow": extracted["avg_daily_outflow"],
                    "accounts_count": extracted["accounts_count"],
                    "account_type": extracted["account_type"],
                    "source": "bank_statement_upload",
                }).execute()
                status = "parsed"
            # else: file is stored, figures need manual entry

        elif doc_type == "gst_return":
            extracted = parse_gstr3b(raw)
            if extracted.get("parsed"):
                month = extracted["month"]
                db.table("monthly_sales").delete() \
                    .eq("msme_id", msme_id).eq("month", month).execute()
                db.table("monthly_sales").insert({
                    "msme_id": msme_id, "month": month,
                    "revenue": extracted["revenue"], "source": "GSTR-3B",
                }).execute()
                db.table("compliance_filings").delete() \
                    .eq("msme_id", msme_id).eq("filing_type", "GSTR-3B") \
                    .eq("period_month", month).execute()
                db.table("compliance_filings").insert({
                    "msme_id": msme_id, "filing_type": "GSTR-3B",
                    "period": extracted["period_label"], "period_month": month,
                    "due_date": extracted["due_date"], "filed_date": extracted["filed_date"],
                    "amount": extracted["total_tax"], "status": extracted["status"],
                    "arn": extracted["arn"],
                }).execute()
                status = "parsed"

        # financial statements → parse to a review payload ONLY. The advisor
        # confirms the figures in FinancialReviewScreen, whose Save commits them.
        # This parser ALWAYS returns a payload carrying a `confidence` flag — it
        # has NO `parsed` boolean like the bank/GST parsers — so we always
        # surface it. A misread can't reach msme_financials without a human Save.
        elif doc_type == "financials":
            review = parse_financial_statement(raw)
            status = "parsed"

        # persist whatever was parsed (bank extract or financials review) for audit
        persisted = extracted if extracted is not None else review
        db.table("documents").update({
            "status": status,
            "extracted": persisted,
            "period_from": (persisted or {}).get("period_from"),
            "period_to": (persisted or {}).get("period_to"),
        }).eq("id", doc_id).execute()

    except Exception as e:  # noqa: BLE001
        db.table("documents").update(
            {"status": "failed", "error": str(e)[:500]}
        ).eq("id", doc_id).execute()
        raise HTTPException(500, f"Processing failed: {e}")

    return {"document_id": doc_id, "status": status, "extracted": extracted, "review": review}


@router.get("/{msme_id}/documents")
async def list_documents(msme_id: str):
    db = get_db()
    res = db.table("documents").select("*") \
        .eq("msme_id", msme_id).order("created_at", desc=True).execute()
    return {"documents": res.data or []}