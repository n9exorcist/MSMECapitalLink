import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { BankingHealthScore } from '@/types/scoring';
import { CashRunway } from '@/types/msme';

// Example of combining multiple backend endpoints into one hook for the Home Dashboard
export function useDashboardMetrics(msmeId: string | null) {
    return useQuery({
        queryKey: ['dashboardMetrics', msmeId],
        queryFn: async () => {
            if (!msmeId) throw new Error('No MSME selected');

            const { data } = await api.get(`/msme/${msmeId}/dashboard`);
            return data as {
                score: BankingHealthScore;
                cashRunway: CashRunway;
                salesTrend: { pct: number; up: boolean; thisMonth: number };
            };
        },
        enabled: !!msmeId, // Only run if we have an active MSME ID
        staleTime: 1000 * 60 * 5, // Cache for 5 minutes
    });
}