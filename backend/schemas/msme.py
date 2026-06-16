from typing import Optional
from pydantic import BaseModel, Field

class MSMEFinancialInflowData(BaseModel):
    company_name: str
    
    # Turnovers & Purchases
    projected_annual_turnover: float
    annual_purchases: float
    
    # P&L Elements
    ebit: Optional[float] = 0.0 
    net_profit_after_tax: Optional[float] = 0.0
    depreciation: float
    interest_expense: float
    
    # DSCR Specifics (NEW)
    interest_on_term_loan: float = Field(default=0.0, description="Interest specifically on term debt")
    principal_repayment: float = Field(default=0.0, description="Annual principal repayment obligation")
    
    # Balance Sheet
    current_assets: float
    inventory: float
    sundry_debtors: float
    sundry_creditors: float
    total_outside_liabilities: float
    tangible_net_worth: float
    
    # Additional Context
    declared_bank_statement_credits: float
    days_past_due: int
    cibil_score: int