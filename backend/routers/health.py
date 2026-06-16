from fastapi import APIRouter, Depends, HTTPException
from schemas.msme import MSMEFinancialInflowData
from services import ratio_engine
from core.auth import verify_supabase_token

router = APIRouter(
    prefix="/health",
    tags=["Financial Health Evaluation"]
)

@router.post("/evaluate")
async def evaluate_msme_financial_health(
    metrics: MSMEFinancialInflowData,
    # This dependency automatically requires a valid Supabase token in the headers!
    # Remove it temporarily if you want to test without a frontend token.
    user: dict = Depends(verify_supabase_token) 
):
    # 1. Calculate Ratios via the new Service Engine
    current_ratio_result = ratio_engine.calculate_current_ratio(metrics)
    dscr_result = ratio_engine.calculate_dscr(metrics)
    
    # Calculate additional metrics (moved from old main.py)
    dso_debtor_days = (metrics.sundry_debtors / metrics.projected_annual_turnover) * 365 if metrics.projected_annual_turnover > 0 else 0.0
    inventory_days = (metrics.inventory / metrics.annual_purchases) * 365 if metrics.annual_purchases > 0 else 0.0
    creditor_days = (metrics.sundry_creditors / metrics.annual_purchases) * 365 if metrics.annual_purchases > 0 else 0.0
    calculated_wc_cycle_days = dso_debtor_days + inventory_days - creditor_days

    # 2. Compile Compliance Matrix
    compliance_matrix = {
        "Current Ratio": current_ratio_result.__dict__,
        "DSCR": dscr_result.__dict__,
        # Add quick_ratio, tol_tnw, etc., as you build them in ratio_engine.py
    }

    # 3. Determine Red Flags
    turnover_variance = abs(metrics.declared_bank_statement_credits - metrics.projected_annual_turnover) / metrics.projected_annual_turnover
    
    # 4. Return modular payload
    return {
        "metadata": {
            "company_name": metrics.company_name,
            "evaluated_by_user_id": user.get("sub", "unknown") # Uses the ID from the Supabase token
        },
        "operating_cycle_analysis": {
            "debtor_days_dso": round(dso_debtor_days, 1),
            "inventory_days": round(inventory_days, 1),
            "creditor_days": round(creditor_days, 1),
            "net_working_capital_cycle_days": round(calculated_wc_cycle_days, 1)
        },
        "ratio_compliance_matrix": compliance_matrix,
        "system_red_flags": {
            "turnover_to_bank_credit_mismatch_alert": turnover_variance > 0.20,
            "promoter_credit_score_alert": metrics.cibil_score < 650
        }
    }