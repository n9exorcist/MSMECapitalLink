// lib/api.ts — CFO console → FastAPI client
// Set NEXT_PUBLIC_API_URL in .env.local (e.g. http://localhost:8000 or your LAN IP).
import type { Client360Data } from '../console/Client360';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

/** A flat record of field values — entry payloads, debtor/creditor rows, financials. */
type Row = Record<string, string | number | boolean | null | undefined>;

async function handle(res: Response) {
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(detail || res.statusText);
  }
  return res.json();
}

function post(path: string, body: unknown) {
  return fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then(handle);
}

export const getClient360 = (id: string): Promise<Client360Data> =>
  fetch(`${API}/msme/${id}/client360`).then(handle);

export interface EntryData {
  company: string | null;
  owner: string | null;
  financials: Row | null;
  debtors: Row[];
  creditors: Row[];
}

export const getEntry = (msmeId: string): Promise<EntryData> =>
  fetch(`${API}/msme/${msmeId}/entry`).then(handle);

export const saveFinancials = (msmeId: string, body: Row) =>
  post(`/msme/${msmeId}/financials`, body); // returns { status, score }

export const saveDebtor = (msmeId: string, body: Row) =>
  post(`/msme/${msmeId}/debtors`, body);

export const saveCreditor = (msmeId: string, body: Row) =>
  post(`/msme/${msmeId}/creditors`, body);
