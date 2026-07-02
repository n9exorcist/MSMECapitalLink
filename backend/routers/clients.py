# backend/routers/clients.py
# GET /msme/clients — the portfolio triage list the CFO console dashboard reads.
# Normalizes column-name variants and surfaces the columns the triage table + filters
# + quick actions need. Risk uses the stored `risk` column (set by score_service),
# falling back to a score band when it's absent.

from fastapi import APIRouter, Depends
from core.database import get_db

router = APIRouter(prefix="/msme", tags=["clients"])


def _risk(r: dict) -> str:
    stored = r.get("risk")
    if stored in ("red", "yellow", "none"):
        return stored
    s = r.get("health_score") or 0
    return "red" if s < 40 else ("yellow" if s < 70 else "none")


@router.get("/clients")
def list_clients(db=Depends(get_db)):
    rows = db.table("msme_entities").select("*").execute().data or []
    clients = [{
        "id": r.get("id"),
        "company": r.get("company_name") or r.get("name") or "Unnamed",
        "owner": r.get("owner_name") or r.get("owner"),
        "sector": r.get("industry") or r.get("sector") or r.get("turnover_category"),
        "msme_class": r.get("msme_class") or r.get("turnover_category"),
        "location": r.get("location"),
        "turnover": r.get("annual_turnover") or 0,
        "health_score": r.get("health_score"),
        "bank_readiness_score": r.get("bank_readiness_score"),
        "green_eligibility_score": r.get("green_eligibility_score"),
        "band": r.get("band"),
        "provisional": r.get("provisional"),
        "data_completeness": r.get("data_completeness"),
        "score_delta": r.get("score_delta"),
        "last_update": r.get("score_updated_at") or r.get("updated_at") or r.get("created_at"),
        # contact fields — tolerant getters; quick actions degrade gracefully if absent
        "phone": r.get("phone") or r.get("mobile") or r.get("contact_phone"),
        "email": r.get("email") or r.get("contact_email"),
        "risk": _risk(r),
    } for r in rows]
    return {"clients": clients}
