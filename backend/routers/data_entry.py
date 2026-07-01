# backend/routers/data_entry.py
# CFO console write API + per-client read. The /clients LIST route lives in
# clients.py (not here) to avoid a duplicate /msme/clients.
#
# Mount in main.py (NO /api/v1 prefix — paths must stay /msme/...):
#     from routers import data_entry
#     app.include_router(data_entry.router)

from typing import Optional
from datetime import datetime, timezone, date          # add: date
from fastapi import APIRouter, Depends, HTTPException   # add: HTTPException
from pydantic import BaseModel

from core.database import get_db          # <-- core.database, matches your structure
from services import score_service



router = APIRouter(prefix="/msme", tags=["cfo-data-entry"])

# Only these financial columns may be written from the review screen / Financials
# tab. The operational columns (cibil_score, days_past_due, bounces_per_month,
# docs_ready_pct, compliance_pct) are deliberately EXCLUDED so a financials save
# can never clobber them — CIBIL in particular must stay NULL until a real bureau
# pull lands, and a phantom 0 would both false-certify the client and tank the
# banking-discipline score.
FINANCIAL_FIELDS = {
    "projected_annual_turnover", "annual_purchases", "ebit", "net_profit_after_tax",
    "depreciation", "interest_expense", "interest_on_term_loan", "principal_repayment",
    "current_assets", "current_liabilities", "inventory", "sundry_debtors",
    "sundry_creditors", "total_outside_liabilities", "tangible_net_worth",
    "declared_bank_statement_credits",
}


class FinancialsIn(BaseModel):
    period_label: Optional[str] = None
    period_year: Optional[int] = None
    period_month: Optional[int] = None
    projected_annual_turnover: float = 0
    annual_purchases: float = 0
    ebit: float = 0
    net_profit_after_tax: float = 0
    depreciation: float = 0
    interest_expense: float = 0
    interest_on_term_loan: float = 0
    principal_repayment: float = 0
    current_assets: float = 0
    current_liabilities: float = 0
    inventory: float = 0
    sundry_debtors: float = 0
    sundry_creditors: float = 0
    total_outside_liabilities: float = 0
    tangible_net_worth: float = 0
    declared_bank_statement_credits: float = 0
    days_past_due: int = 0
    cibil_score: int = 0
    bounces_per_month: float = 0
    docs_ready_pct: float = 80
    compliance_pct: float = 90


class DebtorIn(BaseModel):
    name: str
    amount_outstanding: float = 0
    days_outstanding: int = 0


class CreditorIn(BaseModel):
    name: str
    amount_due: float = 0
    due_date: Optional[str] = None


class ProposalIn(BaseModel):
    facility_type: Optional[str] = None        # 'CC' | 'OD' | 'Term Loan' | 'CC + Term Loan'
    amount_requested: float = 0
    purpose: Optional[str] = None
    tenor_months: Optional[int] = None
    rate_expectation: Optional[str] = None
    security_offered: Optional[str] = None
    security_value: float = 0


class CreditBureauIn(BaseModel):
    score: int
    bureau: str = "CIBIL"
    subject_type: str = "individual"          # individual = consumer (proprietor) | commercial
    subject_name: Optional[str] = None
    subject_pan: Optional[str] = None
    pulled_on: Optional[str] = None           # 'YYYY-MM-DD'; defaults to today
    control_number: Optional[str] = None
    source: str = "manual_entry"
    report_doc_id: Optional[str] = None       # documents.id of the uploaded CIBIL report (optional)


@router.post("/{msme_id}/credit-bureau")
def add_credit_bureau_pull(msme_id: str, body: CreditBureauIn, db=Depends(get_db)):
    # Consumer CIBIL is 300–900 — reject out-of-range so the audit row stays clean.
    if body.subject_type == "individual" and not (300 <= body.score <= 900):
        raise HTTPException(400, "Consumer CIBIL must be between 300 and 900.")

    row = body.model_dump()
    row["msme_id"] = msme_id
    if not row.get("pulled_on"):
        row["pulled_on"] = date.today().isoformat()

    db.table("credit_bureau_pulls").insert(row).execute()   # append-only, one row per pull
    s = score_service.refresh_score(db, msme_id)
    return {"ok": True, "score": {"score": s.get("score"), "band": s.get("band"),
                                  "delta": s.get("delta"), "provisional": s.get("provisional")}}


@router.get("/{msme_id}/entry")
def get_entry(msme_id: str, db=Depends(get_db)):
    ent = (db.table("msme_entities").select("*").eq("id", msme_id)
           .limit(1).execute().data or [])
    ent = ent[0] if ent else {}
    fin = (db.table("msme_financials").select("*").eq("msme_id", msme_id)
           .order("created_at", desc=True).limit(1).execute().data or [])
    # full period history (chronological) — drives the Financials Trends tab.
    fin_hist = (db.table("msme_financials").select("*").eq("msme_id", msme_id)
                .order("created_at", desc=False).limit(24).execute().data or [])
    debtors = (db.table("debtors").select("*").eq("msme_id", msme_id)
               .order("amount_outstanding", desc=True).execute().data or [])
    creditors = (db.table("creditors").select("*").eq("msme_id", msme_id)
                 .order("amount_due", desc=True).execute().data or [])
    # proposal + existing loans — wrapped so a missing loan_proposals table (pre-DDL)
    # never breaks the whole entry screen.
    try:
        prop = (db.table("loan_proposals").select("*").eq("msme_id", msme_id)
                .order("created_at", desc=True).limit(1).execute().data or [])
    except Exception:
        prop = []
    try:
        loans = (db.table("loans").select("*").eq("msme_id", msme_id)
                 .order("sanctioned_amount", desc=True).execute().data or [])
    except Exception:
        loans = []
    # compliance filings — wrapped so a missing table never breaks the entry screen.
    try:
        compliance = (db.table("compliance_filings").select("*").eq("msme_id", msme_id)
                      .order("due_date", desc=True).execute().data or [])
    except Exception:
        compliance = []
    # bank-statement snapshots (parsed from uploads into cash_position) — the
    # Banking tab's evidence. Newest first; wrapped so a missing table is harmless.
    try:
        banking = (db.table("cash_position").select("*").eq("msme_id", msme_id)
                   .order("as_of_date", desc=True).limit(12).execute().data or [])
    except Exception:
        banking = []
    return {

        "company": ent.get("company_name") or ent.get("name"),
        "owner": ent.get("owner_name") or ent.get("owner"),
        "financials": fin[0] if fin else None,
        "financials_history": fin_hist,
        "debtors": debtors,
        "creditors": creditors,
        "proposal": prop[0] if prop else None,
        "loans": loans,
        "compliance": compliance,
        "banking": banking,
    }


class GstReturnIn(BaseModel):
    return_type: str                          # 'GSTR1' | 'GSTR3B'
    period: str                               # 'YYYY-MM-DD' (first of month)
    period_label: Optional[str] = None
    gstin: Optional[str] = None
    taxable_value: float = 0
    igst: float = 0
    cgst: float = 0
    sgst: float = 0
    cess: float = 0
    total_tax: Optional[float] = None         # derived from the tax split if omitted
    arn: Optional[str] = None
    filed_date: Optional[str] = None
    due_date: Optional[str] = None
    status: str = "filed"
    filing_frequency: str = "monthly"


@router.post("/{msme_id}/gst-return")
def save_gst_return(msme_id: str, body: GstReturnIn, db=Depends(get_db)):
    """Manual GST-return entry (either type). Upserts by (msme_id, return_type,
    period) so re-entering a period corrects it in place. This is the
    PDF-parser-free path — advisors can key the two headline figures and the
    reconciliation lights up immediately."""
    if body.return_type not in ("GSTR1", "GSTR3B"):
        raise HTTPException(400, "return_type must be 'GSTR1' or 'GSTR3B'.")
    row = body.model_dump()
    row["msme_id"] = msme_id
    if row.get("total_tax") is None:
        row["total_tax"] = round(row["igst"] + row["cgst"] + row["sgst"] + row["cess"], 2)
    row["source"] = "manual_entry"
    db.table("gst_returns").upsert(row, on_conflict="msme_id,return_type,period").execute()
    return {"ok": True}


@router.get("/{msme_id}/gst-recon")
def get_gst_recon(msme_id: str, db=Depends(get_db)):
    """Per-period GSTR-1 vs GSTR-3B reconciliation, computed from gst_returns.
    A period is flagged `mismatch` when both returns exist and the taxable-value
    gap exceeds a tolerance (₹1,000 or 1% of the larger side)."""
    try:
        rows = (db.table("gst_returns").select("*").eq("msme_id", msme_id)
                .order("period", desc=True).execute().data or [])
    except Exception:
        return {"available": False, "rows": [],
                "summary": {"periods": 0, "matched": 0, "mismatched": 0,
                            "only_one_side": 0, "total_abs_taxable_diff": 0}}

    by_period: dict = {}
    for r in rows:
        p = str(r.get("period"))
        slot = by_period.setdefault(p, {"period": r.get("period"),
                                        "period_label": r.get("period_label")})
        if not slot.get("period_label"):
            slot["period_label"] = r.get("period_label")
        if r.get("return_type") == "GSTR1":
            slot["gstr1_taxable"] = float(r.get("taxable_value") or 0)
            slot["gstr1_tax"] = float(r.get("total_tax") or 0)
            slot["gstr1_status"] = r.get("status")
        elif r.get("return_type") == "GSTR3B":
            slot["gstr3b_taxable"] = float(r.get("taxable_value") or 0)
            slot["gstr3b_tax"] = float(r.get("total_tax") or 0)
            slot["gstr3b_status"] = r.get("status")

    out, matched, mismatched, one_side, total_abs = [], 0, 0, 0, 0.0
    for s in by_period.values():
        g1, g3 = s.get("gstr1_taxable"), s.get("gstr3b_taxable")
        both = g1 is not None and g3 is not None
        diff = (g1 or 0) - (g3 or 0)
        tol = max(1000.0, 0.01 * max(g1 or 0, g3 or 0))
        mismatch = bool(both and abs(diff) > tol)
        if both:
            total_abs += abs(diff)
            matched += 0 if mismatch else 1
            mismatched += 1 if mismatch else 0
        else:
            one_side += 1
        s["taxable_diff"] = round(diff, 2)
        s["tax_diff"] = round((s.get("gstr1_tax") or 0) - (s.get("gstr3b_tax") or 0), 2)
        s["both_filed"] = both
        s["mismatch"] = mismatch
        out.append(s)

    out.sort(key=lambda x: str(x["period"]), reverse=True)
    return {"available": True, "rows": out,
            "summary": {"periods": len(out), "matched": matched,
                        "mismatched": mismatched, "only_one_side": one_side,
                        "total_abs_taxable_diff": round(total_abs, 2)}}


@router.get("/{msme_id}/activity")
def get_activity(msme_id: str, db=Depends(get_db)):
    """A read-only client timeline merged from existing append-only tables
    (score_history, documents, credit_bureau_pulls, compliance_filings). No new
    table — each source is wrapped so a missing one is simply skipped. This is a
    lightweight activity feed, not the full before/after audit log (§12)."""
    events: list[dict] = []

    def add(ts, kind, icon, title, detail=None):
        if ts:
            events.append({"ts": ts, "kind": kind, "icon": icon,
                           "title": title, "detail": detail})

    try:
        for r in (db.table("score_history").select("*").eq("msme_id", msme_id)
                  .order("created_at", desc=True).limit(50).execute().data or []):
            band = r.get("band")
            add(r.get("created_at"), "score", "📊",
                f"Score recomputed: {r.get('score')}/100" + (f" ({band})" if band else ""))
    except Exception:
        pass

    try:
        for r in (db.table("documents").select("*").eq("msme_id", msme_id)
                  .order("created_at", desc=True).limit(50).execute().data or []):
            add(r.get("created_at"), "document", "📄",
                f"Uploaded {r.get('doc_type') or 'document'}", r.get("file_name"))
    except Exception:
        pass

    try:
        for r in (db.table("credit_bureau_pulls").select("*").eq("msme_id", msme_id)
                  .order("pulled_on", desc=True).limit(50).execute().data or []):
            add(r.get("pulled_on"), "bureau", "🏦",
                f"{r.get('bureau') or 'CIBIL'} pull: {r.get('score')}", r.get("subject_name"))
    except Exception:
        pass

    try:
        for r in (db.table("compliance_filings").select("*").eq("msme_id", msme_id)
                  .order("filed_date", desc=True).limit(50).execute().data or []):
            add(r.get("filed_date") or r.get("created_at"), "compliance", "✅",
                f"{r.get('filing_type') or 'Filing'} {r.get('period') or ''}".strip(),
                r.get("status"))
    except Exception:
        pass

    # Newest first. Mixed date/timestamp strings sort lexicographically well
    # enough for a display feed (date-only rows land at day start).
    events.sort(key=lambda e: str(e["ts"]), reverse=True)
    return {"events": events[:100]}


@router.post("/{msme_id}/financials")
def save_financials(msme_id: str, body: FinancialsIn, db=Depends(get_db)):
    # Write ONLY the financial columns (never the operational ones — see
    # FINANCIAL_FIELDS note). This is what keeps cibil_score / bounces NULL.
    payload = {k: v for k, v in body.model_dump().items() if k in FINANCIAL_FIELDS}

    # Period metadata, when supplied, is the upsert key + audit context.
    period_label = body.period_label
    if period_label:
        payload["period_label"] = period_label
        payload["period_year"] = body.period_year
        payload["period_month"] = body.period_month

    now = datetime.now(timezone.utc).isoformat()

    # Upsert by (msme_id, period_label): update the existing period row in place
    # rather than inserting a new one each save. Select-then-write mirrors the GST
    # writer and avoids needing a DB unique constraint.
    existing = None
    if period_label:
        existing = (db.table("msme_financials").select("id")
                    .eq("msme_id", msme_id).eq("period_label", period_label)
                    .execute().data or [])

    if existing:
        db.table("msme_financials").update({**payload, "updated_at": now}) \
          .eq("msme_id", msme_id).eq("period_label", period_label).execute()
    else:
        db.table("msme_financials").insert({**payload, "msme_id": msme_id}).execute()

    s = score_service.refresh_score(db, msme_id)
    return {"ok": True, "score": {"score": s.get("score"), "band": s.get("band"),
                                  "delta": s.get("delta")}}


@router.post("/{msme_id}/debtors")
def add_debtor(msme_id: str, body: DebtorIn, db=Depends(get_db)):
    row = body.model_dump()
    row["msme_id"] = msme_id
    db.table("debtors").insert(row).execute()
    return {"ok": True}


@router.post("/{msme_id}/creditors")
def add_creditor(msme_id: str, body: CreditorIn, db=Depends(get_db)):
    row = body.model_dump()
    row["msme_id"] = msme_id
    db.table("creditors").insert(row).execute()
    return {"ok": True}


@router.post("/{msme_id}/proposal")
def save_proposal(msme_id: str, body: ProposalIn, db=Depends(get_db)):
    """Save the credit ask. One current proposal per client (select-then-write, like
    financials — no DB unique constraint needed)."""
    payload = body.model_dump()
    payload["msme_id"] = msme_id
    now = datetime.now(timezone.utc).isoformat()
    existing = (db.table("loan_proposals").select("id")
                .eq("msme_id", msme_id).execute().data or [])
    if existing:
        db.table("loan_proposals").update({**payload, "updated_at": now}) \
          .eq("msme_id", msme_id).execute()
    else:
        db.table("loan_proposals").insert(payload).execute()
    return {"ok": True}


@router.post("/{msme_id}/score/refresh")
def refresh(msme_id: str, db=Depends(get_db)):
    """Recompute + persist this client's score (use after seeding, or any time)."""
    return score_service.refresh_score(db, msme_id)