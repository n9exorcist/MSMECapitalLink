import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Platform } from 'react-native'; // Added Platform
import { useAuthStore } from '../../stores/useAuthStore';
import * as SecureStore from 'expo-secure-store';

export default function LoginScreen() {
    const login = useAuthStore((state) => state.login);
    const [phone, setPhone] = useState('');
    const [loading, setLoading] = useState(false);

    const handleLogin = async () => {
        setLoading(true);

        // Simulate OTP / Backend verification
        setTimeout(async () => {
            const tokenKey = 'mfos_session_jwt';
            const tokenValue = 'mock-jwt-token';

            try {
                if (Platform.OS === 'web') {
                    // Safe browser fallback
                    window.localStorage.setItem(tokenKey, tokenValue);
                } else {
                    // Secure native storage for Android/iOS
                    await SecureStore.setItemAsync(tokenKey, tokenValue);
                }
            } catch (error) {
                console.warn("Storage warning:", error);
            }

            setLoading(false);
            login(); // Triggers the state change and switches layout
        }, 1000);
    };

    return (
        <View style={{ flex: 1, backgroundColor: '#061D33', justifyContent: 'center', padding: 24 }}>
            <Text style={{ color: '#FFFFFF', fontSize: 24, fontWeight: '800', marginBottom: 20 }}>
                Welcome to MFOS
            </Text>
            <TextInput
                style={{ backgroundColor: '#FFFFFF', padding: 16, borderRadius: 12, marginBottom: 16 }}
                placeholder="Mobile Number"
                keyboardType="phone-pad"
                value={phone}
                onChangeText={setPhone}
            />
            <TouchableOpacity
                onPress={handleLogin}
                style={{ backgroundColor: '#0F766E', padding: 16, borderRadius: 12, alignItems: 'center' }}
            >
                {loading ? <ActivityIndicator color="#FFF" /> : <Text style={{ color: '#FFF', fontWeight: 'bold' }}>Send OTP</Text>}
            </TouchableOpacity>
        </View>
    );
}