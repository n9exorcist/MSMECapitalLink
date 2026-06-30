# backend/services/score_service.py
# Fetches a client's latest financials, runs the scoring engine, and persists to
# msme_entities + scores + score_history. CHANGED: blank CIBIL / DPD / bounces are
# now passed to the engine as None (unknown), not 0 (which scored as "perfect"),
# and the engine's confidence outputs (risk / completeness / provisional / flags)
# are persisted onto msme_entities for the dashboard to render.

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


def _latest_cash_position(db, msme_id: str) -> Optional[dict]:
    # NEW: most recent parsed bank statement → banking-discipline evidence.
    rows = (db.table("cash_position").select("*").eq("msme_id", msme_id)
            .order("as_of_date", desc=True).limit(1).execute().data) or []
    return rows[0] if rows else None

def _latest_bureau_pull(db, msme_id: str) -> Optional[dict]:
    # Most recent credit-bureau pull → authoritative CIBIL, off msme_financials.
    rows = (db.table("credit_bureau_pulls").select("*").eq("msme_id", msme_id)
            .order("pulled_on", desc=True).limit(1).execute().data) or []
    return rows[0] if rows else None


def _entity(db, msme_id: str) -> dict:
    rows = (db.table("msme_entities").select("*").eq("id", msme_id)
            .limit(1).execute().data) or []
    return rows[0] if rows else {}


# NEW: None when the DB value is SQL NULL — preserves "unknown" vs a verified 0.
def _opt_int(d: dict, k: str):
    v = d.get(k)
    return None if v is None else int(v)


def _opt_float(d: dict, k: str):
    v = d.get(k)
    return None if v is None else float(v)


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
        # CHANGED: None = unknown (was int(g(...)) which turned NULL into 0)
        days_past_due=_opt_int(fin, "days_past_due"),
        cibil_score=_opt_int(fin, "cibil_score"),
    )


def _previous_anchor(db, msme_id: str, now: datetime) -> Optional[int]:
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
    # Prefer a real bureau pull over the legacy msme_financials.cibil_score.
    # Falls back to the column when no pull exists, so nothing breaks mid-migration.
    pull = _latest_bureau_pull(db, msme_id)
    if pull and pull.get("score") is not None:
        metrics.cibil_score = int(pull["score"])
    sector = ent.get("industry") or ent.get("sector")
    # CHANGED: None when unknown (was `or 0` → assumed "no bounces")
    bounces = _opt_float(fin, "bounces_per_month")
    docs = float(fin.get("docs_ready_pct") or 80)
    compliance = float(fin.get("compliance_pct") or 90)

    cash_pos = _latest_cash_position(db, msme_id)   # NEW: bank-statement evidence
    result = calculate_composite_score(
        metrics, bounces=bounces, docs_ready=docs, compliance=compliance, sector=sector,
        cash_position=cash_pos)

    now = datetime.now(timezone.utc)
    ts = now.isoformat()
    current = result["currentScore"]
    band = result["band"]
    components = result["component_breakdown"]
    # NEW: confidence outputs from the fixed engine
    completeness = result["data_completeness"]
    flags = result["flags"]
    provisional = result["provisional"]
    risk = result["risk"]

    anchor = _previous_anchor(db, msme_id, now)
    delta = (current - anchor) if anchor is not None else None

    db.table("msme_entities").update({
        "health_score": current, "band": band, "previous_score": anchor,
        "score_delta": delta, "score_updated_at": ts,
        # NEW columns (see migration) — drive the dashboard dot + provisional badge
        "risk": risk, "data_completeness": completeness,
        "provisional": provisional, "score_flags": flags,
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
            "provisional": provisional, "data_completeness": completeness, "flags": flags,
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