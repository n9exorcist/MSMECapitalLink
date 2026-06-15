import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface ScoreArcProps {
    score: number;
    label: string;
}

export function ScoreArc({ score, label }: ScoreArcProps) {
    return (
        <View style={styles.container}>
            <View style={styles.arcContainer}>
                {/* Outer Circular Track Representation */}
                <View style={styles.outerCircle}>
                    <View style={styles.innerCircle}>
                        <Text style={styles.scoreText}>{score}</Text>
                        <Text style={styles.maxScore}>/100</Text>
                    </View>
                </View>
            </View>
            <View style={styles.badgeContainer}>
                <Text style={styles.badgeText}>{label}</Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        justifyContent: 'center',
        marginVertical: 16,
    },
    arcContainer: {
        width: 140,
        height: 140,
        borderRadius: 70,
        backgroundColor: '#E2EAF4',
        alignItems: 'center',
        justifyContent: 'center',
    },
    outerCircle: {
        width: 128,
        height: 128,
        borderRadius: 64,
        backgroundColor: '#0F766E', // Primary Teal Accent
        alignItems: 'center',
        justifyContent: 'center',
    },
    innerCircle: {
        width: 110,
        height: 110,
        borderRadius: 55,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
    },
    scoreText: {
        fontSize: 32,
        fontWeight: '800',
        color: '#0B2E4F',
    },
    maxScore: {
        fontSize: 14,
        color: '#475569',
        fontWeight: '600',
        marginTop: 10,
    },
    badgeContainer: {
        backgroundColor: '#ECFDF5',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        marginTop: -15,
        borderWidth: 1,
        borderColor: '#A7F3D0',
    },
    badgeText: {
        color: '#059669',
        fontSize: 12,
        fontWeight: '700',
    },
});