'use client';
// app/console/[msmeId]/Client360.tsx
// §4 deep-dive "Overview" — dense banker view. Data is props, defaulted to the
// real Sri Sai extraction; <Client360Live> passes live `data` from /client360.

import { useState, type CSSProperties, type ReactNode } from 'react';
import CreditBureauPanel from './CreditBureauPanel';
import BriefingComposer from './BriefingComposer';
import { downloadDocument } from '../lib/api';

// Document tiles. `key` matches the backend registry (reports/registry.py); tiles with a
// key generate a live PDF, the rest are coming soon.
const DOC_TILES: { title: string; sub: string; key?: string }[] = [
  { title: 'MSME Health Report', sub: '4–9 pp · for the owner', key: 'health' },
  { title: 'Bank Proposal Pack', sub: '25–30 pp · credit committee', key: 'bank_proposal' },
  { title: 'CMA Data Sheet (IBA)', sub: '6–8 pp · bank format', key: 'cma' },
  { title: 'Project Report / DPR', sub: '20–40 pp · term loan', key: 'dpr' },
  { title: 'WC Limit Renewal', sub: '5–8 pp · CC/OD renewal', key: 'wc_renewal' },
  { title: 'Migration Pathway Plan', sub: '6–8 pp · NBFC → PSU', key: 'migration' },
  { title: 'Green Opportunity Report', sub: '8–12 pp · solar / CBAM', key: 'green' },
  { title: 'Annual Business Review', sub: '10–15 pp · year-end', key: 'annual_review' },
];

type Pill = 'ok' | 'near' | 'warn' | 'crit' | 'na';
interface Component { name: string; weight: number; score: number | null; evidenced: boolean }
interface Ratio { name: string; value: string; norm: string; status: Pill; label: string }
export interface Client360Data {
  name: string; owner: string; gstin: string; pan: string; sector: string; msmeClass: string;
  location: string; auditedPeriod: string; auditor: string; gstFiling: string; advisor: string;
  health: number | null; band: string; provisional: boolean; completeness: number;
  flags: string[]; reco: string;
  wc: { dso: number; inv: number; cred: number; total: number; note: string };
  trend: { label: string; value: string; pct: number; peak?: boolean }[];
  trendUnit: string;
  trendNote: string;
  components: Component[]; ratios: Ratio[];
}

const SRI_SAI: Client360Data = {
  name: 'Sri Sai Interiors', owner: 'Gopal Vimalraj', gstin: '33ALTPV2431J1ZP', pan: 'ALTPV2431J',
  sector: 'Interiors / fit-out', msmeClass: 'Micro', location: 'Chennai, TN',
  auditedPeriod: 'FY 2024-25', auditor: 'A Rudra & Co', gstFiling: '12/12 · R1≈3B', advisor: 'Rajmohan',
  health: 68, band: 'MEDIUM', provisional: true, completeness: 70,
  flags: ['No bank statements on file', 'No CIBIL / commercial bureau pull', 'No loan / EMI repayment track'],
  reco: 'Provisional — supply bank statements + CIBIL to certify bank-readiness.',
  wc: { dso: 371, inv: 236, cred: 67, total: 540, note: 'Receivables ₹2.49 Cr exceed a full year of sales — the dominant stress.' },
  trend: [
    { label: 'FY23-24', value: '0.46', pct: 19 },
    { label: 'FY24-25', value: '2.44', pct: 100, peak: true },
    { label: 'FY25-26*', value: '0.92', pct: 38 },
  ],
  trendUnit: '₹ Cr',
  trendNote: 'Net margin 28% → 1.3% as topline spiked. *FY25-26 = GST run-rate.',
  components: [
    { name: 'Banking discipline', weight: 25, score: 40, evidenced: false },
    { name: 'Liquidity ratios', weight: 15, score: 76, evidenced: true },
    { name: 'GST consistency', weight: 15, score: 100, evidenced: true },
    { name: 'Leverage quality', weight: 10, score: 50, evidenced: true },
    { name: 'Profitability', weight: 10, score: 80, evidenced: true },
    { name: 'Compliance discipline', weight: 10, score: 90, evidenced: true },
    { name: 'Documentation readiness', weight: 10, score: 80, evidenced: true },
    { name: 'Repayment behavior', weight: 5, score: 40, evidenced: false },
  ],
  ratios: [
    { name: 'Current ratio', value: '2.44', norm: '≥ 1.33', status: 'ok', label: 'Pass' },
    { name: 'DSCR', value: '—', norm: '≥ 1.50', status: 'na', label: 'No data' },
    { name: 'TOL / TNW', value: '3.23', norm: '≤ 3.00', status: 'warn', label: 'Stressed' },
    { name: 'Interest coverage (ICR)', value: '2.02', norm: '≥ 1.50', status: 'ok', label: 'Pass' },
    { name: 'WC cycle (days)', value: '540', norm: '≤ 600*', status: 'warn', label: 'Stretched' },
  ],
};

const TARGET = 80;
const rootVars = {
  '--navy': '#0B2E4F', '--navy2': '#103F6B', '--teal': '#0F766E', '--teal2': '#14B8A6',
  '--bg': '#EEF3FA', '--surface': '#FFFFFF', '--border': '#E2EAF4', '--line': '#EDF1F8',
  '--text': '#0F172A', '--sub': '#475569', '--muted': '#94A3B8',
  '--green': '#059669', '--greenbg': '#ECFDF5', '--amber': '#B45309', '--amberbg': '#FFFBEB',
  '--red': '#DC2626', '--redbg': '#FEF2F2', '--greybg': '#F1F5F9',
} as CSSProperties;

function compPill(c: Component): [Pill, string] {
  if (!c.evidenced) return ['na', 'No data'];
  if (c.score === null) return ['na', 'No data'];
  if (c.score >= 80) return ['ok', 'On track'];
  if (c.score >= 60) return ['near', 'Near'];
  if (c.score >= 40) return ['warn', 'Below'];
  return ['crit', 'Critical'];
}

export default function Client360({
  data = SRI_SAI,
  belowHeader,
  headerOnly,
  msmeId,
  onBureauSaved,
}: {
  data?: Client360Data;
  belowHeader?: ReactNode;
  headerOnly?: boolean;
  msmeId?: string;
  onBureauSaved?: () => void;
}) {
  const d = data;

  // Tiles with a registry key generate a live PDF; the rest are coming soon.
  const [genTile, setGenTile] = useState<string | null>(null);
  const [genErr, setGenErr] = useState<string | null>(null);
  async function handleGenerate(docKey: string) {
    if (!msmeId) return;
    setGenTile(docKey);
    setGenErr(null);
    try {
      await downloadDocument(msmeId, docKey);
    } catch (e) {
      setGenErr((e as Error).message);
    } finally {
      setGenTile(null);
    }
  }

  return (
    <div className={`c360${headerOnly ? ' c360-head' : ''}`} style={rootVars}>
      {/* TOP BAR */}
      <div className="topbar">
        <div className="brand">
          <div className="logo">M</div>
          <div><b>MFOS</b><small>CLIENT 360</small></div>
        </div>
        <div className="client-id">
          <div className="name">{d.name}</div>
          <div className="meta">{d.owner} · <b>GSTIN {d.gstin}</b> · {d.sector} · {d.msmeClass}</div>
        </div>
        <div className="scores">
          <div className="schip prov">
            <div className="lab">Health</div>
            <div className="val num">{d.health ?? '—'}<small>/100</small></div>
            <div className="tag">{d.band}{d.provisional ? ' · Provisional' : ''}</div>
          </div>
          <div className="schip prov">
            <div className="lab">Bank-Ready</div>
            <div className="val num">—</div>
            <div className="tag">{d.provisional ? 'Needs CIBIL' : 'Bank-ready'}</div>
          </div>
          <div className="schip na">
            <div className="lab">Green</div>
            <div className="val num">—</div>
            <div className="tag" style={{ color: '#9fd9ff' }}>Not assessed</div>
          </div>
        </div>
        <div className="toolbar">
          <div className="asof">As of <b>{d.auditedPeriod}</b> (audited)</div>
          <div className="unit"><span className="on">₹ Cr</span><span>₹ L</span></div>
          <div className="who">Advisor: {d.advisor}</div>
        </div>
      </div>

      {belowHeader}

      {!headerOnly && (
        <>
          {/* BODY */}
          <div className="shell">
            {/* MAIN */}
            <main>
              <section className="panel">
                <div className="sec-h"><h3>Composite Scores</h3><span className="hint">Weighted across 8 components · recomputed on save</span></div>
                <div className="tiles">
                  <div className="tile">
                    <div className="lab">Health Score</div>
                    <div className="big num" style={{ color: 'var(--amber)' }}>{d.health}<small>/100</small></div>
                    <div className="sub" style={{ color: 'var(--amber)' }}>Band B → gated to {d.band}{d.provisional ? ' · provisional' : ''}</div>
                  </div>
                  <div className="tile">
                    <div className="lab">Bank-Readiness</div>
                    <div className="big num" style={{ color: d.provisional ? 'var(--muted)' : 'var(--green)' }}>{d.provisional ? '—' : '✓'}</div>
                    <div className="sub" style={{ color: d.provisional ? 'var(--sub)' : 'var(--green)' }}>
                      {d.provisional ? 'Blocked — no CIBIL / bank evidence' : 'Bank-verified · CIBIL on file'}
                    </div>
                  </div>
                  <div className="tile">
                    <div className="lab">Working-Capital Cycle</div>
                    <div className="big num" style={{ color: 'var(--amber)' }}>{d.wc.total}<small> days</small></div>
                    <div className="sub" style={{ color: 'var(--amber)' }}>Stretched (works-contract band ≤600)</div>
                  </div>
                </div>
              </section>

              <section className="panel">
                <div className="sec-h"><h3>Credit-Readiness Scorecard</h3><span className="hint">Target = {TARGET} (Band A / bank-ready)</span></div>
                <div className="tscroll"><table>
                  <thead><tr><th>Component</th><th>Weight</th><th>Score</th><th>Target</th><th>Gap</th><th>Status</th></tr></thead>
                  <tbody>
                    {d.components.map((c) => {
                      const [p, label] = compPill(c);
                      const gap = c.score === null ? null : c.score - TARGET;
                      return (
                        <tr key={c.name}>
                          <td>{c.name}</td>
                          <td className="wt num">{c.weight}%</td>
                          <td className="num">{c.score === null ? '—' : c.score.toFixed(1)}</td>
                          <td className="num">{TARGET}</td>
                          <td className={`num ${gap != null && gap < 0 ? 'neg' : gap != null && gap > 0 ? 'pos' : ''}`}>
                            {gap == null ? '—' : gap > 0 ? `+${gap}` : gap < 0 ? `−${Math.abs(gap)}` : '0'}
                          </td>
                          <td><span className={`pill p-${p}`}>{label}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot><tr>
                    <td>Composite Health</td><td className="wt num">100%</td><td className="num">{d.health}</td>
                    <td className="num">{TARGET}</td><td className="num neg">−{TARGET - (d.health ?? 0)}</td>
                    <td><span className={`pill ${d.provisional ? 'p-warn' : 'p-ok'}`}>{d.provisional ? 'Provisional' : 'Certified'}</span></td>
                  </tr></tfoot>
                </table></div>
              </section>

              <section className="panel">
                <div className="sec-h"><h3>Banker Ratios</h3><span className="hint">{d.auditedPeriod} audited ({d.auditor})</span></div>
                <div className="tscroll"><table>
                  <thead><tr><th>Ratio</th><th>Value</th><th>Norm</th><th>Status</th></tr></thead>
                  <tbody>
                    {d.ratios.map((r) => (
                      <tr key={r.name}>
                        <td>{r.name}</td><td className="num">{r.value}</td><td className="num">{r.norm}</td>
                        <td><span className={`pill p-${r.status}`}>{r.label}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table></div>
              </section>

              <section className="panel">
                <div className="twocol">
                  <div>
                    <div className="eyebrow">Working-capital cycle</div>
                    <div className="wcrow">
                      <div className="wcbox"><b className="num">{d.wc.dso}</b><span>Debtor days</span></div><span className="op">+</span>
                      <div className="wcbox"><b className="num">{d.wc.inv}</b><span>Inventory</span></div><span className="op">−</span>
                      <div className="wcbox"><b className="num">{d.wc.cred}</b><span>Creditor</span></div><span className="op">=</span>
                      <div className="wcbox" style={{ borderColor: '#FBBF24', background: 'var(--amberbg)' }}>
                        <b className="num" style={{ color: 'var(--amber)' }}>{d.wc.total}</b><span style={{ color: 'var(--amber)' }}>Cycle</span>
                      </div>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--sub)', marginTop: 9 }}>{d.wc.note}</div>
                  </div>
                  <div>
                    <div className="eyebrow">Turnover trend · {d.trendUnit}</div>
                    <div className={`bars${d.trend.length > 6 ? ' many' : ''}`}>
                      {d.trend.map((t, i) => (
                        <div key={`${t.label}-${i}`} className={`bar${t.peak ? ' peak' : ''}`}>
                          {(d.trend.length <= 6 || t.peak) && <div className="v num">{t.value}</div>}
                          <div className="col" style={{ height: `${Math.max(t.pct, 2)}%` }} />
                          <div className="x">{t.label}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--sub)', marginTop: 6 }}>{d.trendNote}</div>
                  </div>
                </div>
              </section>
            </main>

            {/* RIGHT ASIDE */}
            <aside>
              <div className="aside">
                <div className="ah"><h3>MSME Profile</h3></div>
                {[['Trade name', d.name], ['Proprietor', d.owner], ['GSTIN', d.gstin], ['PAN', d.pan],
                ['Constitution', 'Proprietorship'], ['Sector', d.sector], ['MSME class', d.msmeClass],
                ['Location', d.location], ['Audited period', d.auditedPeriod], ['Auditor', d.auditor],
                ['GST filing', d.gstFiling]
                ].map(([k, v]) => (
                  <div className="kv" key={k}><span className="k">{k}</span><span className="v num">{v}</span></div>
                ))}
              </div>

              <div className="aside">
                <div className="ah"><h3>Data Completeness</h3></div>
                <div className="comp">
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 800 }}>
                    <span style={{ color: d.provisional ? 'var(--amber)' : 'var(--green)' }}>{d.provisional ? 'Provisional' : 'Complete'}</span>
                    <span className="num" style={{ color: d.provisional ? 'var(--amber)' : 'var(--green)' }}>{d.completeness}%</span>
                  </div>
                  <div className="meter"><i style={{ width: `${d.completeness}%`, background: d.provisional ? 'linear-gradient(90deg,var(--amber),#F59E0B)' : 'linear-gradient(90deg,var(--green),#34D399)' }} /></div>
                  {d.flags.map((f) => <div className="flag" key={f}><b>!</b> {f}</div>)}
                </div>
                <div className="reco">
                  <div className="lab">Lender recommendation</div>
                  <div className="txt">{d.reco}</div>
                </div>
              </div>

              {/* Credit Bureau entry — resolves the "no CIBIL" flag above */}
              {onBureauSaved && (
                <div style={{ marginBottom: 12 }}>
                  <CreditBureauPanel
                    msmeId={msmeId ?? ''}
                    subjectName={d.owner}
                    subjectPan={d.pan}
                    onSaved={onBureauSaved}
                  />
                </div>
              )}
            </aside>
          </div>

          {/* DOCUMENT TILE WALL */}
          <div className="docwall">
            <div className="sec-h"><h3>Generate Documents</h3><span className="hint">From this client&apos;s data · §8</span></div>
            <div className="tiles2">
              {DOC_TILES.map((tile) => {
                const live = !!tile.key;
                const busy = genTile === tile.key;
                return (
                  <div
                    className="dtile"
                    key={tile.title}
                    onClick={live ? () => handleGenerate(tile.key as string) : undefined}
                    style={live ? undefined : { opacity: 0.6, cursor: 'default' }}
                  >
                    <div className="t">{tile.title}</div><div className="d">{tile.sub}</div>
                    <div className="act">
                      <span className="gen" style={live ? undefined : { background: 'var(--muted)' }}>
                        {busy ? 'Generating…' : live ? 'Generate' : 'Coming soon'}
                      </span>
                      <span className="ic">i</span>
                    </div>
                    {live && busy === false && genErr && genTile === null && (
                      <div className="d" style={{ color: 'var(--red)' }}>{genErr}</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* DAILY BRIEFING COMPOSER → owner app "Today's 3 Actions" */}
          <BriefingComposer msmeId={msmeId} />

          <footer>
            <div>Source: audited {d.auditedPeriod} financials + GST returns · <b>Scores recomputed on save</b></div>
            <div>MFOS Client 360 · prototype v0 · *WC cycle norm is sector-aware</div>
          </footer>
        </>
      )}

      <style jsx>{`
        .c360 *{box-sizing:border-box}
        .c360{font-family:"Segoe UI",-apple-system,system-ui,Roboto,Arial,sans-serif;color:var(--text);
          font-size:13px;-webkit-font-smoothing:antialiased;min-height:100vh;width:100%;max-width:100%;overflow-x:clip;
          background:
            radial-gradient(1100px 480px at 100% -8%,rgba(15,118,110,.10),transparent 55%),
            radial-gradient(900px 420px at -5% 0%,rgba(11,46,79,.05),transparent 50%),
            linear-gradient(180deg,#F4F8FD,var(--bg))}
        .c360-head{min-height:0;background:none}
        .num{font-variant-numeric:tabular-nums;letter-spacing:-.01em}
        .eyebrow{font-size:10.5px;font-weight:800;letter-spacing:.09em;text-transform:uppercase;color:var(--muted)}
        .topbar{position:sticky;top:0;z-index:5;color:#fff;padding:11px 18px;display:flex;align-items:center;gap:18px;
          background:
            radial-gradient(600px 220px at 80% -50%,rgba(94,234,212,.20),transparent 60%),
            linear-gradient(135deg,#0a2b49 0%,var(--navy2) 55%,#0e3a60 100%);
          box-shadow:0 12px 32px -14px rgba(11,46,79,.6),inset 0 1px 0 rgba(255,255,255,.14),inset 0 -1px 0 rgba(0,0,0,.20)}
        .brand{display:flex;align-items:center;gap:10px;min-width:230px}
        .brand .logo{width:30px;height:30px;border-radius:8px;background:linear-gradient(180deg,var(--teal2),var(--teal));
          display:grid;place-items:center;font-weight:800;color:#062a26;box-shadow:inset 0 1px 0 rgba(255,255,255,.4)}
        .brand b{font-size:15px;letter-spacing:.2px}
        .brand small{display:block;color:#7fe3d4;font-size:10px;font-weight:700;letter-spacing:.06em}
        .client-id{flex:1;min-width:0}
        .client-id .name{font-size:16px;font-weight:800}
        .client-id .meta{color:#9fd9ff;font-size:11px;font-weight:600}
        .client-id .meta b{color:#cdebff}
        .scores{display:flex;gap:8px}
        .schip{background:linear-gradient(180deg,rgba(255,255,255,.17),rgba(255,255,255,.05));border:1px solid rgba(255,255,255,.20);border-radius:12px;padding:6px 12px;min-width:104px;text-align:right;box-shadow:inset 0 1px 0 rgba(255,255,255,.28),0 6px 16px -10px rgba(0,0,0,.5)}
        .schip .lab{font-size:9.5px;font-weight:800;letter-spacing:.06em;color:#9fd9ff;text-transform:uppercase}
        .schip .val{font-size:21px;font-weight:800;line-height:1}
        .schip .val small{font-size:11px;font-weight:700;opacity:.8}
        .schip .tag{font-size:9.5px;font-weight:800;text-transform:uppercase;letter-spacing:.04em}
        .schip.prov .tag{color:#fde68a}
        .schip.na{opacity:.62}
        .toolbar{display:flex;flex-direction:column;align-items:flex-end;gap:4px;min-width:150px}
        .asof{font-size:11px;color:#cdebff;font-weight:600}
        .unit{display:inline-flex;border:1px solid rgba(255,255,255,.22);border-radius:8px;overflow:hidden;font-size:10px;font-weight:800}
        .unit span{padding:3px 9px;color:#cdebff}
        .unit span.on{background:rgba(255,255,255,.18);color:#fff}
        .who{font-size:10.5px;color:#9fd9ff;font-weight:600}
        .shell{display:grid;grid-template-columns:1fr 286px;gap:12px;padding:12px 14px;max-width:1560px;margin:0 auto;align-items:start}
        .shell > *{min-width:0}
        .rail,.aside{background:linear-gradient(180deg,#FFFFFF,#FBFDFF);border:1px solid var(--border);border-radius:14px;box-shadow:inset 0 1px 0 rgba(255,255,255,.9),0 1px 2px rgba(15,23,42,.05),0 16px 36px -24px rgba(11,46,79,.3)}
        .rail{padding:6px;position:sticky;top:74px}
        .rail .grp{padding:9px 9px 4px}
        .navitem{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:7px 10px;border-radius:8px;color:var(--sub);font-weight:600;cursor:pointer;font-size:12.5px}
        .navitem:hover{background:#F5F9FE;color:var(--navy)}
        .navitem.active{background:linear-gradient(180deg,#103F6B,#0B2E4F);color:#fff;box-shadow:inset 0 1px 0 rgba(255,255,255,.15)}
        .navitem.active .dot{background:#5eead4}
        .navitem .dot{width:6px;height:6px;border-radius:50%;background:#cbd5e1;display:inline-block}
        .navitem .badge{font-size:10px;font-weight:800;color:var(--muted)}
        .navitem.active .badge{color:#9fd9ff}
        .panel{background:linear-gradient(180deg,#FFFFFF,#FCFEFF);border:1px solid var(--border);border-radius:14px;overflow:hidden;margin-bottom:12px;box-shadow:inset 0 1px 0 rgba(255,255,255,.9),0 1px 2px rgba(15,23,42,.05),0 16px 36px -24px rgba(11,46,79,.3)}
        .sec-h{display:flex;align-items:center;justify-content:space-between;padding:11px 14px;border-bottom:1px solid var(--line);background:linear-gradient(180deg,#FAFCFF,#F4F8FD)}
        .sec-h h3{margin:0;font-size:12.5px;font-weight:800;color:var(--navy);letter-spacing:.2px}
        .sec-h .hint{font-size:10.5px;color:var(--muted);font-weight:600}
        .tiles{display:grid;grid-template-columns:repeat(3,1fr)}
        .tile{padding:13px 16px;border-right:1px solid var(--line)}
        .tile:last-child{border-right:0}
        .tile .lab{font-size:10px;font-weight:800;color:var(--muted);text-transform:uppercase;letter-spacing:.06em}
        .tile .big{font-size:30px;font-weight:800;line-height:1.05;margin-top:2px}
        .tile .big small{font-size:13px;font-weight:700;color:var(--muted)}
        .tile .sub{font-size:11px;font-weight:700;margin-top:3px}
        table{width:100%;border-collapse:collapse;font-size:12.5px}
        thead th{font-size:10px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:var(--muted);text-align:right;padding:8px 14px;background:#F8FAFD;border-bottom:1px solid var(--border)}
        thead th:first-child{text-align:left}
        tbody td{padding:9px 14px;border-bottom:1px solid var(--line);text-align:right}
        tbody td:first-child{text-align:left;font-weight:600;color:var(--navy)}
        tbody tr:hover{background:#F8FBFF}
        .wt{color:var(--muted);font-weight:700}
        .neg{color:var(--red)}.pos{color:var(--green)}
        tfoot td{padding:10px 14px;font-weight:800;background:#F4F8FD;border-top:2px solid var(--border);text-align:right}
        tfoot td:first-child{color:var(--navy);text-align:left}
        .pill{display:inline-block;font-size:9.5px;font-weight:800;letter-spacing:.03em;text-transform:uppercase;padding:2px 8px;border-radius:999px;border:1px solid transparent}
        .p-ok{color:var(--green);background:var(--greenbg);border-color:#A7F3D0}
        .p-near{color:var(--teal);background:#ECFDFA;border-color:#99F6E4}
        .p-warn{color:var(--amber);background:var(--amberbg);border-color:#FDE68A}
        .p-crit{color:var(--red);background:var(--redbg);border-color:#FECACA}
        .p-na{color:#64748B;background:var(--greybg);border-color:#E2E8F0}
        .twocol{display:grid;grid-template-columns:1fr 1fr}
        .twocol > div{padding:13px 16px}
        .twocol > div:first-child{border-right:1px solid var(--line)}
        .wcrow{display:flex;align-items:center;gap:8px;font-size:12px;flex-wrap:wrap;margin-top:6px}
        .wcbox{background:#F4F8FD;border:1px solid var(--border);border-radius:8px;padding:6px 10px;text-align:center}
        .wcbox b{display:block;font-size:16px;color:var(--navy)}.wcbox span{font-size:9.5px;color:var(--muted);font-weight:700;text-transform:uppercase}
        .op{color:var(--muted);font-weight:800;font-size:14px}
        .bars{display:flex;align-items:flex-end;gap:14px;height:84px;margin-top:10px;padding-top:6px}
        .bar{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%}
        .bar .col{width:100%;min-height:3px;border-radius:7px 7px 0 0;background:linear-gradient(180deg,#3E80B8,#0B2E4F);box-shadow:inset 0 1px 0 rgba(255,255,255,.30)}
        .bar.peak .col{background:linear-gradient(180deg,#2DD4BF,#0F766E);box-shadow:inset 0 1px 0 rgba(255,255,255,.40)}
        .bar .v{font-size:11px;font-weight:800;color:var(--navy);margin-bottom:3px}
        .bar .x{font-size:9.5px;color:var(--muted);font-weight:700;margin-top:4px}
        .bars.many{gap:5px}
        .bars.many .x{font-size:8px;letter-spacing:-.02em;margin-top:3px}
        .aside{overflow:hidden;margin-bottom:12px}
        .ah{padding:10px 14px;border-bottom:1px solid var(--line);background:linear-gradient(180deg,#FAFCFF,#F4F8FD)}
        .ah h3{margin:0;font-size:12px;font-weight:800;color:var(--navy)}
        .kv{display:flex;justify-content:space-between;gap:10px;padding:6px 14px;font-size:12px}
        .kv:nth-child(even){background:#FAFCFE}
        .kv .k{color:var(--muted);font-weight:600}.kv .v{color:var(--text);font-weight:700;text-align:right}
        .comp{padding:12px 14px}
        .meter{height:9px;border-radius:999px;background:#E8EEF6;overflow:hidden;margin:7px 0 8px}
        .meter i{display:block;height:100%;background:linear-gradient(90deg,var(--amber),#F59E0B)}
        .flag{display:flex;gap:7px;font-size:11.5px;color:var(--sub);padding:4px 0}
        .flag b{color:var(--amber);font-weight:800}
        .reco{margin:10px 14px 14px;border:1px dashed #FBBF24;background:var(--amberbg);border-radius:10px;padding:10px 12px}
        .reco .lab{font-size:9.5px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:var(--amber)}
        .reco .txt{font-size:12px;font-weight:700;color:#7c2d12;margin-top:3px}
        .docwall{max-width:1560px;margin:0 auto;padding:0 14px 18px}
        .docwall .sec-h{border:1px solid var(--border);border-bottom:none;border-radius:12px 12px 0 0}
        .tiles2{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;background:var(--surface);border:1px solid var(--border);border-top:none;border-radius:0 0 12px 12px;padding:12px}
        .dtile{border:1px solid var(--border);border-radius:10px;padding:11px 12px;background:linear-gradient(180deg,#fff,#FBFDFF);display:flex;flex-direction:column;gap:6px;cursor:pointer;transition:transform .12s,box-shadow .12s}
        .dtile:hover{transform:translateY(-2px);box-shadow:0 10px 24px -16px rgba(11,46,79,.4)}
        .dtile .t{font-weight:800;color:var(--navy);font-size:12.5px}
        .dtile .d{font-size:10.5px;color:var(--muted);font-weight:600}
        .dtile .act{display:flex;justify-content:space-between;align-items:center;margin-top:2px}
        .gen{font-size:10.5px;font-weight:800;color:#fff;background:linear-gradient(180deg,var(--teal2),var(--teal));border-radius:7px;padding:4px 9px;box-shadow:inset 0 1px 0 rgba(255,255,255,.3)}
        .ic{width:18px;height:18px;border-radius:5px;border:1px solid var(--border);display:grid;place-items:center;color:var(--muted);font-size:11px;font-weight:800}
        footer{max-width:1560px;margin:0 auto;padding:6px 16px 24px;color:var(--muted);font-size:10.5px;display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px}
        footer b{color:var(--sub)}
        .tscroll{overflow-x:auto;-webkit-overflow-scrolling:touch;border-radius:0 0 14px 14px;min-width:0;max-width:100%}
        .tscroll table{min-width:520px}

        @media (max-width:1080px){
          .shell{grid-template-columns:1fr;gap:10px;padding:10px}
          .aside{position:static}
          .rail{position:static;display:flex;flex-wrap:nowrap;overflow-x:auto;gap:4px;padding:6px 8px}
          .rail .grp{display:none}
          .navitem{white-space:nowrap;flex:0 0 auto}
          .tiles2{grid-template-columns:repeat(2,1fr)}
          .topbar{position:static;flex-wrap:wrap;gap:10px 14px;padding:12px 14px}
          .brand{min-width:0}
          .client-id{flex:1 1 100%;order:1}
          .client-id .name{font-size:15px}
          .scores{order:2;flex:1 1 100%}
          .schip{flex:1;min-width:0;text-align:left;padding:7px 11px}
          .toolbar{order:3;flex:1 1 100%;flex-direction:row;align-items:center;justify-content:space-between;min-width:0}
          .docwall{padding:0 10px 16px}
        }
        @media (max-width:760px){
          .tiles{grid-template-columns:1fr}
          .tile{border-right:0;border-bottom:1px solid var(--line)}
          .tile:last-child{border-bottom:0}
          .twocol{grid-template-columns:1fr}
          .twocol > div:first-child{border-right:0;border-bottom:1px solid var(--line)}
          .tiles2{grid-template-columns:1fr}
          .bars{height:72px}
        }
        @media (max-width:430px){
          .shell{padding:8px}
          .schip{padding:6px 9px}
          .schip .val{font-size:18px}
          .tile .big{font-size:26px}
          .wcrow{gap:6px}
          .wcbox{padding:5px 8px}
          .wcbox b{font-size:14px}
          .sec-h{padding:10px 12px}
          .tile,.twocol > div,.comp{padding-left:12px;padding-right:12px}
        }
      `}</style>
    </div>
  );
}