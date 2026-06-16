import os
from fastapi import APIRouter, Depends, HTTPException
from supabase import Client
from langchain_anthropic import ChatAnthropic
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import JsonOutputParser

from core.auth import verify_supabase_token
from core.database import get_db

router = APIRouter(
    prefix="/ai",
    tags=["AI CFO Briefing"]
)

# Initialize the LLM chain for structured JSON output
# The API key is automatically read from the ANTHROPIC_API_KEY env variable
try:
    llm = ChatAnthropic(model="claude-3-5-sonnet-20240620", max_tokens=1000)
except Exception as e:
    print(f"Warning: LLM Initialization failed. Missing API key? {e}")

briefing_prompt = ChatPromptTemplate.from_template("""
You are an expert MFOS CFO advisor writing a daily briefing for an MSME business owner.
Based on the following financial data, write exactly 3 high-priority action items.
Write in plain, professional, Tamil-friendly English (avoid dense banking jargon).

MSME Data context:
- Health Score: {health_score}/100 (Band {band})
- Top overdue debtor: {top_debtor_name} — ₹{top_debtor_amount}L ({top_debtor_days} days)
- Next EMI: ₹{next_emi_amount}L due {next_emi_date}
- GST compliance: {gst_days_remaining} days left — ₹{gst_amount}L payable

Return ONLY a JSON payload matching this exact structure: 
{{"actions": [{{"id": 1, "icon": "emoji", "text": "Short title", "detail": "Specific detail", "urgency": "high|medium|low"}}]}}
""")

briefing_chain = briefing_prompt | llm | JsonOutputParser()

@router.post("/daily-briefing/{msme_id}")
async def generate_daily_briefing(
    msme_id: str,
    # user: dict = Depends(verify_supabase_token),  # Uncomment when frontend passes JWT
    db: Client = Depends(get_db)
):
    try:
        # 1. Fetch live MSME data from Supabase
        # (Assuming you have an 'msme_entities' table)
        response = db.table("msme_entities").select("*").eq("id", msme_id).single().execute()
        if not response.data:
            raise HTTPException(status_code=404, detail="MSME not found")
        
        msme_data = response.data

        # 2. Invoke the LangChain pipeline
        result = await briefing_chain.ainvoke({
            "health_score": msme_data.get("health_score", 0),
            "band": msme_data.get("band", "UNKNOWN"),
            "top_debtor_name": msme_data.get("top_debtor_name", "Unknown Debtor"),
            "top_debtor_amount": msme_data.get("top_debtor_amount", 0.0),
            "top_debtor_days": msme_data.get("top_debtor_days", 0),
            "next_emi_amount": msme_data.get("next_emi_amount", 0.0),
            "next_emi_date": msme_data.get("next_emi_date", "TBD"),
            "gst_days_remaining": msme_data.get("gst_days_remaining", 0),
            "gst_amount": msme_data.get("gst_amount", 0.0)
        })
        
        # 3. Save the generated AI briefing back to Supabase
        db.table("daily_briefings").insert({
            "msme_id": msme_id,
            "actions_payload": result.get("actions", []),
            "generated_at": "now()"
        }).execute()
        
        return {"status": "success", "data": result}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))