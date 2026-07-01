-- ============================================================================
-- MSMECapitalLink · GST returns + reconciliation  (draft for approval)
-- Run in the Supabase SQL editor. Idempotent (safe to re-run).
--
-- Purpose: capture BOTH GSTR-1 and GSTR-3B per client per tax period so the
-- console can reconcile GSTR-1 outward supplies against GSTR-3B table 3.1(a),
-- and so the scoring engine's gst_consistency component can measure the real
-- GSTR-1 <-> 3B match instead of the bank-credits-vs-turnover proxy.
--
-- RLS: intentionally left OFF to match the rest of the prototype (the backend
-- uses the service-role key, which bypasses RLS). Apply the standard policy
-- when §12 hardening lands.
-- ============================================================================

-- One row per GST filing (GSTR-1 OR GSTR-3B), per client, per tax period.
create table if not exists public.gst_returns (
  id               uuid primary key default gen_random_uuid(),
  msme_id          uuid not null references public.msme_entities(id) on delete cascade,
  gstin            text,
  return_type      text not null check (return_type in ('GSTR1','GSTR3B')),
  period           date not null,                    -- first of month, e.g. 2026-04-01
  period_label     text,                             -- 'April 2026'
  filing_frequency text default 'monthly'
                     check (filing_frequency in ('monthly','quarterly')),

  -- headline outward figures used for reconciliation
  taxable_value    numeric(15,2) not null default 0, -- GSTR-1: total taxable outward
                                                      -- GSTR-3B: table 3.1(a) taxable
  igst             numeric(15,2) not null default 0,
  cgst             numeric(15,2) not null default 0,
  sgst             numeric(15,2) not null default 0,
  cess             numeric(15,2) not null default 0,
  total_tax        numeric(15,2) not null default 0,

  -- filing metadata
  arn              text,
  filed_date       date,
  due_date         date,
  status           text default 'filed'
                     check (status in ('filed','late','pending','not_filed')),
  days_late        integer default 0,
  source           text default 'upload',            -- gstr1_upload | gstr3b_upload | manual_entry
  source_doc_id    uuid references public.documents(id) on delete set null,

  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  -- lets the parser upsert a re-uploaded return in place
  constraint gst_returns_uq unique (msme_id, return_type, period)
);

create index if not exists gst_returns_msme_period_idx on public.gst_returns (msme_id, period desc);
create index if not exists gst_returns_msme_type_idx   on public.gst_returns (msme_id, return_type);

-- keep updated_at honest on every write
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists gst_returns_set_updated_at on public.gst_returns;
create trigger gst_returns_set_updated_at
  before update on public.gst_returns
  for each row execute function public.set_updated_at();

-- Always-fresh reconciliation: GSTR-1 vs GSTR-3B per client per period.
-- A non-zero *_diff (beyond tolerance, applied in the API) is a red flag.
create or replace view public.gst_reconciliation as
select
  coalesce(r1.msme_id, r3.msme_id)                                as msme_id,
  coalesce(r1.period,  r3.period)                                 as period,
  coalesce(r1.period_label, r3.period_label)                      as period_label,
  r1.taxable_value                                                as gstr1_taxable,
  r3.taxable_value                                                as gstr3b_taxable,
  (coalesce(r1.taxable_value,0) - coalesce(r3.taxable_value,0))   as taxable_diff,
  r1.total_tax                                                    as gstr1_tax,
  r3.total_tax                                                    as gstr3b_tax,
  (coalesce(r1.total_tax,0) - coalesce(r3.total_tax,0))          as tax_diff,
  r1.status                                                       as gstr1_status,
  r3.status                                                       as gstr3b_status
from      (select * from public.gst_returns where return_type = 'GSTR1')  r1
full join (select * from public.gst_returns where return_type = 'GSTR3B') r3
       on r1.msme_id = r3.msme_id and r1.period = r3.period;
