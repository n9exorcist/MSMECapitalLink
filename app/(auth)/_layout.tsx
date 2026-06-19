import { Stack } from 'expo-router';

// Makes (auth) a real group so the root layout's <Stack.Screen name="(auth)" />
// resolves. Room to grow: add otp.tsx, signup.tsx, forgot-password.tsx here later.
export default function AuthLayout() {
    return <Stack screenOptions={{ headerShown: false }} />;
}
