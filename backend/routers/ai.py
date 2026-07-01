# backend/routers/ai.py
# Daily Briefing Composer (CFO §9.4) → owner app "Today's 3 Actions" (Owner §5.2).
#
# Flow:
#   POST /ai/daily-briefing/{id}/draft    → suggest 3 actions (does NOT persist)
#   POST /ai/daily-briefing/{id}/publish  → replace this client's rows in `actions`
#   POST /ai/daily-briefing/{id}          → draft + publish in one shot (batch mode)
#
# The suggestion is built from the SHARED read-model + migration plan (real signals —
# score/certification, receivables ageing, GST/compliance, the top score-improvement
# move), so it is grounded, not invented. An LLM pass (Claude) then rewrites those
# grounded candidates into plain, Tamil-friendly owner language. The LLM is OPTIONAL and
# lazily imported: if the package/key/model is unavailable or errors, we fall back to the
# rules-based candidates verbatim — the feature never depends on the model being reachable.
#
# Publishing writes to the `actions` table (columns: id, msme_id, icon, text, detail,
# urgency) — the exact shape the owner app's ActionCard reads — replacing the client's
# previous set. (There is no daily_briefings table; the actions table IS the briefing.)

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from core.database import get_db
from services.read_model import build_read_model, ReadModelError
from services.migration import build_plan

router = APIRouter(prefix="/ai", tags=["AI CFO Briefing"])

# Cheap, current model — fine for short drafting, and this runs per-client in batch mode.
_MODEL = "claude-haiku-4-5-20251001"
_URGENCIES = ("high", "medium", "low")


# ── models ──────────────────────────────────────────────────────────────────
class Action(BaseModel):
    icon: Optional[str] = "📌"
    text: str
    detail: str = ""
    urgency: Optional[str] = "medium"


class PublishIn(BaseModel):
    actions: List[Action] = Field(default_factory=list)


# ── helpers ─────────────────────────────────────────────────────────────────
def _money(n) -> str:
    """₹ figure in the owner's units: Cr ≥ 1cr, else L ≥ 1 lakh, else rupees."""
    try:
        v = float(n or 0)
    except (TypeError, ValueError):
        return "₹0"
    if v >= 1e7:
        return f"₹{v / 1e7:.2f}Cr"
    if v >= 1e5:
        return f"₹{v / 1e5:.1f}L"
    return f"₹{v:,.0f}"


def _norm(a: dict) -> dict:
    """Coerce any candidate/LLM row to the exact {icon,text,detail,urgency} shape."""
    urg = str(a.get("urgency") or "medium").lower()
    return {
        "icon": (a.get("icon") or "📌")[:8],
        "text": (a.get("text") or "").strip()[:200],
        "detail": (a.get("detail") or "").strip()[:280],
        "urgency": urg if urg in _URGENCIES else "medium",
    }


def _candidates(rm, plan) -> List[dict]:
    """Grounded 3-action baseline from real signals. Always returns ≥1."""
    m = rm.metrics
    score = rm.score.get("currentScore")
    provisional = rm.score.get("provisional", False)
    receivables = float(getattr(m, "sundry_debtors", 0) or 0)
    dso = round(rm.dso or 0)
    comp = rm.financials.get("compliance_pct")

    acts: List[dict] = []

    # 1. Certification is the single biggest lever while the file is provisional.
    if provisional:
        acts.append({
            "icon": "📄", "urgency": "high",
            "text": "Get your file bank-certified",
            "detail": "Share 6–12 months of bank statements and a CIBIL check so we can move you "
                      "from provisional to fully bank-ready.",
        })

    # 2. Overdue receivables — the dominant cash lever for most MSMEs.
    if receivables > 0 and dso >= 60:
        acts.append({
            "icon": "💰", "urgency": "high" if dso >= 90 else "medium",
            "text": f"Collect overdue payments ({_money(receivables)})",
            "detail": f"Customers owe you {_money(receivables)} — about {dso} days of sales tied up. "
                      "Chase the oldest bills first to free cash.",
        })

    # 3. Keep GST/compliance clean.
    if comp is not None and float(comp) < 100:
        acts.append({
            "icon": "🧾", "urgency": "medium",
            "text": "File your GST on time",
            "detail": "File GSTR-3B before the due date to keep your compliance record clean and "
                      "protect your score.",
        })

    # 4. Top score-improvement move (jargon-free), if we still have room.
    for mv in getattr(plan, "moves", []):
        if len(acts) >= 3:
            break
        acts.append({
            "icon": "📈", "urgency": "low",
            "text": f"Improve your {mv.name.lower()}",
            "detail": f"Strengthening this lifts your health score by about {mv.impact:.0f} points "
                      "toward the bank-ready line.",
        })

    # 5. Positive default so the briefing is never empty.
    if not acts:
        band = rm.score.get("band", "")
        acts.append({
            "icon": "✅", "urgency": "low",
            "text": "You're on track — keep it up",
            "detail": f"Your business health is {str(band).title() or 'strong'} "
                      f"({score}/100). Keep filings and collections current to hold it.",
        })

    return acts[:3]


def _ai_polish(rm, candidates: List[dict]) -> Optional[List[dict]]:
    """Best-effort LLM rewrite of the grounded candidates into owner-friendly language.
    Returns None on any failure so the caller falls back to the candidates."""
    try:
        from core.config import settings
        api_key = settings.ANTHROPIC_API_KEY or ""
        if not api_key:
            return None  # no key configured → use the rules baseline silently

        from langchain_anthropic import ChatAnthropic
        from langchain_core.prompts import ChatPromptTemplate
        from langchain_core.output_parsers import JsonOutputParser

        llm = ChatAnthropic(model=_MODEL, max_tokens=700, temperature=0.3, api_key=api_key)
        prompt = ChatPromptTemplate.from_template(
            "You are an MFOS CFO advisor writing a daily briefing for an Indian MSME owner who is "
            "not a finance expert. Rewrite the DRAFT actions below into exactly 3 clear, encouraging, "
            "action-oriented items in plain Tamil-friendly English — no banking jargon (no DSCR, "
            "TOL/TNW, current ratio). Keep every rupee figure and day-count EXACTLY as given; do not "
            "invent new numbers. Keep the same urgency for each item.\n\n"
            "Business: {name} · health score {score}/100 ({band}).\n"
            "DRAFT actions (JSON): {draft}\n\n"
            'Return ONLY JSON: {{"actions":[{{"icon":"<emoji>","text":"<short title>",'
            '"detail":"<one specific sentence>","urgency":"high|medium|low"}}]}}'
        )
        chain = prompt | llm | JsonOutputParser()
        out = chain.invoke({
            "name": rm.entity.get("company_name") or rm.entity.get("name") or "the business",
            "score": rm.score.get("currentScore"),
            "band": rm.score.get("band", ""),
            "draft": candidates,
        })
        acts = out.get("actions") if isinstance(out, dict) else None
        if not acts:
            return None
        return [_norm(a) for a in acts][:3]
    except Exception as e:  # noqa: BLE001 — LLM is optional; never break the briefing
        print(f"[ai] LLM polish unavailable, using rules baseline: {e!r}")
        return None


def _build_draft(db, msme_id: str) -> dict:
    try:
        rm = build_read_model(db, msme_id)
    except ReadModelError as e:
        raise HTTPException(404, str(e))
    plan = build_plan(rm)
    candidates = [_norm(c) for c in _candidates(rm, plan)]
    ai = _ai_polish(rm, candidates)
    actions = ai if ai else candidates
    return {
        "msme_id": msme_id,
        "client_name": rm.entity.get("company_name") or rm.entity.get("name") or "",
        "source": "ai" if ai else "rules",
        "actions": actions,
    }


def _persist(db, msme_id: str, actions: List[dict]) -> List[dict]:
    """Replace this client's action set (the owner shows all rows for the msme)."""
    rows = [{"msme_id": msme_id, **_norm(a)} for a in actions][:3]
    if not rows:
        raise HTTPException(400, "No actions to publish")
    db.table("actions").delete().eq("msme_id", msme_id).execute()
    res = db.table("actions").insert(rows).execute()
    return res.data or []


# ── routes ──────────────────────────────────────────────────────────────────
@router.post("/daily-briefing/{msme_id}/draft")
def draft_briefing(msme_id: str, db=Depends(get_db)):
    """Suggest 3 actions for the CFO to review/edit. Does not persist."""
    return _build_draft(db, msme_id)


@router.post("/daily-briefing/{msme_id}/publish")
def publish_briefing(msme_id: str, body: PublishIn, db=Depends(get_db)):
    """Publish the (edited) actions to the owner app."""
    saved = _persist(db, msme_id, [a.model_dump() for a in body.actions])
    return {"status": "published", "count": len(saved), "actions": saved}


@router.post("/daily-briefing/{msme_id}")
def generate_and_publish(msme_id: str, db=Depends(get_db)):
    """Batch mode — draft + publish in one call."""
    d = _build_draft(db, msme_id)
    saved = _persist(db, msme_id, d["actions"])
    return {"status": "success", "source": d["source"], "count": len(saved), "actions": saved}
