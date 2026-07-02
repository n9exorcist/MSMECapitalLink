-- ============================================================================
-- MSMECapitalLink · cache Bank-Readiness + Green Eligibility on msme_entities
-- Run in the Supabase SQL editor. Idempotent (safe to re-run).
--
-- Spec §3.1 requires Health / Bank-Readiness / Green as sortable 0-100 columns
-- in the triage list, and §6.4 treats scores as persisted + refreshed (as
-- health_score already is). These two additive columns let score_service cache
-- the two new composites alongside health_score, so the /msme/clients list can
-- sort/display them without recomputing per row (§1.3 "under 1 second").
--
-- Additive + nullable: no backfill needed. Run score_service.refresh_all_scores
-- afterwards (or resave any client) to populate them.
-- ============================================================================

alter table public.msme_entities
  add column if not exists bank_readiness_score    integer,
  add column if not exists green_eligibility_score  integer;
