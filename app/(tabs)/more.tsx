import React from 'react';
import { ScrollView, View, Text, StyleSheet } from 'react-native';

// ─── STRICT MODE TYPES ────────────────────────────────────────────────────────
type MonthStatus = '✓' | '✕' | '—';

interface ComplianceItem {
    name: string;
    due: string;
    days: number;
    amount: string;
    urgent: boolean;
}

export default function MoreScreen() {
    // Mock Data from Original Blueprint
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const emiStatus: Record<string, MonthStatus> = {
        Jan: '—', Feb: '✓', Mar: '✓', Apr: '✕', May: '✓', Jun: '✓',
        Jul: '✓', Aug: '✓', Sep: '✓', Oct: '✓', Nov: '✓', Dec: '—'
    };

    const complianceList: ComplianceItem[] = [
        { name: 'GSTR-3B (May 2026)', due: '20 Jun', days: 5, amount: '₹3.2L', urgent: true },
        { name: 'TDS Payment (Q1)', due: '07 Jul', days: 22, amount: '₹0.8L', urgent: false },
        { name: 'PF Contribution', due: '15 Jul', days: 30, amount: '₹0.4L', urgent: false },
        { name: 'ESI Payment', due: '21 Jul', days: 36, amount: '₹0.2L', urgent: false },
    ];

    const sparkData = [12, 15, 11, 18, 14, 16, 18, 13, 17, 15, 18, 0];
    const sparkMonths = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

    const getStatusColor = (s: MonthStatus) => s === '✓' ? '#0F766E' : s === '✕' ? '#DC2626' : '#94A3B8';
    const getStatusBg = (s: MonthStatus) => s === '✓' ? '#ECFDF5' : s === '✕' ? '#FEF2F2' : '#E2EAF4';

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

            {/* ── LOANS & EMI ── */}
            <Text style={styles.sectionTitle}>Loans & EMI</Text>
            <View style={styles.card}>
                <View style={styles.loanTop}>
                    <View style={styles.bankIcon}><Text style={{ fontSize: 20 }}>🏛</Text></View>
                    <View style={styles.loanInfo}>
                        <Text style={styles.bankName}>Canara Bank</Text>
                        <Text style={styles.productName}>Working Capital Loan</Text>
                    </View>
                    <View style={styles.activePill}>
                        <Text style={styles.activePillText}>Active</Text>
                    </View>
                </View>

                <View style={styles.loanMetrics}>
                    <View>
                        <Text style={styles.metricLabel}>Paid so far</Text>
                        <Text style={styles.metricValue}>₹15.8L</Text>
                    </View>
                    <View>
                        <Text style={styles.metricLabel}>Outstanding</Text>
                        <Text style={[styles.metricValue, { color: '#DC2626' }]}>₹4.2L</Text>
                    </View>
                    <View>
                        <Text style={styles.metricLabel}>Rate</Text>
                        <Text style={styles.metricValue}>9.5%</Text>
                    </View>
                </View>

                {/* Progress Bar */}
                <View style={styles.progressSection}>
                    <View style={styles.progressTrack}>
                        <View style={[styles.progressFill, { width: '79%' }]} />
                    </View>
                    <View style={styles.progressLabels}>
                        <Text style={styles.progressLabelText}>₹0</Text>
                        <Text style={[styles.progressLabelText, { color: '#0F766E', fontWeight: '700' }]}>79% paid</Text>
                        <Text style={styles.progressLabelText}>₹20L</Text>
                    </View>
                </View>

                <View style={styles.separator} />

                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <View>
                        <Text style={styles.metricLabel}>Next EMI</Text>
                        <Text style={styles.metricValue}>₹1.5L</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                        <Text style={styles.metricLabel}>Due date</Text>
                        <Text style={[styles.metricValue, { color: '#D97706' }]}>14 Jun 2026</Text>
                    </View>
                </View>
            </View>

            {/* ── EMI CALENDAR ── */}
            <View style={[styles.card, { marginTop: 12 }]}>
                <Text style={[styles.sectionTitle, { marginTop: 0, marginBottom: 12 }]}>Payment History 2026</Text>
                <View style={styles.emiGrid}>
                    {months.map(m => (
                        <View key={m} style={styles.emiCell}>
                            <Text style={styles.emiMonth}>{m}</Text>
                            <View style={[styles.emiDot, { backgroundColor: getStatusBg(emiStatus[m]) }]}>
                                <Text style={[styles.emiDotText, { color: getStatusColor(emiStatus[m]) }]}>{emiStatus[m]}</Text>
                            </View>
                        </View>
                    ))}
                </View>
            </View>

            {/* ── COMPLIANCE CALENDAR ── */}
            <Text style={styles.sectionTitle}>Compliance Calendar</Text>
            {complianceList.map((item, i) => (
                <View key={i} style={styles.complianceRow}>
                    <View style={[styles.complianceDot, { backgroundColor: item.urgent ? '#DC2626' : '#059669' }]} />
                    <View style={{ flex: 1 }}>
                        <Text style={styles.complianceName}>{item.name}</Text>
                        <Text style={styles.complianceDue}>Due {item.due} · {item.days} days left</Text>
                    </View>
                    <Text style={[styles.complianceAmount, { color: item.urgent ? '#DC2626' : '#0F172A' }]}>
                        {item.amount}
                    </Text>
                </View>
            ))}

            {/* ── SALES TREND ── */}
            <Text style={styles.sectionTitle}>Sales Trend</Text>
            <View style={styles.card}>
                <View style={styles.salesHeader}>
                    <View>
                        <Text style={styles.metricLabel}>This month</Text>
                        <Text style={styles.salesValue}>₹18.4L</Text>
                    </View>
                    <View style={styles.salesBadge}>
                        <Text style={styles.salesBadgeText}>↑ 12% vs last year</Text>
                    </View>
                </View>

                {/* Sparkline Visualizer */}
                {sparkData.map((v, i) => (
                    <View key={i} style={styles.sparkRow}>
                        <Text style={styles.sparkMonth}>{sparkMonths[i]}</Text>
                        <View style={styles.sparkTrack}>
                            <View style={[
                                styles.sparkFill,
                                { width: v ? `${(v / 20) * 100}%` : '2%', backgroundColor: i === 11 ? '#E2EAF4' : i === 5 ? '#0F766E' : '#0B2E4F' + 'CC' }
                            ]} />
                        </View>
                        <Text style={styles.sparkValue}>{v ? `₹${v}L` : '—'}</Text>
                    </View>
                ))}
            </View>

        </ScrollView>
    );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F0F5FA' },
    scrollContent: { padding: 16, paddingBottom: 40 },
    sectionTitle: { fontSize: 15, fontWeight: '800', color: '#0B2E4F', marginTop: 24, marginBottom: 12, paddingLeft: 4 },
    card: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: '#E2EAF4', shadowColor: '#0B2E4F', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 12, elevation: 2 },

    // Loan Card
    loanTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
    bankIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#061D33', alignItems: 'center', justifyContent: 'center' },
    loanInfo: { flex: 1, marginLeft: 12 },
    bankName: { fontSize: 15, fontWeight: '800', color: '#0F172A' },
    productName: { fontSize: 11, color: '#94A3B8', marginTop: 2 },
    activePill: { backgroundColor: '#ECFDF5', paddingVertical: 5, paddingHorizontal: 12, borderRadius: 20 },
    activePillText: { fontSize: 11, fontWeight: '800', color: '#059669' },
    loanMetrics: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
    metricLabel: { fontSize: 11, fontWeight: '600', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.4 },
    metricValue: { fontSize: 15, fontWeight: '800', color: '#0F172A', marginTop: 3 },
    progressSection: { marginBottom: 16 },
    progressTrack: { height: 8, backgroundColor: '#E2EAF4', borderRadius: 4, overflow: 'hidden' },
    progressFill: { height: '100%', backgroundColor: '#0F766E', borderRadius: 4 },
    progressLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
    progressLabelText: { fontSize: 11, color: '#94A3B8', fontWeight: '600' },
    separator: { height: 1, backgroundColor: '#E2EAF4', marginVertical: 14 },

    // EMI Calendar
    emiGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
    emiCell: { width: '16%', alignItems: 'center', marginVertical: 6 },
    emiMonth: { fontSize: 10, fontWeight: '700', color: '#94A3B8', marginBottom: 5 },
    emiDot: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    emiDotText: { fontSize: 12, fontWeight: '800' },

    // Compliance
    complianceRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: '#E2EAF4' },
    complianceDot: { width: 10, height: 10, borderRadius: 5 },
    complianceName: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
    complianceDue: { fontSize: 11, color: '#94A3B8', marginTop: 2 },
    complianceAmount: { fontSize: 13, fontWeight: '800' },

    // Sales Trend
    salesHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    salesValue: { fontSize: 24, fontWeight: '800', color: '#0B2E4F', marginTop: 2 },
    salesBadge: { backgroundColor: '#ECFDF5', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20 },
    salesBadgeText: { fontSize: 12, fontWeight: '700', color: '#059669' },
    sparkRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 7, gap: 8 },
    sparkMonth: { width: 14, fontSize: 10, fontWeight: '700', color: '#94A3B8' },
    sparkTrack: { flex: 1, height: 7, backgroundColor: '#E2EAF4', borderRadius: 4, overflow: 'hidden' },
    sparkFill: { height: '100%', borderRadius: 4 },
    sparkValue: { width: 42, fontSize: 10, fontWeight: '600', color: '#475569', textAlign: 'right' },
});