'use client';
import React, { useEffect, useState, useCallback } from 'react';
import { uploadDocument, listDocuments, type DocRow, type UploadResult } from '../lib/api';

const DOC_TYPES = [
    { value: 'bank_statement', label: 'Bank statement (PDF)' },
    { value: 'gst_return', label: 'GST return' },
    { value: 'financials', label: 'Financial statement' },
    { value: 'other', label: 'Other document' },
];

const lakh = (n: number) => '₹' + (Math.abs(n) / 1e5).toFixed(1) + 'L';
const perDay = (n: number) => '₹' + Math.round(Math.abs(n)).toLocaleString('en-IN') + '/day';

export default function DocumentUpload({
    msmeId,
    onUploaded,
}: {
    msmeId: string;
    onUploaded?: () => void;
}) {
    const [docType, setDocType] = useState('bank_statement');
    const [file, setFile] = useState<File | null>(null);
    const [busy, setBusy] = useState(false);
    const [result, setResult] = useState<UploadResult | null>(null);
    const [docs, setDocs] = useState<DocRow[]>([]);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        try {
            const r = await listDocuments(msmeId);
            setDocs(r.documents);
        } catch {
            /* non-blocking */
        }
    }, [msmeId]);

    useEffect(() => {
        let cancelled = false;
        listDocuments(msmeId)
            .then((r) => { if (!cancelled) setDocs(r.documents); })
            .catch(() => { /* non-blocking */ });
        return () => { cancelled = true; };
    }, [msmeId]);

    const onUpload = async () => {
        if (!file) return;
        setBusy(true);
        setError(null);
        setResult(null);
        try {
            const r = await uploadDocument(msmeId, file, docType);
            setResult(r);
            setFile(null);
            await refresh();
            onUploaded?.();
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Upload failed');
        } finally {
            setBusy(false);
        }
    };

    const ex = result?.extracted;

    return (
        <div className="docup">
            <div className="docup-card">
                <h3 className="docup-h">Upload a document</h3>
                <p className="docup-sub">
                    The file is stored securely. Bank statements are read automatically into the dashboard.
                </p>

                <label className="docup-label">Document type</label>
                <select
                    className="docup-select"
                    value={docType}
                    onChange={(e) => setDocType(e.target.value)}
                    disabled={busy}
                >
                    {DOC_TYPES.map((d) => (
                        <option key={d.value} value={d.value}>
                            {d.label}
                        </option>
                    ))}
                </select>

                <label className="docup-label">File (PDF)</label>
                <input
                    className="docup-file"
                    type="file"
                    accept="application/pdf"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                    disabled={busy}
                />

                <button className="docup-btn" onClick={onUpload} disabled={!file || busy}>
                    {busy ? 'Uploading & reading…' : 'Upload & process'}
                </button>

                {error && <div className="docup-err">{error}</div>}

                {result && (
                    <div className={`docup-result ${result.status}`}>
                        {result.status === 'parsed' && ex ? (
                            <>
                                <div className="docup-rtitle">✓ Read and saved to the dashboard</div>
                                <div className="docup-grid">
                                    <div>
                                        <span>Closing balance</span>
                                        <b className={ex.closing_balance != null && ex.closing_balance < 0 ? 'neg' : ''}>
                                            {ex.closing_balance != null
                                                ? ex.closing_balance < 0
                                                    ? `${lakh(ex.closing_balance)} (overdraft)`
                                                    : lakh(ex.closing_balance)
                                                : '—'}
                                        </b>
                                    </div>
                                    <div>
                                        <span>Daily burn</span>
                                        <b>{ex.avg_daily_outflow != null ? perDay(ex.avg_daily_outflow) : '—'}</b>
                                    </div>
                                    <div>
                                        <span>Money in / out</span>
                                        <b>
                                            {ex.total_inflow != null ? lakh(ex.total_inflow) : '—'} /{' '}
                                            {ex.total_outflow != null ? lakh(ex.total_outflow) : '—'}
                                        </b>
                                    </div>
                                    <div>
                                        <span>Period</span>
                                        <b>
                                            {ex.period_from ?? '—'} → {ex.period_to ?? '—'}
                                        </b>
                                    </div>
                                </div>
                                <div className={`docup-conf ${ex.confidence}`}>
                                    read via {ex.method} · {ex.confidence} confidence
                                    {ex.confidence !== 'high' ? ' — please double-check the figures' : ''}
                                </div>
                            </>
                        ) : (
                            <div className="docup-rtitle warn">
                                ⚠ File stored, but the figures couldn&apos;t be read automatically. Enter them in the
                                Cash / Financials tab.
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div className="docup-card">
                <h3 className="docup-h">Uploaded documents</h3>
                {docs.length === 0 ? (
                    <p className="docup-empty">Nothing uploaded yet.</p>
                ) : (
                    <ul className="docup-list">
                        {docs.map((d) => (
                            <li key={d.id} className="docup-item">
                                <div className="docup-item-main">
                                    <span className="docup-item-name">{d.file_name}</span>
                                    <span className="docup-item-meta">
                                        {d.doc_type.replace('_', ' ')} · {new Date(d.created_at).toLocaleDateString('en-IN')}
                                    </span>
                                </div>
                                <span className={`docup-badge ${d.status}`}>{d.status}</span>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            <style>{`
        .docup { display:flex; flex-direction:column; gap:16px; max-width:560px; }
        .docup-card { background:#fff; border:1px solid #E2EAF4; border-radius:16px; padding:20px; }
        .docup-h { margin:0 0 4px; font-size:16px; font-weight:800; color:#0B2E4F; }
        .docup-sub { margin:0 0 16px; font-size:12.5px; color:#64748B; }
        .docup-label { display:block; font-size:11px; font-weight:700; letter-spacing:.4px; text-transform:uppercase; color:#64748B; margin:12px 0 6px; }
        .docup-select, .docup-file { width:100%; padding:10px 12px; border:1px solid #CBD8E8; border-radius:10px; font-size:14px; color:#0F172A; background:#F8FBFF; box-sizing:border-box; }
        .docup-btn { margin-top:16px; width:100%; padding:12px; border:0; border-radius:10px; background:#0F766E; color:#fff; font-size:14px; font-weight:700; cursor:pointer; }
        .docup-btn:disabled { opacity:.5; cursor:not-allowed; }
        .docup-err { margin-top:12px; padding:10px 12px; border-radius:10px; background:#FEF2F2; color:#B91C1C; font-size:13px; }
        .docup-result { margin-top:16px; padding:14px; border-radius:12px; background:#F0FDF4; border:1px solid #BBF7D0; }
        .docup-result.stored, .docup-result.failed { background:#FFFBEB; border-color:#FDE68A; }
        .docup-rtitle { font-size:13.5px; font-weight:700; color:#15803D; margin-bottom:10px; }
        .docup-rtitle.warn { color:#B45309; margin-bottom:0; }
        .docup-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px 16px; }
        .docup-grid > div { display:flex; flex-direction:column; gap:2px; }
        .docup-grid span { font-size:11px; color:#64748B; }
        .docup-grid b { font-size:14px; color:#0B2E4F; font-weight:700; }
        .docup-grid b.neg { color:#B45309; }
        .docup-conf { margin-top:10px; font-size:11.5px; color:#64748B; }
        .docup-conf.high { color:#15803D; }
        .docup-conf.medium { color:#B45309; }
        .docup-conf.low { color:#B91C1C; }
        .docup-empty { font-size:13px; color:#94A3B8; margin:4px 0 0; }
        .docup-list { list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:8px; }
        .docup-item { display:flex; align-items:center; justify-content:space-between; padding:10px 12px; border:1px solid #EEF4FB; border-radius:10px; }
        .docup-item-main { display:flex; flex-direction:column; gap:2px; min-width:0; }
        .docup-item-name { font-size:13px; font-weight:600; color:#0F172A; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:340px; }
        .docup-item-meta { font-size:11px; color:#94A3B8; text-transform:capitalize; }
        .docup-badge { font-size:10.5px; font-weight:700; padding:3px 9px; border-radius:20px; text-transform:capitalize; }
        .docup-badge.parsed { background:#DCFCE7; color:#15803D; }
        .docup-badge.stored { background:#FEF3C7; color:#B45309; }
        .docup-badge.processing { background:#E0F2FE; color:#0369A1; }
        .docup-badge.failed { background:#FEE2E2; color:#B91C1C; }
      `}</style>
        </div>
    );
}
