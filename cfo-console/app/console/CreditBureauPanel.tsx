'use client';

import { useState } from 'react';
import { saveCreditBureauPull } from '../lib/api';

interface Props {
    msmeId: string;
    subjectName?: string;     // proprietor — the person pulled, for a proprietorship
    subjectPan?: string;      // e.g. ALTPV2431J
    onSaved?: () => void;     // refresh the dashboard after the recompute
}

const today = () => new Date().toISOString().slice(0, 10);

export default function CreditBureauPanel({ msmeId, subjectName, subjectPan, onSaved }: Props) {
    const [score, setScore] = useState('');
    const [pulledOn, setPulledOn] = useState(today());
    const [controlNumber, setControlNumber] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [done, setDone] = useState<string | null>(null);

    const n = Number(score);
    const valid = score !== '' && Number.isFinite(n) && n >= 300 && n <= 900;

    async function handleSave() {
        setError(null); setDone(null);
        if (!valid) { setError('Enter a consumer CIBIL between 300 and 900.'); return; }
        setSaving(true);
        try {
            const res = await saveCreditBureauPull(msmeId, {
                score: n,
                subject_type: 'individual',
                subject_name: subjectName,
                subject_pan: subjectPan,
                pulled_on: pulledOn,
                control_number: controlNumber.trim() || undefined,
            });
            const s = res?.score;
            setDone(
                s?.provisional === false
                    ? `Saved — ${s.score} ${s.band}. Client is now certified.`
                    : `Saved — ${s?.score ?? ''} ${s?.band ?? ''}.`,
            );
            onSaved?.();
        } catch (e: any) {
            setError(e?.message ?? 'Could not save the bureau pull.');
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-sm font-bold text-slate-900">Credit Bureau</div>
            <p className="mt-0.5 mb-4 text-xs text-slate-500">
                Proprietor&apos;s consumer CIBIL · 300–900
                {subjectName ? <> · <span className="font-medium text-slate-700">{subjectName}</span></> : null}
                {subjectPan ? <> · PAN {subjectPan}</> : null}
            </p>

            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">CIBIL score</label>
            <input
                inputMode="numeric"
                value={score}
                onChange={(e) => setScore(e.target.value.replace(/[^\d]/g, ''))}
                placeholder="e.g. 780"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-teal-500"
            />

            <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                    <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Report date</label>
                    <input
                        type="date"
                        value={pulledOn}
                        onChange={(e) => setPulledOn(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-teal-500"
                    />
                </div>
                <div>
                    <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Control no. (optional)</label>
                    <input
                        value={controlNumber}
                        onChange={(e) => setControlNumber(e.target.value)}
                        placeholder="CIBIL report ref"
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-teal-500"
                    />
                </div>
            </div>

            {error && <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
            {done && <div className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{done}</div>}

            <button
                onClick={handleSave}
                disabled={!valid || saving}
                className="mt-4 w-full rounded-xl bg-teal-600 px-5 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
            >
                {saving ? 'Saving…' : 'Save bureau pull & recompute'}
            </button>
        </div>
    );
}