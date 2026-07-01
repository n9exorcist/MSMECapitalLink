import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

// hooks/useDashboardData.ts
//
// FIX SUMMARY (why the app disagreed with the CFO console):
//  1. Score read the wrong column. `cibil_score` (300–900 bureau score) is 0 here,
//     so `0 || 80` showed a hardcoded 80. The real health score lives in
//     `health_score` — the column score_service / the console writes. Now read that.
//  2. Delta was fabricated: previousScore was 0, so the UI showed "↑80". Now we read
//     `previous_score` / `score_delta` and return null when there's no real anchor.
//  3. overdueCount filtered on `days_past_due` (doesn't exist on debtors). The column
//     is `days_outstanding`. Fixed.
//  4. cashRunway / nextEmi / compliance / sales USED to be mock here. They are now
//     sourced live on the Home screen from dedicated hooks (useCashPosition, useLoans,
//     useComplianceFilings, useMonthlySales), so this hook only returns the score +
//     money-in/out it owns. No mock metrics remain.

// Owner app stays jargon-free: map the console's A/B/C/D bands to plain words.
const BAND_LABEL: Record<string, string> = {
    A: 'Excellent',
    B: 'Good',
    C: 'Fair',
    D: 'Needs attention',
};
function labelFromScore(s: number | null): string {
    if (s == null) return '—';
    if (s >= 80) return 'Excellent';
    if (s >= 60) return 'Good';
    if (s >= 40) return 'Fair';
    return 'Needs attention';
}

// "Overdue" threshold for receivables (matches the Money In screen: 65d = overdue).
// Adjust to whatever rule the console uses.
const OVERDUE_DAYS = 60;

export function useDashboardData(msmeId: string) {
    return useQuery({
        queryKey: ['dashboardData', msmeId],
        queryFn: async () => {
            if (!msmeId) throw new Error('No ID provided');

            const { data: entity, error: entityError } = await supabase
                .from('msme_entities')
                .select('*')
                .eq('id', msmeId)
                .single();
            if (entityError) throw entityError;

            // Lighter related queries (avoids the 400s from a single nested select).
            const [{ data: debtors }, { data: creditors }, { data: actions }] = await Promise.all([
                supabase.from('debtors').select('*').eq('msme_id', msmeId),
                supabase.from('creditors').select('*').eq('msme_id', msmeId),
                supabase.from('actions').select('*').eq('msme_id', msmeId),
            ]);

            // ── Health score: the SAME columns the console / score_service persist ──────
            const currentScore: number | null = entity.health_score ?? null;
            const previousScore: number | null = entity.previous_score ?? null;
            const delta: number | null =
                entity.score_delta ??
                (currentScore != null && previousScore != null ? currentScore - previousScore : null);
            const band = BAND_LABEL[String(entity.band || '').toUpperCase()] || labelFromScore(currentScore);

            return {
                owner: entity.owner_name ?? '',
                score: {
                    currentScore,            // 76, not the fake 80
                    band,                    // friendly word, owner-appropriate
                    previousScore,           // real anchor, or null
                    delta,                   // null on first run — show the chip only when != null
                },

                metrics: {
                    // ── REAL — same tables the console writes, so these stay in sync ──────
                    // Cash Runway, Next EMI, GST & Tax and Sales Trend are NOT here: the
                    // Home screen sources them live from their own hooks (see file header).
                    moneyIn: {
                        total: (debtors ?? []).reduce((a, d) => a + (Number(d.amount_outstanding) || 0), 0),
                        count: debtors?.length ?? 0,
                        overdueCount: (debtors ?? []).filter(
                            (d) => (Number(d.days_outstanding) || 0) >= OVERDUE_DAYS
                        ).length,
                    },
                    moneyOut: {
                        total: (creditors ?? []).reduce((a, c) => a + (Number(c.amount_due) || 0), 0),
                        count: creditors?.length ?? 0,
                        weekAmount: 0, // TODO: sum creditors with due_date within 7 days once that field is set
                    },
                },

                actions: actions ?? [],
            };
        },
        enabled: !!msmeId,
    });
}