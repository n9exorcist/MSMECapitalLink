# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

> **Versioned SDK warning.** Expo 56, React Native 0.85, React 19, and (in `cfo-console/`) Next.js 16 are all newer than common training data. APIs and file conventions differ. Read the versioned docs before writing framework code: Expo at https://docs.expo.dev/versions/v56.0.0/, Next.js in `cfo-console/node_modules/next/dist/docs/`.

## What this is

MSME CapitalLink ("MFOS") is a financial-health and credit-readiness platform for Indian MSMEs. A rules-based engine scores a business across 8 weighted components (banking discipline, liquidity, GST consistency, leverage, profitability, compliance, documentation, repayment) into a 0–100 health score, band (EXCELLENT/GOOD/MEDIUM/POOR), and a recommended lender tier. An LLM layer turns that data into a plain-English daily CFO briefing.

Three apps share one FastAPI backend and one Supabase Postgres database:

| App | Stack | Audience | Location |
|-----|-------|----------|----------|
| Owner mobile/web app | Expo Router (RN 0.85, React 19) | MSME business owner — read-mostly dashboard | repo root (`app/`, `hooks/`, `stores/`, …) |
| CFO console | Next.js 16 (App Router, React 19) | Internal CFO/analyst — data entry, per-client deep-dive | `cfo-console/` |
| Backend API | FastAPI + Supabase | both clients | `backend/` |

## Commands

**Owner app (repo root):**
```bash
npm start            # expo start (dev server / Metro)
npm run android      # expo start --android
npm run ios          # expo start --ios
npm run web          # expo start --web (localhost:8081)
```

**CFO console (`cfo-console/`):**
```bash
npm run dev          # next dev (localhost:3000)
npm run build        # next build
npm run lint         # eslint
```

**Backend (`backend/`):**
```bash
uvicorn main:app --reload --port 8000          # dev server; run from backend/ so `main:app` and PYTHONPATH resolve
pip install -r requirements.txt
docker build -t mfos-api . && docker run -p 8000:8000 mfos-api
```
There is no test suite, linter config, or type-check script for the backend yet.

## Architecture & cross-cutting concerns

### Scoring is the core domain (`backend/services/`)
- `scoring_engine.py` — `calculate_composite_score()` is the heart of the product. It derives ratios (current ratio, working-capital cycle, TOL/TNW, ICR, turnover variance) from `MSMEFinancialInflowData`, scores each of the 8 components, applies `COMPONENT_WEIGHTS`, and maps the total to a band + lender tier.
- **Sector awareness matters:** the working-capital-cycle score uses `WC_CYCLE_BANDS` keyed by sector (resolved from free-text via `_SECTOR_KEYWORDS`). A flat threshold unfairly zeroes structurally long-cycle businesses (jewellery, works contracts). When touching liquidity scoring, preserve this.
- `ratio_engine.py` — standalone ratio calculators (current ratio, DSCR) returning `RatioResult` with PASS/STRESSED/FAIL status and the norm string. Note the deliberate fallback: current ratio uses `current_liabilities`, falling back to `total_outside_liabilities` only for legacy rows (flagged in the `norm`).

### Two Supabase client modules exist — this is intentional, pick the right one
- `backend/core/database.py` + `backend/core/config.py` + `backend/core/auth.py` — Pydantic-settings config, JWT verification (`verify_supabase_token`), and a `get_db()`. Used by `routers/dashboard.py` and `routers/ai.py`.
- `backend/database.py` — a separate `get_db()` (lru-cached, more env-var fallbacks). Used by `routers/data_entry.py` (and the CFO-console write paths).

Both use the Supabase **service-role key**, so the backend bypasses Row Level Security and can read/write every client. **Never expose the service key to the browser or owner app.** The owner app talks to Supabase directly with the anon key (`lib/supabase.ts`).

### Routers (`backend/routers/`, all under `/api/v1` except where noted)
- `dashboard.py` — `POST /msme/{id}/dashboard`: takes financial inputs, returns the exact JSON shape the owner app's `useMetrics.ts` expects (`score`, `cashRunway`, `salesTrend`). Looks up the entity's sector to feed scoring.
- `data_entry.py` — CFO-console write API + per-client read (`/msme/{id}/entry`, `/financials`, `/debtors`, `/creditors`, `/score/refresh`). Mounted with **no `/api/v1` prefix** (paths must stay `/msme/...`). Saving financials triggers `score_service.refresh_score()`.
- `ai.py` — `POST /ai/daily-briefing/{id}`: LangChain + Claude generates 3 action items as JSON, persisted to `daily_briefings`.
- `health.py` — health check.

**Heads-up — incomplete wiring.** `main.py` currently imports `routers.clients` and `data_entry.py` imports `services.score_service`, but neither `routers/clients.py` nor `services/score_service.py` exists in the tree yet, and `data_entry`/`ai` routers aren't all registered in `main.py`. `dashboard.py` references `Client`/`get_db` without importing them. Expect to create/fix these when working on backend endpoints; don't assume the server boots as-is.

### Frontend data flow (owner app)
- **Auth:** `stores/useAuthStore.ts` (Zustand) holds login state + role (`owner`/`cfo`); JWT persisted via `lib/secureStore.ts` (expo-secure-store).
- **Two API surfaces:** `lib/api.ts` is an axios client to the FastAPI backend (`localhost:8000/api/v1`) that auto-injects the JWT and force-logs-out on 401. `lib/supabase.ts` is the direct Supabase client (anon key, AsyncStorage session). Hooks in `hooks/` use both via TanStack Query.
- **Server state:** TanStack Query (`QueryClientProvider` in `app/_layout.tsx`, 5-min `staleTime`, retry 2). Hooks like `useMetrics.ts`, `useDashboardData.ts`, `useDebtors.ts` wrap `useQuery`.
- **Routing:** Expo Router file-based. `app/(auth)/login.tsx`, `app/(tabs)/` (Home / Money In / Money Out / More / Account). Path alias `@/*` → repo root.
- **Styling:** central theme in `constants/theme.ts` (`C` colors, `T` type, `shadow`); NativeWind is installed.

### Config / env
- Owner app: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` (read in `lib/supabase.ts`); backend base URL hard-coded in `lib/api.ts` — switch to LAN IP for physical-device testing.
- CFO console: `NEXT_PUBLIC_API_URL` (defaults to `http://localhost:8000`) in `cfo-console/app/lib/api.ts`.
- Backend: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_SERVICE_KEY`, `SUPABASE_JWT_SECRET`, `ANTHROPIC_API_KEY` in `backend/.env`.

### Supabase tables referenced in code
`msme_entities`, `msme_financials`, `debtors`, `creditors`, `daily_briefings`, plus a score-history table used by the score service. There are no migration files in-repo — schema lives in Supabase. See the `supabase-postgres-best-practices` skill in `.agents/skills/` for RLS, indexing, and query guidance.
