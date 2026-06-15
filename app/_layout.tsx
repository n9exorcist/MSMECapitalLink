import { Stack, useRouter, useSegments } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { useAuthStore } from '../stores/useAuthStore';

const queryClient = new QueryClient();

export default function RootLayout() {
    const { loggedIn } = useAuthStore();
    const segments = useSegments();
    const router = useRouter();

    // Route guarding
    useEffect(() => {
        const inAuthGroup = segments[0] === '(auth)';

        if (!loggedIn && !inAuthGroup) {
            // Redirect to login if not authenticated
            router.replace('/(auth)/login');
        } else if (loggedIn && inAuthGroup) {
            // Redirect to tabs if authenticated and trying to access login
            router.replace('/(tabs)');
        }
    }, [loggedIn, segments]);

    return (
        <QueryClientProvider client={queryClient}>
            <StatusBar style="dark" />
            <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="(auth)/login" options={{ animation: 'fade' }} />
                <Stack.Screen name="(tabs)" options={{ animation: 'slide_from_right' }} />
            </Stack>
        </QueryClientProvider>
    );
}