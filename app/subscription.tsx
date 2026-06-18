import React from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity, Alert } from 'react-native';
import { Stack } from 'expo-router';
import { C, T } from '@/constants/theme';
import { ScreenHeader } from '../components/ScreenHeader';

const FREE_FEATURES = ['Business health score', 'Money in / out tracking', 'Loan & EMI view', 'Talk to your CFO'];
const PRO_FEATURES = ['Document vault & uploads', 'Priority CFO response', 'Monthly video review', 'Advanced compliance alerts', 'Monthly health report PDF'];

export default function SubscriptionScreen() {
    const onUpgrade = () => Alert.alert('Upgrade to Pro', 'Billing is coming soon — your CFO will help you switch plans in the meantime.');

    return (
        <>
            <Stack.Screen options={{ headerShown: false }} />
            <SafeAreaView style={styles.safe}>
                <ScreenHeader title="Subscription" />
                <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

                    {/* Current plan */}
                    <View style={styles.currentCard}>
                        <View style={styles.glow} />
                        <Text style={styles.currentLabel}>CURRENT PLAN</Text>
                        <Text style={styles.currentName}>MFOS Free</Text>
                        <View style={styles.featureList}>
                            {FREE_FEATURES.map((f) => (
                                <View key={f} style={styles.featureRow}>
                                    <Text style={styles.tickLight}>✓</Text>
                                    <Text style={styles.featureLight}>{f}</Text>
                                </View>
                            ))}
                        </View>
                    </View>

                    {/* Pro upsell */}
                    <View style={styles.proCard}>
                        <View style={styles.proTop}>
                            <Text style={styles.proName}>MFOS Pro</Text>
                            <View style={styles.proBadge}><Text style={styles.proBadgeText}>Recommended</Text></View>
                        </View>
                        <Text style={styles.proSub}>Everything in Free, plus:</Text>
                        <View style={styles.featureList}>
                            {PRO_FEATURES.map((f) => (
                                <View key={f} style={styles.featureRow}>
                                    <Text style={styles.tick}>✓</Text>
                                    <Text style={styles.feature}>{f}</Text>
                                </View>
                            ))}
                        </View>
                        <TouchableOpacity style={styles.upgradeBtn} activeOpacity={0.9} onPress={onUpgrade}>
                            <Text style={styles.upgradeText}>Upgrade to Pro</Text>
                        </TouchableOpacity>
                    </View>

                </ScrollView>
            </SafeAreaView>
        </>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: C.bg },
    scroll: { padding: 16, paddingBottom: 48, gap: 16 },

    // Current plan (navy hero)
    currentCard: {
        backgroundColor: C.navy, borderRadius: 20, padding: 22, overflow: 'hidden', position: 'relative',
        boxShadow: '0px 12px 28px rgba(11,46,79,0.22)',
    } as any,
    glow: { position: 'absolute', top: -45, right: -35, width: 160, height: 160, borderRadius: 80, backgroundColor: C.teal, opacity: 0.20 },
    currentLabel: { fontSize: 11, fontWeight: '700', color: 'rgba(226,234,244,0.7)', letterSpacing: 0.5 },
    currentName: { fontSize: 26, fontWeight: '800', color: C.white, marginTop: 4, letterSpacing: -0.5 },
    featureList: { marginTop: 14, gap: 8 },
    featureRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    tickLight: { fontSize: 13, fontWeight: '800', color: C.tealLight },
    featureLight: { fontSize: 13, fontWeight: '600', color: 'rgba(226,234,244,0.85)' },

    // Pro card
    proCard: {
        backgroundColor: C.surface, borderRadius: 20, padding: 22,
        borderWidth: 1.5, borderColor: `${C.teal}40`, boxShadow: '0px 6px 18px rgba(11,46,79,0.08)',
    } as any,
    proTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    proName: { fontSize: 20, fontWeight: '800', color: C.navy },
    proBadge: { backgroundColor: `${C.teal}14`, borderWidth: 1, borderColor: `${C.teal}30`, paddingVertical: 4, paddingHorizontal: 10, borderRadius: 20 },
    proBadgeText: { fontSize: 11, fontWeight: '800', color: C.teal },
    proSub: { fontSize: 13, color: C.textSub, marginTop: 6, fontWeight: '600' },
    tick: { fontSize: 13, fontWeight: '800', color: C.teal },
    feature: { fontSize: 13, fontWeight: '600', color: C.text },
    upgradeBtn: { marginTop: 18, backgroundColor: C.teal, borderRadius: 14, paddingVertical: 15, alignItems: 'center', boxShadow: '0px 8px 18px rgba(15,118,110,0.30)' } as any,
    upgradeText: { color: C.white, fontSize: T.base, fontWeight: '800', letterSpacing: 0.3 },
});
