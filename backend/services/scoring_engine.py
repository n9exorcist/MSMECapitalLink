from datetime import datetime
from typing import Optional, Tuple
from schemas.msme import MSMEFinancialInflowData

COMPONENT_WEIGHTS = {
    "banking_discipline": 0.25, "liquidity_ratios": 0.15, "gst_consistency": 0.15,
    "leverage_quality": 0.10, "profitability": 0.10, "compliance_discipline": 0.10,
    "documentation_readiness": 0.10, "repayment_behavior": 0.05,
}

# ───────────────────────────────────────────────────────────────────────────
#  MISSING-DATA POLICY  — your call as the credit owner, tune these two:
#
#  The old engine read a blank CIBIL/bounce/DPD as 0, and 0 scored as
#  "perfect — no bounces / no overdue". So a file with NO bank evidence still
#  printed ~76 GOOD. These knobs stop that: absence of evidence is no longer
#  scored as good news.
UNKNOWN_SCORE = 40.0           # score for a component with NO supporting data.
                               # 40 = floor of the MEDIUM band: "unassessed", not
                               # "good" (old: ~60-100) and not "defaulter" (0).
GATE_BAND_ON_BANK_EVIDENCE = True
                               # If bank statements AND CIBIL are both missing, the
                               # file cannot be certified above MEDIUM regardless of
                               # how the ratios look — you can't call an MSME
                               # bank-ready with zero banking evidence. Flips the
                               # dashboard risk dot to yellow and marks the score
                               # "provisional".
# ───────────────────────────────────────────────────────────────────────────

WC_CYCLE_BANDS = {
    "trading": (45, 75, 120), "services": (45, 90, 150), "manufacturing": (90, 120, 180),
    "engineering": (120, 180, 240), "jewellery": (180, 300, 480),
    "works_contract": (240, 420, 600), "default": (90, 120, 180),
}
_SECTOR_KEYWORDS = [
    ("works_contract", ("interior", "fit-out", "fitout", "works contract", "contractor",
                        "construction", "civil", "epc", "infrastructure", "builder")),
    ("jewellery",      ("jewel", "gold", "bullion", "diamond")),
    ("engineering",    ("engineering", "machinery", "fabrication", "heavy", "capital goods", "auto comp")),
    ("trading",        ("trading", "trader", "wholesale", "distribution", "retail", "fmcg")),
    ("services",       ("service", "software", "saas", "consult", "logistics", "bpo", "ites", " it")),
    ("manufacturing",  ("manufactur", "factory", "processing", "production", "textile", "food process")),
]

def _sector_key(sector: Optional[str]) -> str:
    if not sector:
        return "default"
    s = sector.lower()
    for key, words in _SECTOR_KEYWORDS:
        if any(w in s for w in words):
            return key
    return "default"

def score_banking_discipline(bounces_per_month: Optional[float],
                             cibil: Optional[int]) -> Tuple[float, bool]:
    """Returns (score, evidenced). A blank bounce count is NOT read as 'zero bounces',
    and a blank CIBIL is NOT read as 600 — both fall back to UNKNOWN_SCORE. Component is
    'evidenced' if at least one of the two inputs is actually present."""
    has_bounce = bounces_per_month is not None
    has_cibil = cibil is not None
    bounce_score = max(0.0, 100.0 - (bounces_per_month * 20)) if has_bounce else UNKNOWN_SCORE
    cibil_score = min(100.0, max(0.0, (cibil - 600) / 2)) if has_cibil else UNKNOWN_SCORE
    return (bounce_score * 0.6) + (cibil_score * 0.4), (has_bounce or has_cibil)

def score_liquidity(current_ratio: float, wc_cycle_days: float, sector: Optional[str] = None) -> float:
    cr_score = 100 if current_ratio >= 1.33 else (75 if current_ratio >= 1.0 else (40 if current_ratio >= 0.75 else 0))
    exc, good, ok = WC_CYCLE_BANDS.get(_sector_key(sector), WC_CYCLE_BANDS["default"])
    cycle_score = 100 if wc_cycle_days <= exc else (70 if wc_cycle_days <= good else (40 if wc_cycle_days <= ok else 0))
    return (cr_score * 0.6) + (cycle_score * 0.4)

def score_gst_consistency(turnover_variance: float) -> float:
    return max(0, 100 - (turnover_variance * 200))

def score_leverage(tol_tnw: float) -> float:
    return 100 if tol_tnw <= 2.0 else (80 if tol_tnw <= 3.0 else (50 if tol_tnw <= 5.0 else 0))

def score_profitability(icr: float) -> float:
    return 100 if icr >= 2.5 else (80 if icr >= 1.5 else (40 if icr >= 1.0 else 0))

def score_behavior(dpd: Optional[int]) -> Tuple[float, bool]:
    """Returns (score, evidenced). None = no repayment history on record → UNKNOWN_SCORE,
    NOT 100. A real 0 (verified no overdue) still scores 100."""
    if dpd is None:
        return UNKNOWN_SCORE, False
    s = 100 if dpd == 0 else (60 if dpd <= 30 else (0 if dpd > 90 else 20))
    return float(s), True

def _band(score: float) -> Tuple[str, str]:
    if score >= 80:   return "EXCELLENT", "PSU Bank @ 9.0-10.5%"
    if score >= 60:   return "GOOD", "PSU with conditions / Private Bank"
    if score >= 40:   return "MEDIUM", "NBFC bridge + 12-month migration plan"
    return "POOR", "NBFC only / rebuild"

def calculate_composite_score(metrics: MSMEFinancialInflowData, bounces: Optional[float] = None,
                              docs_ready: float = 80.0, compliance: float = 90.0,
                              sector: Optional[str] = None) -> dict:
    cl = metrics.current_liabilities or metrics.total_outside_liabilities
    cr = metrics.current_assets / cl if cl > 0 else 0.0
    dso = (metrics.sundry_debtors / metrics.projected_annual_turnover) * 365 if metrics.projected_annual_turnover > 0 else 0.0
    inv = (metrics.inventory / metrics.annual_purchases) * 365 if metrics.annual_purchases > 0 else 0.0
    crd = (metrics.sundry_creditors / metrics.annual_purchases) * 365 if metrics.annual_purchases > 0 else 0.0
    wc_cycle = dso + inv - crd
    tol_tnw = metrics.total_outside_liabilities / metrics.tangible_net_worth if metrics.tangible_net_worth > 0 else 999.0
    icr = metrics.ebit / metrics.interest_expense if metrics.interest_expense > 0 else 999.0
    turnover_variance = abs(metrics.declared_bank_statement_credits - metrics.projected_annual_turnover) / metrics.projected_annual_turnover if metrics.projected_annual_turnover > 0 else 0.0

    # cibil_score / days_past_due are Optional — None means "unknown", which is
    # different from a verified 0. (Schema default for both should be None, not 0.)
    cibil = metrics.cibil_score
    dpd = metrics.days_past_due

    banking_score, banking_ev = score_banking_discipline(bounces, cibil)
    repay_score, repay_ev = score_behavior(dpd)

    components = {
        "banking_discipline": banking_score,
        "liquidity_ratios": score_liquidity(cr, wc_cycle, sector),
        "gst_consistency": score_gst_consistency(turnover_variance),
        "leverage_quality": score_leverage(tol_tnw),
        "profitability": score_profitability(icr),
        "compliance_discipline": compliance,
        "documentation_readiness": docs_ready,
        "repayment_behavior": repay_score,
    }
    # Financial-ratio components are evidenced from the balance sheet/P&L; only the
    # two bureau/bank-fed ones can be unevidenced in this fix.
    evidenced = {k: True for k in components}
    evidenced["banking_discipline"] = banking_ev
    evidenced["repayment_behavior"] = repay_ev

    health_score = sum(components[k] * COMPONENT_WEIGHTS[k] for k in COMPONENT_WEIGHTS)
    data_completeness = round(sum(COMPONENT_WEIGHTS[k] for k in components if evidenced[k]) * 100)

    flags = []
    if not banking_ev:
        flags.append("No bank statement / CIBIL evidence — banking discipline (25% weight) "
                     "is unscored; score is provisional.")
    if not repay_ev:
        flags.append("No repayment / days-past-due history on record.")

    band, lender = _band(health_score)
    risk = "red" if health_score < 40 else ("yellow" if health_score < 70 else "none")
    provisional = False
    if GATE_BAND_ON_BANK_EVIDENCE and not banking_ev:
        provisional = True
        if band in ("EXCELLENT", "GOOD"):
            band = "MEDIUM"
            lender = "Provisional — supply bank statements + CIBIL to certify"
        if risk == "none":
            risk = "yellow"

    return {
        "currentScore": int(health_score),
        "previousScore": None,             # score_service computes the real delta
        "band": band,
        "provisional": provisional,
        "data_completeness": data_completeness,   # % of weight backed by real evidence
        "flags": flags,
        "risk": risk,                      # dashboard hint; reflects data confidence
        "recommended_lender_tier": lender,
        "lastUpdated": datetime.utcnow().isoformat() + "Z",
        "component_breakdown": {k: round(v, 1) for k, v in components.items()},
        "evidenced": evidenced,
        "current_ratio": round(cr, 2),
        "wc_cycle_days": round(wc_cycle, 0),
        "sector_used": _sector_key(sector),
    }