# backend/reports/context.py
# build_health_report_context(db, msme_id) → one flat dict of Jinja template vars
# for the MSME Financial Health Report (reports/templates/health_report.html).
#
# THREE sources, single recompute:
#   (a) the computed view  → routers.client360.client360(msme_id, db)
#       (scores, components, ratios, wc, trend, reco, provisional). We REUSE this
#       function so scoring stays single-sourced — no third recompute path.
#   (b) the raw financials → score_service._latest_financials  (P&L + BS snapshot,
#       plus margins derived here).
#   (c) the latest bureau  → score_service._latest_bureau_pull (CIBIL + pull date).
#
# All rupee figures are formatted in Indian grouping HERE; all bar widths, bar
# colours and pill CSS classes are derived HERE to match the template's design —
# the template only renders pre-computed strings.

from datetime import datetime
import re

from routers import client360 as _c360
from services import score_service as _ss
from reports.format import (
    inr as _inr, cr as _cr, pct1 as _pct1,
    fmt_long as _fmt_long, fmt_med as _fmt_med, fmt_med_str as _fmt_med_str,
)

# template CSS custom-property names (so bar colours are derived here, not inline)
_TEAL = "var(--teal)"
_TEAL2 = "var(--teal2)"
_AMBER = "var(--amber)"
_TARGET = 80
_BAND_WORD = {"EXCELLENT": "Excellent", "GOOD": "Good", "MEDIUM": "Medium", "POOR": "Poor"}
_BAND_TIER = {"EXCELLENT": "A", "GOOD": "B", "MEDIUM": "C", "POOR": "D"}


# ── formatting helpers (shared formatters live in reports.format) ───────────
def _num(d: dict, k: str):
    v = (d or {}).get(k)
    try:
        return None if v is None else float(v)
    except (TypeError, ValueError):
        return None


def _gap_str(gap) -> str:
    """Signed 1-decimal gap with a U+2212 minus, e.g. '+10.8' / '−4.0' / '0.0'."""
    if gap is None:
        return "—"
    g = round(float(gap), 1)
    if g == 0:
        return "0.0"
    return f"{g:+.1f}".replace("-", "−")


def _comp_status(score, evidenced):
    """(title, pill_class) matching the template's banding."""
    if not evidenced or score is None:
        return ("No data", "na")
    if score >= 80:
        return ("On track", "ok")
    if score >= 60:
        return ("Near", "warn")
    return ("Below", "crit")


def _bar_color(score):
    if score is None:
        return _AMBER
    if score >= 85:
        return _TEAL
    if score >= 60:
        return _TEAL2
    return _AMBER


def build_health_report_context(db, msme_id: str) -> dict:
    # (a) computed view — single source of truth for the score/ratios/components.
    view = _c360.client360(msme_id, db)          # raises 404 if missing entity/financials
    # (b) raw financials snapshot, (c) latest bureau pull.
    fin = _ss._latest_financials(db, msme_id) or {}
    pull = _ss._latest_bureau_pull(db, msme_id) or {}

    today = datetime.now().date()
    band = view["band"]
    provisional = view["provisional"]
    certified = not provisional
    period_label = view.get("auditedPeriod") or fin.get("period_label") or ""

    # Derive period-dependent labels from the audited FY (e.g. 'FY 2024–25'):
    #   • bs_date    — balance-sheet 'as at' = close of the audited FY (31 Mar Y+1)
    #   • current_fy — rolling GST year shown in the trend = the FY after the audited one
    _fy = re.search(r"(20\d\d)", period_label or "")
    _sy = int(_fy.group(1)) if _fy else None
    bs_date = f"31 Mar {_sy + 1}" if _sy else ""
    current_fy = f"FY {_sy + 1}–{str(_sy + 2)[2:]}" if _sy else ""

    # ── raw P&L + balance-sheet figures (source b) ──
    turnover = _num(fin, "projected_annual_turnover")
    purchases = _num(fin, "annual_purchases")
    gross_profit = _num(fin, "gross_profit")
    ebit = _num(fin, "ebit")
    interest = _num(fin, "interest_expense")
    depreciation = _num(fin, "depreciation")
    npat = _num(fin, "net_profit_after_tax")
    current_assets = _num(fin, "current_assets")
    sundry_debtors = _num(fin, "sundry_debtors")
    inventory = _num(fin, "inventory")
    current_liabilities = _num(fin, "current_liabilities")
    tol = _num(fin, "total_outside_liabilities")
    tnw = _num(fin, "tangible_net_worth")
    borrowings = (tol - current_liabilities) if (tol is not None and current_liabilities is not None) else None
    gross_margin = (gross_profit / turnover * 100) if (gross_profit and turnover) else None
    net_margin = (npat / turnover * 100) if (npat is not None and turnover) else None

    # ── bureau (source c) ──
    cibil = pull.get("score")
    cibil_date = _fmt_med_str(pull.get("pulled_on")) if pull.get("pulled_on") else ""

    # ── scorecard rows (page 3) ──
    components = []
    comp_score = {}
    for c in view["components"]:
        sc = c["score"]
        comp_score[c["name"]] = sc
        title, cls = _comp_status(sc, c["evidenced"])
        gap = (sc - _TARGET) if sc is not None else None
        gap_class = "" if (sc is None or round(sc - _TARGET, 1) == 0) else ("pos" if sc > _TARGET else "neg")
        components.append({
            "name": c["name"],
            "weight": c["weight"],
            "score": (f"{sc:.1f}" if sc is not None else "—"),
            "bar_pct": (round(max(0.0, min(100.0, sc)), 1) if sc is not None else 0),
            "bar_color": _bar_color(sc),
            "gap": _gap_str(gap),
            "gap_class": gap_class,
            "status": title,
            "status_class": cls,
        })

    health = view["health"]
    composite_gap = _gap_str((health - _TARGET) if health is not None else None)
    composite_gap_class = "" if (health is None or health == _TARGET) else ("pos" if health > _TARGET else "neg")

    # ── ratio lookups (page 4) — reuse client360 value/norm/status/label ──
    by = {r["name"]: r for r in view["ratios"]}

    def _r(name):
        x = by.get(name, {})
        return {"value": x.get("value", "—"), "norm": x.get("norm", ""),
                "verdict": x.get("label", ""), "cls": x.get("status", "na")}

    rb = {
        "cr": _r("Current ratio"),
        "icr": _r("Interest coverage (ICR)"),
        "tol": _r("TOL / TNW"),
        "wc": _r("WC cycle (days)"),
        "dscr": _r("DSCR"),
    }

    wc = view["wc"]

    # ── monthly GST revenue bars (page 5) ──
    trend_bars = [{
        "label": t["label"], "value": t["value"], "peak": bool(t.get("peak")),
        "bar_h": max(round(t["pct"]), 2),
    } for t in view["trend"]]
    fy_gst_total_cr = f"{sum(float(t['value']) for t in view['trend']) / 100:.2f}" if view["trend"] else "—"

    # ── lender tier / rate (page 2 + page 6) ──
    reco = view["reco"]
    m = re.search(r"([\d.]+\s*[-–]\s*[\d.]+%)", reco)
    rate_range = m.group(1).replace("-", "–") if m else ""
    lender_name = reco.split("@")[0].strip() if "@" in reco else reco

    return {
        # identity / cover / running header
        "client_name": view["name"],
        "owner": view["owner"],
        "sector": view["sector"],
        "msme_class": view["msmeClass"],
        "gstin": view["gstin"],
        "pan": view["pan"],
        "location": view["location"],
        "auditor": view["auditor"],
        "advisor": view["advisor"],
        "constitution": "Proprietorship",
        "period_label": period_label,
        "issued_long": _fmt_long(today),     # '30 June 2026'
        "issued_med": _fmt_med(today),       # '30 Jun 2026'

        # verdict block
        "score": health,
        "score_1dp": (f"{health:.1f}" if health is not None else "—"),
        "band": band,
        "band_word": _BAND_WORD.get(band, band.title() if band else ""),
        "band_tier": _BAND_TIER.get(band, ""),
        "bs_date": bs_date,
        "current_fy": current_fy,
        "provisional": provisional,
        "certified": certified,
        "cert_word": "CERTIFIED" if certified else "PROVISIONAL",
        "bank_ready_word": "Ready" if certified else "Provisional",
        "composite_status": "Certified" if certified else "Provisional",
        "composite_status_class": "ok" if certified else "warn",
        "data_completeness": view["completeness"],
        "rate_range": rate_range,
        "lender_name": lender_name,
        "reco": reco,

        # narrative scalars (pages 2/4/6)
        "banking_score": (f"{comp_score.get('Banking discipline'):.1f}" if comp_score.get("Banking discipline") is not None else "—"),
        "gst_score": (f"{comp_score.get('GST consistency'):.0f}" if comp_score.get("GST consistency") is not None else "—"),
        "leverage_score": (f"{comp_score.get('Leverage quality'):.0f}" if comp_score.get("Leverage quality") is not None else "—"),
        "liquidity_score": (f"{comp_score.get('Liquidity ratios'):.0f}" if comp_score.get("Liquidity ratios") is not None else "—"),
        "cibil": cibil if cibil is not None else "—",
        "cibil_date": cibil_date,
        "current_ratio": rb["cr"]["value"],
        "icr": rb["icr"]["value"],
        "tol_tnw": rb["tol"]["value"],
        "receivables_cr": _cr(sundry_debtors),
        "turnover_cr": _cr(turnover),
        "debtor_days": wc["dso"],
        "wc_total": wc["total"],
        "wc_dso": wc["dso"],
        "wc_inv": wc["inv"],
        "wc_cred": wc["cred"],
        "gross_margin": _pct1(gross_margin),
        "net_margin": _pct1(net_margin),

        # scorecard (page 3)
        "components": components,
        "composite_gap": composite_gap,
        "composite_gap_class": composite_gap_class,
        "target": _TARGET,

        # ratios + WC (page 4)
        "rb": rb,

        # financial snapshot (page 5)
        "fin": {
            "turnover": _inr(turnover), "purchases": _inr(purchases),
            "gross_profit": _inr(gross_profit), "ebit": _inr(ebit),
            "interest": _inr(interest), "depreciation": _inr(depreciation),
            "npat": _inr(npat), "current_assets": _inr(current_assets),
            "sundry_debtors": _inr(sundry_debtors), "inventory": _inr(inventory),
            "current_liabilities": _inr(current_liabilities), "tol": _inr(tol),
            "tnw": _inr(tnw), "borrowings": _inr(borrowings),
        },
        "trend": trend_bars,
        "fy_gst_total_cr": fy_gst_total_cr,
    }
