'use client';
// app/console/page.tsx — Portfolio triage dashboard (spec §3).
// Lists every client from GET /msme/clients with aggregate widgets, search + filters,
// sortable columns, and per-row quick actions (open · report · WhatsApp · email).
// Falls back to bundled demo data behind a banner when no backend is reachable.

import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { listClients, downloadDocument, type ClientRow } from '../lib/api';

const C = {
  navy: '#0B2E4F', navy2: '#103F6B', teal: '#0F766E', teal2: '#14B8A6',
  bg: '#EEF3FA', surface: '#FFFFFF', border: '#E2EAF4', text: '#0F172A',
  sub: '#475569', muted: '#94A3B8', green: '#059669', amber: '#D97706', red: '#DC2626',
};

// Demo rows for the no-backend banner state — a spread of bands/risk so the UI reads.
const DEMO_CLIENTS: ClientRow[] = [
  { id: 'demo-1', company: 'Sri Sai Interiors', owner: 'Gopal Vimalraj', sector: 'Interiors / fit-out', msme_class: 'Micro', turnover: 24444909, health_score: 84, bank_readiness_score: 85, green_eligibility_score: 60, band: 'EXCELLENT', provisional: false, data_completeness: 100, score_delta: 1, risk: 'none', last_update: '2026-06-30' },
  { id: 'demo-2', company: 'Anjali Textiles', owner: 'Anjali Rao', sector: 'Textiles', msme_class: 'Small', turnover: 71200000, health_score: 67, bank_readiness_score: 64, green_eligibility_score: 55, band: 'GOOD', provisional: true, data_completeness: 70, score_delta: -2, risk: 'yellow', last_update: '2026-06-22' },
  { id: 'demo-3', company: 'Coastal Marine Exports', owner: 'Iqbal Khan', sector: 'Exports', msme_class: 'Medium', turnover: 184500000, health_score: 52, bank_readiness_score: 50, green_eligibility_score: 78, band: 'MEDIUM', provisional: true, data_completeness: 55, score_delta: 4, risk: 'yellow', last_update: '2026-06-18' },
  { id: 'demo-4', company: 'Vetri Auto Components', owner: 'M. Vetrivel', sector: 'Engineering', msme_class: 'Small', turnover: 38900000, health_score: 36, bank_readiness_score: 33, green_eligibility_score: 41, band: 'POOR', provisional: true, data_completeness: 40, score_delta: -5, risk: 'red', last_update: '2026-06-10' },
];

const bandMeta = (band?: string) => {
  switch (band) {
    case 'EXCELLENT': return { letter: 'A', color: C.green, bg: '#ECFDF5', label: 'Excellent' };
    case 'GOOD': return { letter: 'B', color: C.teal, bg: '#ECFDFA', label: 'Good' };
    case 'MEDIUM': return { letter: 'C', color: C.amber, bg: '#FFFBEB', label: 'Medium' };
    case 'POOR': return { letter: 'D', color: C.red, bg: '#FEF2F2', label: 'Poor' };
    default: return { letter: '—', color: C.muted, bg: '#F1F5F9', label: '—' };
  }
};
const riskColor = (risk?: string) => (risk === 'red' ? C.red : risk === 'yellow' ? C.amber : C.green);
const riskLabel = (risk?: string) => (risk === 'red' ? 'High' : risk === 'yellow' ? 'Watch' : 'OK');
const inrCr = (v?: number | null) => (v ? `₹${(v / 1e7).toFixed(2)} Cr` : '—');
const fmtDate = (s?: string) => {
  if (!s) return '—';
  const d = new Date(s);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' });
};

// Stale-data triage (spec §3.2): a client whose data hasn't been refreshed in >14 days.
const STALE_DAYS = 14;
const daysSince = (s?: string): number | null => {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : Math.floor((Date.now() - d.getTime()) / 86_400_000);
};
const isStale = (s?: string) => {
  const n = daysSince(s);
  return n != null && n > STALE_DAYS;
};
const digits = (s?: string) => (s || '').replace(/\D/g, '');

type SortKey = 'company' | 'sector' | 'turnover' | 'health_score' | 'bank_readiness_score' | 'green_eligibility_score' | 'data_completeness' | 'score_delta' | 'last_update';
const sortVal = (c: ClientRow, k: SortKey): string | number => {
  switch (k) {
    case 'company': return (c.company || '').toLowerCase();
    case 'sector': return (c.sector || '').toLowerCase();
    case 'turnover': return c.turnover || 0;
    case 'health_score': return c.health_score ?? -1;
    case 'bank_readiness_score': return c.bank_readiness_score ?? -1;
    case 'green_eligibility_score': return c.green_eligibility_score ?? -1;
    case 'data_completeness': return c.data_completeness ?? -1;
    case 'score_delta': return c.score_delta ?? 0;
    case 'last_update': return c.last_update ? new Date(c.last_update).getTime() : 0;
  }
};
// Colour a 0-100 score by band (Health / Bank-Ready / Green share this scale).
const scoreColor = (n?: number | null) =>
  n == null ? C.muted : n >= 80 ? C.green : n >= 60 ? C.teal : n >= 40 ? C.amber : C.red;

export default function ConsoleDashboard() {
  const router = useRouter();
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [demo, setDemo] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [q, setQ] = useState('');
  const [band, setBand] = useState('all');
  const [risk, setRisk] = useState('all');
  const [sector, setSector] = useState('all');
  const [freshness, setFreshness] = useState('all');   // 'all' | 'stale'
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'health_score', dir: 'desc' });

  useEffect(() => {
    let ignore = false;
    listClients()
      .then((d) => { if (!ignore) { setClients(d.clients || []); setLoading(false); } })
      .catch(() => { if (!ignore) { setClients(DEMO_CLIENTS); setDemo(true); setLoading(false); } });
    return () => { ignore = true; };
  }, []);

  const sectors = useMemo(
    () => Array.from(new Set(clients.map((c) => c.sector).filter(Boolean))).sort() as string[],
    [clients],
  );

  const filtered = useMemo(() => {
    const rows = clients.filter((c) => {
      if (q && !`${c.company} ${c.owner ?? ''}`.toLowerCase().includes(q.toLowerCase())) return false;
      if (band !== 'all' && c.band !== band) return false;
      if (risk !== 'all' && (c.risk ?? 'none') !== risk) return false;
      if (sector !== 'all' && c.sector !== sector) return false;
      if (freshness === 'stale' && !isStale(c.last_update)) return false;
      return true;
    });
    const { key, dir } = sort;
    return [...rows].sort((a, b) => {
      const av = sortVal(a, key), bv = sortVal(b, key);
      const cmp = typeof av === 'number' && typeof bv === 'number'
        ? av - bv
        : String(av).localeCompare(String(bv));
      return dir === 'asc' ? cmp : -cmp;
    });
  }, [clients, q, band, risk, sector, freshness, sort]);

  const agg = useMemo(() => {
    const rows = filtered;
    const scored = rows.filter((r) => r.health_score != null);
    return {
      n: rows.length,
      avg: scored.length ? Math.round(scored.reduce((s, r) => s + (r.health_score || 0), 0) / scored.length) : 0,
      certified: rows.filter((r) => r.provisional === false).length,
      provisional: rows.filter((r) => r.provisional).length,
      turnover: rows.reduce((s, r) => s + (r.turnover || 0), 0),
      green: rows.filter((r) => (r.risk ?? 'none') === 'none').length,
      yellow: rows.filter((r) => r.risk === 'yellow').length,
      red: rows.filter((r) => r.risk === 'red').length,
      stale: rows.filter((r) => isStale(r.last_update)).length,
    };
  }, [filtered]);

  const toggleSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'company' || key === 'sector' ? 'asc' : 'desc' }));

  async function onReport(id: string) {
    if (demo) { setToast('Connect the backend to generate reports.'); return; }
    setBusyId(id);
    setToast(null);
    try {
      await downloadDocument(id, 'health');
    } catch (e) {
      setToast(`Report failed: ${(e as Error).message}`);
    } finally {
      setBusyId(null);
    }
  }

  const resetFilters = () => { setQ(''); setBand('all'); setRisk('all'); setSector('all'); setFreshness('all'); };
  const filtersActive = q || band !== 'all' || risk !== 'all' || sector !== 'all' || freshness !== 'all';

  return (
    <div style={{ color: C.text }} className="min-h-screen pb-16">
      {/* HEADER */}
      <header className="hero-navy relative px-5 sm:px-8 py-5">
        <div className="mx-auto max-w-7xl flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex items-center gap-3">
            <div style={{ background: `linear-gradient(180deg, ${C.teal2}, ${C.teal})` }}
              className="w-9 h-9 rounded-lg grid place-items-center font-extrabold text-[#06231F]">M</div>
            <div>
              <div className="text-white font-extrabold leading-none">MFOS</div>
              <div style={{ color: '#7FE3D4' }} className="text-[10px] font-bold tracking-widest uppercase mt-0.5">Portfolio</div>
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-white text-lg font-extrabold leading-tight">Client Portfolio</h1>
            <div style={{ color: '#9FC6E6' }} className="text-xs font-medium">
              {loading ? 'Loading…' : `${clients.length} client${clients.length === 1 ? '' : 's'} · credit-readiness triage`}
            </div>
          </div>
          <Link
            href="/console/analytics"
            className="rounded-lg px-3.5 py-2 text-sm font-semibold text-white"
            style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.18)' }}
          >
            📊 Analytics
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        {demo && (
          <div className="mt-4 rounded-xl border px-4 py-2.5 text-sm font-medium"
            style={{ background: '#FFFBEB', color: '#92400E', borderColor: '#FDE68A' }}>
            Showing demo data — the backend at <code>/msme/clients</code> wasn&apos;t reachable.
          </div>
        )}
        {toast && (
          <div className="mt-4 rounded-xl border px-4 py-2.5 text-sm font-medium rise"
            style={{ background: '#FEF2F2', color: C.red, borderColor: '#FECACA' }}>{toast}</div>
        )}

        {/* AGGREGATE WIDGETS */}
        <section className="mt-5 grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
          <Stat label="Clients" value={String(agg.n)} sub={filtersActive ? 'in view' : 'total'} />
          <Stat label="Avg health" value={String(agg.avg)} sub="/ 100" />
          <Stat label="Certified" value={String(agg.certified)} sub="bank-ready" color={C.green} />
          <Stat label="Provisional" value={String(agg.provisional)} sub="need evidence" color={C.amber} />
          <Stat label="Portfolio turnover" value={inrCr(agg.turnover)} sub="combined" />
          <Stat
            label="Stale data" value={String(agg.stale)} sub={`> ${STALE_DAYS} days`}
            color={agg.stale ? C.amber : C.green}
            onClick={agg.stale ? () => setFreshness((f) => (f === 'stale' ? 'all' : 'stale')) : undefined}
            active={freshness === 'stale'}
          />
          <Stat label="Risk split" sub="OK · watch · high" custom={
            <div className="flex items-center gap-2 mt-1">
              <RiskCount n={agg.green} color={C.green} />
              <RiskCount n={agg.yellow} color={C.amber} />
              <RiskCount n={agg.red} color={C.red} />
            </div>
          } />
        </section>

        {/* FILTER BAR */}
        <section className="glass mt-4 rounded-xl px-3 py-3 flex flex-wrap items-center gap-2">
          <input
            value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Search company or owner…"
            className="inp rounded-lg border bg-white/80 px-3 py-2 text-sm outline-none flex-1 min-w-[180px]"
            style={{ borderColor: C.border }}
          />
          <Select value={band} onChange={setBand} options={[['all', 'All bands'], ['EXCELLENT', 'A · Excellent'], ['GOOD', 'B · Good'], ['MEDIUM', 'C · Medium'], ['POOR', 'D · Poor']]} />
          <Select value={risk} onChange={setRisk} options={[['all', 'All risk'], ['none', 'OK'], ['yellow', 'Watch'], ['red', 'High']]} />
          <Select value={sector} onChange={setSector} options={[['all', 'All sectors'], ...sectors.map((s) => [s, s])]} />
          <Select value={freshness} onChange={setFreshness} options={[['all', 'All data'], ['stale', `Stale > ${STALE_DAYS}d`]]} />
          {filtersActive && (
            <button onClick={resetFilters} className="text-sm font-semibold px-3 py-2 rounded-lg" style={{ color: C.sub }}>Reset</button>
          )}
        </section>

        {/* TABLE */}
        <section className="mt-4 card-gloss card-static rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ minWidth: 900 }}>
              <thead>
                <tr style={{ background: 'linear-gradient(180deg,#F8FAFC,#EEF3FA)', color: C.sub }}>
                  <Th onClick={() => toggleSort('company')} sort={sort} k="company" align="left">Client</Th>
                  <Th onClick={() => toggleSort('sector')} sort={sort} k="sector" align="left">Sector</Th>
                  <Th onClick={() => toggleSort('turnover')} sort={sort} k="turnover">Turnover</Th>
                  <Th onClick={() => toggleSort('health_score')} sort={sort} k="health_score">Health</Th>
                  <th className="px-3 py-2.5 text-center font-semibold">Band</th>
                  <Th onClick={() => toggleSort('bank_readiness_score')} sort={sort} k="bank_readiness_score">Bank-ready</Th>
                  <Th onClick={() => toggleSort('green_eligibility_score')} sort={sort} k="green_eligibility_score">Green</Th>
                  <th className="px-3 py-2.5 text-center font-semibold">Risk</th>
                  <Th onClick={() => toggleSort('data_completeness')} sort={sort} k="data_completeness">Complete</Th>
                  <Th onClick={() => toggleSort('score_delta')} sort={sort} k="score_delta">Δ</Th>
                  <Th onClick={() => toggleSort('last_update')} sort={sort} k="last_update">Updated</Th>
                  <th className="px-3 py-2.5 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={12} className="px-4 py-12 text-center" style={{ color: C.muted }}>Loading clients…</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={12} className="px-4 py-12 text-center" style={{ color: C.muted }}>
                    {clients.length === 0 ? 'No clients yet.' : 'No clients match these filters.'}
                  </td></tr>
                ) : filtered.map((c) => {
                  const bm = bandMeta(c.band);
                  const delta = c.score_delta;
                  return (
                    <tr key={c.id}
                      onClick={() => router.push(`/console/${c.id}`)}
                      style={{ borderTop: `1px solid ${C.border}`, cursor: 'pointer' }}
                      className="transition-colors hover:bg-[#F5F9FE]">
                      <td className="px-3 py-3">
                        <div className="font-bold" style={{ color: C.navy }}>{c.company}</div>
                        <div className="text-xs" style={{ color: C.muted }}>{c.owner || '—'}{c.msme_class ? ` · ${c.msme_class}` : ''}</div>
                      </td>
                      <td className="px-3 py-3" style={{ color: C.sub }}>{c.sector || '—'}</td>
                      <td className="px-3 py-3 text-right num" style={{ color: C.text }}>{inrCr(c.turnover)}</td>
                      <td className="px-3 py-3 text-right num font-bold" style={{ color: bm.color }}>
                        {c.health_score ?? '—'}
                        {c.provisional && <span title="Provisional — not yet certified" style={{ color: C.amber }}> ⚠</span>}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className="pill" style={{ color: bm.color, background: bm.bg }}>{bm.letter}</span>
                      </td>
                      <td className="px-3 py-3 text-right num font-bold" style={{ color: scoreColor(c.bank_readiness_score) }}>
                        {c.bank_readiness_score ?? '—'}
                      </td>
                      <td className="px-3 py-3 text-right num font-bold" style={{ color: scoreColor(c.green_eligibility_score) }}
                        title="Green eligibility — indicative (refine with energy/export data)">
                        {c.green_eligibility_score ?? '—'}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold" style={{ color: riskColor(c.risk) }}>
                          <span className="w-2 h-2 rounded-full" style={{ background: riskColor(c.risk) }} />{riskLabel(c.risk)}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2 justify-end">
                          <div className="w-12 h-1.5 rounded-full overflow-hidden" style={{ background: '#E8EEF6' }}>
                            <div style={{ width: `${c.data_completeness ?? 0}%`, height: '100%', background: (c.data_completeness ?? 0) >= 80 ? C.green : C.amber }} />
                          </div>
                          <span className="num text-xs" style={{ color: C.sub }}>{c.data_completeness ?? '—'}%</span>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right num font-semibold"
                        style={{ color: delta == null || delta === 0 ? C.muted : delta > 0 ? C.green : C.red }}>
                        {delta == null ? '—' : delta > 0 ? `+${delta}` : String(delta)}
                      </td>
                      <td className="px-3 py-3 text-right num text-xs" style={{ color: isStale(c.last_update) ? C.amber : C.sub }}>
                        {fmtDate(c.last_update)}
                        {isStale(c.last_update) && <span title={`Not updated in ${daysSince(c.last_update)} days`}> ⚠</span>}
                      </td>
                      <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          <ActionBtn title="Open deep-dive" onClick={() => router.push(`/console/${c.id}`)}>Open</ActionBtn>
                          <ActionBtn title="Download Health Report" busy={busyId === c.id} onClick={() => onReport(c.id)}>
                            {busyId === c.id ? '…' : 'Report'}
                          </ActionBtn>
                          <IconBtn title={c.phone ? `Call ${c.phone}` : 'No phone on file'} disabled={!c.phone}
                            onClick={() => c.phone && (window.location.href = `tel:${digits(c.phone)}`)} color={C.teal}>☎</IconBtn>
                          <IconBtn title={c.phone ? `WhatsApp ${c.phone}` : 'No phone on file'} disabled={!c.phone}
                            onClick={() => c.phone && window.open(`https://wa.me/${digits(c.phone)}`, '_blank')} color="#25D366">WA</IconBtn>
                          <IconBtn title={c.email ? `Email ${c.email}` : 'No email on file'} disabled={!c.email}
                            onClick={() => c.email && (window.location.href = `mailto:${c.email}`)} color={C.navy2}>@</IconBtn>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}

/* ── sub-components ── */

function Stat({ label, value, sub, color, custom, onClick, active }: { label: string; value?: string; sub?: string; color?: string; custom?: ReactNode; onClick?: () => void; active?: boolean }) {
  return (
    <div
      onClick={onClick}
      className="card-gloss card-static tile-sheen relative rounded-2xl px-4 py-3 overflow-hidden"
      style={{
        cursor: onClick ? 'pointer' : undefined,
        outline: active ? `2px solid ${C.amber}` : undefined,
        outlineOffset: active ? -2 : undefined,
      }}
      title={onClick ? 'Filter to stale clients' : undefined}
    >
      <div className="eyebrow">{label}</div>
      {custom ?? <div className="font-extrabold num mt-1" style={{ fontSize: 22, color: color ?? C.navy }}>{value}</div>}
      {sub && <div className="text-[11px] mt-0.5" style={{ color: C.muted }}>{sub}</div>}
    </div>
  );
}

function RiskCount({ n, color }: { n: number; color: string }) {
  return (
    <span className="inline-flex items-center gap-1 font-extrabold num" style={{ fontSize: 16, color }}>
      <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />{n}
    </span>
  );
}

function Select({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[][] }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}
      className="inp rounded-lg border bg-white/80 px-3 py-2 text-sm outline-none" style={{ borderColor: C.border, color: C.text }}>
      {options.map((o) => <option key={o[0]} value={o[0]}>{o[1]}</option>)}
    </select>
  );
}

function Th({ children, onClick, sort, k, align = 'right' }: { children: ReactNode; onClick: () => void; sort: { key: string; dir: string }; k: string; align?: 'left' | 'right' }) {
  const active = sort.key === k;
  return (
    <th onClick={onClick}
      className={`px-3 py-2.5 font-semibold cursor-pointer select-none ${align === 'left' ? 'text-left' : 'text-right'}`}
      style={{ color: active ? C.navy : undefined }}>
      {children}<span style={{ opacity: active ? 1 : 0.25 }}>{active && sort.dir === 'asc' ? ' ▲' : ' ▼'}</span>
    </th>
  );
}

const actionBtnStyle: CSSProperties = { borderColor: C.border, color: C.navy };
function ActionBtn({ children, onClick, title, busy }: { children: ReactNode; onClick: () => void; title?: string; busy?: boolean }) {
  return (
    <button onClick={onClick} title={title} disabled={busy}
      className="rounded-lg border px-2.5 py-1.5 text-xs font-semibold bg-white/70 hover:bg-white transition-colors disabled:opacity-60"
      style={actionBtnStyle}>{children}</button>
  );
}

function IconBtn({ children, onClick, title, disabled, color }: { children: ReactNode; onClick: () => void; title?: string; disabled?: boolean; color: string }) {
  return (
    <button onClick={onClick} title={title} disabled={disabled}
      className="w-7 h-7 rounded-lg border grid place-items-center text-[10px] font-extrabold bg-white/70 transition-opacity disabled:opacity-30"
      style={{ borderColor: C.border, color }}>{children}</button>
  );
}
