from datetime import datetime
from typing import Optional
from schemas.msme import MSMEFinancialInflowData

COMPONENT_WEIGHTS = {
    "banking_discipline": 0.25, "liquidity_ratios": 0.15, "gst_consistency": 0.15,
    "leverage_quality": 0.10, "profitability": 0.10, "compliance_discipline": 0.10,
    "documentation_readiness": 0.10, "repayment_behavior": 0.05,
}

# Sector-aware working-capital cycle bands (days): (excellent<=, good<=, ok<=) -> 100 / 70 / 40, else 0.
# A flat threshold unfairly zeroes structurally-long-cycle businesses (works contract, jewellery).
WC_CYCLE_BANDS = {
    "trading":        (45, 75, 120),
    "services":       (45, 90, 150),
    "manufacturing":  (90, 120, 180),
    "engineering":    (120, 180, 240),
    "jewellery":      (180, 300, 480),
    "works_contract": (240, 420, 600),   # interiors, construction, EPC, fit-out
    "default":        (90, 120, 180),
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

def score_banking_discipline(bounces_per_month: float, cibil: int) -> float:
    bounce_score = max(0, 100 - (bounces_per_month * 20))
    cibil_score = min(100, max(0, (cibil - 600) / 2))
    return (bounce_score * 0.6) + (cibil_score * 0.4)

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

def score_behavior(dpd: int) -> float:
    return 100 if dpd == 0 else (60 if dpd <= 30 else (0 if dpd > 90 else 20))

def calculate_composite_score(metrics: MSMEFinancialInflowData, bounces: float = 0.0,
                              docs_ready: float = 80.0, compliance: float = 90.0,
                              sector: Optional[str] = None) -> dict:
    # FIX: current ratio = CA / Current Liabilities (fallback to TOL only if CL not supplied)
    cl = metrics.current_liabilities or metrics.total_outside_liabilities
    cr = metrics.current_assets / cl if cl > 0 else 0.0

    dso = (metrics.sundry_debtors / metrics.projected_annual_turnover) * 365 if metrics.projected_annual_turnover > 0 else 0.0
    inv = (metrics.inventory / metrics.annual_purchases) * 365 if metrics.annual_purchases > 0 else 0.0
    crd = (metrics.sundry_creditors / metrics.annual_purchases) * 365 if metrics.annual_purchases > 0 else 0.0
    wc_cycle = dso + inv - crd
    tol_tnw = metrics.total_outside_liabilities / metrics.tangible_net_worth if metrics.tangible_net_worth > 0 else 999.0
    icr = metrics.ebit / metrics.interest_expense if metrics.interest_expense > 0 else 999.0
    turnover_variance = abs(metrics.declared_bank_statement_credits - metrics.projected_annual_turnover) / metrics.projected_annual_turnover if metrics.projected_annual_turnover > 0 else 0.0

    components = {
        "banking_discipline": score_banking_discipline(bounces, metrics.cibil_score),
        "liquidity_ratios": score_liquidity(cr, wc_cycle, sector),
        "gst_consistency": score_gst_consistency(turnover_variance),
        "leverage_quality": score_leverage(tol_tnw),
        "profitability": score_profitability(icr),
        "compliance_discipline": compliance,
        "documentation_readiness": docs_ready,
        "repayment_behavior": score_behavior(metrics.days_past_due),
    }
    health_score = sum(components[k] * COMPONENT_WEIGHTS[k] for k in COMPONENT_WEIGHTS)

    if health_score >= 80:   band, lender = "EXCELLENT", "PSU Bank @ 9.0-10.5%"
    elif health_score >= 60: band, lender = "GOOD", "PSU with conditions / Private Bank"
    elif health_score >= 40: band, lender = "MEDIUM", "NBFC bridge + 12-month migration plan"
    else:                    band, lender = "POOR", "NBFC only / rebuild"

    return {
        "currentScore": int(health_score),
        "previousScore": None,  # score_service computes the real delta from score_history
        "band": band,
        "recommended_lender_tier": lender,
        "lastUpdated": datetime.utcnow().isoformat() + "Z",
        "component_breakdown": {k: round(v, 1) for k, v in components.items()},
        # diagnostics for the CFO console deep-dive:
        "current_ratio": round(cr, 2),
        "wc_cycle_days": round(wc_cycle, 0),
        "sector_used": _sector_key(sector),
    }