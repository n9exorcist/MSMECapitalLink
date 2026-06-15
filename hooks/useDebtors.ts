import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useDebtors(msmeId: string | null) {
    return useQuery({
        queryKey: ['debtors', msmeId],
        queryFn: async () => {
            const { data } = await api.get(`/msme/${msmeId}/receivables`);
            return data;
        },
        enabled: !!msmeId,
    });
}