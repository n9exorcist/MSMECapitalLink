# backend/routers/data_entry.py
# CFO console write API + per-client read. The /clients LIST route lives in
# clients.py (not here) to avoid a duplicate /msme/clients.
#
# Mount in main.py (NO /api/v1 prefix — paths must stay /msme/...):
#     from routers import data_entry
#     app.include_router(data_entry.router)

from typing import Optional
from fastapi import APIRouter, Depends
from pydantic import BaseModel

from core.database import get_db          # <-- core.database, matches your structure
from services import score_service

router = APIRouter(prefix="/msme", tags=["cfo-data-entry"])


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
    payload = body.model_dump()
    payload["msme_id"] = msme_id
    db.table("msme_financials").insert(payload).execute()
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