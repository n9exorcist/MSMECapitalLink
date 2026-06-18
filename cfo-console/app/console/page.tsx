'use client';
// app/console/page.tsx  →  route: /console
// Multi-client triage dashboard (CFO Backend App spec §3). The front door:
// lists every client, click a row to open the deep dive at /console/[id].
// Fetches GET ${NEXT_PUBLIC_API_URL}/msme/clients; falls back to demo data
// (behind a banner) so the screen renders before the backend is wired.

import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';

const C = {
  navy: '#0B2E4F', teal: '#0F766E', bg: '#F0F5FA', surface: '#FFFFFF',
  border: '#E2EAF4', text: '#0F172A', sub: '#475569', muted: '#94A3B8',
  green: '#059669', amber: '#D97706', red: '#DC2626', amberBg: '#FFFBEB',
};

interface ClientRow {
  id: string;
  company: string;
  owner?: string | null;
  sector?: string | null;
  turnover?: number | null;     // rupees
  health_score?: number | null; // 0-100
  band?: string | null;
  last_update?: string | null;  // ISO date
  risk?: 'none' | 'yellow' | 'red' | null;
}

// Built from the real Sri Sai Interiors extraction (FY2024-25 audited).
const DEMO_CLIENTS: ClientRow[] = [
  {
    id: 'demo-sri-sai', company: 'Sri Sai Interiors', owner: 'Gopal Vimalraj',
    sector: 'Interior / Works contract', turnover: 24444909,
    health_score: 84, band: 'A', last_update: new Date().toISOString(), risk: 'yellow',
  },
];

const API = process.env.NEXT_PUBLIC_API_URL || '';

type SortKey = 'company' | 'sector' | 'turnover' | 'health_score' | 'last_update';

// score -> band letter + colour (A>=80, B 60-79, C 40-59, D <40)
function band(score: number | null | undefined): { letter: string; color: string } {
  const s = score ?? -1;
  if (s >= 80) return { letter: 'A', color: C.green };
  if (s >= 60) return { letter: 'B', color: C.teal };
  if (s >= 40) return { letter: 'C', color: C.amber };
  if (s >= 0) return { letter: 'D', color: C.red };
  return { letter: '—', color: C.muted };
}
function daysAgo(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(ms / 86400000));
}
function compactINR(v: number | null | undefined): string {
  const n = Number(v || 0);
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(2)} Cr`;
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(1)} L`;
  return `₹${n.toLocaleString('en-IN')}`;
}

export default function DashboardPage() {
  const router = useRouter();
  const [rows, setRows] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDemo, setIsDemo] = useState(false);
  const [q, setQ] = useState('');
  const [bandFilter, setBandFilter] = useState<'all' | 'A' | 'B' | 'C' | 'D'>('all');
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'health_score', dir: 'desc' });

  useEffect(() => {
    let ignore = false;
    async function run() {
      try {
        if (!API) throw new Error('no api url');
        const res = await fetch(`${API}/msme/clients`);
        if (!res.ok) throw new Error(`status ${res.status}`);
        const data = await res.json();
        const list: ClientRow[] = Array.isArray(data) ? data : (data.clients || []);
        if (ignore) return;
        if (list.length === 0) { setRows(DEMO_CLIENTS); setIsDemo(true); }
        else { setRows(list); setIsDemo(false); }
      } catch {
        if (ignore) return;
        setRows(DEMO_CLIENTS);
        setIsDemo(true);
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    run();
    return () => { ignore = true; };
  }, []);

  const view = useMemo(() => {
    let r = rows;
    if (q.trim()) {
      const needle = q.toLowerCase();
      r = r.filter((x) => (x.company || '').toLowerCase().includes(needle)
        || (x.sector || '').toLowerCase().includes(needle));
    }
    if (bandFilter !== 'all') r = r.filter((x) => band(x.health_score).letter === bandFilter);
    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...r].sort((a, b) => {
      const av = a[sort.key]; const bv = b[sort.key];
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });
  }, [rows, q, bandFilter, sort]);

  const total = rows.length;
  const attention = rows.filter((r) => r.risk === 'red' || r.risk === 'yellow').length;
  const avg = total ? Math.round(rows.reduce((s, r) => s + (r.health_score || 0), 0) / total) : 0;

  const toggleSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' }));

  return (
    <div style={{ color: C.text }} className="min-h-screen">
      {/* Glossy sticky header */}
      <header
        style={{
          background:
            'linear-gradient(180deg, rgba(255,255,255,0.10), rgba(255,255,255,0) 42%),' +
            'linear-gradient(135deg, #0B2E4F 0%, #103F6B 60%, #0D3354 100%)',
        }}
        className="sticky top-0 z-30 px-4 sm:px-6 py-4 shadow-lg shadow-[#0b2e4f]/30">
        <div className="mx-auto max-w-6xl flex items-center justify-between gap-3">
          <div>
            <div style={{ color: '#fff' }} className="text-base sm:text-lg font-bold tracking-tight">Client Portfolio</div>
            <div style={{ color: '#5eead4' }} className="text-[11px] sm:text-xs font-semibold">CFO Console · triage view</div>
          </div>
          <div style={{ background: '#ffffff1a', color: '#fff' }}
            className="hidden sm:block rounded-xl px-3 py-1.5 text-xs font-semibold backdrop-blur">
            {total} client{total === 1 ? '' : 's'}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl">
        {isDemo && (
          <div style={{ background: C.amberBg, color: C.amber, borderColor: '#FDE68A' }}
            className="mx-4 sm:mx-6 mt-4 rounded-xl border px-4 py-2.5 text-xs sm:text-sm font-medium">
            Demo data — no backend connected. Set <code>NEXT_PUBLIC_API_URL</code> and add <code>GET /msme/clients</code> to see live clients.
          </div>
        )}

        {/* Aggregate widgets */}
        <div className="px-4 sm:px-6 pt-5 grid grid-cols-2 sm:grid-cols-3 gap-3 rise">
          <StatCard label="Total clients" value={String(total)} />
          <StatCard label="Needing attention" value={String(attention)} accent={attention ? C.amber : C.muted} />
          <StatCard label="Avg health score" value={String(avg)} accent={band(avg).color} className="col-span-2 sm:col-span-1" />
        </div>

        {/* Filters */}
        <div className="px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2">
          <input
            value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Search name or sector…"
            style={{ borderColor: C.border, color: C.text }}
            className="inp w-full sm:max-w-xs rounded-xl border bg-white/80 px-3.5 py-2.5 text-sm outline-none transition-shadow"
          />
          <div className="flex flex-wrap gap-2">
            {(['all', 'A', 'B', 'C', 'D'] as const).map((b) => {
              const active = bandFilter === b;
              return (
                <button key={b} onClick={() => setBandFilter(b)}
                  style={{
                    background: active ? C.navy : 'rgba(255,255,255,0.8)',
                    color: active ? '#fff' : C.sub, borderColor: C.border,
                  }}
                  className={`rounded-xl border px-3.5 py-2 text-sm font-semibold transition-all ${active ? 'shadow-md shadow-[#0b2e4f]/25' : 'hover:bg-white'}`}>
                  {b === 'all' ? 'All' : `Band ${b}`}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Mobile: card list (tables don't fit on phones) ───────────── */}
        <div className="px-4 pb-10 space-y-3 md:hidden">
          {loading ? (
            <div style={{ color: C.muted }} className="card-gloss rounded-2xl px-4 py-10 text-center text-sm">Loading…</div>
          ) : view.length === 0 ? (
            <div style={{ color: C.muted }} className="card-gloss rounded-2xl px-4 py-10 text-center text-sm">No clients match.</div>
          ) : view.map((r) => {
            const b = band(r.health_score);
            const d = daysAgo(r.last_update);
            const stale = d != null && d > 14;
            return (
              <button key={r.id} onClick={() => router.push(`/console/${r.id}`)}
                className="card-gloss rounded-2xl w-full text-left px-4 py-3.5 flex items-center gap-3 active:scale-[0.99] transition-transform">
                <div className="flex-1 min-w-0">
                  <div style={{ color: C.navy }} className="font-bold truncate">{r.company}</div>
                  <div style={{ color: C.muted }} className="text-xs truncate">
                    {r.sector || '—'}{r.owner ? ` · ${r.owner}` : ''}
                  </div>
                  <div className="mt-1.5 flex items-center gap-3 text-xs">
                    <span style={{ color: C.text }} className="font-semibold">{compactINR(r.turnover)}</span>
                    <span style={{ color: stale ? C.red : C.muted }}>
                      {d == null ? '—' : d === 0 ? 'today' : `${d}d ago`}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col items-center gap-1.5">
                  <ScorePill score={r.health_score} b={b} />
                  <RiskDot risk={r.risk} />
                </div>
              </button>
            );
          })}
        </div>

        {/* ── Tablet / desktop: sortable table ─────────────────────────── */}
        <div className="hidden md:block px-6 pb-10">
          <div className="card-gloss rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: 'linear-gradient(180deg,#F8FAFC,#EEF3FA)', color: C.sub }}>
                    <Th label="Client" k="company" sort={sort} onSort={toggleSort} />
                    <Th label="Sector" k="sector" sort={sort} onSort={toggleSort} />
                    <Th label="Turnover" k="turnover" sort={sort} onSort={toggleSort} align="right" />
                    <Th label="Health" k="health_score" sort={sort} onSort={toggleSort} align="center" />
                    <Th label="Last update" k="last_update" sort={sort} onSort={toggleSort} align="right" />
                    <th className="text-center font-semibold px-4 py-2.5">Risk</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={6} style={{ color: C.muted }} className="px-4 py-10 text-center">Loading…</td></tr>
                  ) : view.length === 0 ? (
                    <tr><td colSpan={6} style={{ color: C.muted }} className="px-4 py-10 text-center">No clients match.</td></tr>
                  ) : view.map((r) => {
                    const b = band(r.health_score);
                    const d = daysAgo(r.last_update);
                    const stale = d != null && d > 14;
                    return (
                      <tr key={r.id}
                        onClick={() => router.push(`/console/${r.id}`)}
                        style={{ borderTop: '1px solid #EEF2F8', cursor: 'pointer' }}
                        className="transition-colors hover:bg-[#F5F9FE]">
                        <td className="px-4 py-3.5">
                          <div style={{ color: C.navy }} className="font-semibold">{r.company}</div>
                          {r.owner && <div style={{ color: C.muted }} className="text-xs">{r.owner}</div>}
                        </td>
                        <td className="px-4 py-3.5" style={{ color: C.sub }}>{r.sector || '—'}</td>
                        <td className="px-4 py-3.5 text-right tabular-nums" style={{ color: C.text }}>{compactINR(r.turnover)}</td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center justify-center">
                            <ScorePill score={r.health_score} b={b} />
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-right tabular-nums" style={{ color: stale ? C.red : C.sub }}>
                          {d == null ? '—' : d === 0 ? 'today' : `${d}d ago`}
                        </td>
                        <td className="px-4 py-3.5"><div className="flex justify-center"><RiskDot risk={r.risk} /></div></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── module-scope components ─────────────────────────────────────────────
function StatCard({ label, value, accent, className = '' }: { label: string; value: string; accent?: string; className?: string }) {
  return (
    <div className={`card-gloss tile-sheen relative overflow-hidden rounded-2xl p-4 ${className}`}>
      <div style={{ color: C.muted }} className="text-[10px] sm:text-xs font-semibold uppercase tracking-wide">{label}</div>
      <div style={{ color: accent || C.navy }} className="text-2xl sm:text-3xl font-extrabold mt-1 tabular-nums">{value}</div>
    </div>
  );
}

function ScorePill({ score, b }: { score: number | null | undefined; b: { letter: string; color: string } }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span style={{ color: C.text }} className="font-bold tabular-nums">{score ?? '—'}</span>
      <span style={{ background: `linear-gradient(180deg, ${b.color}, ${b.color}dd)`, color: '#fff' }}
        className="rounded-md px-1.5 py-0.5 text-[11px] font-bold shadow-sm">{b.letter}</span>
    </span>
  );
}

function Th({ label, k, sort, onSort, align = 'left' }: {
  label: string; k: SortKey; sort: { key: SortKey; dir: 'asc' | 'desc' };
  onSort: (k: SortKey) => void; align?: 'left' | 'right' | 'center';
}) {
  const active = sort.key === k;
  const arrow = active ? (sort.dir === 'asc' ? ' ↑' : ' ↓') : '';
  const justify = align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left';
  return (
    <th className={`${justify} font-semibold px-4 py-2.5 select-none cursor-pointer transition-colors hover:text-[#0B2E4F]`} onClick={() => onSort(k)}>
      {label}{arrow}
    </th>
  );
}

function RiskDot({ risk }: { risk?: ClientRow['risk'] }): ReactNode {
  const map = { red: C.red, yellow: C.amber, none: C.green } as const;
  const color = risk && risk in map ? map[risk as keyof typeof map] : C.muted;
  return <span title={risk || 'none'} style={{ background: color, width: 10, height: 10, borderRadius: 9999, display: 'inline-block', boxShadow: `0 0 0 3px ${color}22` }} />;
}
