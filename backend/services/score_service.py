# backend/services/score_service.py
# Fetches a client's latest financials from Supabase, runs the scoring engine,
# and persists to THREE places (entity row, scores, score_history). The db
# (Supabase Client) is passed in by the caller, so no DB import is needed here.

from datetime import datetime, timedelta, timezone
from typing import Optional
from schemas.msme import MSMEFinancialInflowData
from services.scoring_engine import calculate_composite_score


def _parse(ts: Optional[str]):
    if not ts:
        return None
    try:
        return datetime.fromisoformat(ts.replace("Z", "+00:00"))
    except Exception:
        return None


def _latest_financials(db, msme_id: str) -> Optional[dict]:
    rows = (db.table("msme_financials").select("*").eq("msme_id", msme_id)
            .order("created_at", desc=True).limit(1).execute().data) or []
    return rows[0] if rows else None


def _entity(db, msme_id: str) -> dict:
    rows = (db.table("msme_entities").select("*").eq("id", msme_id)
            .limit(1).execute().data) or []
    return rows[0] if rows else {}


def _to_metrics(fin: dict) -> MSMEFinancialInflowData:
    def g(k):
        return fin.get(k) or 0
    return MSMEFinancialInflowData(
        company_name=fin.get("company_name", "") or "",
        projected_annual_turnover=g("projected_annual_turnover"),
        annual_purchases=g("annual_purchases"),
        ebit=g("ebit"),
        net_profit_after_tax=g("net_profit_after_tax"),
        depreciation=g("depreciation"),
        interest_expense=g("interest_expense"),
        interest_on_term_loan=g("interest_on_term_loan"),
        principal_repayment=g("principal_repayment"),
        current_assets=g("current_assets"),
        current_liabilities=g("current_liabilities"),
        inventory=g("inventory"),
        sundry_debtors=g("sundry_debtors"),
        sundry_creditors=g("sundry_creditors"),
        total_outside_liabilities=g("total_outside_liabilities"),
        tangible_net_worth=g("tangible_net_worth"),
        declared_bank_statement_credits=g("declared_bank_statement_credits"),
        days_past_due=int(g("days_past_due")),
        cibil_score=int(g("cibil_score")),
    )


def _previous_anchor(db, msme_id: str, now: datetime) -> Optional[int]:
    """A real historical anchor for the delta: prefer a point >= 7 days old."""
    hist = (db.table("score_history").select("score, computed_at")
            .eq("msme_id", msme_id).order("computed_at", desc=True)
            .limit(50).execute().data) or []
    if not hist:
        return None
    week_ago = now - timedelta(days=7)
    for h in hist:
        ts = _parse(h.get("computed_at"))
        if ts and ts <= week_ago:
            return int(h["score"])
    return int(hist[-1]["score"])


def refresh_score(db, msme_id: str) -> dict:
    fin = _latest_financials(db, msme_id)
    if not fin:
        return {"score": None, "band": None, "delta": None,
                "error": "No financials on record for this client."}

    ent = _entity(db, msme_id)
    metrics = _to_metrics(fin)
    sector = ent.get("industry") or ent.get("sector")
    bounces = float(fin.get("bounces_per_month") or 0)
    docs = float(fin.get("docs_ready_pct") or 80)
    compliance = float(fin.get("compliance_pct") or 90)

    result = calculate_composite_score(
        metrics, bounces=bounces, docs_ready=docs, compliance=compliance, sector=sector)

    now = datetime.now(timezone.utc)
    ts = now.isoformat()
    current = result["currentScore"]
    band = result["band"]
    components = result["component_breakdown"]
    anchor = _previous_anchor(db, msme_id, now)
    delta = (current - anchor) if anchor is not None else None

    db.table("msme_entities").update({
        "health_score": current, "band": band, "previous_score": anchor,
        "score_delta": delta, "score_updated_at": ts,
    }).eq("id", msme_id).execute()

    db.table("scores").upsert({
        "msme_id": msme_id, "score": current, "band": band,
        "components": components, "computed_at": ts,
    }, on_conflict="msme_id").execute()

    db.table("score_history").insert({
        "msme_id": msme_id, "score": current, "band": band,
        "components": components, "computed_at": ts,
    }).execute()

    return {"score": current, "band": band, "delta": delta,
            "components": components,
            "diagnostics": {"current_ratio": result.get("current_ratio"),
                            "wc_cycle_days": result.get("wc_cycle_days"),
                            "sector_used": result.get("sector_used")}}


def refresh_all_scores(db) -> dict:
    ids = [r["id"] for r in (db.table("msme_entities").select("id").execute().data or [])]
    results = []
    for mid in ids:
        try:
            results.append({"id": mid, **refresh_score(db, mid)})
        except Exception as e:
            results.append({"id": mid, "error": str(e)})
    return {"refreshed": len(results), "results": results}