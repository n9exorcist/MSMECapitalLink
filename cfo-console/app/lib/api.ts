// lib/api.ts — CFO console → FastAPI client
// Set NEXT_PUBLIC_API_URL in .env.local (e.g. http://localhost:8000 or your LAN IP).

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

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

export interface EntryData {
  company: string | null;
  owner: string | null;
  financials: Record<string, any> | null;
  debtors: any[];
  creditors: any[];
}

export const getEntry = (msmeId: string): Promise<EntryData> =>
  fetch(`${API}/msme/${msmeId}/entry`).then(handle);

export const saveFinancials = (msmeId: string, body: Record<string, any>) =>
  post(`/msme/${msmeId}/financials`, body); // returns { status, score }

export const saveDebtor = (msmeId: string, body: Record<string, any>) =>
  post(`/msme/${msmeId}/debtors`, body);

export const saveCreditor = (msmeId: string, body: Record<string, any>) =>
  post(`/msme/${msmeId}/creditors`, body);
