import React, { useEffect, useRef } from 'react';
import { ScrollView, View, Text, StyleSheet, SafeAreaView, Animated, TouchableOpacity, ActivityIndicator } from 'react-native';
import { C } from '@/constants/theme';
import { useMsmeData } from '../../hooks/useMsmeData';
import { useLoans } from '../../hooks/useLoans';
import { formatINR } from '../../lib/format';

// ─── STRICT MODE TYPES ──────────────────────────────────────────────────────
type MonthStatus = '✓' | '✕' | '—';

interface ComplianceItem {
    name: string;
    due: string;
    days: number;
    amount: string;
    urgent: boolean;
}

// ─── DATA / WIRING ────────────────────────────────────────────────────────────
//   loan        → LIVE from the `loans` table (useLoans).
//   emiHistory  → no per-payment table   → MOCK.
//   compliance  → no filings table        → MOCK (needs CFO console data-entry).
//   sales       → no monthly time-series  → MOCK.
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const EMI_STATUS: Record<string, MonthStatus> = {
    Jan: '—', Feb: '✓', Mar: '✓', Apr: '✕', May: '✓', Jun: '✓',
    Jul: '✓', Aug: '✓', Sep: '✓', Oct: '✓', Nov: '✓', Dec: '—',
};

const COMPLIANCE: ComplianceItem[] = [
    { name: 'GSTR-3B (May 2026)', due: '20 Jun', days: 5, amount: '₹3.2L', urgent: true },
    { name: 'TDS Payment (Q1)', due: '07 Jul', days: 22, amount: '₹0.8L', urgent: false },
    { name: 'PF Contribution', due: '15 Jul', days: 30, amount: '₹0.4L', urgent: false },
    { name: 'ESI Payment', due: '21 Jul', days: 36, amount: '₹0.2L', urgent: false },
];

const SPARK_DATA = [12, 15, 11, 18, 14, 16, 18, 13, 17, 15, 18, 0];
const SPARK_MONTHS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

const statusColor = (s: MonthStatus) => (s === '✓' ? C.teal : s === '✕' ? C.red : C.textMuted);
const statusBg = (s: MonthStatus) => (s === '✓' ? C.greenBg : s === '✕' ? C.redBg : C.border);

const fmtDate = (iso: string | null): string => {
    if (!iso) return '—';
    const d = new Date(iso);
    return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

// ─── COMPLIANCE ROW (self-animating, pressable) ───────────────────────────────
function ComplianceRow({ item, delay }: { item: ComplianceItem; delay: number }) {
    const enter = useRef(new Animated.Value(0)).current;
    const scale = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        Animated.timing(enter, { toValue: 1, duration: 380, delay, useNativeDriver: false }).start();
    }, []);

    const tint = item.urgent ? C.red : C.green;

    return (
        <Animated.View
            style={{
                opacity: enter,
                transform: [
                    { translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) },
                    { scale },
                ],
            }}
        >
            <TouchableOpacity
                activeOpacity={0.7}
                onPressIn={() => Animated.spring(scale, { toValue: 0.98, useNativeDriver: false }).start()}
                onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: false }).start()}
                style={styles.complianceRow}
            >
                <View style={[styles.complianceChip, { backgroundColor: `${tint}14` }]}>
                    <Text style={styles.complianceChipText}>🧾</Text>
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={styles.complianceName} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.complianceDue}>Due {item.due} · {item.days} days left</Text>
                </View>
                <Text style={[styles.complianceAmount, { color: item.urgent ? C.red : C.text }]}>{item.amount}</Text>
            </TouchableOpacity>
        </Animated.View>
    );
}

export default function MoreScreen() {
    // Live loan data (same active client as the rest of the app).
    const { data: msmeEntities } = useMsmeData();
    const activeMsmeId = msmeEntities && msmeEntities.length > 0 ? msmeEntities[0].id : null;
    const { data: loans = [], isLoading: loansLoading } = useLoans(activeMsmeId);
    const loan = loans[0] ?? null; // primary = largest sanctioned

    const sanctioned = Number(loan?.sanctioned_amount) || 0;
    const outstanding = Number(loan?.outstanding_balance) || 0;
    const paid = Math.max(sanctioned - outstanding, 0);
    const paidPct = sanctioned > 0 ? Math.min(Math.round((paid / sanctioned) * 100), 100) : 0;

    // Section entrances + a shared "grow" value for the loan bar and sales bars.
    const s1 = useRef(new Animated.Value(0)).current; // Loans
    const s2 = useRef(new Animated.Value(0)).current; // Payment history
    const s3 = useRef(new Animated.Value(0)).current; // Sales trend
    const grow = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(s1, { toValue: 1, duration: 420, delay: 0, useNativeDriver: false }).start();
        Animated.timing(s2, { toValue: 1, duration: 420, delay: 110, useNativeDriver: false }).start();
        Animated.timing(s3, { toValue: 1, duration: 420, delay: 520, useNativeDriver: false }).start();
        Animated.timing(grow, { toValue: 1, duration: 950, delay: 350, useNativeDriver: false }).start();
    }, []);

    const rise = (v: Animated.Value) => ({
        opacity: v,
        transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }],
    });

    const loanWidth = grow.interpolate({ inputRange: [0, 1], outputRange: ['0%', `${paidPct}%`] });

    return (
        <SafeAreaView style={styles.safe}>
            <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
                <Text style={styles.screenTitle}>More</Text>

                {/* ── LOANS & EMI (live from `loans`) ── */}
                <Text style={styles.sectionTitle}>Loans & EMI</Text>
                <Animated.View style={[styles.card, styles.cardHero, rise(s1)]}>
                    {loansLoading ? (
                        <ActivityIndicator color={C.teal} style={{ paddingVertical: 28 }} />
                    ) : !loan ? (
                        <View style={styles.emptyLoan}>
                            <Text style={styles.emptyLoanTitle}>No loan on file</Text>
                            <Text style={styles.emptyLoanSub}>Add a loan from the CFO console to see it here.</Text>
                        </View>
                    ) : (
                        <>
                            <View style={styles.loanTop}>
                                <View style={styles.bankIcon}><Text style={{ fontSize: 20 }}>🏛️</Text></View>
                                <View style={styles.loanInfo}>
                                    <Text style={styles.loanTitle} numberOfLines={1}>{loan.loan_type ?? 'Loan'}</Text>
                                </View>
                                <View style={[styles.activePill, outstanding <= 0 && styles.closedPill]}>
                                    <Text style={[styles.activePillText, outstanding <= 0 && styles.closedPillText]}>
                                        {outstanding > 0 ? 'Active' : 'Closed'}
                                    </Text>
                                </View>
                            </View>

                            <View style={styles.loanMetrics}>
                                <View>
                                    <Text style={styles.metricLabel}>Paid so far</Text>
                                    <Text style={styles.metricValue}>{formatINR(paid)}</Text>
                                </View>
                                <View style={{ alignItems: 'center' }}>
                                    <Text style={styles.metricLabel}>Outstanding</Text>
                                    <Text style={[styles.metricValue, { color: C.red }]}>{formatINR(outstanding)}</Text>
                                </View>
                                <View style={{ alignItems: 'flex-end' }}>
                                    <Text style={styles.metricLabel}>EMI</Text>
                                    <Text style={styles.metricValue}>{formatINR(Number(loan.emi_amount) || 0)}</Text>
                                </View>
                            </View>

                            {/* Progress bar — animates from 0 → paid% on load */}
                            <View style={styles.progressSection}>
                                <View style={styles.progressTrack}>
                                    <Animated.View style={[styles.progressFill, { width: loanWidth }]} />
                                </View>
                                <View style={styles.progressLabels}>
                                    <Text style={styles.progressLabelText}>₹0</Text>
                                    <Text style={[styles.progressLabelText, { color: C.teal, fontWeight: '700' }]}>{paidPct}% paid</Text>
                                    <Text style={styles.progressLabelText}>{formatINR(sanctioned)}</Text>
                                </View>
                            </View>

                            <View style={styles.separator} />

                            <View style={styles.loanFooter}>
                                <Text style={styles.metricLabel}>Next EMI due</Text>
                                <Text style={styles.loanDueDate}>{fmtDate(loan.next_due_date)}</Text>
                            </View>
                        </>
                    )}
                </Animated.View>

                {/* ── EMI CALENDAR (mock) ── */}
                <Animated.View style={[styles.card, { marginTop: 12 }, rise(s2)]}>
                    <Text style={[styles.sectionTitle, styles.cardTitle]}>Payment History 2026</Text>
                    <View style={styles.emiGrid}>
                        {MONTHS.map((m) => (
                            <View key={m} style={styles.emiCell}>
                                <Text style={styles.emiMonth}>{m}</Text>
                                <View style={[styles.emiDot, { backgroundColor: statusBg(EMI_STATUS[m]) }]}>
                                    <Text style={[styles.emiDotText, { color: statusColor(EMI_STATUS[m]) }]}>{EMI_STATUS[m]}</Text>
                                </View>
                            </View>
                        ))}
                    </View>
                </Animated.View>

                {/* ── COMPLIANCE CALENDAR (mock) ── */}
                <Text style={styles.sectionTitle}>Compliance Calendar</Text>
                {COMPLIANCE.map((item, i) => (
                    <ComplianceRow key={item.name} item={item} delay={220 + i * 70} />
                ))}

                {/* ── SALES TREND (mock) ── */}
                <Text style={styles.sectionTitle}>Sales Trend</Text>
                <Animated.View style={[styles.card, rise(s3)]}>
                    <View style={styles.salesHeader}>
                        <View>
                            <Text style={styles.metricLabel}>This month</Text>
                            <Text style={styles.salesValue}>₹18.4L</Text>
                        </View>
                        <View style={styles.salesBadge}><Text style={styles.salesBadgeText}>↑ 12% vs last year</Text></View>
                    </View>

                    {SPARK_DATA.map((v, i) => {
                        const pct = v ? (v / 20) * 100 : 2;
                        const w = grow.interpolate({ inputRange: [0, 1], outputRange: ['0%', `${pct}%`] });
                        const barColor = i === 11 ? C.border : i === 5 ? C.teal : C.navy + 'CC';
                        return (
                            <View key={i} style={styles.sparkRow}>
                                <Text style={styles.sparkMonth}>{SPARK_MONTHS[i]}</Text>
                                <View style={styles.sparkTrack}>
                                    <Animated.View style={[styles.sparkFill, { width: w, backgroundColor: barColor }]} />
                                </View>
                                <Text style={styles.sparkValue}>{v ? `₹${v}L` : '—'}</Text>
                            </View>
                        );
                    })}
                </Animated.View>
            </ScrollView>
        </SafeAreaView>
    );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: C.bg },
    scroll: { padding: 16, paddingBottom: 48 },
    screenTitle: { fontSize: 17, fontWeight: '800', color: C.navy, marginBottom: 4, letterSpacing: -0.3 },
    sectionTitle: { fontSize: 15, fontWeight: '800', color: C.navy, marginTop: 24, marginBottom: 12, paddingLeft: 4 },
    cardTitle: { marginTop: 0, marginBottom: 12, paddingLeft: 0 },

    card: {
        backgroundColor: C.surface, borderRadius: 20, padding: 20,
        borderWidth: 1, borderColor: C.border,
        boxShadow: '0px 4px 12px rgba(11,46,79,0.04)',
    } as any,
    cardHero: { boxShadow: '0px 10px 24px rgba(11,46,79,0.10)' } as any,

    // Loan card
    loanTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
    bankIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: C.navyDark, alignItems: 'center', justifyContent: 'center' },
    loanInfo: { flex: 1, marginLeft: 12 },
    loanTitle: { fontSize: 15, fontWeight: '800', color: C.text },
    activePill: { backgroundColor: C.greenBg, paddingVertical: 5, paddingHorizontal: 12, borderRadius: 20 },
    activePillText: { fontSize: 11, fontWeight: '800', color: C.green },
    closedPill: { backgroundColor: C.border },
    closedPillText: { color: C.textMuted },
    loanMetrics: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
    metricLabel: { fontSize: 11, fontWeight: '600', color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.4 },
    metricValue: { fontSize: 15, fontWeight: '800', color: C.text, marginTop: 3 },
    progressSection: { marginBottom: 16 },
    progressTrack: { height: 8, backgroundColor: C.border, borderRadius: 4, overflow: 'hidden' },
    progressFill: { height: '100%', backgroundColor: C.teal, borderRadius: 4 },
    progressLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
    progressLabelText: { fontSize: 11, color: C.textMuted, fontWeight: '600' },
    separator: { height: 1, backgroundColor: C.border, marginVertical: 14 },
    loanFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    loanDueDate: { fontSize: 15, fontWeight: '800', color: C.amber },
    emptyLoan: { paddingVertical: 24, alignItems: 'center', gap: 4 },
    emptyLoanTitle: { fontSize: 15, fontWeight: '800', color: C.navy },
    emptyLoanSub: { fontSize: 12, color: C.textMuted, textAlign: 'center' },

    // EMI calendar
    emiGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
    emiCell: { width: '16%', alignItems: 'center', marginVertical: 6 },
    emiMonth: { fontSize: 10, fontWeight: '700', color: C.textMuted, marginBottom: 5 },
    emiDot: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    emiDotText: { fontSize: 12, fontWeight: '800' },

    // Compliance
    complianceRow: {
        flexDirection: 'row', alignItems: 'center', gap: 12,
        backgroundColor: C.surface, borderRadius: 14, padding: 14, marginBottom: 8,
        borderWidth: 1, borderColor: C.border,
        boxShadow: '0px 2px 8px rgba(11,46,79,0.03)',
    } as any,
    complianceChip: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
    complianceChipText: { fontSize: 16 },
    complianceName: { fontSize: 13, fontWeight: '700', color: C.text },
    complianceDue: { fontSize: 11, color: C.textMuted, marginTop: 2 },
    complianceAmount: { fontSize: 13, fontWeight: '800' },

    // Sales trend
    salesHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    salesValue: { fontSize: 24, fontWeight: '800', color: C.navy, marginTop: 2 },
    salesBadge: { backgroundColor: C.greenBg, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20 },
    salesBadgeText: { fontSize: 12, fontWeight: '700', color: C.green },
    sparkRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 7, gap: 8 },
    sparkMonth: { width: 14, fontSize: 10, fontWeight: '700', color: C.textMuted },
    sparkTrack: { flex: 1, height: 7, backgroundColor: C.border, borderRadius: 4, overflow: 'hidden' },
    sparkFill: { height: '100%', borderRadius: 4 },
    sparkValue: { width: 42, fontSize: 10, fontWeight: '600', color: C.textSub, textAlign: 'right' },
});
