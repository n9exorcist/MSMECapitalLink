import { useQuery, UseQueryResult } from '@tanstack/react-query'; // Import UseQueryResult
import { api } from '../lib/api';

// Define the return type explicitly
export function useDashboardData(msmeId: string, requestData: any) { // Add requestData here
    const query = useQuery({
        queryKey: ['dashboardData', msmeId],
        queryFn: async () => {
            // Change .get to .post to match your @router.post decorator
            const { data } = await api.post(`/msme/${msmeId}/dashboard`, requestData);
            return data;
        },
        enabled: !!msmeId,
    });

    return {
        ...query,
        refetch: query.refetch
    };
}