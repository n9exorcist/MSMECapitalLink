import { Stack } from 'expo-router';
import { QueryClient, QueryClientProvider, focusManager } from '@tanstack/react-query';  // ← add focusManager
import { AppState, Platform } from 'react-native';                                       // ← add this line

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