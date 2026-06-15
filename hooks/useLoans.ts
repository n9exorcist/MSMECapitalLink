import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Loan, EMI } from '@/types/loans';

export function useLoans(msmeId: string | null) {
    return useQuery({
        queryKey: ['loans', msmeId],
        queryFn: async () => {
            const { data } = await api.get(`/msme/${msmeId}/loans`);
            return data as {
                activeLoans: Loan[];
                upcomingEmis: EMI[];
            };
        },
        enabled: !!msmeId,
    });
}