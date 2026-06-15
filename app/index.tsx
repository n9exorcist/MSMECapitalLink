import { Redirect } from 'expo-router';
import { useAuthStore } from '../stores/useAuthStore'; // Updated path

export default function Index() {
    // 1. Check the new 'isLoggedIn' property
    const { isLoggedIn } = useAuthStore();

    // 2. Route accordingly
    return <Redirect href={isLoggedIn ? "/(tabs)" : "/(auth)/login"} />;
}