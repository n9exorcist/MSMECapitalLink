# backend/routers/client360.py
# GET /msme/{id}/client360 — assembles the full object the Next <Client360> component
# expects, reusing the scoring engine so the score + ratios stay single-sourced.
# Mount in main.py:
#     from routers import client360
#     app.include_router(client360.router)

from fastapi import APIRouter, Depends, HTTPException
from core.database import get_db
from services import score_service
from services.scoring_engine import calculate_composite_score, COMPONENT_WEIGHTS, _sector_key, WC_CYCLE_BANDS

router = APIRouter(prefix="/msme", tags=["client360"])

_NAMES = {
    "banking_discipline": "Banking discipline", "liquidity_ratios": "Liquidity ratios",
    "gst_consistency": "GST consistency", "leverage_quality": "Leverage quality",
    "profitability": "Profitability", "compliance_discipline": "Compliance discipline",
    "documentation_readiness": "Documentation readiness", "repayment_behavior": "Repayment behavior",
}


def _cr(rupees) -> str:                      # rupees -> "₹ Cr" string
    return f"{(rupees or 0) / 1e7:.2f}"


def _pill(v, good, warn, higher_is_better=True, fmt="{:.2f}"):
    if v is None:
        return ("—", "na", "No data")
    s = fmt.format(v)
    if higher_is_better:
        if v >= good: return (s, "ok", "Pass")
        if v >= warn: return (s, "warn", "Stressed")
        return (s, "crit", "Fail")
    if v <= good: return (s, "ok", "Pass")
    if v <= warn: return (s, "warn", "Stressed")
    return (s, "crit", "Fail")


@router.get("/{msme_id}/client360")
def client360(msme_id: str, db=Depends(get_db)):
    ent = score_service._entity(db, msme_id)
    if not ent:
        raise HTTPException(404, "Client not found")
    fin = score_service._latest_financials(db, msme_id)
    if not fin:
        raise HTTPException(404, "No financials on record for this client")

    m = score_service._to_metrics(fin)
    sector = ent.get("industry") or ent.get("sector")
    bounces = score_service._opt_float(fin, "bounces_per_month")
    docs = float(fin.get("docs_ready_pct") or 80)
    comp = float(fin.get("compliance_pct") or 90)
    r = calculate_composite_score(m, bounces=bounces, docs_ready=docs, compliance=comp, sector=sector)

    # ── ratios (recomputed from the same metrics the engine used) ──
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

    _, good, okb = WC_CYCLE_BANDS.get(_sector_key(sector), WC_CYCLE_BANDS["default"])
    cr_v, cr_s, cr_l = _pill(cr, 1.33, 1.0)
    dscr_v, dscr_s, dscr_l = _pill(dscr, 1.5, 1.25)
    tol_v, tol_s, tol_l = _pill(tol_tnw, 3.0, 5.0, higher_is_better=False)
    icr_v, icr_s, icr_l = _pill(icr, 1.5, 1.0)
    wc_v, wc_s, wc_l = _pill(wc, good, okb, higher_is_better=False, fmt="{:.0f}")
    wc_l = {"ok": "Healthy", "warn": "Stretched", "crit": "Excessive", "na": "No data"}[wc_s]

    ratios = [
        {"name": "Current ratio", "value": cr_v, "norm": "≥ 1.33", "status": cr_s, "label": cr_l},
        {"name": "DSCR", "value": dscr_v, "norm": "≥ 1.50", "status": dscr_s, "label": dscr_l},
        {"name": "TOL / TNW", "value": tol_v, "norm": "≤ 3.00", "status": tol_s, "label": tol_l},
        {"name": "Interest coverage (ICR)", "value": icr_v, "norm": "≥ 1.50", "status": icr_s, "label": icr_l},
        {"name": "WC cycle (days)", "value": wc_v, "norm": f"≤ {int(okb)}*", "status": wc_s, "label": wc_l},
    ]

    components = [
        {"name": _NAMES[k], "weight": int(round(COMPONENT_WEIGHTS[k] * 100)),
         "score": r["component_breakdown"][k], "evidenced": r["evidenced"][k]}
        for k in COMPONENT_WEIGHTS
    ]

    # ── turnover trend across all financial periods on record ──
    fins = (db.table("msme_financials")
            .select("period_label,period_year,period_month,projected_annual_turnover")
            .eq("msme_id", msme_id).order("period_year").execute().data) or []
    mx = max([float(f.get("projected_annual_turnover") or 0) for f in fins] or [0]) or 1
    trend = [{
        "label": f.get("period_label") or str(f.get("period_year") or ""),
        "value": _cr(f.get("projected_annual_turnover")),
        "pct": round((float(f.get("projected_annual_turnover") or 0) / mx) * 100),
        "peak": float(f.get("projected_annual_turnover") or 0) == mx,
    } for f in fins]

    # ── GST filing summary ──
    cfs = (db.table("compliance_filings").select("status").eq("msme_id", msme_id).execute().data) or []
    filed = sum(1 for c in cfs if (c.get("status") or "").lower() == "filed")
    gst_filing = f"{filed}/{len(cfs)} filed" if cfs else ""

    wc_note = (f"Receivables ₹{_cr(m.sundry_debtors)} Cr — debtor days ({dso:.0f}) dominate the {wc:.0f}-day cycle."
               if m.sundry_debtors else "Working-capital cycle decomposition.")

    return {
        "name": ent.get("company_name") or ent.get("name") or "",
        "owner": ent.get("owner_name") or ent.get("owner") or "",
        "gstin": ent.get("gstin") or "",
        "pan": ent.get("pan") or "",
        "sector": ent.get("industry") or ent.get("sector") or "",
        "msmeClass": ent.get("msme_class") or ent.get("turnover_category") or "",
        "location": ent.get("location") or "",
        "auditedPeriod": fin.get("period_label") or "",
        "auditor": ent.get("auditor") or "",
        "gstFiling": gst_filing,
        "advisor": ent.get("advisor") or "",
        "health": r["currentScore"],
        "band": r["band"],
        "provisional": r["provisional"],
        "completeness": r["data_completeness"],
        "flags": r["flags"],
        "reco": r["recommended_lender_tier"],
        "wc": {"dso": round(dso), "inv": round(invd), "cred": round(crd), "total": round(wc), "note": wc_note},
        "trend": trend,
        "trendNote": "Turnover by financial year. Add more periods to extend the trend.",
        "components": components,
        "ratios": ratios,
    }