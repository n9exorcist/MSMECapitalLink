# backend/reports/migration_context.py
# build_migration_context(db, msme_id) → Jinja vars for the Migration Pathway Plan.
# Reads the shared read-model + services.migration. Adapts framing to where the file
# stands: provisional → certify; already ≥80 → optimise pricing; otherwise → reach Band A.

from datetime import datetime
import re

from services.read_model import build_read_model
from services.migration import build_plan, TARGET
from reports.format import fmt_long

_BAND_WORD = {"EXCELLENT": "Excellent", "GOOD": "Good", "MEDIUM": "Medium", "POOR": "Poor"}
_BAND_TIER = {"EXCELLENT": "A", "GOOD": "B", "MEDIUM": "C", "POOR": "D"}


def _detail(component: str, rm) -> str:
    cr = f"{rm.current_ratio:.2f}"
    tol = f"{rm.tol_tnw:.2f}" if rm.tol_tnw is not None else "—"
    icr = f"{rm.icr:.2f}" if rm.icr is not None else "—"
    wc = round(rm.wc_cycle)
    dso = round(rm.dso)
    return {
        "banking_discipline": "Supply 6–12 months of bank statements and a CIBIL bureau pull. "
            "Banking discipline carries 25% of the score and is the single biggest lever to certify the file.",
        "repayment_behavior": "Record loan EMI/interest history (or confirm no overdues on file). "
            "A clean repayment track evidences debt-service behaviour.",
        "leverage_quality": f"TOL/TNW at {tol} is above the ≤3.00 norm. Retain profit or infuse capital "
            "to bring leverage inside norm.",
        "liquidity_ratios": f"The {wc}-day working-capital cycle drags liquidity — {dso} debtor-days dominate. "
            f"Tighten collections to free cash and lift the current ratio (now {cr}).",
        "profitability": f"Interest coverage at {icr} and thin margins limit debt-service headroom. "
            "Lift operating profit to strengthen this.",
        "gst_consistency": "File GST returns consistently, month on month, to keep this signal clean.",
        "compliance_discipline": "Clear pending statutory filings (GST, TDS, PF/ESI) to lift compliance.",
        "documentation_readiness": "Complete the documentation pack — audited financials, KYC, and ownership proofs.",
    }.get(component, "")


def build_migration_context(db, msme_id: str) -> dict:
    rm = build_read_model(db, msme_id)            # raises ReadModelError → 404 upstream
    plan = build_plan(rm)
    ent, fin = rm.entity, rm.financials
    today = datetime.now().date()

    period_label = fin.get("period_label") or ""
    _fy = re.search(r"(20\d\d)", period_label or "")
    _sy = int(_fy.group(1)) if _fy else None
    bs_date = f"31 Mar {_sy + 1}" if _sy else ""

    client_name = ent.get("company_name") or ent.get("name") or ""
    tier_letter = _BAND_TIER.get(plan.current_band, "")
    delta = plan.projected_score - plan.current_score

    moves = [{
        "n": i + 1,
        "name": mv.name,
        "weight": mv.weight,
        "current": f"{mv.current:.1f}",
        "target": mv.target,
        "impact": f"+{mv.impact:.1f}",
        "kind": "Unlock" if not mv.evidenced else "Improve",
        "detail": _detail(mv.component, rm),
    } for i, mv in enumerate(plan.moves)]

    names_list = ", ".join(m["name"].lower() for m in moves) or "none"

    if plan.provisional:
        posture = "provisional"
        kicker = "Path to certification & PSU eligibility"
        headline = "From provisional to bank-ready"
        summary = (f"{client_name} scores {plan.current_score}/100 but the file is provisional — "
                   "banking/bureau evidence is incomplete. Evidencing it certifies the file and unlocks a "
                   f"mainstream bank. Executing the moves below lifts the file to a projected "
                   f"{plan.projected_score}/100.")
    elif plan.current_score >= TARGET:
        posture = "certified"
        kicker = "Path to top-tier pricing"
        headline = "From bank-ready to best-in-class"
        summary = (f"{client_name} is already certified bank-ready at {plan.current_score}/100 (Band {tier_letter}), "
                   f"eligible for {plan.current_tier}. {len(moves)} component(s) still sit below the 80 bank-ready "
                   f"line — {names_list}. Closing them lifts the file to a projected {plan.projected_score}/100 and "
                   "sharper pricing.")
    else:
        posture = "below"
        kicker = "Credit-readiness migration"
        headline = "Path to Band A · bank-ready"
        summary = (f"{client_name} scores {plan.current_score}/100 (Band {tier_letter}) — a {plan.gap_to_target}-point "
                   f"gap to the Band A bank-ready line. The moves below close it to a projected {plan.projected_score}/100, "
                   f"moving from {plan.current_tier} toward {plan.target_tier}.")

    return {
        # identity / cover
        "client_name": client_name,
        "owner": ent.get("owner_name") or ent.get("owner") or "",
        "sector": ent.get("industry") or ent.get("sector") or "",
        "msme_class": ent.get("msme_class") or ent.get("turnover_category") or "",
        "gstin": ent.get("gstin") or "",
        "pan": ent.get("pan") or "",
        "location": ent.get("location") or "",
        "auditor": ent.get("auditor") or "",
        "advisor": ent.get("advisor") or "",
        "constitution": "Proprietorship",
        "period_label": period_label,
        "bs_date": bs_date,
        "issued_long": fmt_long(today),

        # framing
        "posture": posture,
        "kicker": kicker,
        "headline": headline,
        "summary": summary,

        # standing → target
        "current_score": plan.current_score,
        "current_band_word": _BAND_WORD.get(plan.current_band, plan.current_band.title()),
        "current_band_tier": tier_letter,
        "current_tier": plan.current_tier,
        "provisional": plan.provisional,
        "completeness": plan.completeness,
        "projected_score": plan.projected_score,
        "projected_delta": f"+{delta}" if delta > 0 else str(delta),
        "target_band_word": _BAND_WORD.get(plan.target_band, plan.target_band.title()),
        "target_tier": plan.target_tier,
        "gap_to_target": plan.gap_to_target,

        # the pathway
        "moves": moves,
        "has_moves": len(moves) > 0,
        "flags": plan.flags,
    }
