# backend/routers/admin.py
#
# Maintenance endpoints. Mount in main.py exactly like the others — it carries its
# own /admin prefix, so add it WITHOUT an extra prefix:
#
#     from routers import admin
#     app.include_router(admin.router)
#
# Why this exists: the cached health_score on msme_entities is only rewritten when
# refresh_score runs (which today only happens on a console "Save"). After an engine
# change the cache goes stale — e.g. it reads 76/GOOD while the live console shows
# 71/MEDIUM. These endpoints recompute the cache with the CURRENT engine so the owner
# app and the console agree again.
#
# NOTE: leave this behind auth before production — it rewrites every client's score.

from fastapi import APIRouter, Depends
from core.database import get_db
from services import score_service

router = APIRouter(prefix="/admin", tags=["admin"])

# PostgREST requires a filter on DELETE; an id no real row will ever have is the
# idiom for "match every row".
_ALL = "00000000-0000-0000-0000-000000000000"


@router.post("/recompute-scores")
def recompute_all(reset_anchor: bool = False, db=Depends(get_db)):
    """Recompute EVERY client's cached score with the current engine.

    reset_anchor=true first clears score_history, so the recompute starts from a
    clean slate and no phantom week-over-week delta appears. Use it the first time
    after an engine change; omit it for routine refreshes once history is real.
    """
    if reset_anchor:
        db.table("score_history").delete().neq("msme_id", _ALL).execute()
    return score_service.refresh_all_scores(db)


@router.post("/recompute-scores/{msme_id}")
def recompute_one(msme_id: str, reset_anchor: bool = False, db=Depends(get_db)):
    """Same as above, but for a single client."""
    if reset_anchor:
        db.table("score_history").delete().eq("msme_id", msme_id).execute()
    return score_service.refresh_score(db, msme_id)
