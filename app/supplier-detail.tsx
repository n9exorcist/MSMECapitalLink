import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { C, T } from '@/constants/theme';
import { ScreenHeader } from '../components/ScreenHeader';
import { formatINR } from '../lib/format';
import { notify } from '../lib/alert';

async function openLink(url: string, fallback: string) {
    try {
        const ok = await Linking.canOpenURL(url);
        if (ok) { await Linking.openURL(url); return; }
        throw new Error('unsupported');
    } catch {
        notify('Could not open', fallback);
    }
}

export default function SupplierDetailScreen() {
    const p = useLocalSearchParams<{ id: string; name: string; amount: string; due: string; daysLeft: string; urgent: string; upi: string }>();

    const name = p.name || 'Supplier';
    const amount = Number(p.amount) || 0;
    const due = p.due || '—';
    const daysLeft = (p.daysLeft === '' || p.daysLeft == null) ? null : Number(p.daysLeft);
    const urgent = p.urgent === 'true';
    const upi = (p.upi || '').trim();

    let label = 'Upcoming';
    let color: string = C.green;
    if (daysLeft != null && daysLeft < 0) { label = 'Overdue'; color = C.red; }
    else if (urgent) { label = 'Due soon'; color = C.amber; }

    const upiUrl =
        `upi://pay?pa=${encodeURIComponent(upi)}&pn=${encodeURIComponent(name)}` +
        `&am=${amount}&cu=INR&tn=${encodeURIComponent('Payment via MFOS')}`;

    const onPay = () => {
        if (!upi) return notify('No UPI ID', `Add a UPI ID for ${name} in the CFO console to pay by UPI.`);
        openLink(upiUrl, 'No UPI app found on this device to handle the payment.');
    };
    const onMarkPaid = () =>
        notify('Mark as paid', 'Recording a payment writes back to your records, which needs sign-in to be set up first. Coming soon.');

    return (
        <>
            <Stack.Screen options={{ headerShown: false }} />
            <SafeAreaView style={styles.safe}>
                <ScreenHeader title="Supplier" />
                <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

                    {/* Hero */}
                    <View style={styles.hero}>
                        <View style={[styles.avatar, { backgroundColor: color + '18' }]}>
                            <Text style={[styles.avatarText, { color }]}>{name.charAt(0).toUpperCase()}</Text>
                        </View>
                        <Text style={styles.name} numberOfLines={1}>{name}</Text>
                        <View style={[styles.statusPill, { backgroundColor: color + '18' }]}>
                            <Text style={[styles.statusPillText, { color }]}>{label}</Text>
                        </View>
                        <Text style={styles.amount}>{formatINR(amount)}</Text>
                        <Text style={styles.amountSub}>due {due}{daysLeft != null ? ` · ${daysLeft} days` : ''}</Text>
                    </View>

                    {/* Actions */}
                    <TouchableOpacity style={styles.payBtn} activeOpacity={0.9} onPress={onPay}>
                        <Text style={styles.payIcon}>⚡</Text>
                        <Text style={styles.payText}>Pay via UPI</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.markBtn} activeOpacity={0.8} onPress={onMarkPaid}>
                        <Text style={styles.markText}>Mark as paid</Text>
                    </TouchableOpacity>

                    {/* Details */}
                    <View style={styles.card}>
                        <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>Amount due</Text>
                            <Text style={styles.detailValue}>{formatINR(amount)}</Text>
                        </View>
                        <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>Due date</Text>
                            <Text style={styles.detailValue}>{due}</Text>
                        </View>
                        <View style={[styles.detailRow, styles.detailRowLast]}>
                            <Text style={styles.detailLabel}>UPI ID</Text>
                            <Text style={styles.detailValue}>{upi || 'Not on file'}</Text>
                        </View>
                    </View>

                    <Text style={styles.note}>
                        Pay via UPI opens your payment app (GPay / PhonePe / Paytm…) with the amount pre-filled.
                        Works on a phone with a UPI app installed.
                    </Text>

                </ScrollView>
            </SafeAreaView>
        </>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: C.bg },
    scroll: { padding: 16, paddingBottom: 48 },

    hero: { alignItems: 'center', paddingVertical: 16, marginBottom: 8 },
    avatar: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
    avatarText: { fontSize: 30, fontWeight: '800' },
    name: { fontSize: T.lg, fontWeight: '800', color: C.navy, letterSpacing: -0.3 },
    statusPill: { marginTop: 8, paddingVertical: 4, paddingHorizontal: 12, borderRadius: 20 },
    statusPillText: { fontSize: 11, fontWeight: '800' },
    amount: { fontSize: 34, fontWeight: '800', color: C.text, marginTop: 16, letterSpacing: -0.5 },
    amountSub: { fontSize: 13, color: C.textMuted, marginTop: 2 },

    payBtn: {
        marginTop: 8, backgroundColor: C.navy, borderRadius: 16, paddingVertical: 15,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
        boxShadow: '0px 8px 18px rgba(11,46,79,0.22)',
    } as any,
    payIcon: { fontSize: 16 },
    payText: { color: C.white, fontSize: T.base, fontWeight: '800', letterSpacing: 0.3 },
    markBtn: {
        marginTop: 10, backgroundColor: C.surface, borderRadius: 16, paddingVertical: 14,
        alignItems: 'center', borderWidth: 1, borderColor: C.border,
    },
    markText: { color: C.navy, fontSize: T.base, fontWeight: '800' },

    card: {
        marginTop: 20, backgroundColor: C.surface, borderRadius: 20, paddingHorizontal: 16,
        borderWidth: 1, borderColor: C.border, boxShadow: '0px 4px 12px rgba(11,46,79,0.04)',
    } as any,
    detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: C.border },
    detailRowLast: { borderBottomWidth: 0 },
    detailLabel: { fontSize: 13, fontWeight: '600', color: C.textSub },
    detailValue: { fontSize: 14, fontWeight: '800', color: C.text },

    note: { fontSize: 12, color: C.textMuted, lineHeight: 18, marginTop: 18, paddingHorizontal: 4 },
});
