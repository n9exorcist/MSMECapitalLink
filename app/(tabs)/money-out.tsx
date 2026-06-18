import React from 'react';
import { ScrollView, View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useMsmeData } from '../../hooks/useMsmeData';
import { useCreditors } from '../../hooks/useCreditors';
import { formatINR } from '../../lib/format';

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

export default function MoneyOutScreen() {
    const { data: msmeEntities } = useMsmeData();
    const activeMsmeId = msmeEntities && msmeEntities.length > 0 ? msmeEntities[0].id : null;
    const { data: creditors = [], isLoading } = useCreditors(activeMsmeId);

    const rows = creditors.map((c) => {
        const d = daysUntil(c.due_date);
        return {
            id: c.id,
            name: c.name,
            amount: Number(c.amount_due) || 0,
            dueDate: fmtDue(c.due_date),
            daysLeft: d,
            urgent: d != null && d >= 0 && d <= 3, // due within ~3 days
        };
    });

    const total = rows.reduce((a, c) => a + c.amount, 0);
    const dueThisWeek = rows
        .filter((r) => r.daysLeft != null && r.daysLeft >= 0 && r.daysLeft <= 7)
        .reduce((a, c) => a + c.amount, 0);
    const nextUrgent = rows.find((r) => r.urgent);

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

            {/* Summary Banner */}
            <View style={styles.banner}>
                <View>
                    <Text style={styles.bannerLabel}>Total to Pay</Text>
                    <Text style={styles.bannerValue}>{formatINR(total)}</Text>
                    <Text style={styles.bannerSub}>to {rows.length} supplier{rows.length === 1 ? '' : 's'}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.bannerLabel}>Due this week</Text>
                    <Text style={styles.bannerValueUrgent}>{dueThisWeek > 0 ? formatINR(dueThisWeek) : '—'}</Text>
                </View>
            </View>

            {/* Urgent Strip Alert — only when something is actually due soon */}
            {nextUrgent && (
                <View style={styles.alertStrip}>
                    <Text style={styles.alertStripIcon}>🔴</Text>
                    <Text style={styles.alertStripText}>
                        {nextUrgent.name} — {formatINR(nextUrgent.amount)} due {nextUrgent.dueDate}
                    </Text>
                </View>
            )}

            {isLoading ? (
                <ActivityIndicator color="#0F766E" style={{ marginTop: 40 }} />
            ) : rows.length === 0 ? (
                <Text style={styles.empty}>No suppliers yet. Add payables from the CFO console.</Text>
            ) : (
                <>
                    <Text style={styles.listCount}>All suppliers</Text>

                    {rows.map((c) => (
                        <TouchableOpacity key={c.id} style={styles.row} activeOpacity={0.8}>
                            <View style={[styles.avatar, { backgroundColor: c.urgent ? '#FEF2F2' : '#F8FAFC' }]}>
                                <Text style={[styles.avatarText, { color: c.urgent ? '#DC2626' : '#475569' }]}>
                                    {c.name?.[0] ?? '?'}
                                </Text>
                            </View>
                            <View style={styles.rowInfo}>
                                <Text style={styles.name}>{c.name}</Text>
                                <Text style={styles.days}>Due {c.dueDate}</Text>
                            </View>
                            <View style={styles.rowAction}>
                                <Text style={[styles.amount, { color: c.urgent ? '#DC2626' : '#0F172A' }]}>{formatINR(c.amount)}</Text>
                                <TouchableOpacity style={[styles.payBtn, { backgroundColor: c.urgent ? '#DC2626' : '#0B2E4F' }]}>
                                    <Text style={styles.payBtnText}>Pay</Text>
                                </TouchableOpacity>
                            </View>
                        </TouchableOpacity>
                    ))}
                </>
            )}

        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F0F5FA' },
    scrollContent: { padding: 16, paddingBottom: 40 },

    // Banner
    banner: { backgroundColor: '#FFFBEB', borderRadius: 20, padding: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: '#FDE68A', marginBottom: 12 },
    bannerLabel: { fontSize: 11, fontWeight: '700', color: '#475569', textTransform: 'uppercase', letterSpacing: 0.5 },
    bannerValue: { fontSize: 30, fontWeight: '800', color: '#D97706', marginTop: 4, letterSpacing: -1 },
    bannerValueUrgent: { fontSize: 24, fontWeight: '800', color: '#DC2626', marginTop: 4, letterSpacing: -1 },
    bannerSub: { fontSize: 13, color: '#475569', marginTop: 2 },

    // Alert Strip
    alertStrip: { backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA', borderRadius: 14, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
    alertStripIcon: { fontSize: 16 },
    alertStripText: { flex: 1, fontSize: 13, fontWeight: '600', color: '#DC2626' },

    listCount: { fontSize: 13, fontWeight: '600', color: '#94A3B8', marginTop: 10, marginBottom: 12 },
    empty: { fontSize: 14, color: '#94A3B8', textAlign: 'center', marginTop: 32 },

    // List Rows
    row: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', marginBottom: 8, borderWidth: 1, borderColor: '#E2EAF4' },
    avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
    avatarText: { fontSize: 20, fontWeight: '800' },
    rowInfo: { flex: 1, marginLeft: 12 },
    name: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
    days: { fontSize: 12, color: '#64748B', marginTop: 2 },
    rowAction: { alignItems: 'flex-end' },
    amount: { fontSize: 16, fontWeight: '800' },
    payBtn: { paddingVertical: 6, paddingHorizontal: 14, borderRadius: 10, marginTop: 4 },
    payBtnText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' }
});
