from schemas.msme import MSMEFinancialInflowData
from dataclasses import dataclass

@dataclass
class RatioResult:
    value: float
    formatted: str
    status: str
    norm: str

def calculate_current_ratio(data: MSMEFinancialInflowData) -> RatioResult:
    # FIX: current ratio = Current Assets / Current Liabilities (NOT / total outside liabilities).
    # Fall back to TOL only if current_liabilities was not supplied (legacy rows) — degraded, flagged.
    cl = data.current_liabilities or data.total_outside_liabilities
    used_fallback = not (data.current_liabilities and data.current_liabilities > 0)
    ratio = data.current_assets / cl if cl > 0 else 0.0
    if ratio >= 1.33: status = "PASS"
    elif ratio >= 1.0: status = "STRESSED"
    else: status = "FAIL"
    norm = "Min 1.33:1 (CA / Current Liabilities)" + (" [approx: no CL, used TOL]" if used_fallback else "")
    return RatioResult(ratio, f"{ratio:.2f}:1", status, norm)

def calculate_dscr(data: MSMEFinancialInflowData) -> RatioResult:
    numerator = data.net_profit_after_tax + data.depreciation + data.interest_on_term_loan
    denominator = data.principal_repayment + data.interest_on_term_loan
    if denominator <= 0:
        return RatioResult(0.0, "N/A", "N/A", "Needs principal repayment + term-loan interest")
    dscr = numerator / denominator
    status = "PASS" if dscr >= 1.5 else ("STRESSED" if dscr >= 1.25 else "FAIL")
    return RatioResult(dscr, f"{dscr:.2f}x", status, "Min 1.5x avg / 1.25x any year")