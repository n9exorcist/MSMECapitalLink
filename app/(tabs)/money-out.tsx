import React, { useEffect, useRef } from 'react';
import { ScrollView, View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, SafeAreaView, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { useMsmeData } from '../../hooks/useMsmeData';
import { useCreditors } from '../../hooks/useCreditors';
import { formatINR } from '../../lib/format';
import { C } from '@/constants/theme';

const DAY = 86400000;
function daysUntil(iso: string | null): number | null {
    if (!iso) return null;
    const ms = new Date(iso).getTime() - Date.now();
    return Math.floor(ms / DAY);
}

function fmtDue(iso: string | null): string {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

interface Row {
    id: string;
    name: string;
    amount: number;
    dueDate: string;
    daysLeft: number | null;
    urgent: boolean;
    upi: string;
}

// ─── SUPPLIER ROW (self-animating, pressable) ─────────────────────────────────
// Whole row navigates to the supplier detail screen. "Pay" stays a visual pill;
// the real Pay-via-UPI action lives on the detail screen.
function CreditorRow({ c, index, onPress }: { c: Row; index: number; onPress: () => void }) {
    const enter = useRef(new Animated.Value(0)).current;
    const scale = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        Animated.timing(enter, { toValue: 1, duration: 360, delay: 160 + Math.min(index * 45, 300), useNativeDriver: false }).start();
    }, []);

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
                activeOpacity={0.8}
                onPressIn={() => Animated.spring(scale, { toValue: 0.98, useNativeDriver: false }).start()}
                onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: false }).start()}
                onPress={onPress}
                style={styles.row}
            >
                <View style={[styles.avatar, { backgroundColor: c.urgent ? C.redBg : C.surfaceAlt }]}>
                    <Text style={[styles.avatarText, { color: c.urgent ? C.red : C.textSub }]}>
                        {c.name?.[0]?.toUpperCase() ?? '?'}
                    </Text>
                </View>
                <View style={styles.rowInfo}>
                    <Text style={styles.name} numberOfLines={1}>{c.name}</Text>
                    <Text style={styles.days}>Due {c.dueDate}</Text>
                </View>
                <View style={styles.rowAction}>
                    <Text style={[styles.amount, { color: c.urgent ? C.red : C.text }]}>{formatINR(c.amount)}</Text>
                    <View style={[styles.payBtn, { backgroundColor: c.urgent ? C.red : C.navy }]}>
                        <Text style={styles.payBtnText}>Pay</Text>
                    </View>
                </View>
            </TouchableOpacity>
        </Animated.View>
    );
}

export default function MoneyOutScreen() {
    const router = useRouter();
    const { data: msmeEntities } = useMsmeData();
    const activeMsmeId = msmeEntities && msmeEntities.length > 0 ? msmeEntities[0].id : null;
    const { data: creditors = [], isLoading } = useCreditors(activeMsmeId);

    const rows: Row[] = creditors.map((c) => {
        const d = daysUntil(c.due_date);
        return {
            id: c.id,
            name: c.name,
            amount: Number(c.amount_due) || 0,
            dueDate: fmtDue(c.due_date),
            daysLeft: d,
            urgent: d != null && d >= 0 && d <= 3, // due within ~3 days
            // ↓↓↓ ASSUMPTION: `creditors` has a `upi_id` column. If yours is named
            // differently (vpa / upi / payee_vpa), change `c.upi_id` here.
            upi: String((c as any).upi_id ?? ''),
        };
    });

    const total = rows.reduce((a, c) => a + c.amount, 0);
    const dueThisWeek = rows
        .filter((r) => r.daysLeft != null && r.daysLeft >= 0 && r.daysLeft <= 7)
        .reduce((a, c) => a + c.amount, 0);
    const nextUrgent = rows.find((r) => r.urgent);

    const openSupplier = (c: Row) =>
        router.push({
            pathname: '/supplier-detail',
            params: {
                id: c.id, name: c.name, amount: String(c.amount), due: c.dueDate,
                daysLeft: String(c.daysLeft ?? ''), urgent: String(c.urgent), upi: c.upi,
            },
        });

    // Entrances for banner + alert strip (rows animate themselves).
    const bannerIn = useRef(new Animated.Value(0)).current;
    const alertIn = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(bannerIn, { toValue: 1, duration: 420, delay: 0, useNativeDriver: false }).start();
        Animated.timing(alertIn, { toValue: 1, duration: 420, delay: 120, useNativeDriver: false }).start();
    }, []);

    const rise = (v: Animated.Value) => ({
        opacity: v,
        transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
    });

    return (
        <SafeAreaView style={styles.safe}>
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

                {/* ── Summary banner (navy hero, amber = outgoing) ── */}
                <Animated.View style={[styles.banner, rise(bannerIn)]}>
                    <View style={styles.bannerGlow} />
                    <View style={styles.bannerLeft}>
                        <Text style={styles.bannerLabel}>Total to Pay</Text>
                        <Text style={styles.bannerValue}>{formatINR(total)}</Text>
                        <Text style={styles.bannerSub}>to {rows.length} supplier{rows.length === 1 ? '' : 's'}</Text>
                    </View>
                    <View style={styles.bannerRight}>
                        <Text style={styles.bannerLabel}>Due this week</Text>
                        <Text style={styles.bannerValueUrgent}>{dueThisWeek > 0 ? formatINR(dueThisWeek) : '—'}</Text>
                    </View>
                </Animated.View>

                {/* ── Urgent strip — only when something is actually due soon ── */}
                {nextUrgent && (
                    <Animated.View style={[styles.alertStrip, rise(alertIn)]}>
                        <Text style={styles.alertStripIcon}>🔴</Text>
                        <Text style={styles.alertStripText} numberOfLines={1}>
                            {nextUrgent.name} — {formatINR(nextUrgent.amount)} due {nextUrgent.dueDate}
                        </Text>
                    </Animated.View>
                )}

                {isLoading ? (
                    <ActivityIndicator color={C.teal} style={{ marginTop: 40 }} />
                ) : rows.length === 0 ? (
                    <Text style={styles.empty}>No suppliers yet. Add payables from the CFO console.</Text>
                ) : (
                    <>
                        <Text style={styles.listCount}>All suppliers</Text>
                        {rows.map((c, i) => (
                            <CreditorRow key={c.id} c={c} index={i} onPress={() => openSupplier(c)} />
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

    // Banner (navy hero)
    banner: {
        backgroundColor: C.navy, borderRadius: 20, padding: 20,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 12, overflow: 'hidden', position: 'relative',
        boxShadow: '0px 12px 28px rgba(11,46,79,0.22)',
    } as any,
    bannerGlow: {
        position: 'absolute', top: -45, right: -35, width: 160, height: 160,
        borderRadius: 80, backgroundColor: C.amber, opacity: 0.18,
    },
    bannerLeft: { flex: 1, paddingRight: 12 },
    bannerRight: { alignItems: 'flex-end' },
    bannerLabel: { fontSize: 11, fontWeight: '700', color: 'rgba(226,234,244,0.7)', textTransform: 'uppercase', letterSpacing: 0.5 },
    bannerValue: { fontSize: 30, fontWeight: '800', color: C.white, marginTop: 4, letterSpacing: -1 },
    bannerValueUrgent: { fontSize: 24, fontWeight: '800', color: C.amber, marginTop: 4, letterSpacing: -1 },
    bannerSub: { fontSize: 13, color: 'rgba(226,234,244,0.65)', marginTop: 2 },

    // Alert strip
    alertStrip: {
        backgroundColor: C.redBg, borderWidth: 1, borderColor: C.red + '33', borderRadius: 14,
        padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16,
    },
    alertStripIcon: { fontSize: 15 },
    alertStripText: { flex: 1, fontSize: 13, fontWeight: '600', color: C.red },

    listCount: { fontSize: 13, fontWeight: '600', color: C.textMuted, marginTop: 10, marginBottom: 12 },
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
    amount: { fontSize: 16, fontWeight: '800' },
    payBtn: { paddingVertical: 6, paddingHorizontal: 14, borderRadius: 10, marginTop: 4 },
    payBtnText: { color: C.white, fontSize: 11, fontWeight: '800' },
});
