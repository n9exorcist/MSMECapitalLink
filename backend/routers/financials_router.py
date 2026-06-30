"""
routers/financials.py
=====================
Confirm-write endpoint for the financial-statement review flow.

The parser (services/financial_statement.py) never writes msme_financials. The
console review screen lets a human verify/correct the parsed figures, then POSTs
them here. This endpoint is the ONLY path by which parsed financials reach the
table — which is what keeps a misread from silently poisoning the score.

Register in your app entrypoint alongside the other routers, e.g.:
    from routers import financials
    app.include_router(financials.router)
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from datetime import datetime, timezone

from core.database import get_db   # Supabase service-role client (same as other routers)

router = APIRouter(prefix="/financials", tags=["financials"])

# Only these financial columns may be written from the review screen. This
# whitelist protects operational columns (cibil_score, docs_ready_pct,
# compliance_pct, days_past_due, bounces_per_month) from being clobbered.
ALLOWED_FIELDS = {
    "projected_annual_turnover", "annual_purchases", "ebit", "net_profit_after_tax",
    "depreciation", "interest_expense", "current_assets", "current_liabilities",
    "inventory", "sundry_debtors", "sundry_creditors", "total_outside_liabilities",
    "tangible_net_worth", "declared_bank_statement_credits",
}


class ConfirmFinancialsBody(BaseModel):
    msme_id: str
    period_label: str = Field(..., min_length=1)      # e.g. "FY2024-25"
    period_year: int
    period_month: int = 3                              # Indian FY end
    fields: dict[str, float]                           # the 14 reviewed values


@router.post("/confirm")
def confirm_financials(body: ConfirmFinancialsBody, db=Depends(get_db)):
    # keep only whitelisted, non-null numeric fields
    clean = {k: v for k, v in body.fields.items() if k in ALLOWED_FIELDS and v is not None}
    if not clean:
        raise HTTPException(status_code=400, detail="No valid financial fields supplied.")

    now = datetime.now(timezone.utc).isoformat()

    # Upsert by (msme_id, period_label): update if the period row exists, else insert.
    # (Select-then-write avoids requiring a DB unique constraint — same caution as
    # the GST writer.)
    existing = (
        db.table("msme_financials")
        .select("id")
        .eq("msme_id", body.msme_id)
        .eq("period_label", body.period_label)
        .execute()
    )

    if existing.data:
        db.table("msme_financials").update({**clean, "updated_at": now}) \
          .eq("msme_id", body.msme_id) \
          .eq("period_label", body.period_label) \
          .execute()
        action = "updated"
    else:
        db.table("msme_financials").insert({
            "msme_id": body.msme_id,
            "period_label": body.period_label,
            "period_year": body.period_year,
            "period_month": body.period_month,
            **clean,
            "updated_at": now,
            # created_at omitted -> DB default now()
        }).execute()
        action = "inserted"

    return {"ok": True, "action": action, "period_label": body.period_label, "fields_written": len(clean)}
