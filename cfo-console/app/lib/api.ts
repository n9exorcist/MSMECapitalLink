// lib/api.ts — CFO console → FastAPI client. Every call now carries the Supabase
// JWT, and a 401 (missing/expired token) bounces the user to /login.
import type { Client360Data } from '../console/Client360';
import type { ParsePayload } from '../console/FinancialReviewScreen';
import { supabase } from './supabase';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

type Row = Record<string, string | number | boolean | null | undefined>;

async function authHeaders(): Promise<Record<string, string>> {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
}

async function handle(res: Response) {
    if (res.status === 401) {
        if (typeof window !== 'undefined') {
            await supabase.auth.signOut();
            window.location.href = '/login';
        }
        throw new Error('Session expired — please sign in again.');
    }

    if (!res.ok) {
        const detail = await res.text().catch(() => '');
        throw new Error(detail || res.statusText);
    }
    return res.json();
}

async function get(path: string) {
    const headers = await authHeaders();
    return fetch(`${API}${path}`, { headers }).then(handle);
}

async function post(path: string, body: unknown) {
    const headers = await authHeaders();
    return fetch(`${API}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify(body),
    }).then(handle);
}

// ── Portfolio list (used by the /console dashboard) ──
export interface ClientRow {
    id: string; company: string; owner?: string; sector?: string;
    msme_class?: string; location?: string;
    turnover?: number; health_score?: number; band?: string;
    provisional?: boolean; data_completeness?: number; score_delta?: number;
    last_update?: string; risk?: string;
    phone?: string; email?: string;
}

export const listClients = (): Promise<{ clients: ClientRow[] }> => get('/msme/clients');

// ── Client 360 ──
export const getClient360 = (id: string): Promise<Client360Data> =>
    get(`/msme/${id}/client360`);

// ── Documents ──
// Fetches a generated document PDF (auth header included so it survives an auth flip)
// and saves it as a .pdf file via a download anchor. The route sends
// Content-Disposition: attachment with the filename. `docKey` matches the backend
// registry (reports/registry.py), e.g. 'health'.
export async function downloadDocument(msmeId: string, docKey: string): Promise<void> {
    const headers = await authHeaders();
    const res = await fetch(`${API}/msme/${msmeId}/documents/${docKey}`, { headers });
    if (res.status === 401) {
        if (typeof window !== 'undefined') {
            await supabase.auth.signOut();
            window.location.href = '/login';
        }
        throw new Error('Session expired — please sign in again.');
    }
    if (!res.ok) {
        const detail = await res.text().catch(() => '');
        throw new Error(detail || res.statusText);
    }
    // force the PDF MIME so the browser never treats the blob as HTML
    const blob = new Blob([await res.blob()], { type: 'application/pdf' });

    // prefer the server-provided filename; fall back to a sensible default
    const cd = res.headers.get('Content-Disposition') ?? '';
    const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(cd);
    const filename = match ? decodeURIComponent(match[1]) : `MFOS_${docKey}_${msmeId}.pdf`;

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

// ── Per-client read + writes ──
export interface EntryData {
    company: string | null;
    owner: string | null;
    financials: Row | null;
    financials_history: Row[];
    debtors: Row[];
    creditors: Row[];
    proposal: Row | null;
    loans: Row[];
    compliance: Row[];
    banking: Row[];
}

export const getEntry = (msmeId: string): Promise<EntryData> =>
    get(`/msme/${msmeId}/entry`);

// ── Loan proposal (the credit ask, for the Bank Proposal doc) ──
export const saveProposal = (msmeId: string, body: Row) =>
    post(`/msme/${msmeId}/proposal`, body);

export const saveFinancials = (
    msmeId: string,
    body: Row,
    period?: { period_label: string; period_year: number; period_month: number },
) => post(`/msme/${msmeId}/financials`, { ...body, ...period });

export const saveCreditBureauPull = (
    msmeId: string,
    body: {
        score: number;
        subject_type?: 'individual' | 'commercial';
        subject_name?: string;
        subject_pan?: string;
        pulled_on?: string;          // 'YYYY-MM-DD'
        control_number?: string;
        report_doc_id?: string;      // documents.id from a prior uploadDocument call
    },
) => post(`/msme/${msmeId}/credit-bureau`, body);

// ── Daily Briefing → owner app "Today's 3 Actions" (§9.4 / §5.2) ──
export interface BriefAction {
    icon?: string;
    text: string;
    detail: string;
    urgency?: 'high' | 'medium' | 'low';
}

// Suggest 3 actions (AI-assisted, grounded in the read-model) — does not persist.
export const draftBriefing = (
    msmeId: string,
): Promise<{ msme_id: string; client_name: string; source: 'ai' | 'rules'; actions: BriefAction[] }> =>
    post(`/ai/daily-briefing/${msmeId}/draft`, {});

// Publish the (edited) actions — replaces the client's set the owner app reads.
export const publishBriefing = (
    msmeId: string,
    actions: BriefAction[],
): Promise<{ status: string; count: number; actions: (BriefAction & { id: string })[] }> =>
    post(`/ai/daily-briefing/${msmeId}/publish`, { actions });

export const saveDebtor = (msmeId: string, body: Row) =>
    post(`/msme/${msmeId}/debtors`, body);

export const saveCreditor = (msmeId: string, body: Row) =>
    post(`/msme/${msmeId}/creditors`, body);


// ── Document upload (multipart → backend stores + parses) ──
// No Content-Type header: the browser sets the multipart boundary itself.
async function postForm(path: string, form: FormData) {
    const headers = await authHeaders();
    return fetch(`${API}${path}`, { method: 'POST', headers, body: form }).then(handle);
}


export interface ExtractedStatement {
    parsed: boolean;
    method: string;
    confidence: 'high' | 'medium' | 'low';
    closing_balance: number | null;
    opening_balance: number | null;
    total_inflow: number | null;
    total_outflow: number | null;
    avg_daily_outflow: number | null;
    account_type: string | null;
    accounts_count: number | null;
    period_from: string | null;
    period_to: string | null;
    days: number | null;
}


export interface UploadResult {
    document_id: string;
    status: 'parsed' | 'stored' | 'failed' | 'processing';
    extracted: ExtractedStatement | null;
    review?: ParsePayload;   // present only for financial-statement uploads
}

export const uploadDocument = (
    msmeId: string,
    file: File,
    docType: string,
): Promise<UploadResult> => {
    const form = new FormData();
    form.append('file', file);
    form.append('doc_type', docType);
    return postForm(`/msme/${msmeId}/documents`, form);
};



export interface DocRow {
    id: string;
    doc_type: string;
    file_name: string;
    status: string;
    extracted: ExtractedStatement | null;
    period_from: string | null;
    period_to: string | null;
    size_bytes: number | null;
    created_at: string;
}

export const listDocuments = (msmeId: string): Promise<{ documents: DocRow[] }> =>
    get(`/msme/${msmeId}/documents`);