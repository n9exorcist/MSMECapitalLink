import { Redirect } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { C } from '@/constants/theme';
import { useAuthStore } from '../stores/useAuthStore'; // Updated path

export default function Index() {
    const { isLoggedIn, hydrated } = useAuthStore();

    // Wait for checkAuth() (boot session-restore) before deciding, so a valid
    // persisted token doesn't briefly bounce the user to /login.
    if (!hydrated) {
        return (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg }}>
                <ActivityIndicator color={C.teal} />
            </View>
        );
    }

    return <Redirect href={isLoggedIn ? "/(tabs)" : "/(auth)/login"} />;
}