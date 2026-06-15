import React, { useRef } from 'react';
import { View, Text, TouchableOpacity, Animated, StyleSheet } from 'react-native';
import { C, T } from '@/constants/theme'; //[cite: 6]

export interface ActionItem { id: number | string; icon?: string; text: string; detail: string; urgency?: 'high' | 'medium' | 'low'; } //[cite: 6]

function urgencyToColor(u?: string) {
    if (u === 'high') return C.red; //[cite: 6]
    if (u === 'medium') return C.amber; //[cite: 6]
    return C.teal; //[cite: 6]
}

export function ActionCard({ action, onPress }: { action: ActionItem; onPress?: () => void }) {
    const scale = useRef(new Animated.Value(1)).current; //[cite: 6]
    const color = urgencyToColor(action.urgency); //[cite: 6]
    const onPressIn = () => Animated.spring(scale, { toValue: 0.97, useNativeDriver: false }).start();
    const onPressOut = () => Animated.spring(scale, { toValue: 1, useNativeDriver: false }).start();

    return (
        <Animated.View style={{ transform: [{ scale }] }}>
            <TouchableOpacity activeOpacity={0.88} onPressIn={onPressIn} onPressOut={onPressOut} onPress={onPress} style={styles.card}>
                <View style={[styles.accent, { backgroundColor: color }]} />
                <View style={[styles.iconBox, { backgroundColor: `${color}14` }]}><Text style={styles.iconEmoji}>{action.icon ?? '📌'}</Text></View>
                <View style={styles.textWrap}>
                    <Text style={styles.actionText} numberOfLines={2}>{action.text}</Text>
                    <Text style={styles.detailText} numberOfLines={1}>{action.detail}</Text>
                </View>
                <View style={[styles.dotRing, { backgroundColor: `${color}1A`, borderColor: `${color}35` }]}>
                    <View style={[styles.dot, { backgroundColor: color }]} />
                </View>
            </TouchableOpacity>
        </Animated.View>
    ); //[cite: 6]
}

const styles = StyleSheet.create({
    card: { backgroundColor: C.surface, borderRadius: 18, padding: 14, marginBottom: 10, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: C.border, overflow: 'hidden', boxShadow: '0px 3px 10px rgba(11,46,79,0.06)' } as any, //[cite: 6]
    accent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, borderTopLeftRadius: 18, borderBottomLeftRadius: 18 }, //[cite: 6]
    iconBox: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginLeft: 10, marginRight: 12, flexShrink: 0 }, //[cite: 6]
    iconEmoji: { fontSize: 18, lineHeight: 22 }, //[cite: 6]
    textWrap: { flex: 1, gap: 3 }, //[cite: 6]
    actionText: { fontSize: T.sm, fontWeight: '700', color: C.text, lineHeight: 19 }, //[cite: 6]
    detailText: { fontSize: T.xs, fontWeight: '600', color: C.textMuted }, //[cite: 6]
    dotRing: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', borderWidth: 1, marginLeft: 8, flexShrink: 0 }, //[cite: 6]
    dot: { width: 8, height: 8, borderRadius: 4 }, //[cite: 6]
});