import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet, StatusBar, Animated } from 'react-native';
import { useAuthStore } from '../../stores/useAuthStore';
import { useRouter } from 'expo-router';
import { C, T } from '@/constants/theme';
import { supabase } from '../../lib/supabase';
import { AUTH_MODE } from '../../lib/authMode';

export default function LoginScreen() {
    const { login, syncFromSupabase } = useAuthStore();
    const router = useRouter();

    const isEmail = AUTH_MODE === 'email';

    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');
    const [otp, setOtp] = useState('');
    const [step, setStep] = useState('phone'); // 'phone' (identifier) | 'otp'
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const emailValid = /^\S+@\S+\.\S+$/.test(email);
    const idReady = isEmail ? emailValid : phone.length >= 10;

    const fadeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: false }).start();
    }, [step]);

    const handleSendOtp = async () => {
        if (!idReady) return;
        setLoading(true);
        setError(null);

        if (AUTH_MODE !== 'mock') {
            // Real OTP. email mode uses Supabase's built-in email (no SMS provider);
            // supabase mode uses phone (needs an SMS provider configured).
            const { error: err } = isEmail
                ? await supabase.auth.signInWithOtp({ email })
                : await supabase.auth.signInWithOtp({ phone: `+91${phone}` });
            setLoading(false);
            if (err) { setError(err.message); return; }
            setStep('otp');
            fadeAnim.setValue(0);
            return;
        }

        // Mock: no send, just advance to the code screen.
        setTimeout(() => {
            setLoading(false);
            setStep('otp');
            fadeAnim.setValue(0);
        }, 1200);
    };

    const handleVerify = async () => {
        if (otp.length < 6) return;
        setLoading(true);
        setError(null);

        if (AUTH_MODE !== 'mock') {
            const { error: err } = isEmail
                ? await supabase.auth.verifyOtp({ email, token: otp, type: 'email' })
                : await supabase.auth.verifyOtp({ phone: `+91${phone}`, token: otp, type: 'sms' });
            if (err) { setLoading(false); setError(err.message); return; }
            await syncFromSupabase();   // reflect the new session into the store
            setLoading(false);
            router.replace('/(tabs)');
            return;
        }

        // Mock: accept any 6 digits, store a placeholder token, enter the app.
        setTimeout(async () => {
            setLoading(false);
            await login('mock-jwt-token-123', 'owner');
            router.replace('/(tabs)');
        }, 1000);
    };

    return (
        <View style={styles.loginBg}>
            <StatusBar barStyle="light-content" backgroundColor={C.navyDark} />

            {/* Background decoration */}
            <View style={styles.loginDecor1} />
            <View style={styles.loginDecor2} />

            <Animated.View style={[styles.loginCard, { opacity: fadeAnim }]}>
                {/* Logo */}
                <View style={styles.loginLogo}>
                    <Text style={styles.loginLogoText}>MFOS</Text>
                    <Text style={styles.loginLogoSub}>MSME Financial Operating System</Text>
                </View>

                <View style={styles.loginDivider} />

                {step === 'phone' ? (
                    <>
                        <Text style={styles.loginTitle}>Welcome back</Text>
                        <Text style={styles.loginSubtitle}>
                            {isEmail ? 'Enter your email to continue' : 'Enter your mobile number to continue'}
                        </Text>

                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>{isEmail ? 'Email' : 'Mobile Number'}</Text>
                            {isEmail ? (
                                <TextInput
                                    style={styles.textInput}
                                    placeholder="you@company.com"
                                    placeholderTextColor={C.textMuted}
                                    keyboardType="email-address"
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                    value={email}
                                    onChangeText={setEmail}
                                />
                            ) : (
                                <View style={styles.inputRow}>
                                    <View style={styles.inputPrefix}>
                                        <Text style={styles.inputPrefixText}>🇮🇳 +91</Text>
                                    </View>
                                    <TextInput
                                        style={styles.textInput}
                                        placeholder="98765 43210"
                                        placeholderTextColor={C.textMuted}
                                        keyboardType="phone-pad"
                                        maxLength={10}
                                        value={phone}
                                        onChangeText={setPhone}
                                    />
                                </View>
                            )}
                        </View>

                        <TouchableOpacity
                            style={[styles.loginBtn, !idReady && styles.loginBtnDisabled]}
                            onPress={handleSendOtp}
                            disabled={loading || !idReady}
                        >
                            {loading ? <ActivityIndicator color={C.white} /> : <Text style={styles.loginBtnText}>Send OTP →</Text>}
                        </TouchableOpacity>
                    </>
                ) : (
                    <>
                        <Text style={styles.loginTitle}>{isEmail ? 'Verify your email' : 'Verify your number'}</Text>
                        <Text style={styles.loginSubtitle}>{isEmail ? `Code sent to ${email}` : `OTP sent to +91 ${phone}`}</Text>

                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>Enter OTP</Text>
                            <TextInput
                                style={[styles.textInput, { letterSpacing: 12, fontSize: T.xl, textAlign: 'center', height: 60 }]}
                                placeholder="• • • • • •"
                                placeholderTextColor={C.textMuted}
                                keyboardType="number-pad"
                                maxLength={6}
                                value={otp}
                                onChangeText={setOtp}
                                autoFocus
                            />
                        </View>

                        <TouchableOpacity
                            style={[styles.loginBtn, otp.length < 6 && styles.loginBtnDisabled]}
                            onPress={handleVerify}
                            disabled={loading || otp.length < 6}
                        >
                            {loading ? <ActivityIndicator color={C.white} /> : <Text style={styles.loginBtnText}>Verify & Enter →</Text>}
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.resendBtn} onPress={() => setStep('phone')}>
                            <Text style={styles.resendText}>{isEmail ? '← Change email' : '← Change number'}</Text>
                        </TouchableOpacity>
                    </>
                )}

                {error && <Text style={styles.errorText}>{error}</Text>}

                <Text style={styles.loginFooter}>Powered by 20 years of MSME banking expertise</Text>
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    loginBg: { flex: 1, backgroundColor: C.navyDark, alignItems: 'center', justifyContent: 'center', padding: 24 },
    loginDecor1: { position: 'absolute', top: -60, right: -60, width: 240, height: 240, borderRadius: 120, backgroundColor: C.teal, opacity: 0.12 },
    loginDecor2: { position: 'absolute', bottom: -80, left: -40, width: 280, height: 280, borderRadius: 140, backgroundColor: C.navyLight, opacity: 0.3 },
    loginCard: { width: '100%', backgroundColor: C.surface, borderRadius: 28, padding: 28, boxShadow: '0px 20px 40px rgba(0,0,0,0.25)' } as any,
    loginLogo: { alignItems: 'center', marginBottom: 20 },
    loginLogoText: { fontSize: 42, fontWeight: '900', color: C.navy, letterSpacing: -2 },
    loginLogoSub: { fontSize: T.xs, fontWeight: '600', color: C.teal, letterSpacing: 1.5, textTransform: 'uppercase', marginTop: 4, textAlign: 'center' },
    loginDivider: { height: 1, backgroundColor: C.border, marginBottom: 24 },
    loginTitle: { fontSize: T.xl, fontWeight: '800', color: C.navy, marginBottom: 6 },
    loginSubtitle: { fontSize: T.sm, color: C.textSub, marginBottom: 24 },
    inputGroup: { marginBottom: 20 },
    inputLabel: { fontSize: T.sm, fontWeight: '700', color: C.textSub, marginBottom: 8 },
    inputRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    inputPrefix: { backgroundColor: C.surfaceAlt, borderWidth: 1.5, borderColor: C.border, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 12 },
    inputPrefixText: { fontSize: T.sm, fontWeight: '700', color: C.text },
    textInput: { flex: 1, backgroundColor: C.surfaceAlt, borderWidth: 1.5, borderColor: C.border, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 16, fontSize: T.base, color: C.text, fontWeight: '600' },
    loginBtn: { backgroundColor: C.navy, borderRadius: 16, paddingVertical: 16, alignItems: 'center', boxShadow: '0px 6px 12px rgba(11,46,79,0.35)' } as any,
    loginBtnDisabled: { backgroundColor: C.textMuted, opacity: 0.5 },
    loginBtnText: { color: C.white, fontSize: T.base, fontWeight: '800', letterSpacing: 0.3 },
    resendBtn: { marginTop: 16, alignItems: 'center' },
    resendText: { fontSize: T.sm, color: C.teal, fontWeight: '600' },
    errorText: { marginTop: 16, fontSize: T.sm, color: C.red, textAlign: 'center', fontWeight: '600' },
    loginFooter: { marginTop: 28, fontSize: T.xs, color: C.textMuted, textAlign: 'center' },
});