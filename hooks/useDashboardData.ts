import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

// hooks/useDashboardData.ts
export function useDashboardData(msmeId: string) {
    return useQuery({
        queryKey: ['dashboardData', msmeId],
        queryFn: async () => {
            if (!msmeId) throw new Error("No ID provided");
            const { data: entity, error: entityError } = await supabase
                .from('msme_entities')
                .select('*')
                .eq('id', msmeId)
                .single();

            if (entityError) throw entityError;

            // Fetch related data in separate, lighter queries to avoid 400 errors
            const [{ data: debtors }, { data: creditors }, { data: actions }, { data: loans }] = await Promise.all([
                supabase.from('debtors').select('*').eq('msme_id', msmeId),
                supabase.from('creditors').select('*').eq('msme_id', msmeId),
                supabase.from('actions').select('*').eq('msme_id', msmeId), // Fetch actions here
                supabase.from('loans').select('*').eq('msme_id', msmeId),
            ]);
            // Construct the object the UI expects
            // ADD THIS LOG
            console.log("Supabase raw response for actions:", actions);
            console.log("Supabase raw response for creditors:", creditors);
            console.log("Supabase raw response for debtors:", debtors);
            console.log("Supabase raw response for loans:", loans);
            console.log("Querying debtors for msmeId:", msmeId);
            return {
                owner: entity.owner_name || 'Mr. Suresh',
                score: {
                    currentScore: entity.cibil_score || 80,
                    band: entity.cibil_band?.toUpperCase() || 'EXCELLENT',
                    previousScore: 0
                },
                metrics: {
                    moneyIn: {
                        total: debtors?.reduce((acc, d) => acc + (Number(d.amount_outstanding) || 0), 0) || 0,
                        count: debtors?.length || 0,
                        overdueCount: debtors?.filter(d => (d.days_past_due || 0) > 0).length || 0
                    },
                    moneyOut: {
                        total: creditors?.reduce((acc, c) => acc + (Number(c.amount_due) || 0), 0) || 0,
                        count: creditors?.length || 0,
                        weekAmount: 0
                    },
                    cashRunway: { days: 28, cash: 8.2, accounts: 3 },
                    nextEmi: { amount: 1.5, date: '14 Jun', bank: 'Canara', overdue: false },
                    compliance: { status: 'On Track', filing: 'GSTR-3B', daysLeft: 5 },
                    sales: { pct: 12, thisMonth: 18.4, up: true },
                },
                actions: actions || [] // Now it will have data!
            };
        },
        enabled: !!msmeId,
    });
}