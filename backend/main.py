from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import Dict, List, Any

# Internal imports from our new modular file structures
from database import init_db, SessionLocal, CompanyAuditRecord
from schemas import MSMEFinancialInflowData

# Automatically build database schemas if missing on startup
init_db()

app = FastAPI(
    title="MSME Advanced Credit Underwriting & Health Evaluation Engine",
    version="2026.05"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/api/v2/evaluate-msme-health")
async def evaluate_msme_financial_health(metrics: MSMEFinancialInflowData):
    # --- BLOCK 1: VALIDATE PRIMARY SYSTEM INTEGRITY & DETECT RED FLAGS ---
    turnover_variance = abs(metrics.declared_bank_statement_credits - metrics.projected_annual_turnover) / metrics.projected_annual_turnover
    has_turnover_mismatch_red_flag = turnover_variance > 0.20
    is_cibil_declined = metrics.cibil_score < 650
    
    # --- BLOCK 2: CALCULATION OF RATIOS ---
    current_ratio = metrics.current_assets / metrics.total_outside_liabilities if metrics.total_outside_liabilities > 0 else 0.0
    quick_ratio = (metrics.current_assets - metrics.inventory) / metrics.total_outside_liabilities if metrics.total_outside_liabilities > 0 else 0.0
    tol_tnw_ratio = metrics.total_outside_liabilities / metrics.tangible_net_worth if metrics.tangible_net_worth > 0 else 0.0
    icr = metrics.ebit / metrics.interest_expense if metrics.interest_expense > 0 else 999.0
    
    dso_debtor_days = (metrics.sundry_debtors / metrics.projected_annual_turnover) * 365 if metrics.projected_annual_turnover > 0 else 0.0
    inventory_days = (metrics.inventory / metrics.annual_purchases) * 365 if metrics.annual_purchases > 0 else 0.0
    creditor_days = (metrics.sundry_creditors / metrics.annual_purchases) * 365 if metrics.annual_purchases > 0 else 0.0
    calculated_wc_cycle_days = dso_debtor_days + inventory_days - creditor_days
    
    # --- BLOCK 3: ASSESS WORKING CAPITAL FUNDING LIMITS ---
    nayak_wc_limit_allocation = metrics.projected_annual_turnover * 0.20
    mpbf_method_ii_limit = (metrics.current_assets * 0.75) - metrics.sundry_creditors
    
    # --- BLOCK 4: EVALUATE COMPLIANCE SCORING LOGIC ---
    compliance_matrix = {}
    passed_metrics_count = 0
    total_scorable_metrics = 5
    
    if current_ratio >= 1.33:
        compliance_matrix["Current Ratio"] = {"value": f"{current_ratio:.2f}:1", "status": "PASS", "norm": "Min 1.33:1"}
        passed_metrics_count += 1
    elif current_ratio >= 1.0:
        compliance_matrix["Current Ratio"] = {"value": f"{current_ratio:.2f}:1", "status": "STRESSED", "norm": "Min 1.33:1"}
    else:
        compliance_matrix["Current Ratio"] = {"value": f"{current_ratio:.2f}:1", "status": "FAIL", "norm": "Min 1.33:1"}
        
    if quick_ratio >= 1.0:
        compliance_matrix["Quick Ratio"] = {"value": f"{quick_ratio:.2f}:1", "status": "PASS", "norm": "Min 1.0:1"}
        passed_metrics_count += 1
    else:
        compliance_matrix["Quick Ratio"] = {"value": f"{quick_ratio:.2f}:1", "status": "FAIL", "norm": "Min 1.0:1"}
        
    if tol_tnw_ratio <= 4.0:
        compliance_matrix["TOL / TNW"] = {"value": f"{tol_tnw_ratio:.2f}:1", "status": "PASS", "norm": "Max 4.0:1"}
        passed_metrics_count += 1
    elif tol_tnw_ratio <= 6.0:
        compliance_matrix["TOL / TNW"] = {"value": f"{tol_tnw_ratio:.2f}:1", "status": "STRESSED", "norm": "Max 4.0:1"}
    else:
        compliance_matrix["TOL / TNW"] = {"value": f"{tol_tnw_ratio:.2f}:1", "status": "FAIL", "norm": "Max 4.0:1"}
        
    if icr >= 1.5:
        compliance_matrix["Interest Coverage Ratio"] = {"value": f"{icr:.2f}x", "status": "PASS", "norm": "Min 1.5x"}
        passed_metrics_count += 1
    else:
        compliance_matrix["Interest Coverage Ratio"] = {"value": f"{icr:.2f}x", "status": "FAIL", "norm": "Min 1.5x"}
        
    if dso_debtor_days <= 90:
        compliance_matrix["Debtor Collection Cycle"] = {"value": f"{dso_debtor_days:.1f} Days", "status": "PASS", "norm": "Max 90 Days"}
        passed_metrics_count += 1
    elif dso_debtor_days <= 120:
        compliance_matrix["Debtor Collection Cycle"] = {"value": f"{dso_debtor_days:.1f} Days", "status": "STRESSED", "norm": "Max 90 Days"}
    else:
        compliance_matrix["Debtor Collection Cycle"] = {"value": f"{dso_debtor_days:.1f} Days", "status": "FAIL", "norm": "Max 90 Days"}

    # --- BLOCK 5: COMPILE PROPAGATED METRIC VALUES ---
    passed_percentage = passed_metrics_count / total_scorable_metrics
    calculated_credit_gauge_score = int(300 + (passed_percentage * 600))
    
    if metrics.days_past_due > 90 or is_cibil_declined or dso_debtor_days > 120:
        calculated_credit_gauge_score = min(calculated_credit_gauge_score, 550)
        
    if calculated_credit_gauge_score >= 750:
        health_status_label = "EXCELLENT HEALTH (Low Risk Underwriting Matrix)"
    elif calculated_credit_gauge_score >= 700:
        health_status_label = "GOOD STANDING (Standard Commercial Terms)"
    elif calculated_credit_gauge_score >= 600:
        health_status_label = "AVERAGE PERF (Requires Collateral Mitigants)"
    else:
        health_status_label = "CRITICAL INSOLVENCY STRESS (High Risk Default Alert)"

    # DATABASE INJECTION: Persist evaluation parameters to local SQLite storage
    db = SessionLocal()
    try:
        db_record = CompanyAuditRecord(
            company_name=metrics.company_name,
            credit_score=calculated_credit_gauge_score,
            health_label=health_status_label,
            calculated_turnover=metrics.projected_annual_turnover
        )
        db.add(db_record)
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"Database insertion skipped or failed: {e}")
    finally:
        db.close()

    # Return structural financial health report payload
    return {
        "metadata": {
            "company_name": metrics.company_name,
            "overall_health_assessment": health_status_label,
            "credit_score_index_value": calculated_credit_gauge_score,
        },
        "operating_cycle_analysis": {
            "debtor_days_dso": round(dso_debtor_days, 1),
            "inventory_days": round(inventory_days, 1),
            "creditor_days": round(creditor_days, 1),
            "net_working_capital_cycle_days": round(calculated_wc_cycle_days, 1)
        },
        "funding_eligibility_estimates": {
            "nayak_committee_fast_proxy_limit": round(nayak_wc_limit_allocation, 2),
            "tandon_mpbf_method_ii_max_limit": round(max(0.0, mpbf_method_ii_limit), 2)
        },
        "ratio_compliance_matrix": compliance_matrix,
        "system_red_flags": {
            "turnover_to_bank_credit_mismatch_alert": has_turnover_mismatch_red_flag,
            "severe_debtor_inflation_alert": dso_debtor_days > 120,
            "promoter_credit_score_alert": is_cibil_declined
        }
    }