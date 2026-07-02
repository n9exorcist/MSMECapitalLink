-- ============================================================================
-- MSMECapitalLink · Notifications pipeline (spec §6)  — draft for approval
-- Run in the Supabase SQL editor. Idempotent (safe to re-run).
--
-- Design: ONE table (`notifications`) is both the OUTBOX (queued → sent/failed by
-- a channel provider) and the in-app INBOX (the owner app reads it; read_at marks
-- read). A stub provider records composed messages here now; swapping in the real
-- WhatsApp/FCM/email sender later is a one-file change that just flips status +
-- fills provider_message_id.
--
-- RLS: left OFF to match the prototype (backend uses the service-role key). Apply
-- the standard policy when §12 hardening lands.
-- ============================================================================

-- ── 1. notifications — outbox + in-app inbox (the core; the "outbox DDL") ──────
create table if not exists public.notifications (
  id                  uuid primary key default gen_random_uuid(),
  msme_id             uuid not null references public.msme_entities(id) on delete cascade,
  channel             text not null default 'inapp'
                        check (channel in ('inapp','push','whatsapp','email')),
  category            text not null
                        check (category in ('daily_briefing','weekly_summary','report_ready',
                                            'payment_received','cheque_bounce','gst_due',
                                            'emi_due','score_change','alert')),
  title               text not null,
  body                text not null,
  urgency             text default 'medium' check (urgency in ('high','medium','low')),
  link                text,                              -- optional deep link
  payload             jsonb,                             -- optional structured extras
  status              text not null default 'queued'
                        check (status in ('queued','sent','failed','read')),
  provider            text,                              -- 'stub' | 'gupshup' | 'expo' | 'resend' | …
  provider_message_id text,                              -- external id once really sent
  error               text,                              -- failure reason
  scheduled_for       timestamptz,                       -- e.g. the 8am briefing; null = now
  sent_at             timestamptz,
  read_at             timestamptz,                       -- in-app read state
  created_at          timestamptz not null default now()
);

create index if not exists notifications_msme_created_idx  on public.notifications (msme_id, created_at desc);
create index if not exists notifications_status_idx         on public.notifications (status);
create index if not exists notifications_channel_status_idx on public.notifications (channel, status);

-- ── 2. push_tokens — device tokens per client (needed for the 'push' channel) ─
-- The owner app already retrieves an Expo push token; today it's only displayed.
-- This lets it be persisted so the backend can target the device for real push.
create table if not exists public.push_tokens (
  id          uuid primary key default gen_random_uuid(),
  msme_id     uuid not null references public.msme_entities(id) on delete cascade,
  token       text not null,                             -- Expo push token
  platform    text check (platform in ('ios','android','web')),
  created_at  timestamptz not null default now(),
  last_seen   timestamptz not null default now(),
  constraint push_tokens_uq unique (msme_id, token)      -- upsert per device
);

create index if not exists push_tokens_msme_idx on public.push_tokens (msme_id);

-- ── 3. notification_prefs — persist the owner's toggles (currently local-only) ─
-- Keys match the toggles in app/notifications.tsx (push/whatsapp/email/payments/score).
create table if not exists public.notification_prefs (
  msme_id     uuid primary key references public.msme_entities(id) on delete cascade,
  push        boolean not null default true,
  whatsapp    boolean not null default true,
  email       boolean not null default false,
  payments    boolean not null default true,
  score       boolean not null default true,
  updated_at  timestamptz not null default now()
);

-- keep updated_at honest on prefs writes (create-or-replace = safe if it exists)
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists notification_prefs_set_updated_at on public.notification_prefs;
create trigger notification_prefs_set_updated_at
  before update on public.notification_prefs
  for each row execute function public.set_updated_at();
