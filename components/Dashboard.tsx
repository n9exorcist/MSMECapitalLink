import React, { useEffect } from 'react';
import { Text, View, TouchableOpacity, ScrollView } from 'react-native';
import { styles } from './styles';

interface DashboardProps {
    onLogout: () => void;
    executeUnderwriting: () => void;
    score: number;
    statusText: string;
    complianceData: any;
    userRole: 'ADMIN' | 'USER';
    onNavigate: (target: 'DETAILS') => void; // <── ADD THIS LINE RIGHT HERE
}

export default function Dashboard({ onLogout, executeUnderwriting, score, statusText, complianceData, userRole }: DashboardProps) {

    useEffect(() => {
        executeUnderwriting();
    }, []);

    const getScorePointerPosition = (scoreVal: number) => {
        const min = 620;
        const max = 920;
        const percentage = ((scoreVal - min) / (max - min)) * 100;
        return `${Math.min(Math.max(percentage, 0), 100)}%`;
    };

    // Automated logic parsing engine generating context insights dynamically based on backend evaluations
    const renderActionableInsights = (key: string, item: any) => {
        if (!item) return null;
        const isPassed = item.status === "PASS";
        const isStressed = item.status === "STRESSED";

        if (isPassed) {
            let projectionInsight = "Projections suggest stable runway matching compliance parameters. Maintaining current limits protects profitability channels efficiently.";
            if (key === "Current Ratio") projectionInsight = "Asset cushion complies with the Tandon 25% margin rule[cite: 66, 70]. Expected cash reserves look optimal to sustain additional line enhancement requests cleanly.";
            if (key === "Interest Coverage Ratio") projectionInsight = "Healthy operating margins indicate capacity to absorb up to a 50 bps floating market interest rate shift without breaching standard loan hygiene baselines[cite: 261].";

            return (
                <View key={key} style={[styles.insightBoxContainer, { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }]}>
                    <Text style={[styles.insightHeader, { color: '#047857' }]}>✓ Future Insight: {key}</Text>
                    <Text style={styles.insightBody}>{projectionInsight}</Text>
                </View>
            );
        } else {
            let optimizationAdvice = "Metric indicates potential operational friction. Audit inventory pipelines or re-negotiate supplier payback schedules to restore safety limits.";
            if (key === "Current Ratio") optimizationAdvice = "Current assets fail to sufficiently match short-term debts under banking norms[cite: 71]. To fix this, shorten collection periods from slow-moving buyers or infuse fresh promoter equity to optimize your liquidity index[cite: 98, 185].";
            if (key === "Debtor Collection Cycle") optimizationAdvice = "Collection lag exceeds standard credit boundaries[cite: 309, 311]. Implement rigorous age tracking parameters or secure invoice discounting lines to liquidate frozen receivables books immediately[cite: 318, 620].";

            return (
                <View key={key} style={[styles.insightBoxContainer, { backgroundColor: '#FFF5F5', borderColor: '#FEB2B2' }]}>
                    <Text style={[styles.insightHeader, { color: '#C53030' }]}>⚠ Optimization Strategy: {key}</Text>
                    <Text style={styles.insightBody}>{optimizationAdvice}</Text>
                </View>
            );
        }
    };

    return (
        <View style={styles.phoneFrame}>
            {/* Upper Profile Identity Row */}
            <View style={styles.rowHeader}>
                <View style={styles.profileRow}>
                    <View style={styles.avatarPlaceholder}>
                        <Text style={{ fontSize: 16 }}>{userRole === 'ADMIN' ? '🏦' : '👦'}</Text>
                    </View>
                    <View style={{ marginLeft: 12 }}>
                        <Text style={styles.greetingText}>
                            {userRole === 'ADMIN' ? "Hello, Admin Underwriter" : "Hello, Alibiya Enterprise👋"}
                        </Text>
                        <Text style={styles.subGreetingText}>
                            {userRole === 'ADMIN' ? "Canara Bank Portal Desk" : "Active Credit Standing Profile"}
                        </Text>
                    </View>
                </View>
                <TouchableOpacity style={styles.roundIconButton} onPress={onLogout}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: '#EF4444' }}>Exit</Text>
                </TouchableOpacity>
            </View>

            <Text style={styles.sectionTitleText}>Financial Health Statistics</Text>

            {/* Main Scoring Gauge Display Panel */}
            <View style={styles.scoreDataContainer}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                    <View style={styles.scoreDeltaBadge}><Text style={styles.scoreDeltaText}>CIBIL / AA Matrix Check Passed</Text></View>
                </View>
                <View style={styles.scoreAbsolutePlacement}>
                    <Text style={styles.hugeScoreDigit}>{score}</Text>
                    <Text style={[styles.scoreStatusLabelText, { fontSize: 14, maxWidth: 160, textAlign: 'right' }]}>{statusText}</Text>
                </View>
            </View>

            <View style={{ marginVertical: 10, paddingHorizontal: 5, marginBottom: 25 }}>
                <View style={styles.gradientTrackBackground}>
                    <View style={[styles.sliderIndicatorPointerPin, { left: getScorePointerPosition(score) as any }]} />
                </View>
                <View style={styles.gradientAxisLabelsRow}>
                    <Text style={styles.axisTicksText}>620</Text>
                    <Text style={styles.axisTicksText}>720</Text>
                    <Text style={styles.axisTicksText}>820</Text>
                    <Text style={styles.axisTicksText}>920</Text>
                </View>
            </View>

            {/* Dynamic Compliance Grid replacing graph components verbatim from user instruction */}
            <Text style={[styles.innerCardBoldSubheading, { marginTop: 10, marginBottom: 5 }]}>Ratio Compliance Matrix</Text>
            <View style={styles.complianceTableCard}>
                <View style={styles.tableTableHeaderRow}>
                    <Text style={[styles.colHeader, { flex: 2 }]}>RATIO TYPE</Text>
                    <Text style={[styles.colHeader, { flex: 1.2, textAlign: 'center' }]}>ACTUAL</Text>
                    <Text style={[styles.colHeader, { flex: 1.2, textAlign: 'right' }]}>STATUS</Text>
                </View>

                {complianceData && Object.keys(complianceData).map((key) => {
                    const item = complianceData[key];
                    return (
                        <View key={key} style={styles.tableDataRow}>
                            <View style={{ flex: 2 }}>
                                <Text style={styles.cellTextMain}>{key}</Text>
                                <Text style={{ fontSize: 10, color: '#9CA3AF' }}>Norm: {item.norm}</Text>
                            </View>
                            <Text style={[styles.cellTextSub, { flex: 1.2, textAlign: 'center' }]}>{item.value}</Text>
                            <View style={{ flex: 1.2, alignItems: 'flex-end' }}>
                                <View style={item.status === "PASS" ? styles.badgePass : (item.status === "STRESSED" ? styles.badgeStressed : styles.badgeFail)}>
                                    <Text style={item.status === "PASS" ? styles.badgePassText : (item.status === "STRESSED" ? styles.badgeStressedText : styles.badgeFailText)}>
                                        {item.status}
                                    </Text>
                                </View>
                            </View>
                        </View>
                    );
                })}
            </View>

            {/* Systemic Insights Module block parsing strategies dynamically */}
            <Text style={[styles.innerCardBoldSubheading, { marginTop: 20, marginBottom: 5 }]}>Actionable Underwriting Insights</Text>
            <ScrollView style={{ maxHeight: 250 }} showsVerticalScrollIndicator={true}>
                {complianceData && Object.keys(complianceData).map((key) => renderActionableInsights(key, complianceData[key]))}
            </ScrollView>
        </View>
    );
}