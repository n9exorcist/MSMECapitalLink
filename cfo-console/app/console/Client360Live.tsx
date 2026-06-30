'use client';
// app/console/Client360Live.tsx
// Fetches the live /msme/{id}/client360 payload and feeds it to <Client360>.

import { useEffect, useState, type ReactNode } from 'react';
import Client360, { type Client360Data } from './Client360';
import { getClient360 } from '../lib/api';

export default function Client360Live(
  { msmeId, belowHeader, headerOnly, refreshKey = 0, onBureauSaved }:
    { msmeId: string; belowHeader?: ReactNode; headerOnly?: boolean; refreshKey?: number; onBureauSaved?: () => void },
) {
  const [data, setData] = useState<Client360Data | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!msmeId) return;
    let ignore = false;
    getClient360(msmeId)
      .then((d) => { if (!ignore) setData(d as Client360Data); })
      .catch((e) => { if (!ignore) setErr((e as Error).message); });
    return () => { ignore = true; };
  }, [msmeId, refreshKey]);

  if (err) return headerOnly
    ? <>{belowHeader}</>
    : <>{belowHeader}<div style={{ padding: 24, color: '#475569' }}>Couldn&apos;t load this client: {err}</div></>;
  if (!data) return headerOnly
    ? <>{belowHeader}</>
    : <>{belowHeader}<div style={{ padding: 24, color: '#94A3B8' }}>Loading Client 360…</div></>;
  return (
    <Client360
      data={data}
      belowHeader={belowHeader}
      headerOnly={headerOnly}
      msmeId={msmeId}
      onBureauSaved={onBureauSaved}
    />
  );
}