import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { C, T } from '@/constants/theme';
import { ScreenHeader } from '../components/ScreenHeader';
import { formatINR } from '../lib/format';
import { notify } from '../lib/alert';

type Status = 'overdue' | 'due' | 'current';
const statusColor = (s: Status) => (s === 'overdue' ? C.red : s === 'due' ? C.amber : C.green);
const statusLabel = (s: Status) => (s === 'overdue' ? 'Overdue' : s === 'due' ? 'Due soon' : 'On track');

async function openLink(url: string, fallback: string) {
    try {
        const ok = await Linking.canOpenURL(url);
        if (ok) { await Linking.openURL(url); return; }
        throw new Error('unsupported');
    } catch {
        notify('Could not open', fallback);
    }
}

export default function CustomerDetailScreen() {
    const p = useLocalSearchParams<{ id: string; name: string; amount: string; days: string; status: string; phone: string }>();

    const name = p.name || 'Customer';
    const amount = Number(p.amount) || 0;
    const days = Number(p.days) || 0;
    const status = (p.status as Status) || 'current';
    const phone = (p.phone || '').trim();

    const digits = phone.replace(/[^\d]/g, '');
    const waNumber = digits.length === 10 ? '91' + digits : digits; // assume India if no country code
    const color = statusColor(status);

    const reminder =
        `Hi ${name}, a gentle reminder that ${formatINR(amount)} is pending` +
        `${days ? ` (${days} days outstanding)` : ''}. Could you please arrange the payment at your convenience? Thank you.`;

    const onWhatsApp = () => {
        if (!digits) return notify('No phone number', `Add a phone number for ${name} in the CFO console to send a reminder.`);
        openLink(`https://wa.me/${waNumber}?text=${encodeURIComponent(reminder)}`, `WhatsApp ${phone}`);
    };
    const onCall = () => {
        if (!digits) return notify('No phone number', `Add a phone number for ${name} in the CFO console to call them.`);
        openLink(`tel:${phone}`, `Call ${phone}`);
    };

    return (
        <>
            <Stack.Screen options={{ headerShown: false }} />
            <SafeAreaView style={styles.safe}>
                <ScreenHeader title="Customer" />
                <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

                    {/* Hero */}
                    <View style={styles.hero}>
                        <View style={[styles.avatar, { backgroundColor: color + '18' }]}>
                            <Text style={[styles.avatarText, { color }]}>{name.charAt(0).toUpperCase()}</Text>
                        </View>
                        <Text style={styles.name} numberOfLines={1}>{name}</Text>
                        <View style={[styles.statusPill, { backgroundColor: color + '18' }]}>
                            <Text style={[styles.statusPillText, { color }]}>{statusLabel(status)}</Text>
                        </View>
                        <Text style={styles.amount}>{formatINR(amount)}</Text>
                        <Text style={styles.amountSub}>outstanding · {days} days</Text>
                    </View>

                    {/* Actions */}
                    <TouchableOpacity style={styles.waBtn} activeOpacity={0.9} onPress={onWhatsApp}>
                        <Text style={styles.waIcon}>💬</Text>
                        <Text style={styles.waText}>Send WhatsApp reminder</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.callBtn} activeOpacity={0.8} onPress={onCall}>
                        <Text style={styles.callText}>📞  Call customer</Text>
                    </TouchableOpacity>

                    {/* Details */}
                    <View style={styles.card}>
                        <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>Outstanding</Text>
                            <Text style={styles.detailValue}>{formatINR(amount)}</Text>
                        </View>
                        <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>Days outstanding</Text>
                            <Text style={styles.detailValue}>{days} days</Text>
                        </View>
                        <View style={[styles.detailRow, styles.detailRowLast]}>
                            <Text style={styles.detailLabel}>Phone</Text>
                            <Text style={styles.detailValue}>{phone || 'Not on file'}</Text>
                        </View>
                    </View>

                    {/* Reminder preview */}
                    <Text style={styles.previewLabel}>Reminder preview</Text>
                    <View style={styles.previewCard}>
                        <Text style={styles.previewText}>{reminder}</Text>
                    </View>

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

    waBtn: {
        marginTop: 8, backgroundColor: C.green, borderRadius: 16, paddingVertical: 15,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
        boxShadow: '0px 8px 18px rgba(5,150,105,0.28)',
    } as any,
    waIcon: { fontSize: 17 },
    waText: { color: C.white, fontSize: T.base, fontWeight: '800', letterSpacing: 0.3 },
    callBtn: {
        marginTop: 10, backgroundColor: C.surface, borderRadius: 16, paddingVertical: 14,
        alignItems: 'center', borderWidth: 1, borderColor: C.border,
    },
    callText: { color: C.navy, fontSize: T.base, fontWeight: '800' },

    card: {
        marginTop: 20, backgroundColor: C.surface, borderRadius: 20, paddingHorizontal: 16,
        borderWidth: 1, borderColor: C.border, boxShadow: '0px 4px 12px rgba(11,46,79,0.04)',
    } as any,
    detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: C.border },
    detailRowLast: { borderBottomWidth: 0 },
    detailLabel: { fontSize: 13, fontWeight: '600', color: C.textSub },
    detailValue: { fontSize: 14, fontWeight: '800', color: C.text },

    previewLabel: { fontSize: 12, fontWeight: '800', color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 24, marginBottom: 10, paddingLeft: 4 },
    previewCard: { backgroundColor: `${C.green}0D`, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: `${C.green}26` },
    previewText: { fontSize: 13, color: C.text, lineHeight: 20 },
});
