import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';

// 1. Define the Action Item Shape
export interface ActionItem {
    id: string | number;
    icon?: string;
    text: string;
    detail?: string;
    urgency?: 'high' | 'medium' | 'low';
}

interface ActionCardProps {
    action: ActionItem;
    index: number;
}

// 2. Extracted Animation Hook for Staggered Load
function useFadeIn(delay = 0) {
    const anim = useRef(new Animated.Value(0)).current;
    const slide = useRef(new Animated.Value(18)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(anim, { toValue: 1, duration: 420, delay, useNativeDriver: true }),
            Animated.timing(slide, { toValue: 0, duration: 380, delay, useNativeDriver: true }),
        ]).start();
    }, [anim, slide, delay]);

    return { opacity: anim, transform: [{ translateY: slide }] };
}

// 3. Main Component
export function ActionCard({ action, index }: ActionCardProps) {
    const fade = useFadeIn(index * 80);
    const press = useRef(new Animated.Value(1)).current;

    // Map urgency levels to specific design tokens
    const getUrgencyColor = () => {
        switch (action.urgency) {
            case 'high': return '#DC2626';   // C.red
            case 'medium': return '#D97706'; // C.amber
            case 'low':
            default: return '#0F766E';       // C.teal
        }
    };

    const urgencyColor = getUrgencyColor();

    // Spring animations for touch feedback
    const onPressIn = () => Animated.spring(press, { toValue: 0.97, useNativeDriver: true }).start();
    const onPressOut = () => Animated.spring(press, { toValue: 1, useNativeDriver: true }).start();

    return (
        <Animated.View style={[fade, { transform: [...(fade.transform || []), { scale: press }] }]}>
            <TouchableOpacity
                activeOpacity={0.85}
                onPressIn={onPressIn}
                onPressOut={onPressOut}
                style={styles.actionCard}
                accessibilityRole="button"
            >
                <View style={[styles.actionAccent, { backgroundColor: urgencyColor }]} />

                <View style={styles.actionIcon}>
                    <Text style={{ fontSize: 18 }}>{action.icon || '📌'}</Text>
                </View>

                <View style={styles.textContainer}>
                    <Text style={styles.actionText} numberOfLines={2}>{action.text}</Text>
                    {action.detail && <Text style={styles.actionDetail} numberOfLines={1}>{action.detail}</Text>}
                </View>

                <View style={[styles.actionBullet, { backgroundColor: urgencyColor + '20', borderColor: urgencyColor + '40' }]}>
                    <View style={[styles.actionDot, { backgroundColor: urgencyColor }]} />
                </View>
            </TouchableOpacity>
        </Animated.View>
    );
}

// 4. Styles
const styles = StyleSheet.create({
    actionCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 18,
        padding: 16,
        marginBottom: 10,
        flexDirection: 'row',
        alignItems: 'center',
        shadowColor: '#0B2E4F',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.06,
        shadowRadius: 10,
        elevation: 3,
        borderWidth: 1,
        borderColor: '#E2EAF4',
        overflow: 'hidden'
    },
    actionAccent: {
        position: 'absolute', left: 0, top: 0, bottom: 0, width: 4,
        borderTopLeftRadius: 18, borderBottomLeftRadius: 18
    },
    actionIcon: {
        width: 38, height: 38, borderRadius: 12, backgroundColor: '#F8FAFC',
        alignItems: 'center', justifyContent: 'center', marginLeft: 8, marginRight: 12
    },
    textContainer: {
        flex: 1,
        paddingRight: 10,
    },
    actionText: {
        fontSize: 14, fontWeight: '700', color: '#0F172A', lineHeight: 20
    },
    actionDetail: {
        fontSize: 12, color: '#64748B', marginTop: 2
    },
    actionBullet: {
        width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', borderWidth: 1
    },
    actionDot: {
        width: 8, height: 8, borderRadius: 4
    },
});