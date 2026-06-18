import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { C, T, S } from '@/constants/theme';

export function ScreenHeader({ title, subtitle }: { title: string; subtitle?: string }) {
    const router = useRouter();
    return (
        <View style={styles.bar}>
            <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
                <Text style={styles.backChevron}>‹</Text>
            </TouchableOpacity>
            <View style={styles.titleWrap}>
                <Text style={styles.title} numberOfLines={1}>{title}</Text>
                {subtitle ? <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text> : null}
            </View>
            {/* spacer keeps the title centered */}
            <View style={styles.spacer} />
        </View>
    );
}

const styles = StyleSheet.create({
    bar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: S.lg, paddingVertical: 10, gap: 8 },
    backBtn: {
        width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
        backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    },
    backChevron: { fontSize: 26, fontWeight: '700', color: C.navy, lineHeight: 28, marginTop: -2 },
    spacer: { width: 40, height: 40 },
    titleWrap: { flex: 1, alignItems: 'center' },
    title: { fontSize: T.md, fontWeight: '800', color: C.navy, letterSpacing: -0.3 },
    subtitle: { fontSize: T.xs, color: C.textMuted, marginTop: 1 },
});
