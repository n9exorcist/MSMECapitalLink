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

def _f(v):
    """Coerce a possibly-None / string numeric (Supabase) to float, else None."""
    try:
        return float(v) if v is not None else None
    except (TypeError, ValueError):
        return None


def score_banking_from_statement(cash_pos: dict, turnover: Optional[float]) -> float:
    """Score banking conduct from a parsed bank statement (a cash_position row).
    Three signals a credit officer reads off a statement:
      • overdraft / balance trend (40%) — deleveraging or building reserves is the
        strongest conduct signal (closing vs opening balance over the period).
      • turnover routing          (40%) — are sales actually banked vs kept off-book?
        actual credits / declared turnover; ~1.0 = fully routed.
      • account conduct           (20%) — neutral-positive baseline for an active,
        operating account; refined to real bounce/breach counts once per-transaction
        parsing exists (today we read only the statement's summary block).
    """
    opening = _f(cash_pos.get("opening_balance"))
    closing = _f(cash_pos.get("closing_balance"))
    inflow = _f(cash_pos.get("total_inflow"))

    # 1) Trend — change in balance over the period, normalised to the position held.
    #    +ve (OD paid down / reserves built) lifts above the 60 neutral line.
    if opening is not None and closing is not None:
        base = max(abs(opening), abs(closing), 1.0)
        trend = max(0.0, min(100.0, 60.0 + ((closing - opening) / base) * 80.0))
    else:
        trend = 60.0

    # 2) Routing — actual bank credits vs declared turnover.
    if turnover and turnover > 0 and inflow is not None:
        routing = min(100.0, (inflow / turnover) * 100.0)
    else:
        routing = 60.0

    # 3) Conduct — baseline pending per-transaction parsing (bounces / OD breaches).
    conduct = 70.0

    return (trend * 0.4) + (routing * 0.4) + (conduct * 0.2)


def score_banking_discipline(bounces_per_month: Optional[float],
                             cibil: Optional[int],
                             statement_score: Optional[float] = None,
                             ) -> Tuple[float, bool, bool]:
    """Returns (score, evidenced, has_cibil). Sources, strongest first:
      • bank statement (cash_position) → statement_score, already 0-100
      • CIBIL bureau score
      • bounce count (fewer is better)
    A blank bounce count is NOT read as 'zero bounces' and a blank CIBIL is NOT read as
    600 — with no source at all the component falls back to UNKNOWN_SCORE (unassessed,
    not 'good'). 'evidenced' = at least one source present."""
    has_stmt = statement_score is not None
    has_bounce = bounces_per_month is not None
    has_cibil = cibil is not None

    parts = []  # (score, weight) for whatever evidence exists
    if has_stmt:
        parts.append((statement_score, 0.55))
    if has_cibil:
        parts.append((min(100.0, max(0.0, (cibil - 600) / 2)), 0.30))
    if has_bounce:
        parts.append((max(0.0, 100.0 - (bounces_per_month * 20)), 0.15))

    if not parts:
        return UNKNOWN_SCORE, False, has_cibil
    tw = sum(w for _, w in parts)
    return sum(s * w for s, w in parts) / tw, True, has_cibil

def score_liquidity(current_ratio: float, wc_cycle_days: float, sector: Optional[str] = None) -> float:
    cr_score = 100 if current_ratio >= 1.33 else (75 if current_ratio >= 1.0 else (40 if current_ratio >= 0.75 else 0))
    exc, good, ok = WC_CYCLE_BANDS.get(_sector_key(sector), WC_CYCLE_BANDS["default"])
    cycle_score = 100 if wc_cycle_days <= exc else (70 if wc_cycle_days <= good else (40 if wc_cycle_days <= ok else 0))
    return (cr_score * 0.6) + (cycle_score * 0.4)

def score_gst_consistency(turnover_variance: float) -> float:
    # Legacy proxy: how far declared bank credits diverge from reported turnover.
    # Used only as a FALLBACK now, when GSTR-1↔3B evidence isn't on record.
    return max(0, 100 - (turnover_variance * 200))

def score_gst_match(avg_rel_gap: float) -> float:
    """Spec §6.1 GST consistency: how closely GSTR-1 outward supplies match the
    GSTR-3B table 3.1(a) taxable value, averaged across periods that have both.
    Same slope as the legacy proxy (gap × 200) so bands stay calibrated:
    0% → 100, 10% → 80, 25% → 50, ≥50% → 0. A ≤2% gap is treated as a clean
    match (rounding / paise differences)."""
    if avg_rel_gap <= 0.02:
        return 100.0
    return max(0.0, 100.0 - avg_rel_gap * 200.0)

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
                              sector: Optional[str] = None,
                              cash_position: Optional[dict] = None,
                              gst_match: Optional[dict] = None) -> dict:
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
    cibil = metrics.cibil_score if (metrics.cibil_score and metrics.cibil_score >= 300) else None
    dpd = metrics.days_past_due

    # Bank statement (cash_position) is the strongest banking-discipline evidence.
    statement_score = (score_banking_from_statement(cash_position, metrics.projected_annual_turnover)
                       if cash_position else None)
    banking_score, banking_ev, has_cibil = score_banking_discipline(bounces, cibil, statement_score)
    has_statement = statement_score is not None
    repay_score, repay_ev = score_behavior(dpd)

    # GST consistency: prefer the real GSTR-1↔3B match when there's ≥1 period with
    # both returns on record; otherwise fall back to the bank-credits-vs-turnover
    # proxy so clients without GSTR-1 data keep their existing score unchanged.
    if gst_match and gst_match.get("matched", 0) >= 1:
        gst_score = score_gst_match(float(gst_match.get("avg_rel_gap", 0.0)))
    else:
        gst_score = score_gst_consistency(turnover_variance)

    components = {
        "banking_discipline": banking_score,
        "liquidity_ratios": score_liquidity(cr, wc_cycle, sector),
        "gst_consistency": gst_score,
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
    if not repay_ev:
        flags.append("No repayment / days-past-due history on record.")

    band, lender = _band(health_score)
    risk = "red" if health_score < 40 else ("yellow" if health_score < 70 else "none")
    provisional = False
    if not banking_ev:
        # Zero banking evidence → hard provisional; cannot certify above MEDIUM.
        provisional = True
        flags.append("No bank statement / CIBIL evidence — banking discipline (25% weight) "
                     "is unscored; score is provisional.")
        if GATE_BAND_ON_BANK_EVIDENCE:
            if band in ("EXCELLENT", "GOOD"):
                band = "MEDIUM"
                lender = "Provisional — supply bank statements + CIBIL to certify"
            if risk == "none":
                risk = "yellow"
    elif not has_cibil:
        # Bank evidence present, CIBIL missing → soft provisional. Band is NOT capped and
        # the score rises, but full certification still waits for the bureau report.
        provisional = True
        if has_statement:
            flags.append("Bank-verified from statement; CIBIL pending — provisional until "
                         "the bureau report is on file.")
            lender = f"{lender} · bank-verified, CIBIL pending"
        else:
            flags.append("Partial banking evidence on record; full bank statement and CIBIL "
                         "pending — score is provisional.")
    # else: bank evidence + CIBIL on file → certified (provisional stays False).

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