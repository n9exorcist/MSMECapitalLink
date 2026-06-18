import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase'; // ← match the import your useDebtors / useCreditors use

// Full column set from the loans table. There's no lender / interest-rate / status
// column — the card derives status from the balance and omits bank name + rate.
export interface LoanRow {
    id: string;
    msme_id: string;
    loan_type: string | null;
    sanctioned_amount: number | null;   // raw rupees
    outstanding_balance: number | null;  // raw rupees
    emi_amount: number | null;           // raw rupees
    next_due_date: string | null;        // ISO date — next EMI due
    created_at: string | null;
}

// Supabase-direct, same shape the other money hooks use: returns { data, isLoading }.
// Primary loan = largest sanctioned (loans[0]); change the .order() to show the
// most recent instead.
export function useLoans(msmeId: string | null) {
    return useQuery({
        queryKey: ['loans', msmeId],
        queryFn: async (): Promise<LoanRow[]> => {
            const { data, error } = await supabase
                .from('loans')
                .select('*')
                .eq('msme_id', msmeId)
                .order('sanctioned_amount', { ascending: false });
            if (error) throw error;
            return (data ?? []) as LoanRow[];
        },
        enabled: !!msmeId,
    });
}
