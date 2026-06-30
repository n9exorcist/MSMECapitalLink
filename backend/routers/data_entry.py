# backend/routers/data_entry.py
# CFO console write API + per-client read. The /clients LIST route lives in
# clients.py (not here) to avoid a duplicate /msme/clients.
#
# Mount in main.py (NO /api/v1 prefix — paths must stay /msme/...):
#     from routers import data_entry
#     app.include_router(data_entry.router)

from typing import Optional
from datetime import datetime, timezone, date          # add: date
from fastapi import APIRouter, Depends, HTTPException   # add: HTTPException
from pydantic import BaseModel

from core.database import get_db          # <-- core.database, matches your structure
from services import score_service



router = APIRouter(prefix="/msme", tags=["cfo-data-entry"])

# Only these financial columns may be written from the review screen / Financials
# tab. The operational columns (cibil_score, days_past_due, bounces_per_month,
# docs_ready_pct, compliance_pct) are deliberately EXCLUDED so a financials save
# can never clobber them — CIBIL in particular must stay NULL until a real bureau
# pull lands, and a phantom 0 would both false-certify the client and tank the
# banking-discipline score.
FINANCIAL_FIELDS = {
    "projected_annual_turnover", "annual_purchases", "ebit", "net_profit_after_tax",
    "depreciation", "interest_expense", "interest_on_term_loan", "principal_repayment",
    "current_assets", "current_liabilities", "inventory", "sundry_debtors",
    "sundry_creditors", "total_outside_liabilities", "tangible_net_worth",
    "declared_bank_statement_credits",
}


class FinancialsIn(BaseModel):
    period_label: Optional[str] = None
    period_year: Optional[int] = None
    period_month: Optional[int] = None
    projected_annual_turnover: float = 0
    annual_purchases: float = 0
    ebit: float = 0
    net_profit_after_tax: float = 0
    depreciation: float = 0
    interest_expense: float = 0
    interest_on_term_loan: float = 0
    principal_repayment: float = 0
    current_assets: float = 0
    current_liabilities: float = 0
    inventory: float = 0
    sundry_debtors: float = 0
    sundry_creditors: float = 0
    total_outside_liabilities: float = 0
    tangible_net_worth: float = 0
    declared_bank_statement_credits: float = 0
    days_past_due: int = 0
    cibil_score: int = 0
    bounces_per_month: float = 0
    docs_ready_pct: float = 80
    compliance_pct: float = 90


class DebtorIn(BaseModel):
    name: str
    amount_outstanding: float = 0
    days_outstanding: int = 0


class CreditorIn(BaseModel):
    name: str
    amount_due: float = 0
    due_date: Optional[str] = None


class CreditBureauIn(BaseModel):
    score: int
    bureau: str = "CIBIL"
    subject_type: str = "individual"          # individual = consumer (proprietor) | commercial
    subject_name: Optional[str] = None
    subject_pan: Optional[str] = None
    pulled_on: Optional[str] = None           # 'YYYY-MM-DD'; defaults to today
    control_number: Optional[str] = None
    source: str = "manual_entry"


@router.post("/{msme_id}/credit-bureau")
def add_credit_bureau_pull(msme_id: str, body: CreditBureauIn, db=Depends(get_db)):
    # Consumer CIBIL is 300–900 — reject out-of-range so the audit row stays clean.
    if body.subject_type == "individual" and not (300 <= body.score <= 900):
        raise HTTPException(400, "Consumer CIBIL must be between 300 and 900.")

    row = body.model_dump()
    row["msme_id"] = msme_id
    if not row.get("pulled_on"):
        row["pulled_on"] = date.today().isoformat()

    db.table("credit_bureau_pulls").insert(row).execute()   # append-only, one row per pull
    s = score_service.refresh_score(db, msme_id)
    return {"ok": True, "score": {"score": s.get("score"), "band": s.get("band"),
                                  "delta": s.get("delta"), "provisional": s.get("provisional")}}


@router.get("/{msme_id}/entry")
def get_entry(msme_id: str, db=Depends(get_db)):
    ent = (db.table("msme_entities").select("*").eq("id", msme_id)
           .limit(1).execute().data or [])
    ent = ent[0] if ent else {}
    fin = (db.table("msme_financials").select("*").eq("msme_id", msme_id)
           .order("created_at", desc=True).limit(1).execute().data or [])
    debtors = (db.table("debtors").select("*").eq("msme_id", msme_id)
               .order("amount_outstanding", desc=True).execute().data or [])
    creditors = (db.table("creditors").select("*").eq("msme_id", msme_id)
                 .order("amount_due", desc=True).execute().data or [])
    return {

        "company": ent.get("company_name") or ent.get("name"),
        "owner": ent.get("owner_name") or ent.get("owner"),
        "financials": fin[0] if fin else None,
        "debtors": debtors,
        "creditors": creditors,
    }


@router.post("/{msme_id}/financials")
def save_financials(msme_id: str, body: FinancialsIn, db=Depends(get_db)):
    # Write ONLY the financial columns (never the operational ones — see
    # FINANCIAL_FIELDS note). This is what keeps cibil_score / bounces NULL.
    payload = {k: v for k, v in body.model_dump().items() if k in FINANCIAL_FIELDS}

    # Period metadata, when supplied, is the upsert key + audit context.
    period_label = body.period_label
    if period_label:
        payload["period_label"] = period_label
        payload["period_year"] = body.period_year
        payload["period_month"] = body.period_month

    now = datetime.now(timezone.utc).isoformat()

    # Upsert by (msme_id, period_label): update the existing period row in place
    # rather than inserting a new one each save. Select-then-write mirrors the GST
    # writer and avoids needing a DB unique constraint.
    existing = None
    if period_label:
        existing = (db.table("msme_financials").select("id")
                    .eq("msme_id", msme_id).eq("period_label", period_label)
                    .execute().data or [])

    if existing:
        db.table("msme_financials").update({**payload, "updated_at": now}) \
          .eq("msme_id", msme_id).eq("period_label", period_label).execute()
    else:
        db.table("msme_financials").insert({**payload, "msme_id": msme_id}).execute()

    s = score_service.refresh_score(db, msme_id)
    return {"ok": True, "score": {"score": s.get("score"), "band": s.get("band"),
                                  "delta": s.get("delta")}}


@router.post("/{msme_id}/debtors")
def add_debtor(msme_id: str, body: DebtorIn, db=Depends(get_db)):
    row = body.model_dump()
    row["msme_id"] = msme_id
    db.table("debtors").insert(row).execute()
    return {"ok": True}


@router.post("/{msme_id}/creditors")
def add_creditor(msme_id: str, body: CreditorIn, db=Depends(get_db)):
    row = body.model_dump()
    row["msme_id"] = msme_id
    db.table("creditors").insert(row).execute()
    return {"ok": True}


@router.post("/{msme_id}/score/refresh")
def refresh(msme_id: str, db=Depends(get_db)):
    """Recompute + persist this client's score (use after seeding, or any time)."""
    return score_service.refresh_score(db, msme_id)