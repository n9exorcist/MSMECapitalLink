import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';

export function useDashboardData() {
    return useQuery({
        queryKey: ['dashboardData'],
        queryFn: () => apiFetch('/api/v1/msme/dashboard'),
        refetchInterval: 1000 * 60 * 5, // Auto-refresh every 5 minutes
    });
}