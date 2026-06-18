from fastapi import APIRouter, Depends
from supabase import Client
from schemas.msme import MSMEFinancialInflowData
from services.scoring_engine import calculate_composite_score
from core.database import get_db
from core.auth import verify_supabase_token

router = APIRouter(
    prefix="/msme",
    tags=["Dashboard Aggregation"]
)


# This matches the endpoint your React Native 'useMetrics.ts' hook calls!
@router.post("/{msme_id}/dashboard")
async def get_home_dashboard_data(msme_id: str, metrics: MSMEFinancialInflowData,
                                  db: Client = Depends(get_db)):
    # Look up the client's sector so the score uses sector-aware WC bands
    ent = (db.table("msme_entities").select("industry").eq("id", msme_id)
           .limit(1).execute().data or [])
    sector = ent[0].get("industry") if ent else None
    score_data = calculate_composite_score(metrics, sector=sector)

    # 2. Cash Runway for the dashboard metric card
    monthly_burn = metrics.annual_purchases / 12 if metrics.annual_purchases > 0 else 1.0
    cash_runway_days = int((metrics.current_assets / monthly_burn) * 30)

    # 3. Sales trend (bank credits vs declared turnover)
    variance = ((metrics.declared_bank_statement_credits - metrics.projected_annual_turnover)
                / metrics.projected_annual_turnover) if metrics.projected_annual_turnover > 0 else 0

    # 4. Exact JSON shape expected by React Native
    return {
        "score": score_data,
        "cashRunway": {
            "days": cash_runway_days,
            "cashBalance": round(metrics.current_assets, 2),
            "accountsCount": 3,
            "monthlyBurn": round(monthly_burn, 2),
        },
        "salesTrend": {
            "pct": abs(round(variance * 100, 1)),
            "up": variance >= 0,
            "thisMonth": round(metrics.declared_bank_statement_credits / 12, 2),
        },
    }