import React, { useRef } from 'react';
import { View, Text, TouchableOpacity, Animated, StyleSheet } from 'react-native';
import { C, T } from '@/constants/theme'; //[cite: 5]

interface MetricCardProps {
    icon: string; label: string; value: string; sub?: string; badge?: string; color?: string; onPress?: () => void;
} //[cite: 5]

export function MetricCard({ icon, label, value, sub, badge, color = C.teal, onPress }: MetricCardProps) {
    const scale = useRef(new Animated.Value(1)).current; //[cite: 5]
    const onPressIn = () => Animated.spring(scale, { toValue: 0.96, useNativeDriver: true }).start(); //[cite: 5]
    const onPressOut = () => Animated.spring(scale, { toValue: 1, useNativeDriver: true }).start(); //[cite: 5]

    return (
        <Animated.View style={[styles.wrapper, { transform: [{ scale }] }]}>
            <TouchableOpacity activeOpacity={0.88} onPressIn={onPressIn} onPressOut={onPressOut} onPress={onPress} style={styles.card}>
                {badge ? (
                    <View style={[styles.badge, { backgroundColor: `${color}18` }]}><Text style={[styles.badgeText, { color }]}>{badge}</Text></View>
                ) : <View style={styles.badgeSpacer} />}
                <Text style={styles.icon}>{icon}</Text>
                <Text style={[styles.value, { color }]} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
                <Text style={styles.label}>{label}</Text>
                {sub && <Text style={styles.sub} numberOfLines={1}>{sub}</Text>}
                <View style={[styles.footer, { backgroundColor: `${color}14` }]}><Text style={[styles.footerText, { color }]}>Tap to view →</Text></View>
            </TouchableOpacity>
        </Animated.View>
    ); //[cite: 5]
}

const styles = StyleSheet.create({
    wrapper: { width: '48%' }, //[cite: 5]
    card: { backgroundColor: C.surface, borderRadius: 20, paddingTop: 14, paddingHorizontal: 14, paddingBottom: 0, borderWidth: 1, borderColor: C.border, overflow: 'hidden', boxShadow: '0px 4px 12px rgba(11,46,79,0.07)' } as any, //[cite: 5]
    badge: { paddingVertical: 3, paddingHorizontal: 8, borderRadius: 8, alignSelf: 'flex-start', marginBottom: 8 }, //[cite: 5]
    badgeText: { fontSize: 10, fontWeight: '700' }, //[cite: 5]
    badgeSpacer: { height: 22, marginBottom: 8 }, //[cite: 5]
    icon: { fontSize: 22, lineHeight: 28, marginBottom: 8 }, //[cite: 5]
    value: { fontSize: T.xl, fontWeight: '800', letterSpacing: -0.5 }, //[cite: 5]
    label: { fontSize: 10, fontWeight: '700', color: C.textSub, marginTop: 3, textTransform: 'uppercase', letterSpacing: 0.5 }, //[cite: 5]
    sub: { fontSize: 11, color: C.textMuted, marginTop: 3, marginBottom: 10 }, //[cite: 5]
    footer: { marginHorizontal: -14, marginTop: 10, paddingVertical: 8, paddingHorizontal: 14 }, //[cite: 5]
    footerText: { fontSize: 11, fontWeight: '700' }, //[cite: 5]
});