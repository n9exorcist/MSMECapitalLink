# backend/reports/green_context.py
# build_green_context(db, msme_id) → Jinja vars for the Green Opportunity Report.
# A sustainability & green-finance pre-feasibility assessment. It is anchored to the REAL
# business (turnover, sector, location, health score from the shared read-model) and NEVER
# invents precision: every quantitative estimate (solar sizing, savings, payback, CO₂) is
# INDICATIVE, derived here from a small, named benchmark set that is printed on the report
# so the reader sees exactly what drives each number. No new recompute path — identity and
# score come from build_health_report_context / build_read_model like the other documents.
#
# Three assessments:
#   • Rooftop solar   — indicative sizing/capex/payback from an estimated energy spend
#                       (a % of turnover benchmark) and Chennai/TN solar benchmarks.
#   • Green finance    — eligibility for green term loans, driven by the real health score.
#   • CBAM / transition — sector-aware exposure verdict (out of scope for domestic services;
#                         flagged only for CBAM-covered goods that may be EU-exported).

from reports.context import build_health_report_context
from reports.format import inr, cr
from services.read_model import build_read_model

# ── indicative benchmark assumptions (all surfaced on the report) ────────────
ENERGY_COST_PCT = 0.02       # electricity spend ≈ 2% of turnover (MSME workshop benchmark)
TN_LT_TARIFF = 8.0           # ₹/unit — Tamil Nadu commercial LT tariff (indicative)
SPECIFIC_YIELD = 1500        # kWh per kWp per year — Chennai / TN solar yield
ROOFTOP_OFFSET = 0.75        # size the array to offset ~75% of annual consumption
CAPEX_PER_KWP = 50000        # ₹/kWp installed — indicative post-subsidy-eligible cost
GRID_EMISSION_FACTOR = 0.71  # tCO₂ per MWh — CEA all-India grid factor
SYSTEM_LIFE = 25             # years — panel warranty life

# CBAM-covered goods (EU Carbon Border Adjustment Mechanism). Exposure only arises when a
# business EXPORTS these to the EU; domestic services sectors are out of scope.
_CBAM_GOODS = ("steel", "iron", "aluminium", "aluminum", "cement",
               "fertiliser", "fertilizer", "hydrogen", "ammonia", "electricity")


def _years(x):
    return "—" if not x else f"{x:.1f} years"


def _cbam_assessment(sector: str):
    s = (sector or "").lower()
    hit = next((g for g in _CBAM_GOODS if g in s), None)
    if hit:
        return {
            "exposed": True,
            "verdict": "Potential exposure",
            "verdict_class": "warn",
            "detail": (f"The sector references a CBAM-covered good ({hit}). If any output is exported to "
                       "the EU, embedded-emissions reporting applies from 2026 and a carbon levy from 2027. "
                       "Confirm export destinations and begin product carbon-footprint accounting."),
        }
    return {
        "exposed": False,
        "verdict": "Out of scope",
        "verdict_class": "ok",
        "detail": ("This is a domestic-facing services/fit-out business, not a producer of CBAM-covered goods "
                   "(steel, aluminium, cement, fertiliser, hydrogen, electricity). The EU Carbon Border "
                   "Adjustment Mechanism does not apply. Transition risk is limited to indirect exposure via "
                   "clients' own decarbonisation demands — an opportunity to differentiate, not a levy."),
    }


def _green_finance(score, provisional: bool):
    """Eligibility framing for green term loans, driven by the real health score."""
    if score is None:
        return {"verdict": "Assess", "verdict_class": "na",
                "detail": "Score the file to gauge green-finance eligibility."}
    if provisional:
        return {"verdict": "Eligible on certification", "verdict_class": "warn",
                "detail": ("The file is bank-ready on financials but provisional pending banking/bureau "
                           "evidence. Certifying it opens SIDBI green (4E/EEF) and PSB rooftop-solar term "
                           "loans at concessional rates.")}
    if score >= 80:
        return {"verdict": "Strong candidate", "verdict_class": "ok",
                "detail": ("Certified bank-ready, this file qualifies for green term finance — SIDBI's 4E / "
                           "Energy-Efficiency schemes, PSB rooftop-solar loans, and the PM Surya Ghar "
                           "framework — typically at 20–150 bps below standard MSME pricing.")}
    return {"verdict": "Eligible", "verdict_class": "warn",
            "detail": ("The file supports a green term loan; lifting the health score improves the rate. "
                       "SIDBI 4E and PSB rooftop-solar schemes are the natural routes.")}


def build_green_context(db, msme_id: str) -> dict:
    ctx = dict(build_health_report_context(db, msme_id))   # identity, period, score, band
    rm = build_read_model(db, msme_id)
    turnover = float(rm.metrics.projected_annual_turnover or 0.0)
    score = rm.score.get("currentScore")
    provisional = rm.score.get("provisional", False)
    sector = ctx.get("sector") or ""

    # ── indicative energy profile (from turnover benchmark) ──
    energy_spend = turnover * ENERGY_COST_PCT
    annual_units = (energy_spend / TN_LT_TARIFF) if TN_LT_TARIFF else 0.0

    # ── rooftop solar sizing (indicative) ──
    system_kwp = round(annual_units * ROOFTOP_OFFSET / SPECIFIC_YIELD) if SPECIFIC_YIELD else 0
    system_kwp = max(system_kwp, 0)
    capex = system_kwp * CAPEX_PER_KWP
    annual_generation = system_kwp * SPECIFIC_YIELD           # kWh/yr
    annual_savings = annual_generation * TN_LT_TARIFF         # ₹/yr (self-consumption ≈ tariff)
    payback = (capex / annual_savings) if annual_savings else 0.0
    lifetime_savings = annual_savings * SYSTEM_LIFE
    co2_tpa = annual_generation / 1000.0 * GRID_EMISSION_FACTOR
    co2_lifetime = co2_tpa * SYSTEM_LIFE

    cbam = _cbam_assessment(sector)
    gfin = _green_finance(score, provisional)

    # opportunity headline
    if system_kwp > 0:
        summary = (f"{ctx['client_name']}'s ₹{ctx['turnover_cr']} Cr operation carries an estimated "
                   f"₹{inr(energy_spend)[1:]} annual electricity spend. An indicative {system_kwp} kWp rooftop "
                   f"solar array would offset ~{int(ROOFTOP_OFFSET*100)}% of consumption, saving about "
                   f"{inr(annual_savings)} a year and paying back in {_years(payback)} — while cutting "
                   f"~{co2_tpa:.0f} tonnes of CO₂ annually. The file's {ctx['band_word'].lower()} credit "
                   f"standing opens concessional green term finance to fund it.")
    else:
        summary = (f"{ctx['client_name']}'s energy footprint is modest; rooftop solar is optional. The main "
                   "green lever here is access to concessional green finance on the strength of the file.")

    ctx.update({
        "doc_kicker": "Sustainability & Green Finance",
        "summary": summary,

        # energy profile (indicative)
        "energy_spend_inr": inr(energy_spend),
        "energy_units": f"{annual_units:,.0f}",
        "energy_cost_pct": f"{ENERGY_COST_PCT*100:.0f}%",
        "tariff": f"{TN_LT_TARIFF:.0f}",

        # solar opportunity (indicative)
        "has_solar": system_kwp > 0,
        "system_kwp": system_kwp,
        "capex_inr": inr(capex),
        "capex_cr": cr(capex),
        "annual_generation": f"{annual_generation:,.0f}",
        "annual_savings_inr": inr(annual_savings),
        "payback_years": _years(payback),
        "lifetime_savings_inr": inr(lifetime_savings),
        "co2_tpa": f"{co2_tpa:.0f}",
        "co2_lifetime": f"{co2_lifetime:,.0f}",
        "rooftop_offset_pct": f"{int(ROOFTOP_OFFSET*100)}%",

        # assessments
        "cbam": cbam,
        "gfin": gfin,

        # printed assumptions (transparency)
        "assumptions": [
            f"Electricity spend ≈ {ENERGY_COST_PCT*100:.0f}% of turnover (MSME workshop benchmark)",
            f"Tariff ₹{TN_LT_TARIFF:.0f}/unit — Tamil Nadu commercial LT (indicative)",
            f"Solar yield {SPECIFIC_YIELD:,} kWh/kWp/yr — Chennai / TN",
            f"Array sized to offset {int(ROOFTOP_OFFSET*100)}% of annual consumption",
            f"Installed cost ₹{CAPEX_PER_KWP:,}/kWp (indicative)",
            f"Grid emission factor {GRID_EMISSION_FACTOR} tCO₂/MWh (CEA)",
            f"Savings shown nominal over a {SYSTEM_LIFE}-year life (before tariff escalation & panel degradation)",
        ],
    })
    return ctx
