import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, Switch, TouchableOpacity, Alert, Platform, ActivityIndicator } from 'react-native';
import { Stack } from 'expo-router';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { C, T } from '@/constants/theme';
import { ScreenHeader } from '../components/ScreenHeader';

// Show notifications even when the app is in the foreground.
// (Older Expo SDKs: replace the banner/list fields below with `shouldShowAlert: true`.)
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
    }),
});

const PREFS = [
    { key: 'push', icon: '📲', label: 'Push notifications', sub: 'Alerts on your phone' },
    { key: 'whatsapp', icon: '💬', label: 'WhatsApp updates', sub: 'Daily briefing & reminders' },
    { key: 'email', icon: '✉️', label: 'Email summaries', sub: 'Weekly health report' },
    { key: 'payments', icon: '💰', label: 'Payment reminders', sub: 'When money is due in or out' },
    { key: 'score', icon: '📊', label: 'Health score changes', sub: 'When your score moves' },
];

export default function NotificationsScreen() {
    // Preference toggles — local only for now (no preferences table yet).
    const [on, setOn] = useState<Record<string, boolean>>({
        push: true, whatsapp: true, email: false, payments: true, score: true,
    });
    const toggle = (k: string) => setOn((s) => ({ ...s, [k]: !s[k] }));

    const [sending, setSending] = useState(false);
    const [pushToken, setPushToken] = useState<string | null>(null);
    const [tokenNote, setTokenNote] = useState('Fetching device token…');

    // Best-effort fetch of the Expo push token (for remote tests via Expo's push tool).
    async function refreshToken() {
        try {
            if (Platform.OS === 'web') { setTokenNote('Push isn’t available on web — try a real phone.'); return; }
            const projectId =
                (Constants as any)?.expoConfig?.extra?.eas?.projectId ??
                (Constants as any)?.easConfig?.projectId;
            const res = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
            setPushToken(res.data);
            setTokenNote('Paste this into Expo’s push tool to send a remote test.');
        } catch {
            setTokenNote('Couldn’t get a push token — needs a dev build (not Expo Go) + a projectId.');
        }
    }

    useEffect(() => { refreshToken(); }, []);

    async function ensurePermission(): Promise<boolean> {
        const { status } = await Notifications.getPermissionsAsync();
        let final = status;
        if (status !== 'granted') {
            const req = await Notifications.requestPermissionsAsync();
            final = req.status;
        }
        if (final !== 'granted') {
            Alert.alert('Notifications are off', 'Turn on notifications for MFOS in your phone’s Settings to receive alerts.');
            return false;
        }
        if (Platform.OS === 'android') {
            await Notifications.setNotificationChannelAsync('default', {
                name: 'Default',
                importance: Notifications.AndroidImportance.MAX,
            });
        }
        return true;
    }

    async function sendTest() {
        try {
            setSending(true);
            const ok = await ensurePermission();
            if (!ok) return;
            // Permission may have just been granted — try the token again.
            if (!pushToken) refreshToken();
            await Notifications.scheduleNotificationAsync({
                content: { title: 'MFOS', body: 'Test notification — your alerts are working ✅' },
                trigger: null, // fire now
            });
        } catch {
            Alert.alert('Could not send', 'Something went wrong sending the test notification.');
        } finally {
            setSending(false);
        }
    }

    return (
        <>
            <Stack.Screen options={{ headerShown: false }} />
            <SafeAreaView style={styles.safe}>
                <ScreenHeader title="Notifications" />
                <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
                    <Text style={styles.caption}>Choose what MFOS keeps you posted about.</Text>

                    <View style={styles.card}>
                        {PREFS.map((p, i) => (
                            <View key={p.key} style={[styles.row, i === PREFS.length - 1 && styles.rowLast]}>
                                <View style={styles.iconChip}><Text style={styles.icon}>{p.icon}</Text></View>
                                <View style={styles.rowText}>
                                    <Text style={styles.label}>{p.label}</Text>
                                    <Text style={styles.sub}>{p.sub}</Text>
                                </View>
                                <Switch
                                    value={on[p.key]}
                                    onValueChange={() => toggle(p.key)}
                                    trackColor={{ false: C.border, true: C.teal }}
                                    thumbColor={C.white}
                                    ios_backgroundColor={C.border}
                                />
                            </View>
                        ))}
                    </View>

                    {/* ── Test loop ── */}
                    <Text style={styles.sectionLabel}>Test</Text>
                    <View style={styles.testCard}>
                        <Text style={styles.testTitle}>Send yourself a test</Text>
                        <Text style={styles.testSub}>Fires a real notification on this device so you can confirm the plumbing works.</Text>

                        <TouchableOpacity style={[styles.testBtn, sending && { opacity: 0.7 }]} activeOpacity={0.9} onPress={sendTest} disabled={sending}>
                            {sending ? <ActivityIndicator color={C.white} /> : <Text style={styles.testBtnText}>Send a test notification</Text>}
                        </TouchableOpacity>

                        <View style={styles.tokenBox}>
                            <Text style={styles.tokenLabel}>EXPO PUSH TOKEN</Text>
                            <Text style={styles.tokenValue} selectable numberOfLines={2}>{pushToken ?? '—'}</Text>
                            <Text style={styles.tokenNote}>{tokenNote}</Text>
                        </View>
                    </View>
                </ScrollView>
            </SafeAreaView>
        </>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: C.bg },
    scroll: { padding: 16, paddingBottom: 48 },
    caption: { fontSize: 13, color: C.textSub, marginBottom: 14, paddingHorizontal: 4 },
    card: {
        backgroundColor: C.surface, borderRadius: 20, paddingHorizontal: 6, paddingVertical: 2,
        borderWidth: 1, borderColor: C.border, boxShadow: '0px 4px 12px rgba(11,46,79,0.04)',
    } as any,
    row: {
        flexDirection: 'row', alignItems: 'center', gap: 12,
        paddingVertical: 14, paddingHorizontal: 12,
        borderBottomWidth: 1, borderBottomColor: C.border,
    },
    rowLast: { borderBottomWidth: 0 },
    iconChip: { width: 38, height: 38, borderRadius: 12, backgroundColor: `${C.teal}14`, alignItems: 'center', justifyContent: 'center' },
    icon: { fontSize: 17, lineHeight: 21 },
    rowText: { flex: 1 },
    label: { fontSize: T.base, fontWeight: '700', color: C.text },
    sub: { fontSize: 12, color: C.textMuted, marginTop: 2 },

    // Test section
    sectionLabel: { fontSize: 12, fontWeight: '800', color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 24, marginBottom: 10, paddingLeft: 4 },
    testCard: {
        backgroundColor: C.surface, borderRadius: 20, padding: 18,
        borderWidth: 1, borderColor: C.border, boxShadow: '0px 4px 12px rgba(11,46,79,0.04)',
    } as any,
    testTitle: { fontSize: T.base, fontWeight: '800', color: C.navy },
    testSub: { fontSize: 12.5, color: C.textSub, marginTop: 4, lineHeight: 18 },
    testBtn: { marginTop: 14, backgroundColor: C.teal, borderRadius: 14, paddingVertical: 14, alignItems: 'center', boxShadow: '0px 8px 18px rgba(15,118,110,0.30)' } as any,
    testBtnText: { color: C.white, fontSize: T.base, fontWeight: '800', letterSpacing: 0.3 },
    tokenBox: { marginTop: 16, backgroundColor: C.bg, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: C.border },
    tokenLabel: { fontSize: 10, fontWeight: '800', color: C.textMuted, letterSpacing: 0.6 },
    tokenValue: { fontSize: 12, color: C.text, marginTop: 4, fontWeight: '600' },
    tokenNote: { fontSize: 11, color: C.textMuted, marginTop: 6, lineHeight: 16 },
});
