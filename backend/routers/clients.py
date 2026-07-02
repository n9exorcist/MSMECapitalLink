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


_BAND_LETTER = {"EXCELLENT": "A", "GOOD": "B", "MEDIUM": "C", "POOR": "D"}


def _band_letter(r: dict) -> str:
    b = (r.get("band") or "").upper()
    if b in _BAND_LETTER:
        return _BAND_LETTER[b]
    s = r.get("health_score")
    if s is None:
        return "unknown"
    return "A" if s >= 80 else "B" if s >= 60 else "C" if s >= 40 else "D"


@router.get("/portfolio/analytics")
def portfolio_analytics(db=Depends(get_db)):
    """Portfolio-wide aggregates (spec §10.1) computed live from msme_entities.
    Revenue / advisor productivity (§10.2/§10.3) need billing + advisor data — the
    console renders those as clearly-labelled samples until that lands."""
    rows = db.table("msme_entities").select("*").execute().data or []
    n = len(rows)

    def avg(key: str):
        vals = [float(r[key]) for r in rows if r.get(key) is not None]
        return round(sum(vals) / len(vals)) if vals else None

    bands = {"A": 0, "B": 0, "C": 0, "D": 0, "unknown": 0}
    for r in rows:
        bands[_band_letter(r)] += 1

    risk = {"none": 0, "yellow": 0, "red": 0}
    for r in rows:
        risk[_risk(r)] += 1

    sectors: dict = {}
    for r in rows:
        s = r.get("industry") or r.get("sector") or r.get("turnover_category") or "Unspecified"
        sectors[s] = sectors.get(s, 0) + 1
    sector_list = sorted(({"name": k, "count": v} for k, v in sectors.items()),
                         key=lambda x: x["count"], reverse=True)

    return {
        "total": n,
        "bands": bands,
        "averages": {"health": avg("health_score"),
                     "bank_readiness": avg("bank_readiness_score"),
                     "green": avg("green_eligibility_score")},
        "certified": sum(1 for r in rows if r.get("provisional") is False),
        "provisional": sum(1 for r in rows if r.get("provisional")),
        "risk": risk,
        "sectors": sector_list,
        "turnover_total": sum(float(r.get("annual_turnover") or 0) for r in rows),
    }


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
