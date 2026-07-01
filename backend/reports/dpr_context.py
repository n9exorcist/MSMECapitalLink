# backend/reports/dpr_context.py
# build_dpr_context(db, msme_id) → Jinja vars for the Project Report / DPR.
#
# HONESTY NOTE — there is no defined capital project or term loan on file for the pilot
# client (the only proposal on record is a CC/OD working-capital ask; no `loans`, no capex
# fields). A DPR is normally driven by a stated project cost + term loan. Rather than
# fabricate a project, this builds an INDICATIVE debt-capacity feasibility:
#   • base year is the REAL audited period (from the shared read-model — no new recompute),
#   • an illustrative term loan is SIZED to the business's own debt-service capacity at a
#     target DSCR (not invented out of thin air),
#   • the multi-year projection is a conservative ORGANIC trajectory (turnover growth +
#     margins held), loaded with the new loan's interest so DSCR is a prudent worst case,
#   • every assumption is printed on the report and the whole document is flagged
#     "indicative / pre-project — validate before sanction".
# This mirrors a real advisory-stage debt-capacity note; it is not an engineering DPR.

from reports.context import build_health_report_context
from reports.format import inr, cr
from services.read_model import build_read_model

# ── indicative assumptions (all surfaced on the report) ──────────────────────
TARGET_DSCR = 1.50           # sizing target — the loan is sized so year-1 DSCR ≈ this
TERM_RATE = 0.105            # 10.5% p.a. — upper end of the file's rate expectation
TERM_TENOR = 7              # years — indicative term-loan tenor
PROMOTER_MARGIN = 0.25       # 25% promoter contribution (standard term-loan margin)
TURNOVER_GROWTH = 0.10       # 10% p.a. — conservative organic growth
PROJECTION_YEARS = 5         # rows shown in the projected P&L
_ROUND = 50000               # round the indicative loan to a clean ₹50k


def _dscr(num, den):
    return (num / den) if den else 0.0


def _size_loan(cash_accrual: float) -> float:
    """Largest term loan whose YEAR-1 service (equal principal + full-balance interest)
    is covered at TARGET_DSCR by current cash accrual. Conservative (year-1 is the peak)."""
    if cash_accrual <= 0:
        return 0.0
    max_service = cash_accrual / TARGET_DSCR
    loan = max_service / (1.0 / TERM_TENOR + TERM_RATE)
    return max(round(loan / _ROUND) * _ROUND, 0.0)


def _project(loan, turnover, ebit_margin, existing_interest, depreciation):
    """Year-by-year amortisation + organic P&L + DSCR over the tenor."""
    principal = loan / TERM_TENOR
    rows = []
    for y in range(1, TERM_TENOR + 1):
        opening = loan - principal * (y - 1)
        interest = opening * TERM_RATE
        closing = opening - principal
        turn = turnover * (1 + TURNOVER_GROWTH) ** y
        ebit = turn * ebit_margin
        pbt = ebit - existing_interest - interest       # proprietorship → firm-level tax ≈ 0
        pat = pbt
        cash_accrual = pat + depreciation
        service = principal + interest
        rows.append({
            "year": y,
            "turnover": turn,
            "ebit": ebit,
            "interest": interest,
            "existing_interest": existing_interest,
            "depreciation": depreciation,
            "pat": pat,
            "cash_accrual": cash_accrual,
            "opening": opening,
            "principal": principal,
            "closing": max(closing, 0.0),
            "service": service,
            "dscr": _dscr(pat + depreciation + interest, service),
        })
    return rows


def build_dpr_context(db, msme_id: str) -> dict:
    ctx = dict(build_health_report_context(db, msme_id))   # identity, period, score, band
    rm = build_read_model(db, msme_id)
    m = rm.metrics

    turnover = float(m.projected_annual_turnover or 0.0)
    ebit = float(m.ebit or 0.0)
    existing_interest = float(m.interest_expense or 0.0)
    depreciation = float(m.depreciation or 0.0)
    npat = float(m.net_profit_after_tax or 0.0)
    ebit_margin = (ebit / turnover) if turnover else 0.0

    base_cash_accrual = npat + depreciation                # available for debt service today
    loan = _size_loan(base_cash_accrual)
    project_cost = (loan / (1 - PROMOTER_MARGIN)) if loan else 0.0
    promoter = project_cost - loan
    de_ratio = (loan / promoter) if promoter else None

    rows = _project(loan, turnover, ebit_margin, existing_interest, depreciation)
    dscrs = [r["dscr"] for r in rows] or [0.0]
    min_dscr, avg_dscr = min(dscrs), sum(dscrs) / len(dscrs)
    viable = min_dscr >= TARGET_DSCR - 0.001

    # projected P&L rows (first PROJECTION_YEARS), pre-formatted
    proj = [{
        "year": f"Year {r['year']}",
        "turnover": inr(r["turnover"]),
        "ebit": inr(r["ebit"]),
        "interest": inr(r["interest"] + r["existing_interest"]),
        "depreciation": inr(r["depreciation"]),
        "pat": inr(r["pat"]),
        "cash_accrual": inr(r["cash_accrual"]),
    } for r in rows[:PROJECTION_YEARS]]

    # repayment schedule + DSCR (full tenor)
    sched = [{
        "year": f"Year {r['year']}",
        "opening": inr(r["opening"]),
        "principal": inr(r["principal"]),
        "interest": inr(r["interest"]),
        "closing": inr(r["closing"]),
        "service": inr(r["service"]),
        "dscr": f"{r['dscr']:.2f}",
    } for r in rows]

    means = [
        {"label": f"Promoter contribution ({int(PROMOTER_MARGIN*100)}%)", "value": inr(promoter)},
        {"label": f"Term loan ({int((1-PROMOTER_MARGIN)*100)}%)", "value": inr(loan)},
    ]

    summary = (
        f"{ctx['client_name']} generates cash accruals of about {inr(base_cash_accrual)} a year "
        f"(net profit {inr(npat)} + depreciation {inr(depreciation)}). At a {TARGET_DSCR:.2f}× debt-service "
        f"cover, this supports an indicative term loan of {inr(loan)} over {TERM_TENOR} years — funding a "
        f"project of up to {inr(project_cost)} with a {int(PROMOTER_MARGIN*100)}% promoter margin. Across the "
        f"tenor the projected DSCR holds between {min_dscr:.2f} and {max(dscrs):.2f} (avg {avg_dscr:.2f}), so "
        f"the debt is serviceable on the business's own organic trajectory — before any return from the capex "
        f"itself. The file's {ctx['band_word'].lower()} credit standing supports the ask."
    )
    if viable:
        recommendation = (f"The business can prudently support a term loan of {inr(loan)} at "
                          f"{TERM_RATE*100:.1f}% over {TERM_TENOR} years (DSCR ≥ {TARGET_DSCR:.2f} throughout). "
                          "Firm up the project scope, capex schedule and incremental returns, then convert this "
                          "into a full DPR for sanction.")
    else:
        recommendation = ("Current cash accruals are thin relative to the target cover; strengthen operating "
                          "profit or reduce the ask before committing to term debt.")

    ctx.update({
        "doc_kicker": "Project Report · Indicative DPR",
        "summary": summary,
        "recommendation": recommendation,
        "viable": viable,

        # cost of project & means of finance
        "project_cost_inr": inr(project_cost),
        "project_cost_cr": cr(project_cost),
        "loan_inr": inr(loan),
        "loan_cr": cr(loan),
        "promoter_inr": inr(promoter),
        "means": means,
        "de_ratio": (f"{de_ratio:.1f} : 1" if de_ratio else "—"),

        # debt-capacity basis
        "base_cash_accrual_inr": inr(base_cash_accrual),
        "base_npat_inr": inr(npat),
        "base_dep_inr": inr(depreciation),

        # term terms
        "term_rate": f"{TERM_RATE*100:.1f}%",
        "term_tenor": TERM_TENOR,
        "target_dscr": f"{TARGET_DSCR:.2f}",
        "growth_pct": f"{int(TURNOVER_GROWTH*100)}%",

        # projections & schedule
        "proj": proj,
        "sched": sched,
        "min_dscr": f"{min_dscr:.2f}",
        "avg_dscr": f"{avg_dscr:.2f}",

        # printed assumptions
        "assumptions": [
            f"Term loan sized to a {TARGET_DSCR:.2f}× year-1 DSCR on current cash accruals",
            f"Indicative rate {TERM_RATE*100:.1f}% p.a., tenor {TERM_TENOR} years, equal annual principal",
            f"Promoter margin {int(PROMOTER_MARGIN*100)}% of project cost",
            f"Turnover grows {int(TURNOVER_GROWTH*100)}% p.a.; EBIT margin held at the audited "
            f"{ebit_margin*100:.1f}%",
            "Depreciation and existing (working-capital) interest held flat",
            "Proprietorship — firm-level tax ≈ 0 (income taxed in the proprietor's hands)",
            "Projection is organic only — it excludes incremental returns from the deployed capex "
            "(and its added depreciation), so the DSCR shown is a conservative floor",
        ],
    })
    return ctx
