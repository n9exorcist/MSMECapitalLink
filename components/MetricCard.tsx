import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

interface MetricCardProps {
    title: string;
    value: string;
    subtitle: string;
    status: 'good' | 'warning' | 'alert';
    onPress?: () => void;
}

export function MetricCard({ title, value, subtitle, status, onPress }: MetricCardProps) {
    const getStatusColors = () => {
        switch (status) {
            case 'good': return { bg: '#ECFDF5', text: '#059669' };
            case 'warning': return { bg: '#FFFBEB', text: '#D97706' };
            case 'alert': return { bg: '#FEF2F2', text: '#DC2626' };
            default: return { bg: '#F1F5F9', text: '#475569' };
        }
    };

    const colors = getStatusColors();

    return (
        <TouchableOpacity onPress={onPress} style={styles.card} activeOpacity={0.8}>
            <Text style={styles.title} numberOfLines={1}>{title}</Text>
            <Text style={styles.value} numberOfLines={1}>{value}</Text>
            <View style={[styles.badge, { backgroundColor: colors.bg }]}>
                <Text style={[styles.badgeText, { color: colors.text }]} numberOfLines={1}>
                    {subtitle}
                </Text>
            </View>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    card: {
        width: '100%', // Fills the wrapper automatically
        backgroundColor: '#FFFFFF',
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#E2EAF4',
        // Slight shadow for depth matching the original design
        shadowColor: '#0B2E4F',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
        elevation: 2,
    },
    title: {
        fontSize: 12,
        fontWeight: '700',
        color: '#64748B',
        marginBottom: 6,
        textTransform: 'uppercase',
        letterSpacing: 0.5
    },
    value: {
        fontSize: 24,
        fontWeight: '800',
        color: '#0B2E4F',
        marginBottom: 10,
        letterSpacing: -0.5
    },
    badge: {
        alignSelf: 'flex-start',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8
    },
    badgeText: {
        fontSize: 11,
        fontWeight: '700'
    }
});