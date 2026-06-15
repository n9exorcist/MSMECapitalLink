import React from 'react';
import { ScrollView, RefreshControl, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useDashboardData } from '../../hooks/useDashboardData';
import { ScoreArc } from '../../components/ScoreArc';
import { MetricCard } from '../../components/MetricCard';
import { ActionCard } from '../../components/ActionCard';

// 1. Define the exact shape of your data
interface ActionItem {
    id: number | string;
    text: string;
    detail: string;
}

export default function HomeDashboard() {
    const { data: mfosData, isLoading, refetch } = useDashboardData();

    const ownerName = mfosData?.owner || 'Mr. Suresh';

    // Format the current date to match the "Tuesday, 10 Jun 2026" format from the spec
    const today = new Date();
    const dateStr = today.toLocaleDateString('en-IN', {
        weekday: 'long',
        day: 'numeric',
        month: 'short',
        year: 'numeric'
    });

    const actions: ActionItem[] = mfosData?.actions || [
        { id: 1, text: 'Follow up Sundaram', detail: '2.4L (65 days past due)' },
        { id: 2, text: 'Pay Ramesh Steel', detail: '85k due by Friday' },
        { id: 3, text: 'GST filing deadline', detail: '3.2L due in 5 days' },
    ];

    return (
        <ScrollView
            style={styles.container}
            refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor="#0F766E" />}
        >
            {/* Top Banner Accent */}
            <View style={styles.topHeader}>
                <Text style={styles.greeting}>Good morning, {ownerName}</Text>
                <Text style={styles.subGreeting}>{dateStr}</Text>
            </View>

            <View style={styles.content}>
                {/* Main Score Visualizer */}
                <ScoreArc score={78} label="↑ 3 points from last week" />

                {/* Action Center Section */}
                {/* Action Center Section */}
                <Text style={styles.sectionTitle}>Today's 3 Critical Actions</Text>
                <View>
                    {actions.map((action, index) => (
                        <ActionCard key={action.id} action={action} index={index} />
                    ))}
                </View>

                {/* Core Liquidity Metrics Grid */}
                <Text style={styles.sectionTitle}>Key Operational Benchmarks</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                    <View style={styles.metricsGrid}>
                        <View style={styles.metricWrapper}>
                            <MetricCard
                                title="Money In"
                                value="₹14.2L"
                                subtitle="12 customers"
                                status="good"
                            />
                        </View>
                        <View style={styles.metricWrapper}>
                            <MetricCard
                                title="Money Out"
                                value="₹8.6L"
                                subtitle="9 suppliers"
                                status="warning"
                            />
                        </View>
                        <View style={styles.metricWrapper}>
                            <MetricCard
                                title="Cash Runway"
                                value="28 days"
                                subtitle="₹8.2L cash"
                                status="good"
                            />
                        </View>
                        <View style={styles.metricWrapper}>
                            <MetricCard
                                title="Next EMI"
                                value="₹1.5L"
                                subtitle="14 Jun (Canara)"
                                status="warning"
                            />
                        </View>
                        <View style={styles.metricWrapper}>
                            <MetricCard
                                title="Compliance"
                                value="On Track"
                                subtitle="GST in 5d"
                                status="good"
                            />
                        </View>
                        <View style={styles.metricWrapper}>
                            <MetricCard
                                title="Sales"
                                value="↑ +12%"
                                subtitle="vs Jun 25"
                                status="good"
                            />
                        </View>
                    </View>
                </View>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F0F5FA' },
    topHeader: { backgroundColor: '#0B2E4F', padding: 24, paddingBottom: 40, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
    greeting: { fontSize: 22, fontWeight: '800', color: '#FFFFFF' },
    subGreeting: { fontSize: 13, color: '#93C5FD', marginTop: 4 },
    content: { padding: 16, marginTop: -20 },
    sectionTitle: { fontSize: 16, fontWeight: '700', color: '#0B2E4F', marginTop: 20, marginBottom: 10, paddingLeft: 4 },

    // Action Center Styling
    // actionCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#E2EAF4' },
    // actionRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
    // actionNumberBox: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#0F766E', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
    // actionNumber: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
    // actionTexts: { flex: 1 },
    // actionMainText: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
    // actionSubText: { fontSize: 12, color: '#64748B', marginTop: 2 },

    // Metrics Grid Styling
    metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 24 },
    metricWrapper: { width: '48%', marginBottom: 12 } // Forces the 2-column grid layout
});