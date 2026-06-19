import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, SafeAreaView, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { C, T, S, shadow } from '@/constants/theme';
import { useMsmeData } from '../../hooks/useMsmeData';
import { TalkToCFO } from '../../components/TalkToCFO';

// Settings rows — each with a tinted icon chip. Labels are owner-facing
// (what the person controls), no system/jargon language.
const SETTINGS: { key: string; icon: string; tint: string; route: string }[] = [
    { key: 'Notifications', icon: '🔔', tint: C.teal, route: '/notifications' },
    { key: 'Documents', icon: '📄', tint: C.navy, route: '/documents' },
    { key: 'Subscription Plan', icon: '⭐', tint: C.amber, route: '/subscription' },
    { key: 'Security', icon: '🔒', tint: C.green, route: '/security' },
];

// One animated, pressable settings row.
function SettingRow({
    icon,
    tint,
    label,
    isLast,
    danger,
    onPress,
}: {
    icon: string;
    tint: string;
    label: string;
    isLast?: boolean;
    danger?: boolean;
    onPress: () => void;
}) {
    const scale = useRef(new Animated.Value(1)).current;
    const pressIn = () => Animated.spring(scale, { toValue: 0.98, useNativeDriver: false }).start();
    const pressOut = () => Animated.spring(scale, { toValue: 1, useNativeDriver: false }).start();

    return (
        <Animated.View style={{ transform: [{ scale }] }}>
            <TouchableOpacity
                activeOpacity={0.7}
                onPressIn={pressIn}
                onPressOut={pressOut}
                onPress={onPress}
                style={[styles.row, isLast && styles.rowLast]}
            >
                <View style={[styles.rowIcon, { backgroundColor: `${tint}14` }]}>
                    <Text style={styles.rowIconText}>{icon}</Text>
                </View>
                <Text style={[styles.rowLabel, danger && styles.rowLabelDanger]} numberOfLines={1}>
                    {label}
                </Text>
                {!danger && <Text style={styles.chevron}>›</Text>}
            </TouchableOpacity>
        </Animated.View>
    );
}

export default function AccountScreen() {
    const router = useRouter();
    const [cfoOpen, setCfoOpen] = useState(false);

    // Same entity the rest of the app reads — no hardcoded identity.
    const { data: msmeEntities } = useMsmeData();
    const entity = msmeEntities && msmeEntities.length > 0 ? msmeEntities[0] : null;
    const name = entity?.owner_name ?? '—';
    const company = entity?.company_name ?? '—';
    const initial = name && name !== '—' ? name.trim().charAt(0).toUpperCase() : '?';

    // Staggered entrance: profile → action → settings.
    const a1 = useRef(new Animated.Value(0)).current;
    const a2 = useRef(new Animated.Value(0)).current;
    const a3 = useRef(new Animated.Value(0)).current;
    const cfoScale = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        Animated.stagger(110, [
            Animated.timing(a1, { toValue: 1, duration: 420, useNativeDriver: false }),
            Animated.timing(a2, { toValue: 1, duration: 420, useNativeDriver: false }),
            Animated.timing(a3, { toValue: 1, duration: 420, useNativeDriver: false }),
        ]).start();
    }, []);

    // Shared "rise + fade" entrance style from an Animated value.
    const rise = (v: Animated.Value) => ({
        opacity: v,
        transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }],
    });

    return (
        <SafeAreaView style={styles.safe}>
            <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
                <Text style={styles.screenTitle}>Account</Text>

                {/* ── Profile hero (the page's signature element) ── */}
                <Animated.View style={rise(a1)}>
                    <LinearGradient
                        colors={['#1B4368', '#0B2E4F', '#061D33']} // light navy → navy → navyDark
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.profileCard}
                    >
                        <View style={styles.glow} />
                        <View style={styles.profileRow}>
                            <View style={styles.avatarRing}>
                                <View style={styles.avatar}>
                                    <Text style={styles.avatarText}>{initial}</Text>
                                </View>
                            </View>
                            <View style={styles.profileText}>
                                <Text style={styles.name} numberOfLines={1}>{name}</Text>
                                <Text style={styles.company} numberOfLines={1}>{company}</Text>
                            </View>
                        </View>
                    </LinearGradient>
                </Animated.View>

                {/* ── Talk to my CFO — gradient button, opens the contact sheet ── */}
                <Animated.View style={rise(a2)}>
                    <Animated.View style={{ transform: [{ scale: cfoScale }] }}>
                        <TouchableOpacity
                            activeOpacity={0.9}
                            onPressIn={() => Animated.spring(cfoScale, { toValue: 0.97, useNativeDriver: false }).start()}
                            onPressOut={() => Animated.spring(cfoScale, { toValue: 1, useNativeDriver: false }).start()}
                            onPress={() => setCfoOpen(true)}
                            style={styles.cfoTouchable}
                        >
                            <LinearGradient
                                colors={['#14B8A6', '#0F766E']} // tealLight → teal
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={styles.cfoButton}
                            >
                                <Text style={styles.cfoIcon}>📞</Text>
                                <Text style={styles.cfoButtonText}>Talk to my CFO</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    </Animated.View>
                </Animated.View>

                {/* ── Settings ── */}
                <Animated.View style={[styles.settingsGroup, rise(a3)]}>
                    {SETTINGS.map((s) => (
                        <SettingRow key={s.key} icon={s.icon} tint={s.tint} label={s.key} onPress={() => router.push(s.route as any)} />
                    ))}
                    <SettingRow
                        icon="🚪"
                        tint={C.red}
                        label="Logout"
                        isLast
                        danger
                        onPress={() => router.replace('/login')}
                    />
                </Animated.View>
            </ScrollView>

            <TalkToCFO visible={cfoOpen} onClose={() => setCfoOpen(false)} />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: C.bg },
    scroll: { padding: S.xl, paddingBottom: S.xxxl },
    screenTitle: { fontSize: T.md, fontWeight: '800', color: C.navy, marginBottom: S.lg, letterSpacing: -0.3 },

    // Profile hero
    profileCard: {
        borderRadius: 24,
        padding: 22,
        marginBottom: S.xl,
        overflow: 'hidden',
        position: 'relative',
        boxShadow: '0px 12px 28px rgba(11,46,79,0.22)',
    } as any,
    glow: {
        position: 'absolute',
        top: -50,
        right: -40,
        width: 170,
        height: 170,
        borderRadius: 85,
        backgroundColor: C.teal,
        opacity: 0.22,
    },
    profileRow: { flexDirection: 'row', alignItems: 'center' },
    avatarRing: {
        width: 58,
        height: 58,
        borderRadius: 29,
        borderWidth: 2,
        borderColor: C.tealLight,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: 'rgba(255,255,255,0.14)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarText: { color: C.white, fontSize: T.lg, fontWeight: '800' },
    profileText: { flex: 1, marginLeft: 14 },
    name: { color: C.white, fontSize: T.lg, fontWeight: '800', letterSpacing: -0.3 },
    // Fix: brighter teal reads cleanly on navy (old C.teal was muddy here).
    company: { color: C.tealLight, fontSize: T.sm, fontWeight: '600', marginTop: 4, letterSpacing: 0.3 },

    // Talk to my CFO
    cfoTouchable: {
        borderRadius: 16,
        marginBottom: S.xl,
        overflow: 'hidden',
        boxShadow: '0px 10px 22px rgba(15,118,110,0.35)',
    } as any,
    cfoButton: {
        borderRadius: 16,
        paddingVertical: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    cfoIcon: { fontSize: 18, lineHeight: 22 },
    // Fix: white text on the green/teal background.
    cfoButtonText: { color: C.white, fontSize: T.base, fontWeight: '800', letterSpacing: 0.3 },

    // Settings
    settingsGroup: {
        backgroundColor: C.surface,
        borderRadius: 20,
        paddingHorizontal: 6,
        paddingVertical: 4,
        borderWidth: 1,
        borderColor: C.border,
        overflow: 'hidden',
        boxShadow: shadow.sm,
    } as any,
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 14,
        paddingHorizontal: 12,
        borderBottomWidth: 1,
        borderBottomColor: C.border,
    },
    rowLast: { borderBottomWidth: 0 },
    rowIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    rowIconText: { fontSize: 17, lineHeight: 21 },
    rowLabel: { flex: 1, fontSize: T.base, fontWeight: '600', color: C.text },
    rowLabelDanger: { color: C.red, fontWeight: '800' },
    chevron: { fontSize: 22, fontWeight: '400', color: C.textMuted },
});
