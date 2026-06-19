import React, { useEffect, useRef } from 'react';
import { ScrollView, View, Text, StyleSheet, SafeAreaView, Animated, TouchableOpacity, ActivityIndicator } from 'react-native';
import { C } from '@/constants/theme';
import { useMsmeData } from '../../hooks/useMsmeData';
import { useLoans } from '../../hooks/useLoans';
import { useMonthlySales } from '../../hooks/useMonthlySales';
import { useComplianceFilings } from '../../hooks/useComplianceFilings';
import { formatINR } from '../../lib/format';

// ─── STRICT MODE TYPES ──────────────────────────────────────────────────────
type MonthStatus = '✓' | '✕' | '—';

interface ComplianceItem {
    name: string;
    sub: string;
    amount: string;
    state: 'urgent' | 'upcoming' | 'filed';
}

// ─── DATA / WIRING ────────────────────────────────────────────────────────────
//   loan        → LIVE from `loans`              (useLoans).
//   compliance  → LIVE from `compliance_filings` (useComplianceFilings).
//   sales       → LIVE from `monthly_sales`      (useMonthlySales).
//   emiHistory  → no per-payment table           → MOCK.
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const EMI_STATUS: Record<string, MonthStatus> = {
    Jan: '—', Feb: '✓', Mar: '✓', Apr: '✕', May: '✓', Jun: '✓',
    Jul: '✓', Aug: '✓', Sep: '✓', Oct: '✓', Nov: '✓', Dec: '—',
};

const statusColor = (s: MonthStatus) => (s === '✓' ? C.teal : s === '✕' ? C.red : C.textMuted);
const statusBg = (s: MonthStatus) => (s === '✓' ? C.greenBg : s === '✕' ? C.redBg : C.border);

const stateTint = (s: ComplianceItem['state']) => (s === 'urgent' ? C.red : s === 'filed' ? C.green : C.amber);
const stateAmountColor = (s: ComplianceItem['state']) => (s === 'urgent' ? C.red : s === 'filed' ? C.green : C.text);

const fmtDate = (iso: string | null): string => {
    if (!iso) return '—';
    const d = new Date(iso);
    return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

const fmtDM = (iso: string | null): string => {
    if (!iso) return '—';
    const d = new Date(iso);
    return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
};

// ─── COMPLIANCE ROW (self-animating, pressable) ───────────────────────────────
function ComplianceRow({ item, delay }: { item: ComplianceItem; delay: number }) {
    const enter = useRef(new Animated.Value(0)).current;
    const scale = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        Animated.timing(enter, { toValue: 1, duration: 380, delay, useNativeDriver: false }).start();
    }, []);

    const tint = stateTint(item.state);

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
                    <Text style={styles.complianceChipText}>{item.state === 'filed' ? '✅' : '🧾'}</Text>
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={styles.complianceName} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.complianceDue}>{item.sub}</Text>
                </View>
                <Text style={[styles.complianceAmount, { color: stateAmountColor(item.state) }]}>{item.amount}</Text>
            </TouchableOpacity>
        </Animated.View>
    );
}

export default function MoreScreen() {
    // Live data (same active client as the rest of the app).
    const { data: msmeEntities } = useMsmeData();
    const activeMsmeId = msmeEntities && msmeEntities.length > 0 ? msmeEntities[0].id : null;

    const { data: loans = [], isLoading: loansLoading } = useLoans(activeMsmeId);
    const { data: filings = [], isLoading: filingsLoading } = useComplianceFilings(activeMsmeId);
    const { data: salesRows = [], isLoading: salesLoading } = useMonthlySales(activeMsmeId);

    const loan = loans[0] ?? null; // primary = largest sanctioned

    const sanctioned = Number(loan?.sanctioned_amount) || 0;
    const outstanding = Number(loan?.outstanding_balance) || 0;
    const paid = Math.max(sanctioned - outstanding, 0);
    const paidPct = sanctioned > 0 ? Math.min(Math.round((paid / sanctioned) * 100), 100) : 0;

    // ── Compliance: upcoming (pending) first, then recent filed history ──
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dayDiff = (iso: string) => Math.ceil((new Date(iso).getTime() - today.getTime()) / 86400000);

    const pendingItems: ComplianceItem[] = filings
        .filter((f) => f.status === 'pending')
        .sort((a, b) => a.due_date.localeCompare(b.due_date))
        .map((f): ComplianceItem => {
            const d = dayDiff(f.due_date);
            return {
                name: `${f.filing_type} · ${f.period}`,
                sub: `Due ${fmtDM(f.due_date)} · ${d <= 0 ? 'due now' : `${d} day${d === 1 ? '' : 's'} left`}`,
                amount: f.amount != null ? formatINR(Number(f.amount)) : '—',
                state: d <= 7 ? 'urgent' : 'upcoming',
            };
        });

    const filedItems: ComplianceItem[] = filings
        .filter((f) => f.status !== 'pending')
        .sort((a, b) => b.due_date.localeCompare(a.due_date))
        .slice(0, 6)
        .map((f): ComplianceItem => ({
            name: `${f.filing_type} · ${f.period}`,
            sub: `Filed ${fmtDM(f.filed_date)}`,
            amount: f.amount != null ? formatINR(Number(f.amount)) : '—',
            state: 'filed',
        }));

    const complianceItems = [...pendingItems, ...filedItems];

    // ── Sales: bars scaled to the busiest month; header = latest month + MoM ──
    const revenues = salesRows.map((r) => Number(r.revenue));
    const maxRev = Math.max(...revenues, 1);
    const latest = salesRows.length ? salesRows[salesRows.length - 1] : null;
    const prev = salesRows.length > 1 ? salesRows[salesRows.length - 2] : null;
    const latestRev = latest ? Number(latest.revenue) : 0;
    const prevRev = prev ? Number(prev.revenue) : 0;
    const momPct = prevRev > 0 ? Math.round(((latestRev - prevRev) / prevRev) * 100) : null;
    const latestLabel = latest ? new Date(latest.month).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }) : '';
    const inLakh = (n: number) => (n ? `₹${(n / 100000).toFixed(1)}L` : '—');
    const monthLetter = (iso: string) => {
        const d = new Date(iso);
        return isNaN(d.getTime()) ? '?' : d.toLocaleDateString('en-IN', { month: 'short' }).charAt(0);
    };

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

                {/* ── COMPLIANCE CALENDAR (live from compliance_filings) ── */}
                <Text style={styles.sectionTitle}>Compliance Calendar</Text>
                {filingsLoading ? (
                    <ActivityIndicator color={C.teal} style={{ paddingVertical: 20 }} />
                ) : complianceItems.length === 0 ? (
                    <View style={[styles.card, styles.emptyBox]}>
                        <Text style={styles.emptyBoxText}>No filings on record yet.</Text>
                    </View>
                ) : (
                    complianceItems.map((item, i) => (
                        <ComplianceRow key={`${item.name}-${item.state}`} item={item} delay={220 + i * 60} />
                    ))
                )}

                {/* ── SALES TREND (live from monthly_sales) ── */}
                <Text style={styles.sectionTitle}>Sales Trend</Text>
                <Animated.View style={[styles.card, rise(s3)]}>
                    {salesLoading ? (
                        <ActivityIndicator color={C.teal} style={{ paddingVertical: 28 }} />
                    ) : salesRows.length === 0 ? (
                        <View style={styles.emptyBox}>
                            <Text style={styles.emptyBoxText}>No sales data yet.</Text>
                        </View>
                    ) : (
                        <>
                            <View style={styles.salesHeader}>
                                <View>
                                    <Text style={styles.metricLabel}>Latest · {latestLabel}</Text>
                                    <Text style={styles.salesValue}>{inLakh(latestRev)}</Text>
                                </View>
                                {momPct != null && (
                                    <View style={[styles.salesBadge, momPct < 0 && { backgroundColor: C.redBg }]}>
                                        <Text style={[styles.salesBadgeText, momPct < 0 && { color: C.red }]}>
                                            {momPct >= 0 ? '↑' : '↓'} {Math.abs(momPct)}% vs last month
                                        </Text>
                                    </View>
                                )}
                            </View>

                            {salesRows.map((r, i) => {
                                const v = Number(r.revenue);
                                const pct = v ? (v / maxRev) * 100 : 2;
                                const w = grow.interpolate({ inputRange: [0, 1], outputRange: ['0%', `${pct}%`] });
                                const isLatest = i === salesRows.length - 1;
                                const barColor = v === 0 ? C.border : isLatest ? C.teal : C.navy + 'CC';
                                return (
                                    <View key={r.id} style={styles.sparkRow}>
                                        <Text style={styles.sparkMonth}>{monthLetter(r.month)}</Text>
                                        <View style={styles.sparkTrack}>
                                            <Animated.View style={[styles.sparkFill, { width: w, backgroundColor: barColor }]} />
                                        </View>
                                        <Text style={styles.sparkValue}>{inLakh(v)}</Text>
                                    </View>
                                );
                            })}
                        </>
                    )}
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

    // Shared empty state
    emptyBox: { paddingVertical: 22, alignItems: 'center' },
    emptyBoxText: { fontSize: 13, color: C.textMuted, fontWeight: '600' },

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
