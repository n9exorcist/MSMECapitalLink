'use client';

/**
 * FinancialReviewScreen
 * ---------------------------------------------------------------------------
 * The confirm-before-write step for the financial-statement parser, shown as a
 * modal over the console.
 *
 * A financial statement is uploaded -> backend runs parse_financial_statement
 * and returns a review payload -> this screen shows the parsed figures,
 * PRE-FILLED and EDITABLE, with the confidence flag and reconciliation results
 * surfaced -> the human reviews/corrects -> on confirm, the figures are written
 * to msme_financials via the console's authenticated API client (saveFinancials),
 * which recomputes the health score.
 *
 * The parser NEVER writes the table directly; this screen is the gate. A
 * misread can't poison the score because a misread never reaches msme_financials
 * without a human pressing Save. This is the assisted-entry twin of the manual
 * Financials tab — same 14 fields, same save endpoint.
 */

import { useMemo, useState } from 'react';
import { saveFinancials } from '../lib/api';

// ---- types: must match parse_financial_statement's return shape ----
export interface ParsePayload {
  fields: Record<string, number>;          // the 14 msme_financials columns, pre-filled
  raw_line_items: Record<string, number>;  // what was read from the PDF (for cross-check)
  checks: Record<string, boolean | null>;  // balance_sheet_balances, trading_account_balances
  missing: string[];                        // required line items not found
  confidence: 'high' | 'review';
}

interface Props {
  msmeId: string;
  payload: ParsePayload;
  sourceDocName?: string;                   // e.g. "SHRI_SAI_SIGNED.pdf"
  onCancel: () => void;
  onSaved: () => void;                      // called after a successful write (refresh dashboard)
}

// ---- field metadata: column -> label, group, derived? ----
type Group = 'P&L' | 'Balance Sheet';
const FIELD_META: { key: string; label: string; group: Group; derived?: boolean; note?: string }[] = [
  { key: 'projected_annual_turnover', label: 'Annual Turnover (Sales)', group: 'P&L' },
  { key: 'annual_purchases', label: 'Annual Purchases', group: 'P&L' },
  { key: 'net_profit_after_tax', label: 'Net Profit', group: 'P&L' },
  { key: 'ebit', label: 'EBIT', group: 'P&L', derived: true, note: 'Net Profit + Interest' },
  { key: 'depreciation', label: 'Depreciation', group: 'P&L' },
  { key: 'interest_expense', label: 'Interest Expense', group: 'P&L' },
  { key: 'current_assets', label: 'Current Assets', group: 'Balance Sheet', derived: true, note: 'Stock + Debtors + Cash + Other CA' },
  { key: 'current_liabilities', label: 'Current Liabilities', group: 'Balance Sheet', derived: true, note: 'Creditors + Other CL' },
  { key: 'inventory', label: 'Inventory (Closing Stock)', group: 'Balance Sheet' },
  { key: 'sundry_debtors', label: 'Sundry Debtors', group: 'Balance Sheet' },
  { key: 'sundry_creditors', label: 'Sundry Creditors', group: 'Balance Sheet' },
  { key: 'total_outside_liabilities', label: 'Total Outside Liabilities', group: 'Balance Sheet', derived: true, note: 'Secured + Unsecured + Creditors + Other CL' },
  { key: 'tangible_net_worth', label: 'Tangible Net Worth', group: 'Balance Sheet' },
  { key: 'declared_bank_statement_credits', label: 'Declared Bank Credits', group: 'Balance Sheet', derived: true, note: 'Proxy = Turnover' },
];

const CHECK_LABEL: Record<string, string> = {
  balance_sheet_balances: 'Balance sheet balances (Assets = Liabilities)',
  trading_account_balances: 'Trading account balances',
};

// ₹ formatter: shows L / Cr for readability beside each input
function fmtINR(n: number): string {
  if (!n) return '—';
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(2)} Cr`;
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(2)} L`;
  return `₹${n.toLocaleString('en-IN')}`;
}

export default function FinancialReviewScreen({ msmeId, payload, sourceDocName, onCancel, onSaved }: Props) {
  // editable copy of the parsed fields
  const [values, setValues] = useState<Record<string, number>>(() => {
    const seed: Record<string, number> = {};
    for (const m of FIELD_META) seed[m.key] = Number(payload.fields[m.key] ?? 0);
    return seed;
  });
  // period the statement is for (parser doesn't read this — human confirms)
  const [periodLabel, setPeriodLabel] = useState('');
  const [periodYear, setPeriodYear] = useState<number>(new Date().getFullYear());
  const [periodMonth, setPeriodMonth] = useState<number>(3); // Indian FY end
  const [showRaw, setShowRaw] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isHigh = payload.confidence === 'high';
  const missingSet = useMemo(() => new Set(payload.missing), [payload.missing]);

  const setVal = (k: string, raw: string) =>
    setValues((v) => ({ ...v, [k]: raw === '' ? 0 : Math.round(Number(raw.replace(/[^\d.-]/g, ''))) }));

  const canSave = periodLabel.trim().length > 0 && !saving;

  async function handleSave() {
    setError(null);
    if (!periodLabel.trim()) { setError('Enter the period (e.g. FY2024-25) before saving.'); return; }
    setSaving(true);
    try {
      await saveFinancials(msmeId, values, {
        period_label: periodLabel.trim(),
        period_year: periodYear,
        period_month: periodMonth,
      });
      onSaved();
    } catch (e: any) {
      setError(e?.message ?? 'Something went wrong saving the figures.');
    } finally {
      setSaving(false);
    }
  }

  const groups: Group[] = ['P&L', 'Balance Sheet'];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4">
      <div className="my-8 w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
        {/* Header */}
        <div className="mb-1 text-lg font-bold text-slate-900">Review financial figures</div>
        <p className="mb-4 text-sm text-slate-500">
          Read from {sourceDocName ? <span className="font-medium text-slate-700">{sourceDocName}</span> : 'the uploaded statement'}.
          Check each figure against the PDF, then save to the client&apos;s financials.
        </p>

        {/* Confidence banner */}
        <div className={`mb-4 rounded-xl border px-4 py-3 text-sm ${isHigh
          ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
          : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
          {isHigh
            ? '✓ High confidence — all line items found and the balance sheet reconciles. Please still confirm the figures below.'
            : '⚠ Needs review — some figures could not be read cleanly or the statement did not reconcile. Correct the highlighted fields before saving.'}
        </div>

        {/* Missing line items */}
        {payload.missing.length > 0 && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            <div className="font-semibold">Couldn&apos;t read from the PDF — fill these in:</div>
            <div className="mt-1">{payload.missing.join(', ')}</div>
          </div>
        )}

        {/* Reconciliation checks */}
        <div className="mb-5 flex flex-wrap gap-2">
          {Object.entries(payload.checks).map(([k, v]) => (
            <span key={k} className={`rounded-full px-3 py-1 text-xs font-medium ${v === true
              ? 'bg-emerald-100 text-emerald-700'
              : v === false
                ? 'bg-red-100 text-red-700'
                : 'bg-slate-100 text-slate-500'}`}>
              {v === true ? '✓ ' : v === false ? '✕ ' : '– '}{CHECK_LABEL[k] ?? k}
            </span>
          ))}
        </div>

        {/* Period */}
        <div className="mb-5 rounded-xl bg-slate-50 p-4">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Statement period</div>
          <div className="grid grid-cols-3 gap-3">
            <label className="text-sm">
              <span className="mb-1 block text-slate-600">Label</span>
              <input value={periodLabel} onChange={(e) => setPeriodLabel(e.target.value)}
                placeholder="FY2024-25"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-teal-500" />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-slate-600">Year</span>
              <input type="number" value={periodYear} onChange={(e) => setPeriodYear(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-teal-500" />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-slate-600">FY-end month</span>
              <input type="number" min={1} max={12} value={periodMonth} onChange={(e) => setPeriodMonth(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-teal-500" />
            </label>
          </div>
        </div>

        {/* Editable fields, grouped */}
        {groups.map((grp) => (
          <div key={grp} className="mb-5">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{grp}</div>
            <div className="space-y-2">
              {FIELD_META.filter((m) => m.group === grp).map((m) => {
                const flagged = missingSet.has(m.key) || !values[m.key];
                return (
                  <div key={m.key} className="flex items-center gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                        {m.label}
                        {m.derived && (
                          <span title={m.note} className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
                            derived
                          </span>
                        )}
                      </div>
                      {m.note && <div className="text-[11px] text-slate-400">{m.note}</div>}
                    </div>
                    <input
                      inputMode="numeric"
                      value={values[m.key] ?? 0}
                      onChange={(e) => setVal(m.key, e.target.value)}
                      className={`w-40 rounded-lg border px-3 py-2 text-right font-semibold outline-none focus:border-teal-500 ${flagged ? 'border-red-300 bg-red-50 text-red-700' : 'border-slate-300 text-slate-900'}`}
                    />
                    <div className="w-24 text-right text-xs text-slate-500">{fmtINR(values[m.key] ?? 0)}</div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {/* Raw line items (collapsible cross-check) */}
        <button onClick={() => setShowRaw((s) => !s)} className="mb-4 text-sm font-medium text-teal-600">
          {showRaw ? 'Hide' : 'Show'} what was read from the document
        </button>
        {showRaw && (
          <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs">
            <div className="grid grid-cols-2 gap-x-6 gap-y-1">
              {Object.entries(payload.raw_line_items).map(([k, v]) => (
                <div key={k} className="flex justify-between">
                  <span className="text-slate-500">{k}</span>
                  <span className="font-medium text-slate-700">{v.toLocaleString('en-IN')}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {error && <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <button onClick={onCancel} disabled={saving}
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50">
            Cancel
          </button>
          <button onClick={handleSave} disabled={!canSave}
            className="rounded-xl bg-teal-600 px-5 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50">
            {saving ? 'Saving…' : 'Save to financials'}
          </button>
        </div>
      </div>
    </div>
  );
}