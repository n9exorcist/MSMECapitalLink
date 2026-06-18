import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

// hooks/useDebtors.ts
// Reads the SAME `debtors` table the CFO console writes and the dashboard sums.
export interface Debtor {
    id: string;
    name: string;
    amount_outstanding: number;
    days_outstanding: number;
    status?: string | null;
}

export function useDebtors(msmeId: string | null) {
    return useQuery({
        queryKey: ['debtors', msmeId],
        queryFn: async (): Promise<Debtor[]> => {
            if (!msmeId) return [];
            const { data, error } = await supabase
                .from('debtors')
                .select('*')
                .eq('msme_id', msmeId)
                .order('amount_outstanding', { ascending: false });
            if (error) throw error;
            return data ?? [];
        },
        enabled: !!msmeId,
    });
}
