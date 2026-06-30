# backend/reports/wc_context.py
# build_wc_renewal_context(db, msme_id) → flat Jinja vars for the WC Limit Renewal
# document. Reuses the shared read-model + the wc_finance assessment (MPBF / drawing
# power). All rupee figures are formatted here via reports.format.

from datetime import datetime
import re

from services.read_model import build_read_model
from services.wc_finance import assess_wc_limit
from reports.format import inr, cr, pct1, fmt_long


def _pct(x: float) -> str:
    return f"{round(x * 100)}%"


def build_wc_renewal_context(db, msme_id: str) -> dict:
    rm = build_read_model(db, msme_id)            # raises ReadModelError → 404 upstream
    w = assess_wc_limit(rm)
    ent, fin = rm.entity, rm.financials
    today = datetime.now().date()

    period_label = fin.get("period_label") or ""
    _fy = re.search(r"(20\d\d)", period_label or "")
    _sy = int(_fy.group(1)) if _fy else None
    bs_date = f"31 Mar {_sy + 1}" if _sy else ""

    has_existing = w.existing_bank_finance > 0

    return {
        # identity / cover
        "client_name": ent.get("company_name") or ent.get("name") or "",
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

        # recommendation hero
        "recommended_limit_cr": cr(w.recommended_limit),
        "recommended_limit_inr": inr(w.recommended_limit),
        "binding": "MPBF (Method II)" if w.binding == "MPBF" else "Drawing Power",
        "product": "CC / OD against stock & receivables",
        "current_ratio": f"{w.current_ratio:.2f}",

        # MPBF (Tandon) computation
        "tca_inr": inr(w.tca),
        "ocl_inr": inr(w.ocl),
        "existing_bank_inr": inr(w.existing_bank_finance),
        "has_existing_bank": has_existing,
        "wcg_inr": inr(w.wcg),
        "min_nwc_pct": _pct(0.25),
        "min_nwc_inr": inr(w.min_nwc),
        "actual_nwc_inr": inr(w.actual_nwc),
        "surplus_nwc_inr": inr(w.surplus_nwc),
        "mpbf1_inr": inr(w.mpbf_method1),
        "mpbf2_inr": inr(w.mpbf_method2),
        "mpbf1_cr": cr(w.mpbf_method1),
        "mpbf2_cr": cr(w.mpbf_method2),

        # drawing power
        "inventory_inr": inr(w.inventory),
        "creditors_inr": inr(w.creditors),
        "paid_stock_inr": inr(w.paid_stock),
        "stock_margin_pct": _pct(w.stock_margin),
        "dp_stock_inr": inr(w.dp_stock),
        "debtors_inr": inr(w.debtors),
        "debtor_margin_pct": _pct(w.debtor_margin),
        "dp_debtors_inr": inr(w.dp_debtors),
        "drawing_power_inr": inr(w.drawing_power),
        "drawing_power_cr": cr(w.drawing_power),

        # working-capital cycle + comfort ratios
        "wc_dso": rm.dso and round(rm.dso),
        "wc_inv": round(rm.inv_days),
        "wc_cred": round(rm.cred_days),
        "wc_total": round(rm.wc_cycle),
        "receivables_cr": cr(rm.metrics.sundry_debtors),
        "tol_tnw": f"{rm.tol_tnw:.2f}" if rm.tol_tnw is not None else "—",
        "turnover_cr": cr(rm.metrics.projected_annual_turnover),
    }
