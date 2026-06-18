import React from 'react';
import { View, Text, StyleSheet, SafeAreaView } from 'react-native';
import { Stack } from 'expo-router';
import { C, T } from '@/constants/theme';
import { ScreenHeader } from '../components/ScreenHeader';

export default function DocumentsScreen() {
    return (
        <>
            <Stack.Screen options={{ headerShown: false }} />
            <SafeAreaView style={styles.safe}>
                <ScreenHeader title="Documents" />
                <View style={styles.emptyWrap}>
                    <View style={styles.emptyIcon}><Text style={styles.emptyEmoji}>📂</Text></View>
                    <Text style={styles.emptyTitle}>No documents yet</Text>
                    <Text style={styles.emptyText}>
                        Your CFO will share statements, sanction letters, GST returns and your monthly
                        health report here. They’ll appear in this list as soon as they’re uploaded.
                    </Text>
                </View>
            </SafeAreaView>
        </>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: C.bg },
    emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, paddingBottom: 60, gap: 12 },
    emptyIcon: {
        width: 84, height: 84, borderRadius: 24, backgroundColor: `${C.navy}0D`,
        alignItems: 'center', justifyContent: 'center', marginBottom: 4,
    },
    emptyEmoji: { fontSize: 34, lineHeight: 40 },
    emptyTitle: { fontSize: T.lg, fontWeight: '800', color: C.navy },
    emptyText: { fontSize: 14, color: C.textSub, textAlign: 'center', lineHeight: 21 },
});
