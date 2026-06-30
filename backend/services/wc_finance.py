# backend/services/wc_finance.py
# Working-capital limit assessment — a §7 banker-analysis tool, also the engine behind
# the WC Limit Renewal document. Computes:
#   • Tandon Committee MPBF (Maximum Permissible Bank Finance), Methods I and II
#   • Drawing Power from paid stock + book debts after margins
#   • a recommended CC/OD limit = min(MPBF II, Drawing Power)
# Inputs come from services.read_model (the audited balance sheet).
#
# Conventions / assumptions (all surfaced in the document):
#   • Method II stipulates the borrower fund 25% of total current assets from long-term
#     sources → it inherently targets a current ratio ≥ 1.33.
#   • "Other current liabilities" excludes existing bank finance; default 0 when no CC/OD
#     is on record (Sri Sai has none). Pass existing_bank_finance to net an existing limit.
#   • Drawing-power margins: 25% on stock, 40% on book debts (typical CC norms). Debtor
#     ageing (≤90-day eligibility) isn't on record, so the full debtor balance is taken
#     net of margin.

from dataclasses import dataclass

STOCK_MARGIN = 0.25
DEBTOR_MARGIN = 0.40
MIN_NWC_PCT = 0.25          # Tandon Method II borrower contribution (% of total CA)


@dataclass
class WCAssessment:
    # MPBF
    tca: float
    total_cl: float
    existing_bank_finance: float
    ocl: float
    wcg: float
    actual_nwc: float
    min_nwc: float
    surplus_nwc: float
    mpbf_method1: float
    mpbf_method2: float
    # Drawing power
    inventory: float
    creditors: float
    paid_stock: float
    stock_margin: float
    dp_stock: float
    debtors: float
    debtor_margin: float
    dp_debtors: float
    drawing_power: float
    # result
    recommended_limit: float
    binding: str            # 'MPBF' or 'Drawing Power' — which caps the limit
    current_ratio: float


def assess_wc_limit(rm, existing_bank_finance: float = 0.0,
                    stock_margin: float = STOCK_MARGIN,
                    debtor_margin: float = DEBTOR_MARGIN) -> WCAssessment:
    m = rm.metrics
    tca = float(m.current_assets or 0.0)
    total_cl = float(m.current_liabilities or 0.0)
    ocl = max(total_cl - existing_bank_finance, 0.0)

    wcg = tca - ocl
    actual_nwc = tca - total_cl
    min_nwc = MIN_NWC_PCT * tca
    surplus_nwc = actual_nwc - min_nwc

    mpbf1 = max(0.75 * wcg, 0.0)                 # Method I: 75% of working-capital gap
    mpbf2 = max(0.75 * tca - ocl, 0.0)           # Method II: 75% of CA − OCL

    inv = float(m.inventory or 0.0)
    cred = float(m.sundry_creditors or 0.0)
    paid_stock = max(inv - cred, 0.0)            # stock the borrower has actually paid for
    dp_stock = paid_stock * (1.0 - stock_margin)
    deb = float(m.sundry_debtors or 0.0)
    dp_deb = deb * (1.0 - debtor_margin)
    drawing_power = dp_stock + dp_deb

    recommended = max(min(mpbf2, drawing_power), 0.0)
    binding = "MPBF" if mpbf2 <= drawing_power else "Drawing Power"
    cr = (tca / total_cl) if total_cl > 0 else 0.0

    return WCAssessment(
        tca=tca, total_cl=total_cl, existing_bank_finance=existing_bank_finance, ocl=ocl,
        wcg=wcg, actual_nwc=actual_nwc, min_nwc=min_nwc, surplus_nwc=surplus_nwc,
        mpbf_method1=mpbf1, mpbf_method2=mpbf2,
        inventory=inv, creditors=cred, paid_stock=paid_stock, stock_margin=stock_margin,
        dp_stock=dp_stock, debtors=deb, debtor_margin=debtor_margin, dp_debtors=dp_deb,
        drawing_power=drawing_power, recommended_limit=recommended, binding=binding,
        current_ratio=cr,
    )
