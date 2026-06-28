// hooks/useCashPosition.ts
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export interface CashPositionRow {
    id: string;
    msme_id: string;
    as_of_date: string;
    period_from: string | null;
    period_to: string | null;
    closing_balance: number;        // current book balance — NEGATIVE means overdraft drawn
    opening_balance: number | null;
    total_inflow: number | null;    // deposits over the period
    total_outflow: number | null;   // withdrawals over the period
    avg_daily_outflow: number | null; // daily burn
    accounts_count: number | null;
    account_type: string | null;    // 'current' | 'cc_od' | ...
    source: string | null;
}

// Latest cash snapshot → powers the Cash Runway card. Newest as_of_date wins.
// Read directly from Supabase (anon key + RLS), same as the other owner-app hooks.
export function useCashPosition(msmeId: string | null) {
    return useQuery({
        queryKey: ['cash_position', msmeId],
        enabled: !!msmeId,
        queryFn: async (): Promise<CashPositionRow | null> => {
            const { data, error } = await supabase
                .from('cash_position')
                .select('*')
                .eq('msme_id', msmeId)
                .order('as_of_date', { ascending: false })
                .limit(1);
            if (error) throw error;
            return (data && data[0]) ?? null;
        },
    });
}
