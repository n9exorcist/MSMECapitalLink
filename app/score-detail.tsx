import React from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, ActivityIndicator } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { C, T } from '@/constants/theme';
import { ScreenHeader } from '../components/ScreenHeader';

// Owner-friendly names for the 8 banker components (no jargon — spec §1.3).
const LABELS: Record<string, string> = {
    banking_discipline: 'Banking habits',
    liquidity_ratios: 'Cash & liquidity',
    gst_consistency: 'GST filing consistency',
    leverage_quality: 'Borrowing level',
    profitability: 'Profitability',
    compliance_discipline: 'Tax & compliance',
    documentation_readiness: 'Paperwork readiness',
    repayment_behavior: 'Loan repayment track',
};
const ORDER = Object.keys(LABELS);

const BAND_WORD: Record<string, string> = {
    EXCELLENT: 'Excellent', GOOD: 'Good', MEDIUM: 'Fair', POOR: 'Needs attention',
};
const wordFromScore = (s: number) =>
    s >= 80 ? 'Excellent' : s >= 60 ? 'Good' : s >= 40 ? 'Fair' : 'Needs attention';
const barColor = (v: number) => (v >= 70 ? C.teal : v >= 40 ? C.amber : C.red);

type Components = Record<string, number>;

export default function ScoreDetailScreen() {
    const { id } = useLocalSearchParams<{ id?: string }>();

    const { data, isLoading } = useQuery({
        queryKey: ['scoreDetail', id],
        enabled: !!id,
        queryFn: async () => {
            const [{ data: sc }, { data: ent }] = await Promise.all([
                supabase.from('scores').select('score, band, components, computed_at').eq('msme_id', id).maybeSingle(),
                supabase.from('msme_entities').select('health_score, band, score_delta').eq('id', id).maybeSingle(),
            ]);
            return { sc, ent };
        },
    });

    const sc = data?.sc as { score?: number; band?: string; components?: Components } | null | undefined;
    const ent = data?.ent as { health_score?: number; band?: string; score_delta?: number } | null | undefined;

    const score = sc?.score ?? ent?.health_score ?? null;
    const band = sc?.band ?? ent?.band ?? '';
    const delta = ent?.score_delta ?? null;
    const components: Components = (sc?.components as Components) || {};

    const rows = ORDER
        .filter((k) => components[k] != null)
        .map((k) => ({ key: k, label: LABELS[k], value: Math.round(Number(components[k])) }));
    const helping = rows.filter((r) => r.value >= 70);
    const needsWork = rows.filter((r) => r.value < 70).sort((a, b) => a.value - b.value);

    const bandWord = BAND_WORD[String(band).toUpperCase()] || (score != null ? wordFromScore(score) : '—');

    return (
        <>
            <Stack.Screen options={{ headerShown: false }} />
            <SafeAreaView style={styles.safe}>
                <ScreenHeader title="Score breakdown" />
                <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
                    {isLoading ? (
                        <View style={styles.center}><ActivityIndicator color={C.teal} /></View>
                    ) : score == null ? (
                        <View style={styles.center}>
                            <Text style={styles.empty}>No score yet</Text>
                            <Text style={styles.emptySub}>Your score appears here once your CFO team adds your figures.</Text>
                        </View>
                    ) : (
                        <>
                            {/* Summary */}
                            <View style={styles.summary}>
                                <Text style={styles.bandWord}>{bandWord}</Text>
                                <Text style={styles.scoreBig}>{score}<Text style={styles.scoreOut}> / 100</Text></Text>
                                {delta != null && delta !== 0 && (
                                    <Text style={[styles.delta, { color: delta > 0 ? C.green : C.red }]}>
                                        {delta > 0 ? `↑ ${delta}` : `↓ ${Math.abs(delta)}`} from last week
                                    </Text>
                                )}
                            </View>

                            {needsWork.length > 0 && (
                                <Section title="What needs work" rows={needsWork} />
                            )}
                            {helping.length > 0 && (
                                <Section title="What's helping" rows={helping} />
                            )}

                            <Text style={styles.footnote}>
                                Your score blends eight areas of your business. Ask your CFO how to lift the ones that need work.
                            </Text>
                        </>
                    )}
                </ScrollView>
            </SafeAreaView>
        </>
    );
}

function Section({ title, rows }: { title: string; rows: { key: string; label: string; value: number }[] }) {
    return (
        <View style={styles.card}>
            <Text style={styles.sectionLabel}>{title}</Text>
            {rows.map((r, i) => (
                <View key={r.key} style={[styles.row, i === rows.length - 1 && styles.rowLast]}>
                    <View style={styles.rowTop}>
                        <Text style={styles.rowLabel}>{r.label}</Text>
                        <Text style={[styles.rowValue, { color: barColor(r.value) }]}>{r.value}</Text>
                    </View>
                    <View style={styles.track}>
                        <View style={[styles.fill, { width: `${r.value}%`, backgroundColor: barColor(r.value) }]} />
                    </View>
                </View>
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: C.bg },
    scroll: { padding: 16, paddingBottom: 48 },
    center: { alignItems: 'center', justifyContent: 'center', paddingVertical: 64, gap: 8 },
    empty: { fontSize: T.lg, fontWeight: '800', color: C.navy },
    emptySub: { fontSize: 13, color: C.textMuted, textAlign: 'center', maxWidth: 260 },

    summary: {
        backgroundColor: C.surface, borderRadius: 20, padding: 22, alignItems: 'center',
        borderWidth: 1, borderColor: C.border, marginBottom: 16,
        boxShadow: '0px 4px 12px rgba(11,46,79,0.04)',
    } as any,
    bandWord: { fontSize: T.md, fontWeight: '800', color: C.navy, textTransform: 'uppercase', letterSpacing: 0.5 },
    scoreBig: { fontSize: 44, fontWeight: '900', color: C.navy, marginTop: 4 },
    scoreOut: { fontSize: T.base, fontWeight: '700', color: C.textMuted },
    delta: { fontSize: T.sm, fontWeight: '700', marginTop: 6 },

    card: {
        backgroundColor: C.surface, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6,
        borderWidth: 1, borderColor: C.border, marginBottom: 14,
        boxShadow: '0px 4px 12px rgba(11,46,79,0.04)',
    } as any,
    sectionLabel: { fontSize: 12, fontWeight: '800', color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 12, marginBottom: 6 },
    row: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border },
    rowLast: { borderBottomWidth: 0 },
    rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    rowLabel: { fontSize: T.base, fontWeight: '700', color: C.text },
    rowValue: { fontSize: T.base, fontWeight: '800', fontVariant: ['tabular-nums'] },
    track: { height: 8, borderRadius: 999, backgroundColor: C.border, overflow: 'hidden' },
    fill: { height: '100%', borderRadius: 999 },

    footnote: { fontSize: 12, color: C.textMuted, lineHeight: 18, textAlign: 'center', marginTop: 4, paddingHorizontal: 8 },
});
