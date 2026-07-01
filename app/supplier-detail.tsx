import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, Linking, Modal, TextInput, ActivityIndicator, Pressable } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { C, T } from '@/constants/theme';
import { ScreenHeader } from '../components/ScreenHeader';
import { supabase } from '../lib/supabase';
import { formatINR } from '../lib/format';
import { notify } from '../lib/alert';

const PAY_MODES: { key: string; label: string }[] = [
    { key: 'upi', label: 'UPI' },
    { key: 'neft', label: 'NEFT / IMPS' },
    { key: 'cheque', label: 'Cheque' },
    { key: 'cash', label: 'Cash' },
];

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

    const router = useRouter();
    const queryClient = useQueryClient();
    const [showPaid, setShowPaid] = useState(false);
    const [mode, setMode] = useState<string>(upi ? 'upi' : 'neft');
    const [utr, setUtr] = useState('');
    const [saving, setSaving] = useState(false);
    const [paidDone, setPaidDone] = useState(false);

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
    const onMarkPaid = () => {
        if (!p.id) return notify('Cannot record', 'This supplier has no record id.');
        setShowPaid(true);
    };

    const confirmPaid = async () => {
        if (!p.id) return;
        setSaving(true);
        const { error } = await supabase
            .from('creditors')
            .update({ paid_at: new Date().toISOString(), utr: utr.trim() || null, paid_mode: mode })
            .eq('id', p.id);
        setSaving(false);
        if (error) return notify('Could not save', error.message);
        queryClient.invalidateQueries({ queryKey: ['creditors'] });
        setShowPaid(false);
        setPaidDone(true);
    };

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
                    {paidDone ? (
                        <View style={styles.paidBanner}>
                            <Text style={styles.paidBannerTitle}>✓ Marked as paid</Text>
                            <Text style={styles.paidBannerSub}>
                                {PAY_MODES.find((m) => m.key === mode)?.label ?? mode}
                                {utr.trim() ? ` · UTR ${utr.trim()}` : ''}
                            </Text>
                            <TouchableOpacity style={styles.doneBtn} activeOpacity={0.85} onPress={() => router.back()}>
                                <Text style={styles.doneText}>Done</Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <>
                            <TouchableOpacity style={styles.payBtn} activeOpacity={0.9} onPress={onPay}>
                                <Text style={styles.payIcon}>⚡</Text>
                                <Text style={styles.payText}>Pay via UPI</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.markBtn} activeOpacity={0.8} onPress={onMarkPaid}>
                                <Text style={styles.markText}>Mark as paid</Text>
                            </TouchableOpacity>
                        </>
                    )}

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

                {/* Mark-as-paid sheet */}
                <Modal visible={showPaid} transparent animationType="slide" onRequestClose={() => setShowPaid(false)}>
                    <Pressable style={styles.backdrop} onPress={() => !saving && setShowPaid(false)}>
                        <Pressable style={styles.sheet} onPress={() => { }}>
                            <View style={styles.handle} />
                            <Text style={styles.sheetTitle}>Mark as paid</Text>
                            <Text style={styles.sheetSub}>{name} · {formatINR(amount)}</Text>

                            <Text style={styles.fieldLabel}>Payment mode</Text>
                            <View style={styles.modeRow}>
                                {PAY_MODES.map((m) => (
                                    <TouchableOpacity
                                        key={m.key}
                                        activeOpacity={0.8}
                                        onPress={() => setMode(m.key)}
                                        style={[styles.modeChip, mode === m.key && styles.modeChipOn]}
                                    >
                                        <Text style={[styles.modeChipText, mode === m.key && styles.modeChipTextOn]}>{m.label}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <Text style={styles.fieldLabel}>UTR / reference {mode === 'cash' ? '(optional)' : ''}</Text>
                            <TextInput
                                style={styles.input}
                                placeholder={mode === 'cheque' ? 'Cheque number' : 'e.g. 4155XXXXXXXX'}
                                placeholderTextColor={C.textMuted}
                                value={utr}
                                onChangeText={setUtr}
                                autoCapitalize="characters"
                            />

                            <TouchableOpacity style={[styles.confirmBtn, saving && { opacity: 0.6 }]} activeOpacity={0.9} disabled={saving} onPress={confirmPaid}>
                                {saving ? <ActivityIndicator color={C.white} /> : <Text style={styles.confirmText}>Confirm payment</Text>}
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.cancelBtn} onPress={() => !saving && setShowPaid(false)}>
                                <Text style={styles.cancelText}>Cancel</Text>
                            </TouchableOpacity>
                        </Pressable>
                    </Pressable>
                </Modal>
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

    // Paid confirmation banner (replaces the action buttons after marking paid)
    paidBanner: {
        marginTop: 8, backgroundColor: `${C.green}0D`, borderRadius: 16, padding: 18,
        borderWidth: 1, borderColor: `${C.green}33`, alignItems: 'center',
    },
    paidBannerTitle: { fontSize: T.base, fontWeight: '800', color: C.green },
    paidBannerSub: { fontSize: 12, fontWeight: '600', color: C.textSub, marginTop: 4 },
    doneBtn: { marginTop: 14, backgroundColor: C.navy, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 40 },
    doneText: { color: C.white, fontSize: T.base, fontWeight: '800' },

    // Mark-as-paid sheet
    backdrop: { flex: 1, backgroundColor: 'rgba(11,46,79,0.35)', justifyContent: 'flex-end' },
    sheet: { backgroundColor: C.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 32 },
    handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: C.border, marginBottom: 16 },
    sheetTitle: { fontSize: T.lg, fontWeight: '800', color: C.navy },
    sheetSub: { fontSize: 13, fontWeight: '600', color: C.textSub, marginTop: 2, marginBottom: 16 },
    fieldLabel: { fontSize: 12, fontWeight: '800', color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8, marginTop: 6 },
    modeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 6 },
    modeChip: { paddingVertical: 9, paddingHorizontal: 14, borderRadius: 12, backgroundColor: C.bg, borderWidth: 1.5, borderColor: C.border },
    modeChipOn: { backgroundColor: C.navy, borderColor: C.navy },
    modeChipText: { fontSize: 13, fontWeight: '700', color: C.textSub },
    modeChipTextOn: { color: C.white },
    input: { backgroundColor: C.bg, borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, fontWeight: '700', color: C.text, marginBottom: 8 },
    confirmBtn: { marginTop: 14, backgroundColor: C.green, borderRadius: 16, paddingVertical: 15, alignItems: 'center', boxShadow: '0px 8px 18px rgba(5,150,105,0.28)' } as any,
    confirmText: { color: C.white, fontSize: T.base, fontWeight: '800', letterSpacing: 0.3 },
    cancelBtn: { marginTop: 10, paddingVertical: 13, alignItems: 'center' },
    cancelText: { color: C.textSub, fontSize: T.base, fontWeight: '700' },
});
