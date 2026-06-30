# backend/reports/bank_proposal_context.py
# build_bank_proposal_context(db, msme_id) → Jinja vars for the Bank Proposal Pack.
# Reuses the health-report context (financials, ratios, score, conduct) and layers on:
#   • the credit ask (loan_proposals; falls back to the MPBF-based limit if none on file)
#   • existing facilities (loans)
#   • the MPBF / drawing-power assessment (wc_finance)
#   • strengths & risks derived from the component scorecard + migration plan

from reports.context import build_health_report_context
from reports.migration_context import _detail
from reports.format import inr, cr
from services.read_model import build_read_model
from services.wc_finance import assess_wc_limit
from services.migration import build_plan, NAMES

_RISK_GRADE = {"EXCELLENT": "Low", "GOOD": "Low–Moderate", "MEDIUM": "Moderate", "POOR": "Elevated"}


def _latest_proposal(db, msme_id):
    try:
        rows = (db.table("loan_proposals").select("*").eq("msme_id", msme_id)
                .order("created_at", desc=True).limit(1).execute().data or [])
        return rows[0] if rows else None
    except Exception:
        return None


def _existing_loans(db, msme_id):
    try:
        return (db.table("loans").select("*").eq("msme_id", msme_id)
                .order("sanctioned_amount", desc=True).execute().data or [])
    except Exception:
        return []


def build_bank_proposal_context(db, msme_id: str) -> dict:
    ctx = dict(build_health_report_context(db, msme_id))   # identity, fin, rb, score, margins
    rm = build_read_model(db, msme_id)
    w = assess_wc_limit(rm)
    plan = build_plan(rm)
    prop = _latest_proposal(db, msme_id)
    loans = _existing_loans(db, msme_id)
    m = rm.metrics

    # ── the credit ask (from the proposal, else MPBF-derived & flagged indicative) ──
    if prop:
        facility_type = prop.get("facility_type") or "CC / OD"
        amount = float(prop.get("amount_requested") or 0)
        purpose = prop.get("purpose") or "Working capital"
        tenor = prop.get("tenor_months")
        rate = prop.get("rate_expectation") or ctx.get("rate_range") or ""
        security = prop.get("security_offered") or "Hypothecation of stock & book debts"
        security_value = float(prop.get("security_value") or 0)
        ask_indicative = False
    else:
        facility_type = "CC / OD"
        amount = w.recommended_limit
        purpose = "Working capital"
        tenor = None
        rate = ctx.get("rate_range") or ""
        security = "Hypothecation of stock & book debts (primary)"
        security_value = w.drawing_power
        ask_indicative = True

    is_term = bool(facility_type) and "term" in facility_type.lower()
    dscr = rm.dscr

    existing = [{
        "type": (ln.get("loan_type") or "Facility"),
        "lender": ln.get("lender") or "—",
        "sanctioned": inr(ln.get("sanctioned_amount")),
        "outstanding": inr(ln.get("outstanding_balance")),
        "rate": (f"{ln['interest_rate']:.2f}%" if ln.get("interest_rate") is not None else "—"),
    } for ln in loans]

    # ── strengths & risks ──
    comps = rm.score["component_breakdown"]
    strong = sorted([(NAMES[k], v) for k, v in comps.items() if v >= 80], key=lambda x: -x[1])[:4]
    strengths = [f"{name} — {v:.0f}/100" for name, v in strong]
    if not rm.score["provisional"]:
        strengths.insert(0, f"Certified bank-ready ({rm.score['currentScore']}/100), bureau & bank evidence on file")
    risks = [{"name": mv.name, "detail": _detail(mv.component, rm)} for mv in plan.moves]

    risk_grade = _RISK_GRADE.get(rm.score["band"], "Moderate")
    certified = not rm.score["provisional"]
    summary = (
        f"{ctx['client_name']} seeks a {facility_type} facility of {cr(amount)} Cr for {purpose.lower()}. "
        f"The file scores {rm.score['currentScore']}/100 ({ctx['band_word']}) and is "
        f"{'certified bank-ready' if certified else 'provisional pending bank/bureau evidence'}. "
        f"Permissible bank finance (Tandon Method II) supports {cr(w.mpbf_method2)} Cr against a "
        f"{ctx['current_ratio']} current ratio; drawing power of {cr(w.drawing_power)} Cr provides ample security cover."
    )
    if certified and amount <= w.mpbf_method2 * 1.05:
        recommendation = (f"Recommended for sanction of a {facility_type} limit of {cr(amount)} Cr. "
                          "The ask is within permissible bank finance and well-secured; conduct and bureau are clean.")
    elif certified:
        recommendation = (f"Recommended with conditions: the {cr(amount)} Cr ask exceeds permissible bank finance "
                          f"of {cr(w.mpbf_method2)} Cr — consider sanctioning {cr(w.mpbf_method2)} Cr or seeking additional margin.")
    else:
        recommendation = ("Hold for certification: supply bank statements and a CIBIL pull to move the file off "
                          "provisional before committing the facility.")

    ctx.update({
        "doc_kicker": "Bank Proposal Pack",
        # the ask
        "facility_type": facility_type,
        "amount_inr": inr(amount),
        "amount_cr": cr(amount),
        "purpose": purpose,
        "tenor_months": tenor,
        "rate": rate,
        "security": security,
        "security_value_inr": inr(security_value),
        "ask_indicative": ask_indicative,
        "is_term": is_term,
        # existing facilities
        "existing_facilities": existing,
        "has_existing": bool(existing),
        # MPBF / WC
        "mpbf_cr": cr(w.mpbf_method2),
        "mpbf_inr": inr(w.mpbf_method2),
        "dp_cr": cr(w.drawing_power),
        "dp_inr": inr(w.drawing_power),
        "wc_dso": round(rm.dso), "wc_inv": round(rm.inv_days),
        "wc_cred": round(rm.cred_days), "wc_total": round(rm.wc_cycle),
        "dscr": (f"{dscr:.2f}" if (is_term and dscr is not None) else None),
        # conduct / bureau
        "banking_score": ctx.get("banking_score"),
        "cibil": ctx.get("cibil"),
        "cibil_date": ctx.get("cibil_date"),
        "net_worth_inr": inr(m.tangible_net_worth),
        "turnover_cr": ctx.get("turnover_cr"),
        # assessment
        "strengths": strengths,
        "risks": risks,
        "has_risks": bool(risks),
        "risk_grade": risk_grade,
        "certified": certified,
        "summary": summary,
        "recommendation": recommendation,
    })
    return ctx
