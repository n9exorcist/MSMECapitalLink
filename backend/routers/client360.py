# backend/routers/client360.py
# GET /msme/{id}/client360 — assembles the full object the Next <Client360> component
# expects, reusing the scoring engine so the score + ratios stay single-sourced.
# Mount in main.py:
#     from routers import client360
#     app.include_router(client360.router)

from fastapi import APIRouter, Depends, HTTPException
from core.database import get_db
from services.read_model import build_read_model, ReadModelError
from services.scoring_engine import COMPONENT_WEIGHTS

router = APIRouter(prefix="/msme", tags=["client360"])

NAMES = {
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


def _safe(n, d):
    """n / d, or None when the denominator is missing/non-positive."""
    return (n / d) if (d and d > 0) else None


def _pct(n, d):
    """100 · n / d as a percentage, or None."""
    r = _safe(n, d)
    return None if r is None else r * 100.0


@router.get("/{msme_id}/client360")
def client360(msme_id: str, db=Depends(get_db)):
    # Single computed read-model (entity + financials + bureau overlay + score +
    # ratios). Scoring lives in services.read_model — this route only shapes the view.
    try:
        rm = build_read_model(db, msme_id)
    except ReadModelError as e:
        raise HTTPException(404, str(e))

    ent, fin, m, r, sector = rm.entity, rm.financials, rm.metrics, rm.score, rm.sector
    cr, dscr, tol_tnw, icr = rm.current_ratio, rm.dscr, rm.tol_tnw, rm.icr
    dso, invd, crd, wc = rm.dso, rm.inv_days, rm.cred_days, rm.wc_cycle
    _, good, okb = rm.wc_band

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

    # ── extended ratio library (§7.3) — display-only, derived from the audited figures.
    # Core banker ratios above stay single-sourced in read_model; these are view-layer.
    sales = float(m.projected_annual_turnover or 0)
    _gp = fin.get("gross_profit")
    gp = float(_gp) if _gp not in (None, "") else None
    ebit_v = float(m.ebit or 0)
    dep_v = float(m.depreciation or 0)
    npat_v = float(m.net_profit_after_tax or 0)
    ca_v = float(m.current_assets or 0)
    cl_v = float(m.current_liabilities or 0)
    inv_v = float(m.inventory or 0)
    tol_r = float(m.total_outside_liabilities or 0)
    tnw_v = float(m.tangible_net_worth or 0)

    term_debt = max(tol_r - cl_v, 0.0)         # long-term borrowings
    cap_employed = tnw_v + term_debt
    total_assets = tol_r + tnw_v               # balance-sheet identity
    net_fixed = max(total_assets - ca_v, 0.0)

    def _R(name, v, norm, good, warn, hib=True, fmt="{:.2f}"):
        vv, st, lab = _pill(v, good, warn, higher_is_better=hib, fmt=fmt)
        return {"name": name, "value": vv, "norm": norm, "status": st, "label": lab}

    ratios += [
        _R("Quick ratio", _safe(ca_v - inv_v, cl_v), "≥ 1.00", 1.0, 0.75),
        _R("Gross margin", _pct(gp, sales) if gp is not None else None, "> 0", 8.0, 0.0, fmt="{:.1f}%"),
        _R("Operating margin", _pct(ebit_v, sales), "> 0", 8.0, 0.0, fmt="{:.1f}%"),
        _R("EBITDA margin", _pct(ebit_v + dep_v, sales), "> 0", 10.0, 0.0, fmt="{:.1f}%"),
        _R("Net profit margin", _pct(npat_v, sales), "> 0", 5.0, 0.0, fmt="{:.1f}%"),
        _R("Return on capital (ROCE)", _pct(ebit_v, cap_employed), "≥ 12%", 12.0, 0.0, fmt="{:.1f}%"),
        _R("Return on equity (ROE)", _pct(npat_v, tnw_v), "> 0", 12.0, 0.0, fmt="{:.1f}%"),
        _R("Asset turnover", _safe(sales, total_assets), "sector-led", 1.0, 0.5, fmt="{:.2f}×"),
        _R("Fixed-asset turnover", _safe(sales, net_fixed), "sector-led", 2.0, 1.0, fmt="{:.2f}×"),
        _R("Long-term debt / equity", _safe(term_debt, tnw_v), "≤ 1.00", 1.0, 2.0, hib=False),
    ]

    components = [
        {"name": NAMES[k], "weight": int(round(COMPONENT_WEIGHTS[k] * 100)),
         "score": r["component_breakdown"][k], "evidenced": r["evidenced"][k]}
        for k in COMPONENT_WEIGHTS
    ]

    # ── turnover trend ──
    # Prefer 12 monthly points from GSTR-1 (monthly_sales); fall back to the annual
    # msme_financials view when there are no usable monthly rows. We select("*") and
    # use tolerant getters so unknown column names degrade gracefully (fall back to the
    # annual bar) instead of 400-ing the endpoint or rendering 12 empty bars.
    _MABBR = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun",
              "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

    def _rev(row):  # revenue value, whatever the column is called
        for k in ("revenue", "outward_taxable", "taxable_value", "taxable_outward", "amount", "value"):
            if row.get(k) is not None:
                return float(row.get(k) or 0)
        return 0.0

    def _mval(row):  # the 'month' value, whatever the column is called
        for k in ("month", "period", "month_label", "tax_period"):
            if row.get(k) is not None:
                return row.get(k)
        return None

    def _msort(row):  # chronological sort key for int 1-12 OR 'YYYY-MM[-DD]' text
        mv = _mval(row)
        if isinstance(mv, int):
            return (0, mv, "")
        s = str(mv or "")
        return (0, int(s), "") if s.isdigit() else (1, 0, s)

    def _mlabel(row):  # short month label, e.g. 'Apr'
        mv = _mval(row)
        try:
            if isinstance(mv, int) or (isinstance(mv, str) and mv.isdigit()):
                return _MABBR[int(mv)]
            s = str(mv)
            if len(s) >= 7 and s[4] == "-":   # 2025-04...
                return _MABBR[int(s[5:7])]
        except Exception:
            pass
        return str(mv or "")

    monthly = (db.table("monthly_sales").select("*")
               .eq("msme_id", msme_id).execute().data) or []

    if monthly and any(_rev(row) for row in monthly):
        monthly = sorted(monthly, key=_msort)
        vals = [_rev(row) for row in monthly]
        mx = max(vals) or 1
        trend = [{
            "label": _mlabel(row),
            "value": f"{(v / 1e5):.1f}",          # ₹ Lakh per month
            "pct": round((v / mx) * 100),
            "peak": v == mx,
        } for row, v in zip(monthly, vals)]
        trend_unit = "₹ L"
        trend_note = f"Monthly GSTR-3B revenue · FY2025-26 total ≈ ₹{(sum(vals) / 1e7):.2f} Cr ({len(vals)} months)."
    else:
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
        trend_unit = "₹ Cr"
        trend_note = "Turnover by financial year. Add monthly GST data to see the monthly trend."

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
        "bankReadiness": r.get("bank_readiness_score"),
        "bankReadinessBand": r.get("bank_readiness_band"),
        "band": r["band"],
        "provisional": r["provisional"],
        "completeness": r["data_completeness"],
        "flags": r["flags"],
        "reco": r["recommended_lender_tier"],
        "wc": {"dso": round(dso), "inv": round(invd), "cred": round(crd), "total": round(wc), "note": wc_note},
        "trend": trend,
        "trendUnit": trend_unit,
        "trendNote": trend_note,
        "components": components,
        "ratios": ratios,
    }