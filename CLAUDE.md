# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

> **Versioned SDK warning.** Expo 56, React Native 0.85, React 19, and (in `cfo-console/`) Next.js 16 are all newer than common training data. APIs and file conventions differ. Read the versioned docs before writing framework code: Expo at https://docs.expo.dev/versions/v56.0.0/, Next.js in `cfo-console/node_modules/next/dist/docs/`.

## What this is

MSME CapitalLink ("MFOS") is a financial-health and credit-readiness platform for Indian MSMEs. A rules-based engine scores a business across 8 weighted components (banking discipline, liquidity, GST consistency, leverage, profitability, compliance, documentation, repayment) into a 0–100 health score, band (EXCELLENT/GOOD/MEDIUM/POOR), and a recommended lender tier. An LLM layer turns that data into a plain-English daily CFO briefing.

Three apps share one FastAPI backend and one Supabase Postgres database:

| App                  | Stack                                 | Audience                                                | Location                                   |
| -------------------- | ------------------------------------- | ------------------------------------------------------- | ------------------------------------------ |
| Owner mobile/web app | Expo Router (RN 0.85.3, React 19.2)   | MSME business owner — read-mostly dashboard             | repo root (`app/`, `hooks/`, `stores/`, …) |
| CFO console          | Next.js 16.2 (App Router, React 19.2) | Internal CFO/analyst — data entry, per-client deep-dive | `cfo-console/`                             |
| Backend API          | FastAPI + Supabase                    | both clients                                            | `backend/`                                 |

## Commands

**Owner app (repo root):**

```bash
PS C:\Users\narayanan.selvaraj\MSMECapitalLink> npx expo start
npm start            # expo start (dev server / Metro)
npm run android      # expo start --android
npm run ios          # expo start --ios
npm run web          # expo start --web (localhost:8081)
http://localhost:8081/login
```

**CFO console (`cfo-console/`):**

```bash
PS C:\Users\narayanan.selvaraj\MSMECapitalLink> cd .\cfo-console\
PS C:\Users\narayanan.selvaraj\MSMECapitalLink\cfo-console> npm run dev
npm run dev          # next dev (localhost:3000)
npm run build        # next build
npm run lint         # eslint
http://localhost:3000/console
```

**Backend (`backend/`):**

```bash
 C:\Users\narayanan.selvaraj\MSMECapitalLink\backend> .\.venv\Scripts\Activate.ps1
uvicorn main:app --reload --port 8000          # dev server; run from backend/ so `main:app` and PYTHONPATH resolve
pip install -r requirements.txt
docker build -t mfos-api . && docker run -p 8000:8000 mfos-api
netstat -ano | findstr :8000
taskkill /PID 31428 /F
uvicorn main:app --reload --port 8000
```

There is no test suite, linter config, or type-check script for the backend yet. (A legacy `backend/msme_capital_link.db` SQLite file is still in the tree from before the Supabase migration — it is unused; the app is fully on Supabase.)

## Architecture & cross-cutting concerns

### Scoring is the core domain (`backend/services/`)

- `scoring_engine.py` — `calculate_composite_score(metrics, bounces, docs_ready, compliance, sector)` is the heart of the product. It derives ratios (current ratio, DSO/inventory/creditor days → working-capital cycle, TOL/TNW, ICR, turnover variance) from `MSMEFinancialInflowData`, scores each of the 8 components via the `score_*` helpers, applies `COMPONENT_WEIGHTS`, and maps the total to a band + lender tier. Returns `currentScore`, `band`, `recommended_lender_tier`, a `component_breakdown`, and diagnostics (`current_ratio`, `wc_cycle_days`, `sector_used`).
- **Sector awareness matters:** the working-capital-cycle score uses `WC_CYCLE_BANDS` keyed by sector (resolved from free-text `industry` via `_SECTOR_KEYWORDS`). A flat threshold unfairly zeroes structurally long-cycle businesses (jewellery, works contracts). When touching liquidity scoring, preserve this.
- `ratio_engine.py` — standalone ratio calculators (current ratio, DSCR) returning `RatioResult` with PASS/STRESSED/FAIL status and the norm string. Note the deliberate fallback: current ratio uses `current_liabilities`, falling back to `total_outside_liabilities` only for legacy rows (flagged in the `norm`). The same CA/CL-with-TOL-fallback logic is duplicated inline in `scoring_engine.calculate_composite_score`.
- `score_service.py` — `refresh_score(db, msme_id)` fetches the client's latest `msme_financials` row + entity, runs the engine, and **persists to three places**: updates the `msme_entities` row (`health_score`, `band`, `previous_score`, `score_delta`, `score_updated_at`), upserts `scores` (on `msme_id`), and inserts a `score_history` row. The delta is anchored to a real point ≥7 days old from `score_history` (or the oldest available), so it returns `null` on first run rather than a fabricated number. `refresh_all_scores(db)` loops every entity.

### Supabase access (`backend/core/`)

There is **one** Supabase client module: `core/database.py`. Its `get_db()` is `lru_cache`d and reads `SUPABASE_URL` + the service-role key (accepts `SUPABASE_SERVICE_ROLE_KEY` or `SUPABASE_SERVICE_KEY`, from `settings` or the environment). `core/config.py` is the Pydantic-settings config; `core/auth.py` exposes `verify_supabase_token` (HS256 JWT verify against `SUPABASE_JWT_SECRET`, `verify_aud` disabled). **All routers import `get_db` from `core.database`.**

The backend uses the Supabase **service-role key**, so it bypasses Row Level Security and can read/write every client. **Never expose the service key to the browser or owner app.** The owner app talks to Supabase directly with the anon key (`lib/supabase.ts`).

> Note: an earlier version of this repo had a second `backend/database.py` module. It is gone — don't reintroduce a parallel `get_db()`.

### Routers (`backend/routers/`)

Registered in `main.py`: `health` and `dashboard` are mounted **with** `/api/v1`; `clients` and `data_entry` are mounted **without a prefix** (their paths must stay `/msme/...`).

- `health.py` — `POST /api/v1/health/evaluate`: runs `ratio_engine` (current ratio, DSCR), operating-cycle analysis, and red-flag checks. **JWT-protected** (`verify_supabase_token`). This is _not_ a liveness probe — there is no bare health-check endpoint.
- `dashboard.py` — `POST /api/v1/msme/{id}/dashboard`: takes financial inputs, looks up the entity's `industry` to feed sector-aware scoring, and returns the exact JSON shape the owner app's `useMetrics.ts` expects (`score`, `cashRunway`, `salesTrend`).
- `clients.py` — `GET /msme/clients`: the multi-client list the CFO console's triage view reads. Normalizes column-name variants (`company_name`/`name`, `industry`/`sector`, etc.).
- `data_entry.py` — CFO-console write API + per-client read: `GET /msme/{id}/entry`, `POST /msme/{id}/financials`, `/debtors`, `/creditors`, `/score/refresh`. Saving financials inserts the row **and** calls `score_service.refresh_score()`, returning the fresh score.
- `ai.py` — `POST /ai/daily-briefing/{id}`: LangChain + Claude generates 3 action items as JSON, persisted to `daily_briefings`. Prompt asks for "Tamil-friendly", jargon-free English.

**Heads-up — wiring gaps:**

- The **`ai` router is NOT registered in `main.py`** — `/ai/daily-briefing/...` is unreachable until you add `app.include_router(ai.router)`. (`ai.py` also pins an old model id, `claude-3-5-sonnet-20240620`; bump it when you touch that file.)
- `ai.py` and `dashboard.py` import `verify_supabase_token` but don't apply it (auth is commented out for local dev).

### Frontend data flow (owner app)

- **Two API surfaces, but reads are mostly direct-Supabase.** `lib/supabase.ts` is the direct Supabase client (anon key, AsyncStorage session); `lib/api.ts` is an axios client to FastAPI (`localhost:8000/api/v1`) that auto-injects the JWT and force-logs-out on 401. Most hooks read Supabase directly — `useDashboardData.ts` (Home), `useDebtors.ts`, `useCreditors.ts`, `useLoans.ts`, `useMsmeData.ts`. **Only `useMetrics.ts` (`useDashboardMetrics`) calls the FastAPI `/dashboard` endpoint**, and the Home screen currently uses the Supabase-direct `useDashboardData` instead, so that backend endpoint isn't on the hot path yet.
- **Active client selection is implicit:** the Home screen takes `msmeEntities[0].id` from `useMsmeData()` as the active MSME. `stores/msmeStore.ts` (Zustand) exists for an explicit active-MSME selection but isn't wired into the main flow yet.
- **Auth is currently mocked.** `app/(auth)/login.tsx` simulates OTP and stores a literal `'mock-jwt-token-123'`; `stores/useAuthStore.ts.checkAuth()` hardcodes role `'owner'` (JWT is not decoded). Real auth is a TODO — don't assume the stored token is a valid Supabase JWT.
- **Score-column gotchas (documented in `useDashboardData.ts`, respect them):** the health score lives in `msme_entities.health_score` — **not** `cibil_score` (a 300–900 bureau number). Delta comes from `previous_score`/`score_delta` (null when there's no real anchor). Receivable ageing is `debtors.days_outstanding`, **not** `days_past_due`.
- **Some dashboard metrics are still MOCK** (`cashRunway`, `nextEmi`, `compliance`, `sales` in `useDashboardData.ts`) — flagged `mock: true` because there's no data-entry path for them yet. `moneyIn`/`moneyOut` (from `debtors`/`creditors`) and the score are real.
- **Server state:** TanStack Query (`QueryClientProvider` in `app/_layout.tsx`, 5-min `staleTime`, retry 2).
- **Routing:** Expo Router file-based. `app/(auth)/login.tsx`, `app/(tabs)/` (Home `index` / Money In / Money Out / More / Account), plus stack screens `customer-detail`, `supplier-detail`, `documents`, `notifications`, `security`, `subscription`. Path alias `@/*` → repo root.
- **Styling:** central design tokens in `constants/theme.ts` (`C` colors, `T` type sizes, `S` spacing, `shadow`); display/format helpers (compact INR, `scoreColor`) in `lib/format.ts`; cross-platform alerts in `lib/alert.ts`. Shared components in `components/` (`ScoreArc`, `MetricCard`, `ActionCard`, `ScreenHeader`, `TalkToCFO`). NativeWind is installed.

### Frontend data flow (CFO console)

- Talks **only to FastAPI** (no direct Supabase). `cfo-console/app/lib/api.ts` wraps `getEntry` / `saveFinancials` / `saveDebtor` / `saveCreditor` against `NEXT_PUBLIC_API_URL`.
- `app/console/page.tsx` — triage list (`GET /msme/clients`); falls back to bundled `DEMO_CLIENTS` behind a banner when no backend is reachable. `app/console/[msmeId]/page.tsx` — per-client deep-dive + data entry; saving financials shows the recomputed score live. The console **only captures financials, debtors, and creditors** (no loans/actions entry yet).
- **Band wording differs per surface.** The engine emits `EXCELLENT/GOOD/MEDIUM/POOR`; the console renders score-derived `A/B/C/D` letters; the owner app maps to friendly words (Excellent/Good/Fair/Needs attention). If you change bands, update all three.

### Config / env

- Owner app: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` (read in `lib/supabase.ts`); backend base URL hard-coded in `lib/api.ts` — switch to LAN IP for physical-device testing.
- CFO console: `NEXT_PUBLIC_API_URL` (defaults to `http://localhost:8000`) in `cfo-console/app/lib/api.ts`.
- Backend: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_SERVICE_KEY`, `SUPABASE_JWT_SECRET`, `ANTHROPIC_API_KEY` in `backend/.env` (loaded via `core/config.py`).

### Supabase tables referenced in code

- `msme_entities` — client master + cached score columns (`health_score`, `band`, `previous_score`, `score_delta`, `score_updated_at`).
- `msme_financials` — per-period financial inputs (keyed by `msme_id`); scoring reads the latest by `created_at`.
- `debtors` (`amount_outstanding`, `days_outstanding`), `creditors` (`amount_due`, `due_date`).
- `scores` — one current row per client (upserted on `msme_id`); `score_history` — append-only score log (drives the delta).
- `loans` (`sanctioned_amount`, `outstanding_balance`, `emi_amount`, `next_due_date`) — read by `useLoans.ts`.
- `actions` — per-client action items read by `useDashboardData.ts`; `daily_briefings` — AI briefing output.

There are no migration files in-repo — schema lives in Supabase. See the `supabase-postgres-best-practices` skill in `.agents/skills/` for RLS, indexing, and query guidance.
