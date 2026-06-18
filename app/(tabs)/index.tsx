import React, { useEffect, useRef } from 'react';
import { ScrollView, RefreshControl, View, Text, TouchableOpacity, StyleSheet, SafeAreaView, Animated, ActivityIndicator } from 'react-native';
import { useDashboardData } from '../../hooks/useDashboardData';
import { ScoreArc } from '../../components/ScoreArc';
import { MetricCard } from '../../components/MetricCard';
import { ActionCard, ActionItem } from '../../components/ActionCard';
import { C, T, S, runwayColor } from '@/constants/theme';
import { useRouter } from 'expo-router';
import { useMsmeData } from '../../hooks/useMsmeData';
import { useLoans } from '../../hooks/useLoans';
import { formatINR } from '../../lib/format';

// Format an ISO date for the Next EMI card.
const fmtDate = (iso: string | null): string => {
    if (!iso) return '—';
    const d = new Date(iso);
    return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

// Styled loading view (replaces the bare <Text>Loading…</Text> screens).
function Loading({ label }: { label: string }) {
    return (
        <SafeAreaView style={styles.center}>
            <ActivityIndicator color={C.teal} />
            <Text style={styles.loadingText}>{label}</Text>
        </SafeAreaView>
    );
}

export default function HomeDashboard() {
    // 1. ALL HOOKS AT THE TOP (incl. animation hooks, before any early return).
    const { data: msmeEntities, loading: msmeLoading } = useMsmeData();
    const router = useRouter();

    const activeMsmeId = msmeEntities && msmeEntities.length > 0 ? msmeEntities[0].id : null;
    const { data: mfosData, isLoading: mfosLoading, refetch } = useDashboardData(activeMsmeId);
    const { data: loans = [] } = useLoans(activeMsmeId); // live loan data for the Next EMI card

    // Staggered entrance — fires once, when the dashboard data is ready.
    const e1 = useRef(new Animated.Value(0)).current; // header
    const e2 = useRef(new Animated.Value(0)).current; // score card
    const e3 = useRef(new Animated.Value(0)).current; // actions
    const e4 = useRef(new Animated.Value(0)).current; // numbers
    const hasAnimated = useRef(false);

    useEffect(() => {
        if (mfosData && !hasAnimated.current) {
            hasAnimated.current = true;
            Animated.stagger(110, [
                Animated.timing(e1, { toValue: 1, duration: 420, useNativeDriver: false }),
                Animated.timing(e2, { toValue: 1, duration: 420, useNativeDriver: false }),
                Animated.timing(e3, { toValue: 1, duration: 420, useNativeDriver: false }),
                Animated.timing(e4, { toValue: 1, duration: 420, useNativeDriver: false }),
            ]).start();
        }
    }, [mfosData]);

    const rise = (v: Animated.Value) => ({
        opacity: v,
        transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
    });

    // 2. LOADING / EMPTY STATES
    if (msmeLoading) return <Loading label="Loading business profile…" />;
    if (!activeMsmeId) {
        return (
            <SafeAreaView style={styles.center}>
                <Text style={styles.emptyTitle}>No business found</Text>
                <Text style={styles.loadingText}>Add your business from the CFO console to get started.</Text>
            </SafeAreaView>
        );
    }
    if (mfosLoading || !mfosData) return <Loading label="Loading live dashboard…" />;

    // 3. DATA EXTRACTION
    const entity = msmeEntities[0];
    const companyName = entity?.company_name ?? 'Your business';
    // Prefer the dashboard owner, fall back to the entity's owner (no stale hardcoded name).
    const ownerName = mfosData?.owner ?? entity?.owner_name ?? 'there';

    const scoreData = mfosData?.score ?? { currentScore: 0, band: 'NEUTRAL', previousScore: 0 };
    const prevScore = scoreData.previousScore ?? 0;
    const actions: ActionItem[] = mfosData?.actions ?? [];

    // Live: moneyIn / moneyOut + Next EMI (from `loans`). Still MOCK: cashRunway, compliance, sales.
    const primaryLoan = loans[0] ?? null; // largest sanctioned
    const m = mfosData?.metrics ?? {
        moneyIn: { total: 0, count: 0, overdueCount: 0 },
        moneyOut: { total: 0, count: 0, weekAmount: 0 },
        cashRunway: { days: 0, cash: 0, accounts: 0 },
        nextEmi: { amount: 0, date: '', bank: '', overdue: false },
        compliance: { status: 'Pending', filing: '', daysLeft: 0 },
        sales: { pct: 0, thisMonth: 0, up: false },
    };

    const now = new Date();
    const hour = now.getHours();
    const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    const shortDate = now.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });

    return (
        <SafeAreaView style={styles.safe}>
            <View style={styles.appBar}>
                <Text style={styles.appBarTitle}>Home</Text>
                <View style={styles.liveChip}><View style={styles.liveDot} /><Text style={styles.liveText}>Live</Text></View>
            </View>

            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={styles.scroll}
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={mfosLoading} onRefresh={refetch} tintColor={C.teal} />}
            >
                <Animated.View style={[styles.header, rise(e1)]}>
                    <View style={styles.headerLeft}>
                        <View style={styles.avatarRing}>
                            <View style={styles.avatar}><Text style={styles.avatarText}>{ownerName?.charAt(0)?.toUpperCase() || 'U'}</Text></View>
                            <View style={styles.onlineDot} />
                        </View>
                        <View style={{ marginLeft: 12, flex: 1 }}>
                            <Text style={styles.greeting} numberOfLines={1}>{greeting}, {ownerName}</Text>
                            <Text style={styles.dateStr} numberOfLines={1}>{companyName} · {shortDate}</Text>
                        </View>
                    </View>
                    <TouchableOpacity style={styles.notifBtn} activeOpacity={0.7} onPress={() => router.push('/notifications')}><Text style={styles.notifEmoji}>🔔</Text></TouchableOpacity>
                </Animated.View>

                <Animated.View style={[styles.scoreCard, rise(e2)]}>
                    <View style={styles.scoreCardTop}>
                        <Text style={styles.scoreCardTitle}>Your Business Health</Text>
                    </View>
                    <ScoreArc score={scoreData.currentScore ?? 0} previousScore={prevScore} band={scoreData.band} />
                    <TouchableOpacity style={styles.scoreDetailBtn}><Text style={styles.scoreDetailText}>See full breakdown →</Text></TouchableOpacity>
                </Animated.View>

                <Animated.View style={[styles.section, rise(e3)]}>
                    <View style={styles.sectionRow}>
                        <Text style={styles.sectionTitle}>Today's Actions</Text>
                    </View>
                    {actions.length > 0 ? (
                        actions.map((a) => <ActionCard key={a.id} action={a} />)
                    ) : (
                        <Text style={{ padding: 16, color: C.textMuted }}>No actions pending for today.</Text>
                    )}
                </Animated.View>

                <Animated.View style={[styles.section, rise(e4)]}>
                    <Text style={styles.sectionTitle}>Your Numbers</Text>
                    <View style={styles.grid}>
                        <MetricCard icon="📥" label="Money to Collect" value={formatINR(m.moneyIn.total)} sub={`${m.moneyIn.count} customers`} badge={`${m.moneyIn.overdueCount} overdue`} color={C.teal} onPress={() => router.push('/(tabs)/money-in')} />
                        <MetricCard icon="📤" label="Money to Pay" value={formatINR(m.moneyOut.total)} sub={`${m.moneyOut.count} suppliers`} color={C.amber} onPress={() => router.push('/(tabs)/money-out')} />
                        <MetricCard icon="🏦" label="Cash Runway" value={`${m.cashRunway.days} days`} sub={`₹${m.cashRunway.cash}L`} color={runwayColor(m.cashRunway.days)} />
                        {/* Next EMI is now live from `loans`. Cash Runway / GST & Tax / Sales Trend are still mock (lakh-unit) until wired. */}
                        <MetricCard icon="🏛️" label="Next EMI" value={primaryLoan ? formatINR(Number(primaryLoan.emi_amount) || 0) : '—'} sub={primaryLoan ? fmtDate(primaryLoan.next_due_date) : 'No loan on file'} color={C.navy} />
                        <MetricCard icon="📊" label="GST & Tax" value={m.compliance.status} sub={`${m.compliance.daysLeft}d left`} color={C.green} />
                        <MetricCard icon="📈" label="Sales Trend" value={`${m.sales.pct}%`} sub={`₹${m.sales.thisMonth}L`} color={C.green} />
                    </View>
                </Animated.View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: C.bg },
    center: { flex: 1, backgroundColor: C.bg, justifyContent: 'center', alignItems: 'center', gap: 12, padding: 32 },
    loadingText: { fontSize: T.base, color: C.textSub, fontWeight: '600', textAlign: 'center' },
    emptyTitle: { fontSize: T.lg, fontWeight: '800', color: C.navy },

    appBar: { height: 52, backgroundColor: C.bg, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: S.xl, borderBottomWidth: 1, borderBottomColor: C.border },
    appBarTitle: { fontSize: T.md, fontWeight: '800', color: C.navy, letterSpacing: -0.3 },
    liveChip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.greenBg, borderWidth: 1, borderColor: `${C.green}30`, paddingVertical: 4, paddingHorizontal: 10, borderRadius: 20 },
    liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.green },
    liveText: { fontSize: T.xs, fontWeight: '700', color: C.green },
    scroll: { paddingBottom: S.xl },

    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: S.xl, paddingTop: 18, paddingBottom: 14 },
    headerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, paddingRight: 12 },
    avatarRing: { width: 46, height: 46, borderRadius: 23, borderWidth: 2, borderColor: C.teal, alignItems: 'center', justifyContent: 'center', position: 'relative' },
    avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: C.navy, alignItems: 'center', justifyContent: 'center' },
    avatarText: { color: C.white, fontSize: T.md, fontWeight: '800' },
    onlineDot: { position: 'absolute', bottom: 2, right: 2, width: 10, height: 10, borderRadius: 5, backgroundColor: C.green, borderWidth: 2, borderColor: C.bg },
    greeting: { fontSize: T.base, fontWeight: '800', color: C.navy },
    dateStr: { fontSize: T.xs, fontWeight: '500', color: C.textMuted, marginTop: 1 },
    notifBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.border, position: 'relative', boxShadow: '0px 2px 6px rgba(11,46,79,0.06)' } as any,
    notifEmoji: { fontSize: 18, lineHeight: 22 },

    scoreCard: { marginHorizontal: S.md, backgroundColor: C.surface, borderRadius: 24, padding: S.xxl, borderWidth: 1, borderColor: C.border, boxShadow: '0px 6px 18px rgba(11,46,79,0.09)' } as any,
    scoreCardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: S.xl },
    scoreCardTitle: { fontSize: T.md, fontWeight: '800', color: C.navy },
    scoreDetailBtn: { marginTop: S.md, paddingVertical: 10, alignItems: 'center' },
    scoreDetailText: { fontSize: T.sm, fontWeight: '700', color: C.teal },

    section: { marginTop: S.xxl, paddingHorizontal: S.md },
    sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: S.md },
    sectionTitle: { fontSize: T.md, fontWeight: '800', color: C.navy, marginBottom: S.md },
    grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: S.md },
});
