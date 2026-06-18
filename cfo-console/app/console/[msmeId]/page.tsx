'use client';
// app/console/[msmeId]/page.tsx   (rename the file to page.tsx)
// CFO Data Entry Console (spec §5). Banker-grade, dense, navy/teal — matches the owner app.
// Writes through FastAPI; saving Financials recomputes the score and shows it live.

import { useCallback, useEffect, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { useParams } from 'next/navigation';
// Relative import works with no tsconfig change. If you set up the "@/*" alias
// to point at ./app/*, you can use: import { ... } from '@/lib/api';
import { getEntry, saveFinancials, saveDebtor, saveCreditor } from '../../lib/api';

const C = {
  navy: '#0B2E4F', teal: '#0F766E', bg: '#F0F5FA', surface: '#FFFFFF',
  border: '#E2EAF4', text: '#0F172A', sub: '#475569', muted: '#94A3B8',
  green: '#059669', greenBg: '#ECFDF5', amber: '#D97706', red: '#DC2626',
};

type Tab = 'financials' | 'debtors' | 'creditors';
type Msg = { kind: 'ok' | 'err'; text: string };
type ScoreState = { score: number; band: string; delta: number | null };

interface Debtor { id?: string; name: string; amount_outstanding?: number; days_outstanding?: number; status?: string }
interface Creditor { id?: string; name: string; amount_due?: number; due_date?: string }

const FIN_GROUPS: { title: string; fields: { key: string; label: string }[] }[] = [
  {
    title: 'Turnover & Purchases', fields: [
      { key: 'projected_annual_turnover', label: 'Projected annual turnover (₹)' },
      { key: 'annual_purchases', label: 'Annual purchases (₹)' },
    ],
  },
  {
    title: 'Profit & Loss', fields: [
      { key: 'ebit', label: 'EBIT / operating profit (₹)' },
      { key: 'net_profit_after_tax', label: 'Net profit after tax (₹)' },
      { key: 'depreciation', label: 'Depreciation (₹)' },
      { key: 'interest_expense', label: 'Total interest expense (₹)' },
    ],
  },
  {
    title: 'Debt servicing (drives DSCR)', fields: [
      { key: 'interest_on_term_loan', label: 'Interest on term loan (₹)' },
      { key: 'principal_repayment', label: 'Annual principal repayment (₹)' },
    ],
  },
  {
    title: 'Balance sheet', fields: [
      { key: 'current_assets', label: 'Current assets (₹)' },
      { key: 'current_liabilities', label: 'Current liabilities (₹)' },
      { key: 'inventory', label: 'Inventory (₹)' },
      { key: 'sundry_debtors', label: 'Sundry debtors (₹)' },
      { key: 'sundry_creditors', label: 'Sundry creditors (₹)' },
      { key: 'total_outside_liabilities', label: 'Total outside liabilities (₹)' },
      { key: 'tangible_net_worth', label: 'Tangible net worth (₹)' },
    ],
  },
  {
    title: 'Banking & credit', fields: [
      { key: 'declared_bank_statement_credits', label: 'Bank statement credits — annual (₹)' },
      { key: 'bounces_per_month', label: 'Cheque bounces per month' },
      { key: 'days_past_due', label: 'Days past due (worst loan)' },
      { key: 'cibil_score', label: 'CIBIL score (300–900)' },
    ],
  },
  {
    title: 'Readiness (0–100)', fields: [
      { key: 'docs_ready_pct', label: 'Document readiness %' },
      { key: 'compliance_pct', label: 'Compliance %' },
    ],
  },
];
const FIN_KEYS = FIN_GROUPS.flatMap((g) => g.fields.map((f) => f.key));

const inputCls = 'inp w-full rounded-lg border bg-white/80 px-3 py-2.5 text-sm outline-none transition-shadow';
const inputStyle: CSSProperties = { borderColor: C.border, color: C.text };

// Button gloss as inline styles (hardcoded hex, no CSS-var/class dependency) so
// they always render even if the stylesheet chunk is stale in dev.
const navyBtnStyle: CSSProperties = {
  background: 'linear-gradient(180deg, #103F6B 0%, #0B2E4F 100%)', color: '#fff',
  boxShadow: '0 6px 16px -6px rgba(11,46,79,0.5), inset 0 1px 0 rgba(255,255,255,0.18)',
};
const tealBtnStyle: CSSProperties = {
  background: 'linear-gradient(180deg, #14B8A6 0%, #0F766E 100%)', color: '#fff',
  boxShadow: '0 6px 16px -6px rgba(15,118,110,0.55), inset 0 1px 0 rgba(255,255,255,0.25)',
};
const disabledBtnStyle: CSSProperties = { background: C.muted, color: '#fff' };
const inr = (v: number | string | null | undefined) => `₹${Number(v || 0).toLocaleString('en-IN')}`;
const toNum = (v: string) => (v.trim() === '' ? 0 : Number(v));

export default function ConsolePage() {
  const params = useParams<{ msmeId: string }>();
  const routeId = (params?.msmeId as string) || '';

  // manualId is only used on the fallback screen (no route id). When a route id
  // exists it always wins — so we never mirror routeId into state via an effect.
  const [manualId, setManualId] = useState('');
  const msmeId = routeId || manualId;

  const [tab, setTab] = useState<Tab>('financials');
  const [company, setCompany] = useState<string | null>(null);
  const [owner, setOwner] = useState<string | null>(null);

  const [fin, setFin] = useState<Record<string, string>>(() =>
    Object.fromEntries(FIN_KEYS.map((k) => [k, ''])));
  const [period, setPeriod] = useState({
    period_label: '', period_year: String(new Date().getFullYear()), period_month: '',
  });

  const [debtors, setDebtors] = useState<Debtor[]>([]);
  const [creditors, setCreditors] = useState<Creditor[]>([]);
  const [newDebtor, setNewDebtor] = useState({ name: '', amount_outstanding: '', days_outstanding: '' });
  const [newCreditor, setNewCreditor] = useState({ name: '', amount_due: '', due_date: '' });

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg | null>(null);
  const [score, setScore] = useState<ScoreState | null>(null);

  const load = useCallback(async (id: string) => {
    if (!id) return;
    try {
      const d = await getEntry(id);
      setMsg(null); // after await — not a synchronous setState in the effect
      setCompany(d.company);
      setOwner(d.owner);
      setDebtors(d.debtors || []);
      setCreditors(d.creditors || []);
      const f = d.financials;
      if (f) {
        setFin(Object.fromEntries(FIN_KEYS.map((k) => [k, f[k] != null ? String(f[k]) : ''])));
        setPeriod({
          period_label: f.period_label || '',
          period_year: f.period_year ? String(f.period_year) : String(new Date().getFullYear()),
          period_month: f.period_month ? String(f.period_month) : '',
        });
      }
    } catch (e) {
      setMsg({ kind: 'err', text: `Couldn't load this client: ${(e as Error).message}` });
    }
  }, []);

  // Load whenever the route id changes. React's official fetch-in-effect shape:
  // the async fn lives INSIDE the effect and sets state only after the await, with
  // an `ignore` guard for stale updates. (The rule rejects calling an external
  // state-setting function synchronously from an effect — hence inlined here.)
  useEffect(() => {
    if (!routeId) return;
    let ignore = false;
    async function run() {
      try {
        const d = await getEntry(routeId);
        if (ignore) return;
        setMsg(null);
        setCompany(d.company);
        setOwner(d.owner);
        setDebtors(d.debtors || []);
        setCreditors(d.creditors || []);
        const f = d.financials;
        if (f) {
          setFin(Object.fromEntries(FIN_KEYS.map((k) => [k, f[k] != null ? String(f[k]) : ''])));
          setPeriod({
            period_label: f.period_label || '',
            period_year: f.period_year ? String(f.period_year) : String(new Date().getFullYear()),
            period_month: f.period_month ? String(f.period_month) : '',
          });
        }
      } catch (e) {
        if (!ignore) setMsg({ kind: 'err', text: `Couldn't load this client: ${(e as Error).message}` });
      }
    }
    run();
    return () => { ignore = true; };
  }, [routeId]);

  async function onSaveFinancials() {
    setBusy(true);
    setMsg(null);
    try {
      const body: Record<string, number | string | null> = {
        period_label: period.period_label || null,
        period_year: period.period_year ? Number(period.period_year) : null,
        period_month: period.period_month ? Number(period.period_month) : null,
        ...Object.fromEntries(FIN_KEYS.map((k) => [k, toNum(fin[k])])),
      };
      const res = await saveFinancials(msmeId, body);
      const s = res.score;
      setScore({ score: s.score, band: s.band, delta: s.delta });
      setMsg({ kind: 'ok', text: `Saved. Score recomputed: ${s.score}/100 (${s.band}).` });
    } catch (e) {
      setMsg({ kind: 'err', text: `Save failed: ${(e as Error).message}` });
    } finally {
      setBusy(false);
    }
  }

  async function onAddDebtor() {
    if (!newDebtor.name.trim()) { setMsg({ kind: 'err', text: 'Enter a customer name.' }); return; }
    setBusy(true);
    setMsg(null);
    try {
      await saveDebtor(msmeId, {
        name: newDebtor.name.trim(),
        amount_outstanding: toNum(newDebtor.amount_outstanding),
        days_outstanding: Number(newDebtor.days_outstanding || 0),
      });
      setNewDebtor({ name: '', amount_outstanding: '', days_outstanding: '' });
      await load(msmeId);
      setMsg({ kind: 'ok', text: 'Customer added.' });
    } catch (e) {
      setMsg({ kind: 'err', text: `Save failed: ${(e as Error).message}` });
    } finally {
      setBusy(false);
    }
  }

  async function onAddCreditor() {
    if (!newCreditor.name.trim()) { setMsg({ kind: 'err', text: 'Enter a supplier name.' }); return; }
    setBusy(true);
    setMsg(null);
    try {
      await saveCreditor(msmeId, {
        name: newCreditor.name.trim(),
        amount_due: toNum(newCreditor.amount_due),
        due_date: newCreditor.due_date || null,
      });
      setNewCreditor({ name: '', amount_due: '', due_date: '' });
      await load(msmeId);
      setMsg({ kind: 'ok', text: 'Supplier added.' });
    } catch (e) {
      setMsg({ kind: 'err', text: `Save failed: ${(e as Error).message}` });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ color: C.text }} className="min-h-screen">
      {/* Glossy sticky top bar */}
      <header
        style={{
          background:
            'linear-gradient(180deg, rgba(255,255,255,0.10), rgba(255,255,255,0) 42%),' +
            'linear-gradient(135deg, #0B2E4F 0%, #103F6B 60%, #0D3354 100%)',
        }}
        className="sticky top-0 z-30 px-4 sm:px-6 py-4 shadow-lg shadow-[#0b2e4f]/30">
        <div className="mx-auto max-w-5xl flex items-center justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <div style={{ color: '#fff' }} className="text-base sm:text-lg font-bold tracking-tight truncate">
              {company || 'CFO Data Entry Console'}
            </div>
            <div style={{ color: '#5eead4' }} className="text-[11px] sm:text-xs font-semibold truncate">
              {owner ? `${owner} · ` : ''}{msmeId ? `MSME ${msmeId.slice(0, 8)}…` : 'No client selected'}
            </div>
          </div>
          {score && (
            <div style={{ background: '#ffffff1a', color: '#fff' }}
              className="rounded-xl px-4 py-2 text-right backdrop-blur shadow-inner rise">
              <div className="text-2xl font-extrabold leading-none tabular-nums">{score.score}<span className="text-sm font-semibold">/100</span></div>
              <div style={{ color: '#5eead4' }} className="text-[11px] font-bold uppercase tracking-wide">
                {score.band}{score.delta != null ? ` · ${score.delta >= 0 ? '↑' : '↓'}${Math.abs(score.delta)}` : ''}
              </div>
            </div>
          )}
        </div>
      </header>

      <div className="mx-auto max-w-5xl">
        {/* Client id helper (until the multi-client picker exists) */}
        {!routeId && (
          <div className="glass mx-4 sm:mx-6 mt-4 rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-2">
            <input
              className={inputCls} style={{ ...inputStyle, maxWidth: 360 }}
              placeholder="Paste an MSME id to load" value={manualId}
              onChange={(e) => setManualId(e.target.value)}
            />
            <button onClick={() => load(manualId)} style={navyBtnStyle} className="rounded-lg px-4 py-2.5 text-sm font-semibold transition-transform active:translate-y-px">
              Load client
            </button>
          </div>
        )}

        {/* Tabs — horizontally scrollable on small screens */}
        <div className="glass mx-4 sm:mx-6 mt-4 rounded-xl px-2 overflow-x-auto">
          <div className="flex min-w-max">
            <TabBtn id="financials" label="Financials" active={tab} onSelect={setTab} />
            <TabBtn id="debtors" label={`Money In (${debtors.length})`} active={tab} onSelect={setTab} />
            <TabBtn id="creditors" label={`Money Out (${creditors.length})`} active={tab} onSelect={setTab} />
          </div>
        </div>

        {/* Message banner */}
        {msg && (
          <div className="px-4 sm:px-6 pt-4">
            <div
              style={{
                background: msg.kind === 'ok' ? C.greenBg : '#FEF2F2',
                color: msg.kind === 'ok' ? C.green : C.red,
                borderColor: msg.kind === 'ok' ? '#A7F3D0' : '#FECACA',
              }}
              className="rounded-xl border px-4 py-2.5 text-sm font-medium rise"
            >
              {msg.text}
            </div>
          </div>
        )}

        <main className="px-4 sm:px-6 py-6">
          {/* FINANCIALS */}
          {tab === 'financials' && (
            <section className="space-y-5 rise">
              <div className="card-gloss rounded-2xl p-4 sm:p-5">
                <div style={{ color: C.sub }} className="text-xs font-bold uppercase tracking-wide mb-3">Reporting period</div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Field label="Label (e.g. FY 2025-26)">
                    <input className={inputCls} style={inputStyle} value={period.period_label}
                      onChange={(e) => setPeriod({ ...period, period_label: e.target.value })} />
                  </Field>
                  <Field label="Year">
                    <input className={inputCls} style={inputStyle} inputMode="numeric" value={period.period_year}
                      onChange={(e) => setPeriod({ ...period, period_year: e.target.value })} />
                  </Field>
                  <Field label="Month (1-12, optional)">
                    <input className={inputCls} style={inputStyle} inputMode="numeric" value={period.period_month}
                      onChange={(e) => setPeriod({ ...period, period_month: e.target.value })} />
                  </Field>
                </div>
              </div>

              {FIN_GROUPS.map((g) => (
                <div key={g.title} className="card-gloss rounded-2xl p-4 sm:p-5">
                  <div style={{ color: C.sub }} className="text-xs font-bold uppercase tracking-wide mb-3">{g.title}</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {g.fields.map((f) => (
                      <Field key={f.key} label={f.label}>
                        <input
                          className={inputCls} style={inputStyle} inputMode="numeric"
                          value={fin[f.key]} onChange={(e) => setFin({ ...fin, [f.key]: e.target.value })}
                        />
                      </Field>
                    ))}
                  </div>
                </div>
              ))}

              <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-1">
                <button
                  onClick={onSaveFinancials} disabled={busy || !msmeId}
                  style={busy || !msmeId ? disabledBtnStyle : tealBtnStyle}
                  className="w-full sm:w-auto rounded-xl px-6 py-3 text-sm font-bold transition-transform active:translate-y-px disabled:cursor-not-allowed"
                >
                  {busy ? 'Saving…' : 'Save & recompute score'}
                </button>
                <span style={{ color: C.muted }} className="text-xs">
                  Enter all amounts in rupees. Saving recomputes this client&apos;s health score instantly.
                </span>
              </div>
            </section>
          )}

          {/* DEBTORS / MONEY IN */}
          {tab === 'debtors' && (
            <section className="space-y-5 rise">
              <ListCard<Debtor>
                rows={debtors}
                cols={[
                  { h: 'Customer', get: (r) => r.name, primary: true },
                  { h: 'Outstanding', get: (r) => inr(r.amount_outstanding) },
                  { h: 'Days', get: (r) => r.days_outstanding ?? '—' },
                  { h: 'Status', get: (r) => r.status ?? '—' },
                ]}
                empty="No customers yet. Add the first receivable below."
              />
              <AddCard title="Add a customer (receivable)">
                <input className={inputCls} style={{ ...inputStyle, maxWidth: 220 }} placeholder="Customer name"
                  value={newDebtor.name} onChange={(e) => setNewDebtor({ ...newDebtor, name: e.target.value })} />
                <input className={inputCls} style={{ ...inputStyle, maxWidth: 200 }} inputMode="numeric" placeholder="Amount outstanding (₹)"
                  value={newDebtor.amount_outstanding} onChange={(e) => setNewDebtor({ ...newDebtor, amount_outstanding: e.target.value })} />
                <input className={inputCls} style={{ ...inputStyle, maxWidth: 160 }} inputMode="numeric" placeholder="Days outstanding"
                  value={newDebtor.days_outstanding} onChange={(e) => setNewDebtor({ ...newDebtor, days_outstanding: e.target.value })} />
                <button onClick={onAddDebtor} disabled={busy} style={navyBtnStyle} className="w-full sm:w-auto rounded-lg px-5 py-2.5 text-sm font-semibold transition-transform active:translate-y-px disabled:opacity-60">Add customer</button>
              </AddCard>
            </section>
          )}

          {/* CREDITORS / MONEY OUT */}
          {tab === 'creditors' && (
            <section className="space-y-5 rise">
              <ListCard<Creditor>
                rows={creditors}
                cols={[
                  { h: 'Supplier', get: (r) => r.name, primary: true },
                  { h: 'Amount due', get: (r) => inr(r.amount_due) },
                  { h: 'Due date', get: (r) => r.due_date ?? '—' },
                ]}
                empty="No suppliers yet. Add the first payable below."
              />
              <AddCard title="Add a supplier (payable)">
                <input className={inputCls} style={{ ...inputStyle, maxWidth: 220 }} placeholder="Supplier name"
                  value={newCreditor.name} onChange={(e) => setNewCreditor({ ...newCreditor, name: e.target.value })} />
                <input className={inputCls} style={{ ...inputStyle, maxWidth: 200 }} inputMode="numeric" placeholder="Amount due (₹)"
                  value={newCreditor.amount_due} onChange={(e) => setNewCreditor({ ...newCreditor, amount_due: e.target.value })} />
                <input className={inputCls} style={{ ...inputStyle, maxWidth: 180 }} type="date"
                  value={newCreditor.due_date} onChange={(e) => setNewCreditor({ ...newCreditor, due_date: e.target.value })} />
                <button onClick={onAddCreditor} disabled={busy} style={navyBtnStyle} className="w-full sm:w-auto rounded-lg px-5 py-2.5 text-sm font-semibold transition-transform active:translate-y-px disabled:opacity-60">Add supplier</button>
              </AddCard>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}

// ── Components declared at module scope (not inside render) ──────────────────
function TabBtn({ id, label, active, onSelect }: { id: Tab; label: string; active: Tab; onSelect: (t: Tab) => void }) {
  const isActive = active === id;
  return (
    <button
      onClick={() => onSelect(id)}
      style={{
        color: isActive ? C.navy : C.muted,
        borderBottomColor: isActive ? C.teal : 'transparent',
        fontWeight: isActive ? 800 : 600,
      }}
      className="whitespace-nowrap px-4 py-3 text-sm border-b-2 -mb-px transition-colors"
    >
      {label}
    </button>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span style={{ color: C.sub }} className="block text-xs font-semibold mb-1">{label}</span>
      {children}
    </label>
  );
}

function ListCard<T>({ rows, cols, empty }: {
  rows: T[]; cols: { h: string; get: (r: T) => ReactNode; primary?: boolean }[]; empty: string;
}) {
  if (rows.length === 0) {
    return (
      <div className="card-gloss rounded-2xl px-4 py-8 text-center" style={{ color: C.muted }}>{empty}</div>
    );
  }
  return (
    <>
      {/* Mobile: stacked cards */}
      <div className="space-y-3 sm:hidden">
        {rows.map((r, i) => (
          <div key={i} className="card-gloss rounded-2xl p-4">
            <div style={{ color: C.navy }} className="font-bold mb-2">{cols.find((c) => c.primary)?.get(r) ?? cols[0].get(r)}</div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
              {cols.filter((c) => !c.primary).map((c) => (
                <div key={c.h} className="flex flex-col">
                  <dt style={{ color: C.muted }} className="text-[11px] font-semibold uppercase tracking-wide">{c.h}</dt>
                  <dd style={{ color: C.text }} className="tabular-nums">{c.get(r)}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>

      {/* Tablet / desktop: table */}
      <div className="hidden sm:block card-gloss rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'linear-gradient(180deg,#F8FAFC,#EEF3FA)', color: C.sub }}>
                {cols.map((c) => <th key={c.h} className="text-left font-semibold px-4 py-2.5">{c.h}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} style={{ borderTop: '1px solid #EEF2F8' }} className="transition-colors hover:bg-[#F5F9FE]">
                  {cols.map((c) => <td key={c.h} className="px-4 py-3 tabular-nums" style={{ color: C.text }}>{c.get(r)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function AddCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="card-gloss rounded-2xl p-4 sm:p-5">
      <div style={{ color: C.sub }} className="text-xs font-bold uppercase tracking-wide mb-3">{title}</div>
      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3">{children}</div>
    </div>
  );
}
