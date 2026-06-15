import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useCreditors(msmeId: string | null) {
    return useQuery({
        queryKey: ['creditors', msmeId],
        queryFn: async () => {
            const { data } = await api.get(`/msme/${msmeId}/payables`);
            return data;
        },
        enabled: !!msmeId,
    });
}