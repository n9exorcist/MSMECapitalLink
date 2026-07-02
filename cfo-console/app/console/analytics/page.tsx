'use client';
// app/console/analytics/page.tsx — Portfolio Analytics (spec §10).
// Real portfolio-wide aggregates from GET /msme/portfolio/analytics. Revenue +
// advisor productivity (§10.2/§10.3) are shown as clearly-labelled SAMPLES until
// billing/advisor data is connected.

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { getPortfolioAnalytics, type PortfolioAnalytics } from '../../lib/api';

const C = {
  navy: '#0B2E4F', navy2: '#103F6B', teal: '#0F766E', teal2: '#14B8A6',
  border: '#E2EAF4', text: '#0F172A', sub: '#475569', muted: '#94A3B8',
  green: '#059669', amber: '#D97706', red: '#DC2626',
};

const BAND = [
  { key: 'A', label: 'A · Excellent', color: C.green },
  { key: 'B', label: 'B · Good', color: C.teal },
  { key: 'C', label: 'C · Medium', color: C.amber },
  { key: 'D', label: 'D · Poor', color: C.red },
  { key: 'unknown', label: 'Unscored', color: C.muted },
] as const;

const inrCr = (v?: number | null) => (v ? `₹${(v / 1e7).toFixed(2)} Cr` : '₹0');

export default function PortfolioAnalyticsPage() {
  const [data, setData] = useState<PortfolioAnalytics | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    getPortfolioAnalytics()
      .then((d) => { if (!ignore) setData(d); })
      .catch((e) => { if (!ignore) setError((e as Error).message); });
    return () => { ignore = true; };
  }, []);

  const maxSector = useMemo(() => Math.max(1, ...(data?.sectors ?? []).map((s) => s.count)), [data]);
  const total = data?.total ?? 0;

  return (
    <div style={{ color: C.text }} className="min-h-screen pb-16">
      <header className="hero-navy relative px-5 sm:px-8 py-5">
        <div className="mx-auto max-w-7xl flex items-center gap-4">
          <Link href="/console" className="text-white/80 hover:text-white text-sm font-semibold">← Portfolio</Link>
          <div className="flex-1">
            <h1 className="text-white text-lg font-extrabold leading-tight">Portfolio Analytics</h1>
            <div style={{ color: '#9FC6E6' }} className="text-xs font-medium">Book-wide health, risk & mix · §10</div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        {error && (
          <div className="mt-4 rounded-xl border px-4 py-2.5 text-sm font-medium"
            style={{ background: '#FEF2F2', color: C.red, borderColor: '#FECACA' }}>{error}</div>
        )}
        {!data && !error && (
          <div className="mt-6 text-sm" style={{ color: C.muted }}>Loading analytics…</div>
        )}

        {data && (
          <>
            {/* Summary tiles */}
            <section className="mt-5 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
              <Tile label="Clients" value={String(data.total)} />
              <Tile label="Avg health" value={data.averages.health != null ? String(data.averages.health) : '—'} sub="/ 100" color={C.navy} />
              <Tile label="Avg bank-ready" value={data.averages.bank_readiness != null ? String(data.averages.bank_readiness) : '—'} sub="/ 100" color={C.teal} />
              <Tile label="Avg green" value={data.averages.green != null ? String(data.averages.green) : '—'} sub="/ 100 · indicative" color={C.green} />
              <Tile label="Certified" value={String(data.certified)} sub="bank-ready" color={C.green} />
              <Tile label="Portfolio turnover" value={inrCr(data.turnover_total)} sub="combined" />
            </section>

            <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Band distribution */}
              <Panel title="Health band distribution">
                {BAND.map((b) => {
                  const n = data.bands[b.key];
                  return <BarRow key={b.key} label={b.label} value={n} pct={total ? (n / total) * 100 : 0} color={b.color} />;
                })}
              </Panel>

              {/* Risk split */}
              <Panel title="Risk">
                <BarRow label="OK" value={data.risk.none} pct={total ? (data.risk.none / total) * 100 : 0} color={C.green} />
                <BarRow label="Watch" value={data.risk.yellow} pct={total ? (data.risk.yellow / total) * 100 : 0} color={C.amber} />
                <BarRow label="High" value={data.risk.red} pct={total ? (data.risk.red / total) * 100 : 0} color={C.red} />
                <div className="mt-3 pt-3 flex items-center justify-between text-sm" style={{ borderTop: `1px solid ${C.border}`, color: C.sub }}>
                  <span>Certified vs provisional</span>
                  <span className="num font-semibold">
                    <span style={{ color: C.green }}>{data.certified}</span> · <span style={{ color: C.amber }}>{data.provisional}</span>
                  </span>
                </div>
              </Panel>
            </div>

            {/* Sector distribution */}
            <div className="mt-4">
              <Panel title="Sector mix">
                {data.sectors.length === 0 ? (
                  <div className="text-sm" style={{ color: C.muted }}>No sector data.</div>
                ) : data.sectors.map((s) => (
                  <BarRow key={s.name} label={s.name} value={s.count} pct={(s.count / maxSector) * 100} color={C.navy2} />
                ))}
              </Panel>
            </div>

            {/* Revenue + advisor productivity — SAMPLE until billing is connected */}
            <div className="mt-6 flex items-center gap-2">
              <h2 className="text-sm font-extrabold" style={{ color: C.navy }}>Revenue &amp; advisor productivity</h2>
              <span className="pill" style={{ color: C.amber, background: '#FFFBEB' }}>Sample</span>
            </div>
            <p className="text-xs mt-1" style={{ color: C.muted }}>
              Illustrative only — wired once billing (Razorpay) and advisor assignment data are connected (§10.2/§10.3).
            </p>
            <section className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3 opacity-70">
              <Tile label="MRR" value="₹—" sub="sample" />
              <Tile label="ARR" value="₹—" sub="sample" />
              <Tile label="New this month" value="—" sub="sample" />
              <Tile label="Churn" value="—" sub="sample" />
            </section>
          </>
        )}
      </div>
    </div>
  );
}

function Tile({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="card-gloss card-static tile-sheen relative rounded-2xl px-4 py-3 overflow-hidden">
      <div className="eyebrow">{label}</div>
      <div className="font-extrabold num mt-1" style={{ fontSize: 22, color: color ?? C.navy }}>{value}</div>
      {sub && <div className="text-[11px] mt-0.5" style={{ color: C.muted }}>{sub}</div>}
    </div>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="card-gloss card-static rounded-2xl p-4 sm:p-5">
      <div className="eyebrow mb-3">{title}</div>
      <div className="space-y-2.5">{children}</div>
    </div>
  );
}

function BarRow({ label, value, pct, color }: { label: string; value: number; pct: number; color: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-28 sm:w-40 text-sm truncate" style={{ color: C.sub }} title={label}>{label}</div>
      <div className="flex-1 h-2.5 rounded-full overflow-hidden" style={{ background: '#EDF2F9' }}>
        <div style={{ width: `${Math.max(pct, value ? 3 : 0)}%`, height: '100%', background: color }} />
      </div>
      <div className="w-8 text-right num text-sm font-semibold" style={{ color: C.text }}>{value}</div>
    </div>
  );
}
