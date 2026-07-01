# backend/reports/cma_context.py
# build_cma_context(db, msme_id) → Jinja vars for the CMA Data Sheet (IBA format).
# The CMA (Credit Monitoring Arrangement) statement is the standard bank-format pack a
# lender's credit desk keys in. This builds the IBA forms from the SAME shared read-model
# every other document uses — NO third recompute path:
#   • identity / period / bureau / ratios / P&L+BS formatting  → build_health_report_context
#     (which internally runs routers.client360 → services.read_model)
#   • the raw audited metrics (for the classified forms)        → services.read_model
#   • MPBF / drawing-power (Form V, the centrepiece)            → services.wc_finance
#
# We only have ONE audited period on record, so the multi-column "estimate / projection"
# columns a full CMA carries are shown as GST-derived context (Form II trend strip) and
# flagged — we never fabricate a projected balance sheet. Fund-flow (Form VI) needs a
# prior-period balance sheet that isn't on file, so it's noted rather than stubbed.
#
# Every rupee figure is Indian-grouped and every derived line computed HERE; the template
# only renders pre-computed strings.

from reports.context import build_health_report_context
from reports.format import inr, cr
from services.read_model import build_read_model
from services.wc_finance import assess_wc_limit


def _f(x):
    """Coerce to float; None/'' → None."""
    try:
        return None if x is None or x == "" else float(x)
    except (TypeError, ValueError):
        return None


def _sub(a, b):
    return (a - b) if (a is not None and b is not None) else None


def _pos(x):
    """Clamp a derived balancing figure to ≥0 (negatives are rounding/classification noise)."""
    return None if x is None else max(x, 0.0)


def _share(part, total):
    """'42.1%' share of a total, for the comparative columns. None-safe."""
    if part is None or not total:
        return "—"
    return f"{part / total * 100:.1f}%"


def _existing_bank_finance(db, msme_id):
    """Sanctioned CC/OD already on record — nets into the MPBF 'other current liabilities'."""
    try:
        rows = (db.table("loans").select("*").eq("msme_id", msme_id).execute().data or [])
    except Exception:
        return 0.0, []
    cc = 0.0
    existing = []
    for ln in rows:
        lt = (ln.get("loan_type") or "").lower()
        is_wc = any(t in lt for t in ("cc", "od", "cash credit", "overdraft", "working"))
        existing.append({
            "type": ln.get("loan_type") or "Facility",
            "lender": ln.get("lender") or "—",
            "sanctioned": inr(ln.get("sanctioned_amount")),
            "outstanding": inr(ln.get("outstanding_balance")),
            "is_wc": is_wc,
        })
        if is_wc:
            cc += float(ln.get("sanctioned_amount") or 0.0)
    return cc, existing


def build_cma_context(db, msme_id: str) -> dict:
    ctx = dict(build_health_report_context(db, msme_id))   # identity, period, rb, bureau, margins
    rm = build_read_model(db, msme_id)
    m = rm.metrics
    fin = rm.financials or {}

    existing_cc, existing = _existing_bank_finance(db, msme_id)
    w = assess_wc_limit(rm, existing_bank_finance=existing_cc)

    # ── raw audited figures (Indian-grouped in this builder) ──
    turnover = _f(m.projected_annual_turnover)
    purchases = _f(m.annual_purchases)
    gross_profit = _f(fin.get("gross_profit"))
    if gross_profit is None:
        gross_profit = _sub(turnover, purchases)
    ebit = _f(m.ebit)
    interest = _f(m.interest_expense)
    depreciation = _f(m.depreciation)
    npat = _f(m.net_profit_after_tax)
    opex = _sub(gross_profit, ebit)            # SG&A incl. depreciation, backed out of EBIT
    pbt = _sub(ebit, interest)
    tax = _sub(pbt, npat)

    current_assets = _f(m.current_assets)
    debtors = _f(m.sundry_debtors)
    inventory = _f(m.inventory)
    creditors = _f(m.sundry_creditors)
    current_liabilities = _f(m.current_liabilities)
    tol = _f(m.total_outside_liabilities)
    tnw = _f(m.tangible_net_worth)

    other_ca = _pos(_sub(_sub(current_assets, inventory), debtors))
    other_cl = _pos(_sub(current_liabilities, creditors))
    term_liab = _pos(_sub(tol, current_liabilities))          # long-term / term borrowings
    total_liab = (tol + tnw) if (tol is not None and tnw is not None) else None
    net_fixed = _pos(_sub(total_liab, current_assets))        # net fixed + non-current (balancing)

    # ── Form II — Operating Statement rows ──
    op_rows = [
        ("Gross sales / turnover", turnover, True),
        ("Less: cost of sales (purchases)", purchases, False),
        ("Gross profit", gross_profit, True),
        ("Less: operating expenses (incl. depreciation)", opex, False),
        ("Operating profit (EBIT)", ebit, True),
        ("Less: interest & finance cost", interest, False),
        ("Profit before tax", pbt, True),
        ("Less: taxation", tax, False),
        ("Net profit after tax", npat, True),
    ]
    operating = [{"label": lbl, "value": inr(val), "bold": bold} for lbl, val, bold in op_rows]

    # ── Form III — classified balance sheet (two sides) ──
    liabilities = [
        {"label": "Sundry creditors (trade)", "value": inr(creditors), "bold": False},
        {"label": "Other current liabilities", "value": inr(other_cl), "bold": False},
        {"label": "Bank working-capital finance", "value": inr(existing_cc), "bold": False},
        {"label": "Total current liabilities", "value": inr(current_liabilities), "bold": True},
        {"label": "Term / long-term borrowings", "value": inr(term_liab), "bold": False},
        {"label": "Tangible net worth", "value": inr(tnw), "bold": False},
        {"label": "Total liabilities", "value": inr(total_liab), "bold": True},
    ]
    assets = [
        {"label": "Inventory", "value": inr(inventory), "bold": False},
        {"label": "Sundry debtors (receivables)", "value": inr(debtors), "bold": False},
        {"label": "Other current assets", "value": inr(other_ca), "bold": False},
        {"label": "Total current assets", "value": inr(current_assets), "bold": True},
        {"label": "Net fixed & non-current assets", "value": inr(net_fixed), "bold": False},
        {"label": "Total assets", "value": inr(total_liab), "bold": True},
    ]

    # ── Form IV — comparative current assets & liabilities (share of total) ──
    ca_rows = [
        {"label": "Inventory", "value": inr(inventory), "share": _share(inventory, current_assets)},
        {"label": "Sundry debtors", "value": inr(debtors), "share": _share(debtors, current_assets)},
        {"label": "Other current assets", "value": inr(other_ca), "share": _share(other_ca, current_assets)},
    ]
    cl_rows = [
        {"label": "Sundry creditors", "value": inr(creditors), "share": _share(creditors, current_liabilities)},
        {"label": "Other current liabilities", "value": inr(other_cl), "share": _share(other_cl, current_liabilities)},
        {"label": "Bank WC finance", "value": inr(existing_cc), "share": _share(existing_cc, current_liabilities)},
    ]

    # ── Form V — MPBF (Tandon Method I & II) + drawing power ──
    mpbf = {
        "tca": inr(w.tca),
        "ocl": inr(w.ocl),
        "wcg": inr(w.wcg),
        "mpbf1": inr(w.mpbf_method1),
        "tca_75": inr(0.75 * w.tca),
        "mpbf2": inr(w.mpbf_method2),
        "actual_nwc": inr(w.actual_nwc),
        "min_nwc": inr(w.min_nwc),
        "surplus_nwc": inr(w.surplus_nwc),
        "nwc_ok": w.surplus_nwc >= 0,
        # drawing power
        "inventory": inr(w.inventory),
        "creditors": inr(w.creditors),
        "paid_stock": inr(w.paid_stock),
        "stock_margin_pct": f"{w.stock_margin * 100:.0f}%",
        "dp_stock": inr(w.dp_stock),
        "debtors": inr(w.debtors),
        "debtor_margin_pct": f"{w.debtor_margin * 100:.0f}%",
        "dp_debtors": inr(w.dp_debtors),
        "drawing_power": inr(w.drawing_power),
        # result
        "recommended_inr": inr(w.recommended_limit),
        "recommended_cr": cr(w.recommended_limit),
        "binding": w.binding,
    }

    ctx.update({
        "doc_kicker": "CMA Data · Bank Format",
        "existing": existing,
        "has_existing": bool(existing),
        "existing_cc_inr": inr(existing_cc),
        "proposed_cc_inr": inr(w.recommended_limit),
        "proposed_cc_cr": cr(w.recommended_limit),
        # forms
        "operating": operating,
        "liabilities": liabilities,
        "assets": assets,
        "ca_rows": ca_rows,
        "cl_rows": cl_rows,
        "total_ca_inr": inr(current_assets),
        "total_cl_inr": inr(current_liabilities),
        "mpbf": mpbf,
        # sales-trend strip (GST-derived; ctx["trend"] already carries label/value/bar_h)
        "trend_unit": "₹ Cr",
    })
    return ctx
