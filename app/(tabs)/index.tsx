import React from 'react';
import { ScrollView, RefreshControl, View, Text, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
import { useDashboardData } from '../../hooks/useDashboardData';
import { ScoreArc } from '../../components/ScoreArc'; //[cite: 4]
import { MetricCard } from '../../components/MetricCard'; //[cite: 4]
import { ActionCard, ActionItem } from '../../components/ActionCard';
import { C, T, S, runwayColor } from '@/constants/theme'; //[cite: 4]
import { useRouter } from 'expo-router'; //[cite: 4]
import { useMsmeData } from '../../hooks/useMsmeData';
import { formatINR } from '../../lib/format';

export default function HomeDashboard() {
    // 1. ALL HOOKS AT THE TOP
    const { data: msmeEntities, loading: msmeLoading } = useMsmeData();
    const router = useRouter();

    // Use the ID from your live database
    const activeMsmeId = msmeEntities && msmeEntities.length > 0 ? msmeEntities[0].id : null;
    const { data: mfosData, isLoading: mfosLoading, refetch } = useDashboardData(activeMsmeId);

    // 2. LOADING STATE
    // 1. Initial Load: Wait for the entity list
    if (msmeLoading) {
        return <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><Text>Loading business profile...</Text></SafeAreaView>;
    }

    // 2. No Data Case
    if (!activeMsmeId) {
        return <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><Text>No MSME business found.</Text></SafeAreaView>;
    }

    // 3. Data Loading Case
    if (mfosLoading || !mfosData) {
        return <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><Text>Loading live dashboard...</Text></SafeAreaView>;
    }

    // 3. Data Extraction
    const companyName = msmeEntities.length > 0 ? msmeEntities[0].company_name : "Loading...";

    const ownerName = mfosData?.owner ?? 'Mr. Suresh';
    const scoreData = mfosData?.score ?? {
        currentScore: 0,
        band: 'NEUTRAL',
        previousScore: 0
    };
    // Change this line: remove 'mfosData.previousScore' if it doesn't exist in the hook return
    const prevScore = scoreData.previousScore ?? 0;
    // FIX THIS: Ensure you are pulling 'actions' correctly from mfosData
    const actions = mfosData?.actions ?? [];

    // This 'm' is the correct object for your metrics
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
    const dateStr = now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });

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
                <View style={styles.header}>
                    <View style={styles.headerLeft}>
                        <View style={styles.avatarRing}>
                            <View style={styles.avatar}><Text style={styles.avatarText}>{ownerName?.charAt(0) || 'U'}</Text></View>
                            <View style={styles.onlineDot} />
                        </View>
                        <View style={{ marginLeft: 12 }}>
                            <Text style={styles.greeting}>{greeting}, {ownerName}</Text>
                            <Text style={styles.dateStr}>{companyName}</Text>
                        </View>
                    </View>
                    <TouchableOpacity style={styles.notifBtn}><Text style={styles.notifEmoji}>🔔</Text></TouchableOpacity>
                </View>

                <View style={styles.scoreCard}>
                    <View style={styles.scoreCardTop}>
                        <Text style={styles.scoreCardTitle}>Your Business Health</Text>
                        <View style={styles.chip}><Text style={styles.chipText}>Live</Text></View>
                    </View>
                    <ScoreArc score={scoreData.currentScore ?? 0} previousScore={prevScore} band={scoreData.band} />
                    <TouchableOpacity style={styles.scoreDetailBtn}><Text style={styles.scoreDetailText}>See full breakdown →</Text></TouchableOpacity>
                </View>

                <View style={styles.section}>
                    <View style={styles.sectionRow}>
                        <Text style={styles.sectionTitle}>Today's Actions</Text>
                    </View>
                    {actions.length > 0 ? (
                        actions.map((a) => <ActionCard key={a.id} action={a} />)
                    ) : (
                        <Text style={{ padding: 16, color: C.textMuted }}>No actions pending for today.</Text>
                    )}
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Your Numbers</Text>
                    <View style={styles.grid}>
                        <MetricCard icon="📥" label="Money to Collect" value={formatINR(m.moneyIn.total)} sub={`${m.moneyIn.count} customers`} badge={`${m.moneyIn.overdueCount} overdue`} color={C.teal} onPress={() => router.push('/(tabs)/money-in')} />
                        <MetricCard icon="📤" label="Money to Pay" value={formatINR(m.moneyOut.total)} sub={`${m.moneyOut.count} suppliers`} color={C.amber} onPress={() => router.push('/(tabs)/money-out')} />
                        <MetricCard icon="🏦" label="Cash Runway" value={`${m.cashRunway.days} days`} sub={`₹${m.cashRunway.cash}L`} color={runwayColor(m.cashRunway.days)} />
                        {/* These three are still mock (lakh-unit) — switch to formatINR once wired to real raw-rupee data */}
                        <MetricCard icon="🏛" label="Next EMI" value={`₹${m.nextEmi.amount}L`} sub={`${m.nextEmi.date}`} color={C.navy} />
                        <MetricCard icon="📊" label="GST & Tax" value={m.compliance.status} sub={`${m.compliance.daysLeft}d left`} color={C.green} />
                        <MetricCard icon="📈" label="Sales Trend" value={`${m.sales.pct}%`} sub={`₹${m.sales.thisMonth}L`} color={C.green} />
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: C.bg }, //[cite: 4]
    appBar: { height: 52, backgroundColor: C.bg, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: S.xl, borderBottomWidth: 1, borderBottomColor: C.border }, //[cite: 4]
    appBarTitle: { fontSize: T.md, fontWeight: '800', color: C.navy, letterSpacing: -0.3 }, //[cite: 4]
    liveChip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.greenBg, borderWidth: 1, borderColor: `${C.green}30`, paddingVertical: 4, paddingHorizontal: 10, borderRadius: 20 }, //[cite: 4]
    liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.green }, //[cite: 4]
    liveText: { fontSize: T.xs, fontWeight: '700', color: C.green }, //[cite: 4]
    scroll: { paddingBottom: S.xl }, //[cite: 4]
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: S.xl, paddingTop: 18, paddingBottom: 14 }, //[cite: 4]
    headerLeft: { flexDirection: 'row', alignItems: 'center' }, //[cite: 4]
    avatarRing: { width: 46, height: 46, borderRadius: 23, borderWidth: 2, borderColor: C.teal, alignItems: 'center', justifyContent: 'center', position: 'relative' }, //[cite: 4]
    avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: C.navy, alignItems: 'center', justifyContent: 'center' }, //[cite: 4]
    avatarText: { color: C.white, fontSize: T.md, fontWeight: '800' }, //[cite: 4]
    onlineDot: { position: 'absolute', bottom: 2, right: 2, width: 10, height: 10, borderRadius: 5, backgroundColor: C.green, borderWidth: 2, borderColor: C.bg }, //[cite: 4]
    greeting: { fontSize: T.base, fontWeight: '800', color: C.navy }, //[cite: 4]
    dateStr: { fontSize: T.xs, fontWeight: '500', color: C.textMuted, marginTop: 1 }, //[cite: 4]
    notifBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.border, position: 'relative', boxShadow: '0px 2px 6px rgba(11,46,79,0.06)' } as any, //[cite: 4]
    notifEmoji: { fontSize: 18, lineHeight: 22 }, //[cite: 4]
    notifBadge: { position: 'absolute', top: 8, right: 8, width: 8, height: 8, borderRadius: 4, backgroundColor: C.red, borderWidth: 1.5, borderColor: C.bg }, //[cite: 4]
    scoreCard: { marginHorizontal: S.md, backgroundColor: C.surface, borderRadius: 24, padding: S.xxl, borderWidth: 1, borderColor: C.border, boxShadow: '0px 6px 18px rgba(11,46,79,0.09)' } as any, //[cite: 4]
    scoreCardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: S.xl }, //[cite: 4]
    scoreCardTitle: { fontSize: T.md, fontWeight: '800', color: C.navy }, //[cite: 4]
    chip: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 20, borderWidth: 1, backgroundColor: `${C.teal}14`, borderColor: `${C.teal}30` }, //[cite: 4]
    chipNavy: { backgroundColor: `${C.navy}12`, borderColor: `${C.navy}25` }, //[cite: 4]
    chipText: { fontSize: T.xs, fontWeight: '700', color: C.teal }, //[cite: 4]
    scoreDetailBtn: { marginTop: S.md, paddingVertical: 10, alignItems: 'center' }, //[cite: 4]
    scoreDetailText: { fontSize: T.sm, fontWeight: '700', color: C.teal }, //[cite: 4]
    section: { marginTop: S.xxl, paddingHorizontal: S.md }, //[cite: 4]
    sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: S.md }, //[cite: 4]
    sectionTitle: { fontSize: T.md, fontWeight: '800', color: C.navy, marginBottom: S.md }, //[cite: 4]
    grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: S.md }, //[cite: 4]
});
