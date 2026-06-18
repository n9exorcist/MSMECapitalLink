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
    <div style={{ background: C.bg, minHeight: '100vh', color: C.text }}>
      <header style={{ background: C.navy }} className="px-6 py-4">
        <div style={{ color: '#fff' }} className="text-lg font-bold">Client Portfolio</div>
        <div style={{ color: C.teal }} className="text-xs font-semibold">CFO Console · triage view</div>
      </header>

      {isDemo && (
        <div style={{ background: C.amberBg, color: C.amber, borderColor: '#FDE68A' }}
          className="border-b px-6 py-2 text-sm font-medium">
          Demo data — no backend connected. Set <code>NEXT_PUBLIC_API_URL</code> and add <code>GET /msme/clients</code> to see live clients.
        </div>
      )}

      {/* Aggregate widgets */}
      <div className="px-6 pt-5 grid grid-cols-2 sm:grid-cols-3 gap-3 max-w-4xl">
        <StatCard label="Total clients" value={String(total)} />
        <StatCard label="Needing attention" value={String(attention)} accent={attention ? C.amber : C.muted} />
        <StatCard label="Avg health score" value={String(avg)} accent={band(avg).color} />
      </div>

      {/* Filters */}
      <div className="px-6 py-4 flex flex-wrap items-center gap-2">
        <input
          value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="Search name or sector…"
          style={{ borderColor: C.border, color: C.text, maxWidth: 320 }}
          className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2"
        />
        {(['all', 'A', 'B', 'C', 'D'] as const).map((b) => (
          <button key={b} onClick={() => setBandFilter(b)}
            style={{
              background: bandFilter === b ? C.navy : C.surface,
              color: bandFilter === b ? '#fff' : C.sub, borderColor: C.border,
            }}
            className="rounded-lg border px-3 py-2 text-sm font-semibold">
            {b === 'all' ? 'All' : `Band ${b}`}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="px-6 pb-10">
        <div style={{ background: C.surface, borderColor: C.border }} className="rounded-2xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: '#F8FAFC', color: C.sub }}>
                <Th label="Client" k="company" sort={sort} onSort={toggleSort} />
                <Th label="Sector" k="sector" sort={sort} onSort={toggleSort} />
                <Th label="Turnover" k="turnover" sort={sort} onSort={toggleSort} align="right" />
                <Th label="Health" k="health_score" sort={sort} onSort={toggleSort} align="center" />
                <Th label="Last update" k="last_update" sort={sort} onSort={toggleSort} align="right" />
                <th className="text-center font-semibold px-4 py-2">Risk</th>
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
                    style={{ borderTop: '1px solid #F0F0F0', cursor: 'pointer' }}
                    className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div style={{ color: C.navy }} className="font-semibold">{r.company}</div>
                      {r.owner && <div style={{ color: C.muted }} className="text-xs">{r.owner}</div>}
                    </td>
                    <td className="px-4 py-3" style={{ color: C.sub }}>{r.sector || '—'}</td>
                    <td className="px-4 py-3 text-right" style={{ color: C.text }}>{compactINR(r.turnover)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <span style={{ color: C.text }} className="font-bold">{r.health_score ?? '—'}</span>
                        <span style={{ background: b.color, color: '#fff' }}
                          className="rounded px-1.5 py-0.5 text-[11px] font-bold">{b.letter}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right" style={{ color: stale ? C.red : C.sub }}>
                      {d == null ? '—' : d === 0 ? 'today' : `${d}d ago`}
                    </td>
                    <td className="px-4 py-3"><div className="flex justify-center"><RiskDot risk={r.risk} /></div></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── module-scope components ─────────────────────────────────────────────
function StatCard({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div style={{ background: C.surface, borderColor: C.border }} className="rounded-2xl border p-4">
      <div style={{ color: C.muted }} className="text-xs font-semibold uppercase tracking-wide">{label}</div>
      <div style={{ color: accent || C.navy }} className="text-2xl font-extrabold mt-1">{value}</div>
    </div>
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
    <th className={`${justify} font-semibold px-4 py-2 select-none cursor-pointer`} onClick={() => onSort(k)}>
      {label}{arrow}
    </th>
  );
}

function RiskDot({ risk }: { risk?: ClientRow['risk'] }): ReactNode {
  const map = { red: C.red, yellow: C.amber, none: C.green } as const;
  const color = risk && risk in map ? map[risk as keyof typeof map] : C.muted;
  return <span title={risk || 'none'} style={{ background: color, width: 10, height: 10, borderRadius: 9999, display: 'inline-block' }} />;
}
