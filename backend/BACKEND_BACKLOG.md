# MSMECapitalLink — Backend Backlog

Status of the FastAPI backend against `MFOS_Spec_CFO_Backend_App.docx`.
Legend: `[x]` done · `[~]` built but not wired · `[ ]` to build · **(Pn)** = spec phase.

---

## ✅ Built & working

- [x] Supabase data layer + HTTP/2 fix (`core/database.py`)
- [x] Settings / config loader (`core/config.py`)
- [x] Health scoring engine — 8 weighted components + sector-aware WC bands (`services/scoring_engine.py`)
- [x] Score persistence — writes `msme_entities` + `scores` + `score_history`, 7-day delta (`services/score_service.py`)
- [x] Ratio engine — current ratio + DSCR only (`services/ratio_engine.py`)
- [x] `GET /msme/clients` — triage list + risk flag (`routers/clients.py`)
- [x] `GET /msme/{id}/entry` — read financials + debtors + creditors
- [x] `POST /msme/{id}/financials` — save + auto-recompute score
- [x] `POST /msme/{id}/debtors` · `POST /msme/{id}/creditors` — save (no recompute)
- [x] `POST /msme/{id}/score/refresh` — manual recompute
- [x] `POST /api/v1/msme/{id}/dashboard` — score + cash runway + sales trend
- [x] `POST /api/v1/health/evaluate` — ratio matrix + red flags
- [x] CORS

## 🔧 Built but NOT wired (fix, don't rebuild)

- [~] Auth `verify_supabase_token` exists but **commented out on every route → all endpoints open** (P1, security)
- [x] AI daily-briefing router **mounted** (`/ai/daily-briefing/{id}/draft|publish`), model bumped to `claude-haiku-4-5`; grounded rules fallback when no API key (P2)
- [~] `refresh_all_scores()` exists but **nothing calls it** — no schedule (P1)
- [~] Tables with no endpoints: `loans`, `actions`, `monthly_sales`, `compliance_filings` (last two seeded via raw SQL)

---

## Scoring engine (§6)

- [ ] **Null-handling fix** — blank CIBIL / bounces / DPD must stop scoring as good news _(in progress)_ (P1)
- [ ] Recompute on debtor / creditor / loan changes (only `financials` triggers it today) (P1)
- [ ] Fix GST component to spec — measure GSTR-1 vs 3B match, not bank-credits-vs-turnover (P1)
- [ ] Turnover-trend component (reads `monthly_sales`) (P3)
- [ ] Receivables-ageing component (reads debtor ageing) (P3)
- [ ] Bank-Readiness Score (reshuffled weights) (P1)
- [ ] Green Eligibility Score (P3)
- [ ] Weekly background recompute job — Sun 2 AM IST (P1)
- [ ] Unit tests for every scoring rule (P1)

## Data ingestion (§5)

- [ ] Bank statement entry — manual / bulk-paste / OCR + `bank_statements` table (P1)
- [x] GST return entry (`POST /msme/{id}/gst-return`) + GSTR-1 ↔ 3B reconciliation (`GET /msme/{id}/gst-recon`) over `gst_returns` (P1)
- [ ] Loan entry — sanction / EMI schedule / repayment log (table exists, no endpoints) (P1)
- [ ] Debtor/creditor bulk import + party master + ageing-over-time (P1/P3)
- [ ] Document upload + storage + OCR + versioning (P2)

## Deep-dive tabs needing a backend (§4.2)

- [x] Financials **Trends** tab — period-over-period from `msme_financials` history (industry benchmarks still pending) (P3)
- [x] **Banking** tab — parsed bank-statement position + history from `cash_position` (P1)
- [x] **Compliance** tab — GST/TDS/PF/ESI filing status from `compliance_filings` (P1)
- [x] **GST recon** tab — GSTR-1 vs 3B per period from `gst_returns` (manual entry + auto GSTR-3B from uploads; GSTR-1 **PDF** parser pending a sample) (P1)
- [x] **Loans** tab — facilities from `loans` (P2)
- [x] **Documents** tab — upload + parse + list (P2)
- [x] **Activity** tab — merged read-only feed (`GET /msme/{id}/activity`) over score_history + documents + bureau pulls + filings (P3)
- [ ] Green profile tab (P3)
- [x] CMA / Reports — served by the document engine (Health → Bank Proposal → CMA → DPR → Green) (P2/P3)
- [ ] Subscription / billing tab (P4)

## Banker-grade tools (§7) — the differentiator, mostly unbuilt

- [ ] Working-capital eligibility — MPBF Tandon II, drawing power, stress test (P3)
- [ ] Term-loan eligibility — DSCR over tenor, repayment capacity, collateral (P3)
- [ ] Full ratio library — quick/cash, ICR, TOL-TNW exposed, D/E, EBITDA/PAT margin, ROCE/ROE, debtor/creditor/inventory days, turnovers, margins (P3)
- [ ] Migration pathway designer (P3)
- [ ] Green finance tools — solar / SIDBI / CBAM / carbon (P3)

## Document generation (§8)

- [ ] 8 document types (Health Report → Bank Proposal → CMA → DPR → …) (P2/P3)
- [ ] PDF (Puppeteer/WeasyPrint) + docx (python-docx) + xlsx (openpyxl) (P2)
- [ ] Email / WhatsApp delivery (P2)

## Customer service (§9)

- [ ] WhatsApp / Email template send (Gupshup/AiSensy, Resend) (P2)
- [ ] Action-item tracker (P2)
- [ ] Finish + mount the AI daily-briefing workflow (P2/P3)

## Portfolio analytics (§10)

- [ ] Server-side aggregates — band/tier distribution, MRR/ARR, advisor productivity (P3)
- [ ] Real-time push to the owner app — the "updates in real-time" promise (§1.2) (P3)

## Security & compliance (§2, §12) — **deploy blocker, cross-cutting**

- [ ] Enforce auth on all routes (P1)
- [ ] Login / session + 7 roles + permission checks (P1/P4)
- [ ] RLS policies — backend currently uses the service-role key, which bypasses RLS entirely (P1)
- [ ] Audit log — who / when / what / before–after (P2/P4)
- [ ] DPDP Act consent capture + purpose limitation (P4)

---

### Net

Data spine + Health scoring work. Largest unbuilt blocks: banker tools (§7), document engine (§8), and **all security**.
