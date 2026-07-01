import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

// hooks/useCreditors.ts
// Reads the SAME `creditors` table the CFO console writes and the dashboard sums.
export interface Creditor {
    id: string;
    name: string;
    amount_due: number;
    due_date: string | null;
    upi_id?: string | null;
    // Mark-as-paid (owner app writes these back): settlement stamp + reference.
    paid_at?: string | null;
    utr?: string | null;
    paid_mode?: string | null;
}

export function useCreditors(msmeId: string | null) {
    return useQuery({
        queryKey: ['creditors', msmeId],
        queryFn: async (): Promise<Creditor[]> => {
            if (!msmeId) return [];
            const { data, error } = await supabase
                .from('creditors')
                .select('*')
                .eq('msme_id', msmeId)
                .order('amount_due', { ascending: false });
            if (error) throw error;
            return data ?? [];
        },
        enabled: !!msmeId,
    });
}
