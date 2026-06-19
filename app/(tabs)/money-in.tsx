import React, { useState, useEffect, useRef } from 'react';
import { ScrollView, View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, SafeAreaView, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { notify } from '../../lib/alert';
import { useMsmeData } from '../../hooks/useMsmeData';
import { useDebtors } from '../../hooks/useDebtors';
import { formatINR } from '../../lib/format';
import { C } from '@/constants/theme';

// Status is derived from days_outstanding (same buckets the UI filters on).
type DebtorStatus = 'overdue' | 'due' | 'current';
const OVERDUE_DAYS = 60;
const DUE_SOON_DAYS = 30;
function statusOf(days: number): DebtorStatus {
    if (days > OVERDUE_DAYS) return 'overdue';
    if (days >= DUE_SOON_DAYS) return 'due';
    return 'current';
}

const statusColor = (s: DebtorStatus) => (s === 'overdue' ? C.red : s === 'due' ? C.amber : C.green);
const statusLabel = (s: DebtorStatus) => (s === 'overdue' ? 'Overdue' : s === 'due' ? 'Due soon' : 'On track');

interface Row {
    id: string;
    name: string;
    amount: number;
    days: number;
    status: DebtorStatus;
    phone: string;
}

// ─── CUSTOMER ROW (self-animating, pressable) ─────────────────────────────────
function DebtorRow({ d, index, onPress }: { d: Row; index: number; onPress: () => void }) {
    const enter = useRef(new Animated.Value(0)).current;
    const scale = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        Animated.timing(enter, { toValue: 1, duration: 360, delay: 160 + Math.min(index * 45, 300), useNativeDriver: false }).start();
    }, []);

    const color = statusColor(d.status);

    return (
        <Animated.View
            style={{
                opacity: enter,
                transform: [
                    { translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) },
                    { scale },
                ],
            }}
        >
            <TouchableOpacity
                activeOpacity={0.7}
                onPressIn={() => Animated.spring(scale, { toValue: 0.98, useNativeDriver: false }).start()}
                onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: false }).start()}
                onPress={onPress}
                style={styles.row}
            >
                <View style={[styles.avatar, { backgroundColor: color + '18' }]}>
                    <Text style={[styles.avatarText, { color }]}>{d.name?.[0]?.toUpperCase() ?? '?'}</Text>
                </View>
                <View style={styles.rowInfo}>
                    <Text style={styles.name} numberOfLines={1}>{d.name}</Text>
                    <Text style={styles.days}>{d.days} days outstanding</Text>
                </View>
                <View style={styles.rowAction}>
                    <Text style={styles.amount}>{formatINR(d.amount)}</Text>
                    <View style={[styles.statusPill, { backgroundColor: color + '18' }]}>
                        <Text style={[styles.statusPillText, { color }]}>{statusLabel(d.status)}</Text>
                    </View>
                </View>
            </TouchableOpacity>
        </Animated.View>
    );
}

export default function MoneyInScreen() {
    const router = useRouter();
    const [filter, setFilter] = useState<string>('All');
    const filters = ['All', 'Overdue', 'Due Soon', 'Current'];

    // Same active client the Home dashboard uses — live Supabase data.
    const { data: msmeEntities } = useMsmeData();
    const activeMsmeId = msmeEntities && msmeEntities.length > 0 ? msmeEntities[0].id : null;
    const { data: debtors = [], isLoading } = useDebtors(activeMsmeId);

    const rows: Row[] = debtors.map((d) => ({
        id: d.id,
        name: d.name,
        amount: Number(d.amount_outstanding) || 0,
        days: Number(d.days_outstanding) || 0,
        status: statusOf(Number(d.days_outstanding) || 0),
        // ↓↓↓ ASSUMPTION: `debtors` has a `phone` column. If yours is named
        // differently (mobile / phone_number / contact), change `d.phone` here.
        phone: String((d as any).phone ?? ''),
    }));
    const total = rows.reduce((a, d) => a + d.amount, 0);

    const filtered = filter === 'All' ? rows
        : filter === 'Overdue' ? rows.filter(d => d.status === 'overdue')
            : filter === 'Due Soon' ? rows.filter(d => d.status === 'due')
                : rows.filter(d => d.status === 'current');

    const openCustomer = (d: Row) =>
        router.push({
            pathname: '/customer-detail',
            params: { id: d.id, name: d.name, amount: String(d.amount), days: String(d.days), status: d.status, phone: d.phone },
        });

    const onRemindAll = () =>
        notify(
            'Remind all customers',
            'Sending reminders to everyone at once needs the WhatsApp Business sender (coming in Phase 2). For now, tap a customer to send them a reminder.',
        );

    // Entrance for banner + filter row (rows animate themselves).
    const bannerIn = useRef(new Animated.Value(0)).current;
    const filterIn = useRef(new Animated.Value(0)).current;
    const blastScale = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        Animated.timing(bannerIn, { toValue: 1, duration: 420, delay: 0, useNativeDriver: false }).start();
        Animated.timing(filterIn, { toValue: 1, duration: 420, delay: 90, useNativeDriver: false }).start();
    }, []);

    const rise = (v: Animated.Value) => ({
        opacity: v,
        transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
    });

    return (
        <SafeAreaView style={styles.safe}>
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

                <Text style={styles.screenTitle}>Money In</Text>

                {/* ── Summary banner (navy hero) ── */}
                <Animated.View style={[styles.banner, rise(bannerIn)]}>
                    <View style={styles.bannerGlow} />
                    <View style={styles.bannerLeft}>
                        <Text style={styles.bannerLabel}>TOTAL TO COLLECT</Text>
                        <Text style={styles.bannerValue}>{formatINR(total)}</Text>
                        <Text style={styles.bannerSub}>from {rows.length} customer{rows.length === 1 ? '' : 's'}</Text>
                    </View>
                    <Animated.View style={{ transform: [{ scale: blastScale }] }}>
                        <TouchableOpacity
                            activeOpacity={0.9}
                            onPressIn={() => Animated.spring(blastScale, { toValue: 0.96, useNativeDriver: false }).start()}
                            onPressOut={() => Animated.spring(blastScale, { toValue: 1, useNativeDriver: false }).start()}
                            onPress={onRemindAll}
                            style={styles.blastBtn}
                        >
                            <View style={styles.blastSheen} />
                            <Text style={styles.blastIcon}>💬</Text>
                            <Text style={styles.blastText}>Remind All</Text>
                        </TouchableOpacity>
                    </Animated.View>
                </Animated.View>

                {/* ── Filter pills ── */}
                <Animated.View style={rise(filterIn)}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={{ alignItems: 'center' }}>
                        {filters.map(f => (
                            <TouchableOpacity
                                key={f}
                                activeOpacity={0.8}
                                onPress={() => setFilter(f)}
                                style={[styles.filterPill, filter === f && styles.filterPillActive]}
                            >
                                <Text style={[styles.filterPillText, filter === f && styles.filterPillTextActive]}>{f}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </Animated.View>

                {isLoading ? (
                    <ActivityIndicator color={C.teal} style={{ marginTop: 40 }} />
                ) : rows.length === 0 ? (
                    <Text style={styles.empty}>No customers yet. Add receivables from the CFO console.</Text>
                ) : (
                    <>
                        <Text style={styles.listCount}>{filtered.length} customer{filtered.length === 1 ? '' : 's'}</Text>
                        {filtered.map((d, i) => (
                            <DebtorRow key={d.id} d={d} index={i} onPress={() => openCustomer(d)} />
                        ))}
                    </>
                )}

            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: C.bg },
    scrollContent: { padding: 16, paddingBottom: 48 },
    screenTitle: { fontSize: 17, fontWeight: '800', color: C.navy, marginBottom: 16, letterSpacing: -0.3 },

    // Banner (navy hero)
    banner: {
        backgroundColor: C.navy, borderRadius: 20, padding: 20,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 16, overflow: 'hidden', position: 'relative',
        boxShadow: '0px 12px 28px rgba(11,46,79,0.22)',
    } as any,
    bannerGlow: {
        position: 'absolute', top: -45, right: -35, width: 160, height: 160,
        borderRadius: 80, backgroundColor: C.teal, opacity: 0.20,
    },
    bannerLeft: { flex: 1, paddingRight: 12 },
    bannerLabel: { fontSize: 11, fontWeight: '700', color: 'rgba(226,234,244,0.7)', letterSpacing: 0.5 },
    bannerValue: { fontSize: 30, fontWeight: '800', color: C.white, marginTop: 4, letterSpacing: -0.5 },
    bannerSub: { fontSize: 13, color: 'rgba(226,234,244,0.65)', marginTop: 2 },
    blastBtn: {
        backgroundColor: C.teal, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 14,
        alignItems: 'center', flexDirection: 'row', gap: 6, overflow: 'hidden', position: 'relative',
        boxShadow: '0px 6px 16px rgba(15,118,110,0.40)',
    } as any,
    blastSheen: { position: 'absolute', top: 0, left: 0, right: 0, height: '50%', backgroundColor: 'rgba(255,255,255,0.12)' },
    blastIcon: { fontSize: 15 },
    blastText: { color: C.white, fontSize: 13, fontWeight: '800' },

    // Filters
    filterRow: { marginBottom: 16, maxHeight: 40 },
    filterPill: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, marginRight: 8, backgroundColor: C.surface, borderWidth: 1.5, borderColor: C.border },
    filterPillActive: { backgroundColor: C.navy, borderColor: C.navy },
    filterPillText: { fontSize: 13, fontWeight: '700', color: C.textSub },
    filterPillTextActive: { color: C.white },
    listCount: { fontSize: 13, fontWeight: '600', color: C.textMuted, marginBottom: 12 },
    empty: { fontSize: 14, color: C.textMuted, textAlign: 'center', marginTop: 32 },

    // List rows
    row: {
        backgroundColor: C.surface, borderRadius: 16, padding: 16,
        flexDirection: 'row', alignItems: 'center', marginBottom: 8,
        borderWidth: 1, borderColor: C.border,
        boxShadow: '0px 2px 8px rgba(11,46,79,0.04)',
    } as any,
    avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
    avatarText: { fontSize: 20, fontWeight: '800' },
    rowInfo: { flex: 1, marginLeft: 12 },
    name: { fontSize: 14, fontWeight: '700', color: C.text },
    days: { fontSize: 12, color: C.textSub, marginTop: 2 },
    rowAction: { alignItems: 'flex-end' },
    amount: { fontSize: 16, fontWeight: '800', color: C.text },
    statusPill: { paddingVertical: 4, paddingHorizontal: 8, borderRadius: 8, marginTop: 4 },
    statusPillText: { fontSize: 10, fontWeight: '700' },
});
