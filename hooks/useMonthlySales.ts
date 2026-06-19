import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export interface MonthlySalesRow {
    id: string;
    msme_id: string;
    month: string;        // ISO date, first of the month (e.g. 2025-04-01)
    revenue: number;      // raw rupees
    source: string;       // gstr3b | gstr1 | manual
}

// Monthly turnover series → powers the Sales Trend chart. Ordered oldest → newest.
export function useMonthlySales(msmeId: string | null) {
    return useQuery({
        queryKey: ['monthly_sales', msmeId],
        enabled: !!msmeId,
        queryFn: async (): Promise<MonthlySalesRow[]> => {
            const { data, error } = await supabase
                .from('monthly_sales')
                .select('*')
                .eq('msme_id', msmeId)
                .order('month', { ascending: true });
            if (error) throw error;
            return (data ?? []) as MonthlySalesRow[];
        },
    });
}
