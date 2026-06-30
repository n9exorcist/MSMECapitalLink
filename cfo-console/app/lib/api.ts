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
    turnover?: number; health_score?: number; band?: string;
    last_update?: string; risk?: string;
}

export const listClients = (): Promise<{ clients: ClientRow[] }> => get('/msme/clients');

// ── Client 360 ──
export const getClient360 = (id: string): Promise<Client360Data> =>
    get(`/msme/${id}/client360`);

// ── Per-client read + writes ──
export interface EntryData {
    company: string | null;
    owner: string | null;
    financials: Row | null;
    debtors: Row[];
    creditors: Row[];
}

export const getEntry = (msmeId: string): Promise<EntryData> =>
    get(`/msme/${msmeId}/entry`);

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