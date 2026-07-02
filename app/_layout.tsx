import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { QueryClient, QueryClientProvider, focusManager } from '@tanstack/react-query';  // ← add focusManager
import { AppState, Platform } from 'react-native';                                       // ← add this line
import { useAuthStore } from '../stores/useAuthStore';

// 1. Initialize the TanStack Query Client outside the component
const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            retry: 2,
            refetchOnWindowFocus: true,
            staleTime: 30_000,
        },
    },
});

// ── ADD THIS ──────────────────────────────────────────────────────────
// Make React Query's "focus" refetch actually work on native.
// refetchOnWindowFocus is web-only by default; this bridges it to
// React Native's foreground/background events.
AppState.addEventListener('change', (status) => {
    if (Platform.OS !== 'web') focusManager.setFocused(status === 'active');
});
// ──────────────────────────────────────────────────────────────────────

export default function RootLayout() {
    // Restore the persisted session once on boot, so a valid token keeps the user
    // signed in across cold starts instead of bouncing them to the login screen.
    const checkAuth = useAuthStore((s) => s.checkAuth);
    useEffect(() => { checkAuth(); }, [checkAuth]);

    return (
        <QueryClientProvider client={queryClient}>
            <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="index" />
                <Stack.Screen name="(auth)" />
                <Stack.Screen name="(tabs)" />
            </Stack>
        </QueryClientProvider>
    );
}