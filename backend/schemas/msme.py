from typing import Optional
from pydantic import BaseModel, Field

class MSMEFinancialInflowData(BaseModel):
    company_name: str
    
    # Turnovers & Purchases
    projected_annual_turnover: Optional[float] = 0.0
    annual_purchases: Optional[float] = 0.0
    
    # P&L Elements
    ebit: Optional[float] = 0.0 
    net_profit_after_tax: Optional[float] = 0.0
    depreciation: Optional[float] = 0.0
    interest_expense: Optional[float] = 0.0
    
    # DSCR Specifics (NEW)
    interest_on_term_loan: float = Field(default=0.0, description="Interest specifically on term debt")
    principal_repayment: float = Field(default=0.0, description="Annual principal repayment obligation")
    
    # Balance Sheet
    current_assets: Optional[float] = 0.0
    current_liabilities: Optional[float] = 0.0
    inventory: Optional[float] = 0.0
    sundry_debtors: Optional[float] = 0.0
    sundry_creditors: Optional[float] = 0.0
    total_outside_liabilities: Optional[float] = 0.0
    tangible_net_worth: Optional[float] = 0.0
    
    # Additional Context
    declared_bank_statement_credits: float
    days_past_due: Optional[int] = 0
    cibil_score: Optional[int] = 0