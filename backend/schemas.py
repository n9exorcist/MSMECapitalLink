from pydantic import BaseModel, Field

class MSMEFinancialInflowData(BaseModel):
    company_name: str
    
    # 1. GST & 3CA/3CB Monthly/Annual Data Elements
    projected_annual_turnover: float = Field(..., description="Projected gross turnover validated via GST/3CA/3CB audit streams")
    annual_purchases: float = Field(..., description="Total raw input material purchases recorded via GSTR-3B filings")
    
    # 2. P&L Statement Annual Elements
    ebit: float = Field(..., description="Earnings Before Interest and Tax (Operating Profit)")
    net_profit_after_tax: float = Field(..., description="Final net income generated post tax adjustments")
    depreciation: float = Field(..., description="Non-cash depreciation and amortization expenses added back to cash flows")
    interest_expense: float = Field(..., description="Total financial interest obligation for the fiscal period")
    
    # 3. Balance Sheet Annual Elements
    current_assets: float = Field(..., description="Cash, bank balances, short-term advances, and liquid assets")
    inventory: float = Field(..., description="Closing stock/inventory valuation at fiscal period conclusion")
    sundry_debtors: float = Field(..., description="Total trade receivables due from clients")
    sundry_creditors: float = Field(..., description="Total trade payables due to manufacturing raw material suppliers")
    total_outside_liabilities: float = Field(..., description="Sum total of all external liabilities, short-term debt, and long-term dues")
    tangible_net_worth: float = Field(..., description="Paid-up capital + reserves minus intangible assets and accumulated losses")
    
    # 4. Account Balance & Bureau Monthly Monitoring Metrics
    declared_bank_statement_credits: float = Field(..., description="Sum total of 12-month trailing actual bank account deposit turnovers")
    days_past_due: int = Field(..., description="Maximum Days Past Due (DPD) flag encountered in current lending facilities")
    cibil_score: int = Field(..., description="Bureau personal credit profile index score for corporate promoters")