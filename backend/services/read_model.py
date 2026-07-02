# backend/services/read_model.py
# THE single per-client computed read-model. One place that: fetches the entity +
# latest financials + latest bureau pull, applies the CIBIL overlay, runs the scoring
# engine, and derives the banker ratios. Everything that needs a client's computed
# numbers consumes THIS — `routers/client360` (view shaping), `services/score_service`
# (persistence), and the report/document context builders — so scoring lives in exactly
# one place and can't drift between callers again.
#
# To avoid an import cycle, score_service imports build_read_model lazily (inside
# refresh_score); this module imports score_service at top for its row-fetch + metric
# helpers, which do NOT import this module.

from dataclasses import dataclass
from typing import Any, Optional, Tuple

from services import score_service
from services.scoring_engine import calculate_composite_score, _sector_key, WC_CYCLE_BANDS


class ReadModelError(Exception):
    """No entity / no financials on record — callers map this to a 404 or an error dict."""


@dataclass
class ReadModel:
    entity: dict
    financials: dict
    bureau: Optional[dict]
    metrics: Any                 # MSMEFinancialInflowData (with bureau CIBIL overlaid)
    sector: Optional[str]
    score: dict                  # calculate_composite_score(...) output
    # derived banker ratios (unrounded; formatted by the view/report layers)
    current_ratio: float
    dscr: Optional[float]
    tol_tnw: Optional[float]
    icr: Optional[float]
    dso: float
    inv_days: float
    cred_days: float
    wc_cycle: float
    wc_band: Tuple[float, float, float]   # sector-aware (excellent, good, ok) day bands


def build_read_model(db, msme_id: str) -> ReadModel:
    ent = score_service._entity(db, msme_id)
    if not ent:
        raise ReadModelError("Client not found")
    fin = score_service._latest_financials(db, msme_id)
    if not fin:
        raise ReadModelError("No financials on record for this client")

    m = score_service._to_metrics(fin)
    # Apply the latest bureau pull (authoritative CIBIL) over the legacy column so the
    # recompute can certify. Without it we'd read the NULL msme_financials.cibil_score.
    pull = score_service._latest_bureau_pull(db, msme_id)
    if pull and pull.get("score") is not None:
        m.cibil_score = int(pull["score"])

    sector = ent.get("industry") or ent.get("sector")
    bounces = score_service._opt_float(fin, "bounces_per_month")
    docs = float(fin.get("docs_ready_pct") or 80)
    compliance = float(fin.get("compliance_pct") or 90)
    cash_pos = score_service._latest_cash_position(db, msme_id)   # bank-statement evidence
    gst_match = score_service._gst_match(db, msme_id)             # GSTR-1 ↔ 3B consistency

    r = calculate_composite_score(
        m, bounces=bounces, docs_ready=docs, compliance=compliance,
        sector=sector, cash_position=cash_pos, gst_match=gst_match)

    # ── banker ratios, derived from the same metrics the engine used ──
    cl = m.current_liabilities or m.total_outside_liabilities
    cr = (m.current_assets / cl) if cl > 0 else 0.0
    dso = (m.sundry_debtors / m.projected_annual_turnover) * 365 if m.projected_annual_turnover > 0 else 0.0
    invd = (m.inventory / m.annual_purchases) * 365 if m.annual_purchases > 0 else 0.0
    crd = (m.sundry_creditors / m.annual_purchases) * 365 if m.annual_purchases > 0 else 0.0
    wc = dso + invd - crd
    tol_tnw = (m.total_outside_liabilities / m.tangible_net_worth) if m.tangible_net_worth > 0 else None
    icr = (m.ebit / m.interest_expense) if m.interest_expense > 0 else None
    dnum = m.net_profit_after_tax + m.depreciation + m.interest_on_term_loan
    dden = m.principal_repayment + m.interest_on_term_loan
    dscr = (dnum / dden) if dden > 0 else None
    wc_band = WC_CYCLE_BANDS.get(_sector_key(sector), WC_CYCLE_BANDS["default"])

    return ReadModel(
        entity=ent, financials=fin, bureau=pull, metrics=m, sector=sector, score=r,
        current_ratio=cr, dscr=dscr, tol_tnw=tol_tnw, icr=icr,
        dso=dso, inv_days=invd, cred_days=crd, wc_cycle=wc, wc_band=wc_band,
    )
