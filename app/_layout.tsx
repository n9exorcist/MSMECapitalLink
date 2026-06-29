import { Stack } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// 1. Initialize the TanStack Query Client outside the component
// This prevents it from being recreated every time the screen renders
const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            retry: 2, // If an API call fails, retry twice before showing an error
            refetchOnWindowFocus: true,   // refetch when the app/screen regains focus
            staleTime: 30_000,            // treat data fresh for 30s to avoid over-fetching
        },
    },
});

export default function RootLayout() {
    return (
        // 2. Wrap your entire navigation stack in the Provider
        <QueryClientProvider client={queryClient}>
            <Stack screenOptions={{ headerShown: false }}>
                {/* Define your root routes here so Expo knows about them */}
                <Stack.Screen name="index" />
                <Stack.Screen name="(auth)" />
                <Stack.Screen name="(tabs)" />
            </Stack>
        </QueryClientProvider>
    );
}