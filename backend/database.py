from fastapi import APIRouter
from datetime import datetime

router = APIRouter(
    prefix="/msme",
    tags=["Dashboard Aggregation"]
)

# Notice this is now a @router.get!
@router.get("/{msme_id}/dashboard")
async def get_home_dashboard_data(msme_id: str):
    """
    TEMPORARY BRIDGE: This returns the exact JSON shape your React Native UI 
    expects. Later, we will fetch this live from Supabase.
    """
    return {
        "owner": "Mr. Suresh",
        "score": 82,
        "previousScore": 75,
        "band": "EXCELLENT",
        "actions": [
            { "id": 1, "icon": "📞", "text": "Follow up Sundaram", "detail": "₹2.4L (65 days past due)", "urgency": "high" },
            { "id": 2, "icon": "💸", "text": "Pay Ramesh Steel", "detail": "₹85k due by Friday", "urgency": "medium" },
            { "id": 3, "icon": "📋", "text": "GST filing deadline", "detail": "₹3.2L due in 5 days", "urgency": "low" }
        ],
        "metrics": {
            "moneyIn": { "total": 14.2, "count": 12, "overdueCount": 1 },
            "moneyOut": { "total": 8.6, "count": 9, "weekAmount": 2.1 },
            "cashRunway": { "days": 45, "cash": 8.2, "accounts": 3 },
            "nextEmi": { "amount": 1.5, "date": "14 Jun", "bank": "Canara", "overdue": False },
            "compliance": { "status": "On Track", "filing": "GSTR-3B", "daysLeft": 5 },
            "sales": { "pct": 12.5, "thisMonth": 18.4, "up": True }
        }
    }