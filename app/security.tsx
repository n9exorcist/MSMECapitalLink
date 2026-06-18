import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, Switch, TouchableOpacity, Alert } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { C, T } from '@/constants/theme';
import { ScreenHeader } from '../components/ScreenHeader';

export default function SecurityScreen() {
    const router = useRouter();
    // Local only — a real biometric lock needs expo-local-authentication.
    const [biometric, setBiometric] = useState(false);

    const soon = (what: string) => Alert.alert(what, 'This will be available once sign-in is fully set up.');

    const confirmLogout = () =>
        Alert.alert('Log out', 'Are you sure you want to log out?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Log out', style: 'destructive', onPress: () => router.replace('/login') },
        ]);

    return (
        <>
            <Stack.Screen options={{ headerShown: false }} />
            <SafeAreaView style={styles.safe}>
                <ScreenHeader title="Security" />
                <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

                    <View style={styles.card}>
                        <View style={styles.row}>
                            <View style={styles.iconChip}><Text style={styles.icon}>🔐</Text></View>
                            <View style={styles.rowText}>
                                <Text style={styles.label}>Biometric lock</Text>
                                <Text style={styles.sub}>Unlock with Face ID / fingerprint</Text>
                            </View>
                            <Switch
                                value={biometric}
                                onValueChange={setBiometric}
                                trackColor={{ false: C.border, true: C.teal }}
                                thumbColor={C.white}
                                ios_backgroundColor={C.border}
                            />
                        </View>

                        <TouchableOpacity style={styles.row} activeOpacity={0.7} onPress={() => soon('App PIN')}>
                            <View style={styles.iconChip}><Text style={styles.icon}>🔢</Text></View>
                            <View style={styles.rowText}>
                                <Text style={styles.label}>App PIN</Text>
                                <Text style={styles.sub}>Set a 4-digit code for the app</Text>
                            </View>
                            <Text style={styles.chevron}>›</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={[styles.row, styles.rowLast]} activeOpacity={0.7} onPress={() => soon('Active sessions')}>
                            <View style={styles.iconChip}><Text style={styles.icon}>📱</Text></View>
                            <View style={styles.rowText}>
                                <Text style={styles.label}>Active sessions</Text>
                                <Text style={styles.sub}>See where you’re signed in</Text>
                            </View>
                            <Text style={styles.chevron}>›</Text>
                        </TouchableOpacity>
                    </View>

                    <TouchableOpacity style={styles.logoutBtn} activeOpacity={0.8} onPress={confirmLogout}>
                        <Text style={styles.logoutText}>Log out</Text>
                    </TouchableOpacity>

                </ScrollView>
            </SafeAreaView>
        </>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: C.bg },
    scroll: { padding: 16, paddingBottom: 48 },
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
    iconChip: { width: 38, height: 38, borderRadius: 12, backgroundColor: `${C.navy}0D`, alignItems: 'center', justifyContent: 'center' },
    icon: { fontSize: 17, lineHeight: 21 },
    rowText: { flex: 1 },
    label: { fontSize: T.base, fontWeight: '700', color: C.text },
    sub: { fontSize: 12, color: C.textMuted, marginTop: 2 },
    chevron: { fontSize: 22, fontWeight: '400', color: C.textMuted },
    logoutBtn: {
        marginTop: 16, backgroundColor: C.redBg, borderRadius: 16, paddingVertical: 15, alignItems: 'center',
        borderWidth: 1, borderColor: `${C.red}33`,
    },
    logoutText: { color: C.red, fontSize: T.base, fontWeight: '800' },
});
