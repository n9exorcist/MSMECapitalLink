import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export interface ComplianceFilingRow {
    id: string;
    msme_id: string;
    filing_type: string;   // GSTR-1 | GSTR-3B | TDS | PF | ESI | ITR
    period: string;        // 'Mar 2026'
    period_month: string;  // ISO date, first of the return month
    due_date: string;      // ISO date
    filed_date: string | null;
    amount: number | null; // tax due (₹); null for info-only filings
    status: string;        // pending | filed | overdue
    arn: string | null;
}

// Compliance filing log → powers the Compliance Calendar (upcoming dues + filed history).
export function useComplianceFilings(msmeId: string | null) {
    return useQuery({
        queryKey: ['compliance_filings', msmeId],
        enabled: !!msmeId,
        queryFn: async (): Promise<ComplianceFilingRow[]> => {
            const { data, error } = await supabase
                .from('compliance_filings')
                .select('*')
                .eq('msme_id', msmeId)
                .order('due_date', { ascending: true });
            if (error) throw error;
            return (data ?? []) as ComplianceFilingRow[];
        },
    });
}
