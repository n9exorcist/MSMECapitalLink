import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import { C, T, bandColor } from '@/constants/theme'; //[cite: 7]

interface ScoreArcProps { score: number; previousScore: number; band: string; } //[cite: 7]

export function ScoreArc({ score, previousScore, band }: ScoreArcProps) {
    const pulseAnim = useRef(new Animated.Value(1)).current; //[cite: 7]
    const barAnim = useRef(new Animated.Value(0)).current; //[cite: 7]
    const color = bandColor(band); //[cite: 7]
    const delta = score - previousScore; //[cite: 7]

    // Inside components/ScoreArc.tsx around line 20:
    useEffect(() => {
        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, { toValue: 1.04, duration: 950, useNativeDriver: false }), // Change to false
                Animated.timing(pulseAnim, { toValue: 1, duration: 950, useNativeDriver: false }), // Change to false
            ])
        );
        loop.start();
        return () => loop.stop();
    }, []);

    useEffect(() => {
        Animated.timing(barAnim, { toValue: score / 100, duration: 1200, delay: 400, useNativeDriver: false }).start();
    }, [score]); //[cite: 7]

    return (
        <View style={styles.wrap}>
            <Animated.View style={[styles.outerRing, { borderColor: `${color}40`, transform: [{ scale: pulseAnim }] }]}>
                <View style={[styles.midRing, { borderColor: `${color}70` }]}>
                    <View style={[styles.core, { backgroundColor: `${color}0D` }]}>
                        <Text style={[styles.band, { color }]}>{band}</Text>
                        <Text style={styles.num}>{score}</Text>
                        <Text style={styles.of}>/ 100</Text>
                    </View>
                </View>
            </Animated.View>
            <View style={[styles.deltaBadge, { backgroundColor: delta >= 0 ? C.greenBg : C.redBg }]}>
                <Text style={[styles.deltaText, { color: delta >= 0 ? C.green : C.red }]}>{delta >= 0 ? '↑' : '↓'} {Math.abs(delta)} from last week</Text>
            </View>
            <View style={styles.barTrack}>
                <Animated.View style={[styles.barFill, { backgroundColor: color, width: barAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]} />
                <View style={[styles.barDot, { left: `${score}%` as any, backgroundColor: color }]} />
            </View>
            <View style={styles.barLabels}>{['0', '25', '50', '75', '100'].map((l) => <Text key={l} style={styles.barLabel}>{l}</Text>)}</View>
        </View>
    ); //[cite: 7]
}

const styles = StyleSheet.create({
    wrap: { alignItems: 'center', paddingTop: 4 }, //[cite: 7]
    outerRing: { width: 148, height: 148, borderRadius: 74, borderWidth: 3, alignItems: 'center', justifyContent: 'center', marginBottom: 16 }, //[cite: 7]
    midRing: { width: 124, height: 124, borderRadius: 62, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' }, //[cite: 7]
    core: { width: 106, height: 106, borderRadius: 53, alignItems: 'center', justifyContent: 'center' }, //[cite: 7]
    band: { fontSize: T.xs, fontWeight: '900', letterSpacing: 2, textTransform: 'uppercase' }, //[cite: 7]
    num: { fontSize: T.hero, fontWeight: '200', color: C.navy, letterSpacing: -3, lineHeight: T.hero + 2 }, //[cite: 7]
    of: { fontSize: T.xs, fontWeight: '700', color: C.textMuted, marginTop: -4 }, //[cite: 7]
    deltaBadge: { paddingVertical: 6, paddingHorizontal: 14, borderRadius: 20, marginBottom: 16 }, //[cite: 7]
    deltaText: { fontSize: T.sm, fontWeight: '700' }, //[cite: 7]
    barTrack: { width: '100%', height: 8, backgroundColor: C.border, borderRadius: 4, overflow: 'visible', position: 'relative' }, //[cite: 7]
    barFill: { height: '100%', borderRadius: 4 }, //[cite: 7]
    barDot: { position: 'absolute', top: -3, width: 14, height: 14, borderRadius: 7, borderWidth: 2.5, borderColor: C.white, marginLeft: -7, boxShadow: '0px 0px 0px 3px rgba(15,118,110,0.2)' } as any, //[cite: 7]
    barLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, width: '100%' }, //[cite: 7]
    barLabel: { fontSize: T.xs, fontWeight: '600', color: C.textMuted }, //[cite: 7]
});