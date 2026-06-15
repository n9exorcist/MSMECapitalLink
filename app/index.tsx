import { Redirect } from 'expo-router';
import { useAuthStore } from '../stores/useAuthStore';

export default function Index() {
    const { loggedIn } = useAuthStore();

    // This acts as your traffic cop. It instantly routes the user based on their login state.
    return <Redirect href={loggedIn ? "/(tabs)" : "/(auth)/login"} />;
}