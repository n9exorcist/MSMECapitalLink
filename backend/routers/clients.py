# backend/routers/clients.py

from fastapi import APIRouter, Depends
from core.database import get_db

router = APIRouter(prefix="/msme", tags=["clients"])


@router.get("/clients")
def list_clients(db=Depends(get_db)):
    rows = db.table("msme_entities").select("*").execute().data or []
    return {"clients": [{
        "id": r.get("id"),
        "company": r.get("company_name") or r.get("name") or "Unnamed",
        "owner": r.get("owner_name") or r.get("owner"),
        "sector": r.get("industry") or r.get("sector") or r.get("turnover_category"),
        "turnover": r.get("annual_turnover") or 0,
        "health_score": r.get("health_score"),
        "band": r.get("band"),
        "last_update": r.get("score_updated_at") or r.get("updated_at") or r.get("created_at"),
        "risk": (                                          # ← ADD THIS
            "red"    if (r.get("health_score") or 0) < 40
            else "yellow" if (r.get("health_score") or 0) < 70
            else "none"
        ),
    } for r in rows]}