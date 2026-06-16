import React from 'react';
import { ScrollView, RefreshControl, View, Text, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
import { useDashboardData } from '../../hooks/useDashboardData';
import { ScoreArc } from '../../components/ScoreArc'; //[cite: 4]
import { MetricCard } from '../../components/MetricCard'; //[cite: 4]
import { ActionCard, ActionItem } from '../../components/ActionCard';
import { C, T, S, runwayColor } from '@/constants/theme'; //[cite: 4]
import { useRouter } from 'expo-router'; //[cite: 4]

export default function HomeDashboard() {

    const metrics = {
        // Existing fields
        annual_purchases: 500000,
        current_assets: 100000,
        declared_bank_statement_credits: 600000,
        projected_annual_turnover: 700000,

        // Add these required missing fields
        company_name: "Bharat Engineering",
        ebit: 50000,
        net_profit_after_tax: 40000,
        depreciation: 10000,
        interest_expense: 5000,
        inventory: 50000,
        sundry_debtors: 80000,
        sundry_creditors: 40000,
        total_outside_liabilities: 200000,
        tangible_net_worth: 150000,
        days_past_due: 0,
        cibil_score: 760
    };

    const { data: mfosData, isLoading, refetch } = useDashboardData('123', metrics) as any;
    const router = useRouter(); //[cite: 4]

    const ownerName = mfosData?.owner ?? 'Mr. Suresh'; //[cite: 4]
    const scoreData = mfosData?.score; //[cite: 4]
    const prevScore = mfosData?.previousScore ?? 75; //[cite: 4]
    const band = mfosData?.band ?? 'GOOD'; //[cite: 4]

    const now = new Date(); //[cite: 4]
    const hour = now.getHours(); //[cite: 4]
    const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'; //[cite: 4]
    const dateStr = now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' }); //[cite: 4]

    // Add : ActionItem[] right after the variable name
    const actions: ActionItem[] = mfosData?.actions ?? [
        { id: 1, icon: '📞', text: 'Follow up Sundaram', detail: '₹2.4L (65 days past due)', urgency: 'high' as const },
        { id: 2, icon: '💸', text: 'Pay Ramesh Steel', detail: '₹85k due by Friday', urgency: 'medium' as const },
        { id: 3, icon: '📋', text: 'GST filing deadline', detail: '₹3.2L due in 5 days', urgency: 'low' as const },
    ];

    const m = mfosData?.metrics ?? {
        moneyIn: { total: 14.2, count: 12, overdueCount: 1 }, //[cite: 4]
        moneyOut: { total: 8.6, count: 9, weekAmount: 2.1 }, //[cite: 4]
        cashRunway: { days: 28, cash: 8.2, accounts: 3 }, //[cite: 4]
        nextEmi: { amount: 1.5, date: '14 Jun', bank: 'Canara', overdue: false }, //[cite: 4]
        compliance: { status: 'On Track', filing: 'GSTR-3B', daysLeft: 5 }, //[cite: 4]
        sales: { pct: 12, thisMonth: 18.4, up: true }, //[cite: 4]
    }; //[cite: 4]

    return (
        <SafeAreaView style={styles.safe}>
            <View style={styles.appBar}>
                <Text style={styles.appBarTitle}>Home</Text>
                <View style={styles.liveChip}><View style={styles.liveDot} /><Text style={styles.liveText}>Live</Text></View>
            </View>

            <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={C.teal} />}>
                <View style={styles.header}>
                    <View style={styles.headerLeft}>
                        <View style={styles.avatarRing}>
                            <View style={styles.avatar}><Text style={styles.avatarText}>{ownerName.charAt(ownerName.indexOf(' ') + 1) || ownerName[0]}</Text></View>
                            <View style={styles.onlineDot} />
                        </View>
                        <View style={{ marginLeft: 12 }}><Text style={styles.greeting}>{greeting}, {ownerName}</Text><Text style={styles.dateStr}>{dateStr}</Text></View>
                    </View>
                    <TouchableOpacity style={styles.notifBtn} accessibilityLabel="Notifications"><Text style={styles.notifEmoji}>🔔</Text><View style={styles.notifBadge} /></TouchableOpacity>
                </View>

                <View style={styles.scoreCard}>
                    <View style={styles.scoreCardTop}>
                        <Text style={styles.scoreCardTitle}>Your Business Health</Text>
                        <View style={styles.chip}><Text style={styles.chipText}>Updated today</Text></View>
                    </View>
                    <ScoreArc
                        score={scoreData?.currentScore ?? 78}
                        previousScore={mfosData?.previousScore ?? 75}
                        band={scoreData?.band ?? 'GOOD'}
                    />
                    <TouchableOpacity style={styles.scoreDetailBtn}><Text style={styles.scoreDetailText}>See full breakdown →</Text></TouchableOpacity>
                </View>

                <View style={styles.section}>
                    <View style={styles.sectionRow}>
                        <Text style={styles.sectionTitle}>Today's 3 Actions</Text>
                        <View style={[styles.chip, styles.chipNavy]}><Text style={[styles.chipText, { color: C.navy }]}>From your CFO</Text></View>
                    </View>
                    {actions.map((a) => <ActionCard key={a.id} action={a} />)}
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Your Numbers</Text>
                    <View style={styles.grid}>
                        <MetricCard icon="📥" label="Money to Collect" value={`₹${m.moneyIn.total}L`} sub={`${m.moneyIn.count} customers`} badge={`${m.moneyIn.overdueCount} overdue`} color={C.teal} onPress={() => router.push('/(tabs)/money-in')} />
                        <MetricCard icon="📤" label="Money to Pay" value={`₹${m.moneyOut.total}L`} sub={`${m.moneyOut.count} suppliers`} badge={`₹${m.moneyOut.weekAmount}L this week`} color={C.amber} onPress={() => router.push('/(tabs)/money-out')} />
                        <MetricCard icon="🏦" label="Cash Runway" value={`${m.cashRunway.days} days`} sub={`₹${m.cashRunway.cash}L in ${m.cashRunway.accounts} accounts`} color={runwayColor(m.cashRunway.days)} />
                        <MetricCard icon="🏛" label="Next EMI" value={`₹${m.nextEmi.amount}L`} sub={`${m.nextEmi.date} · ${m.nextEmi.bank}`} color={m.nextEmi.overdue ? C.red : C.navy} onPress={() => router.push('/(tabs)/more')} />
                        <MetricCard icon="📊" label="GST & Tax" value={m.compliance.status} sub={`${m.compliance.filing} in ${m.compliance.daysLeft}d`} color={m.compliance.daysLeft <= 3 ? C.red : C.green} onPress={() => router.push('/(tabs)/more')} />
                        <MetricCard icon="📈" label="Sales Trend" value={`${m.sales.up ? '↑' : '↓'} ${m.sales.pct}%`} sub={`₹${m.sales.thisMonth}L this month`} color={m.sales.up ? C.green : C.red} onPress={() => router.push('/(tabs)/more')} />
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    ); //[cite: 4]
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