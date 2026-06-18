// lib/format.ts
// Display helpers for the owner app. Keep all currency + score-colour logic here
// so every screen formats identically (single source of truth for presentation).

// Compact Indian currency: raw rupees -> "₹2.45 Cr" / "₹17.3L" / "₹45,000".
export function formatINR(rupees: number | null | undefined): string {
    const n = Number(rupees);
    if (!Number.isFinite(n)) return '—';
    const sign = n < 0 ? '-' : '';
    const abs = Math.abs(n);
    if (abs >= 1e7) return `${sign}₹${trim(abs / 1e7)} Cr`;
    if (abs >= 1e5) return `${sign}₹${trim(abs / 1e5)}L`;
    return `${sign}₹${Math.round(abs).toLocaleString('en-IN')}`;
}

// Full Indian grouping: 24492203 -> "₹2,44,92,203" (use on detail rows).
export function formatINRFull(rupees: number | null | undefined): string {
    const n = Number(rupees);
    if (!Number.isFinite(n)) return '—';
    const sign = n < 0 ? '-' : '';
    return `${sign}₹${Math.round(Math.abs(n)).toLocaleString('en-IN')}`;
}

function trim(v: number): string {
    // 2.4492 -> "2.45", 17.0 -> "17", 8.20 -> "8.2"
    return v.toFixed(2).replace(/\.?0+$/, '');
}

// Health-score colour — keyed to the NUMBER, never the band word, so a change in
// band casing/wording can't break it. Use for the ring AND the band label.
export function scoreColor(score: number | null | undefined): string {
    const s = Number(score);
    if (!Number.isFinite(s)) return '#94a3b8'; // unknown — grey
    if (s >= 80) return '#059669';             // excellent — green
    if (s >= 60) return '#0f766e';             // good — teal
    if (s >= 40) return '#d97706';             // fair — amber
    return '#dc2626';                          // needs attention — red
}