from schemas.msme import MSMEFinancialInflowData
from dataclasses import dataclass

@dataclass
class RatioResult:
    value: float
    formatted: str
    status: str  # "PASS" | "STRESSED" | "FAIL"
    norm: str

def calculate_current_ratio(data: MSMEFinancialInflowData) -> RatioResult:
    ratio = data.current_assets / data.total_outside_liabilities if data.total_outside_liabilities > 0 else 0.0
    
    if ratio >= 1.33:
        status = "PASS"
    elif ratio >= 1.0:
        status = "STRESSED"
    else:
        status = "FAIL"
        
    return RatioResult(ratio, f"{ratio:.2f}:1", status, "Min 1.33:1")

def calculate_dscr(data: MSMEFinancialInflowData) -> RatioResult:
    # THE KING RATIO
    numerator = data.net_profit_after_tax + data.depreciation + data.interest_on_term_loan
    denominator = data.principal_repayment + data.interest_on_term_loan
    
    dscr = numerator / denominator if denominator > 0 else 999.0
    
    if dscr >= 1.5:
        status = "PASS"
    elif dscr >= 1.25:
        status = "STRESSED"
    else:
        status = "FAIL"
        
    return RatioResult(dscr, f"{dscr:.2f}x", status, "Min 1.5x avg / 1.25x any year")