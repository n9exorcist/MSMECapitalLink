import React from 'react';
import { ScrollView, View, Text, StyleSheet, TouchableOpacity } from 'react-native';

// Type definitions for Strict Mode
interface Creditor {
    id: string;
    name: string;
    amount: number;
    dueDate: string;
    urgent: boolean;
}

export default function MoneyOutScreen() {
    // Mock data extracted from App.jsx
    const mockCreditors: Creditor[] = [
        { id: '1', name: 'Ramesh Steel', amount: 0.85, dueDate: '13 Jun', urgent: true },
        { id: '2', name: 'Chennai Polymers', amount: 1.2, dueDate: '18 Jun', urgent: false },
        { id: '3', name: 'Anand Chemicals', amount: 0.6, dueDate: '22 Jun', urgent: false },
        { id: '4', name: 'SKF Bearings', amount: 2.1, dueDate: '30 Jun', urgent: false },
    ];

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

            {/* Summary Banner */}
            <View style={styles.banner}>
                <View>
                    <Text style={styles.bannerLabel}>Total to Pay</Text>
                    <Text style={styles.bannerValue}>₹8.6L</Text>
                    <Text style={styles.bannerSub}>to 9 suppliers</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.bannerLabel}>Due this week</Text>
                    <Text style={styles.bannerValueUrgent}>₹2.1L</Text>
                </View>
            </View>

            {/* Urgent Strip Alert */}
            <View style={styles.alertStrip}>
                <Text style={styles.alertStripIcon}>🔴</Text>
                <Text style={styles.alertStripText}>Ramesh Steel — ₹0.85L due Friday</Text>
            </View>

            <Text style={styles.listCount}>All suppliers</Text>

            {/* Creditor List */}
            {mockCreditors.map((c) => (
                <TouchableOpacity key={c.id} style={styles.row} activeOpacity={0.8}>
                    <View style={[styles.avatar, { backgroundColor: c.urgent ? '#FEF2F2' : '#F8FAFC' }]}>
                        <Text style={[styles.avatarText, { color: c.urgent ? '#DC2626' : '#475569' }]}>
                            {c.name[0]}
                        </Text>
                    </View>
                    <View style={styles.rowInfo}>
                        <Text style={styles.name}>{c.name}</Text>
                        <Text style={styles.days}>Due {c.dueDate}</Text>
                    </View>
                    <View style={styles.rowAction}>
                        <Text style={[styles.amount, { color: c.urgent ? '#DC2626' : '#0F172A' }]}>₹{c.amount}L</Text>
                        <TouchableOpacity style={[styles.payBtn, { backgroundColor: c.urgent ? '#DC2626' : '#0B2E4F' }]}>
                            <Text style={styles.payBtnText}>Pay</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            ))}

        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F0F5FA' },
    scrollContent: { padding: 16, paddingBottom: 40 },

    // Banner
    banner: { backgroundColor: '#FFFBEB', borderRadius: 20, padding: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: '#FDE68A', marginBottom: 12 },
    bannerLabel: { fontSize: 11, fontWeight: '700', color: '#475569', textTransform: 'uppercase', letterSpacing: 0.5 },
    bannerValue: { fontSize: 30, fontWeight: '800', color: '#D97706', marginTop: 4, letterSpacing: -1 },
    bannerValueUrgent: { fontSize: 24, fontWeight: '800', color: '#DC2626', marginTop: 4, letterSpacing: -1 },
    bannerSub: { fontSize: 13, color: '#475569', marginTop: 2 },

    // Alert Strip
    alertStrip: { backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA', borderRadius: 14, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
    alertStripIcon: { fontSize: 16 },
    alertStripText: { flex: 1, fontSize: 13, fontWeight: '600', color: '#DC2626' },

    listCount: { fontSize: 13, fontWeight: '600', color: '#94A3B8', marginTop: 10, marginBottom: 12 },

    // List Rows
    row: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', marginBottom: 8, borderWidth: 1, borderColor: '#E2EAF4' },
    avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
    avatarText: { fontSize: 20, fontWeight: '800' },
    rowInfo: { flex: 1, marginLeft: 12 },
    name: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
    days: { fontSize: 12, color: '#64748B', marginTop: 2 },
    rowAction: { alignItems: 'flex-end' },
    amount: { fontSize: 16, fontWeight: '800' },
    payBtn: { paddingVertical: 6, paddingHorizontal: 14, borderRadius: 10, marginTop: 4 },
    payBtnText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' }
});