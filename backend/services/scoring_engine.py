from datetime import datetime
from schemas.msme import MSMEFinancialInflowData

# ─── WEIGHTING CONFIGURATION ──────────────────────────────────────────────────
COMPONENT_WEIGHTS = {
    "banking_discipline": 0.25,
    "liquidity_ratios": 0.15,
    "gst_consistency": 0.15,
    "leverage_quality": 0.10,
    "profitability": 0.10,
    "compliance_discipline": 0.10,
    "documentation_readiness": 0.10,
    "repayment_behavior": 0.05,
}

# ─── INDIVIDUAL SCORING FUNCTIONS (0-100 Scale) ───────────────────────────────
def score_banking_discipline(bounces_per_month: float, cibil: int) -> float:
    bounce_score = max(0, 100 - (bounces_per_month * 20))
    cibil_score = min(100, max(0, (cibil - 600) / 2))
    return (bounce_score * 0.6) + (cibil_score * 0.4)

def score_liquidity(current_ratio: float, wc_cycle_days: float) -> float:
    cr_score = 100 if current_ratio >= 1.33 else (75 if current_ratio >= 1.0 else (40 if current_ratio >= 0.75 else 0))
    cycle_score = 100 if wc_cycle_days <= 60 else (70 if wc_cycle_days <= 90 else (40 if wc_cycle_days <= 120 else 0))
    return (cr_score * 0.6) + (cycle_score * 0.4)

def score_gst_consistency(turnover_variance: float) -> float:
    return max(0, 100 - (turnover_variance * 200))  # 20% variance = 60 score

def score_leverage(tol_tnw: float) -> float:
    return 100 if tol_tnw <= 2.0 else (80 if tol_tnw <= 3.0 else (50 if tol_tnw <= 5.0 else 0))

def score_profitability(icr: float) -> float:
    return 100 if icr >= 2.5 else (80 if icr >= 1.5 else (40 if icr >= 1.0 else 0))

def score_behavior(dpd: int) -> float:
    return 100 if dpd == 0 else (60 if dpd <= 30 else (0 if dpd > 90 else 20))

# ─── MAIN COMPOSITE ENGINE ────────────────────────────────────────────────────
def calculate_composite_score(metrics: MSMEFinancialInflowData, bounces: float = 0.0, docs_ready: float = 80.0, compliance: float = 90.0) -> dict:
    """
    Computes the final institutional-grade MSME health score.
    """
    # Calculate derived ratios
    cr = metrics.current_assets / metrics.total_outside_liabilities if metrics.total_outside_liabilities > 0 else 0.0
    dso = (metrics.sundry_debtors / metrics.projected_annual_turnover) * 365 if metrics.projected_annual_turnover > 0 else 0.0
    inv = (metrics.inventory / metrics.annual_purchases) * 365 if metrics.annual_purchases > 0 else 0.0
    crd = (metrics.sundry_creditors / metrics.annual_purchases) * 365 if metrics.annual_purchases > 0 else 0.0
    wc_cycle = dso + inv - crd
    tol_tnw = metrics.total_outside_liabilities / metrics.tangible_net_worth if metrics.tangible_net_worth > 0 else 999.0
    icr = metrics.ebit / metrics.interest_expense if metrics.interest_expense > 0 else 999.0
    turnover_variance = abs(metrics.declared_bank_statement_credits - metrics.projected_annual_turnover) / metrics.projected_annual_turnover if metrics.projected_annual_turnover > 0 else 0.0

    # Build the component dictionary
    components = {
        "banking_discipline": score_banking_discipline(bounces, metrics.cibil_score),
        "liquidity_ratios": score_liquidity(cr, wc_cycle),
        "gst_consistency": score_gst_consistency(turnover_variance),
        "leverage_quality": score_leverage(tol_tnw),
        "profitability": score_profitability(icr),
        "compliance_discipline": compliance,
        "documentation_readiness": docs_ready,
        "repayment_behavior": score_behavior(metrics.days_past_due),
    }

    # Aggregate weighted score
    health_score = sum(components[key] * COMPONENT_WEIGHTS[key] for key in COMPONENT_WEIGHTS)
    
    # Band classification per banking spec
    if health_score >= 80:
        band, lender = "EXCELLENT", "PSU Bank @ 9.0-10.5%"
    elif health_score >= 60:
        band, lender = "GOOD", "PSU with conditions / Private Bank"
    elif health_score >= 40:
        band, lender = "MEDIUM", "NBFC bridge + 12-month migration plan"
    else:
        band, lender = "POOR", "NBFC only / rebuild"

    return {
        "currentScore": int(health_score),
        "previousScore": max(0, int(health_score) - 3), # Mocking historical delta
        "band": band,
        "recommended_lender_tier": lender,
        "lastUpdated": datetime.utcnow().isoformat() + "Z",
        "component_breakdown": {k: round(v, 1) for k, v in components.items()}
    }