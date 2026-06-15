import React, { useState } from 'react';
import { ScrollView, View, Text, StyleSheet, TouchableOpacity } from 'react-native';

// Type definitions for Strict Mode
type DebtorStatus = 'overdue' | 'due' | 'current';

interface Debtor {
    id: string;
    name: string;
    amount: number;
    days: number;
    status: DebtorStatus;
}

export default function MoneyInScreen() {
    const [filter, setFilter] = useState<string>('All');
    const filters = ['All', 'Overdue', 'Due Soon', 'Current'];

    // Mock data extracted from App.jsx
    const mockDebtors: Debtor[] = [
        { id: '1', name: 'Sundaram & Co', amount: 2.4, days: 65, status: 'overdue' },
        { id: '2', name: 'Kaveri Traders', amount: 3.1, days: 42, status: 'due' },
        { id: '3', name: 'Rajan Industries', amount: 1.8, days: 28, status: 'due' },
        { id: '4', name: 'Selva Exports', amount: 4.6, days: 15, status: 'current' },
    ];

    const filtered = filter === 'All' ? mockDebtors
        : filter === 'Overdue' ? mockDebtors.filter(d => d.status === 'overdue')
            : filter === 'Due Soon' ? mockDebtors.filter(d => d.status === 'due')
                : mockDebtors.filter(d => d.status === 'current');

    const getStatusColor = (s: DebtorStatus) => s === 'overdue' ? '#DC2626' : s === 'due' ? '#D97706' : '#059669';
    const getStatusLabel = (s: DebtorStatus) => s === 'overdue' ? 'Overdue' : s === 'due' ? 'Due soon' : 'On track';

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>

            {/* Summary Banner */}
            <View style={styles.banner}>
                <View>
                    <Text style={styles.bannerLabel}>TOTAL TO COLLECT</Text>
                    <Text style={styles.bannerValue}>₹11.9L</Text>
                    <Text style={styles.bannerSub}>from 4 customers</Text>
                </View>
                <TouchableOpacity style={styles.blastBtn}>
                    <Text style={styles.blastIcon}>💬</Text>
                    <Text style={styles.blastText}>Remind All</Text>
                </TouchableOpacity>
            </View>

            {/* Filter Row */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
                {filters.map(f => (
                    <TouchableOpacity
                        key={f}
                        onPress={() => setFilter(f)}
                        style={[styles.filterPill, filter === f && styles.filterPillActive]}
                    >
                        <Text style={[styles.filterPillText, filter === f && styles.filterPillTextActive]}>{f}</Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>

            <Text style={styles.listCount}>{filtered.length} customers</Text>

            {/* Debtor List */}
            {filtered.map((d) => (
                <TouchableOpacity key={d.id} style={styles.row}>
                    <View style={[styles.avatar, { backgroundColor: getStatusColor(d.status) + '18' }]}>
                        <Text style={[styles.avatarText, { color: getStatusColor(d.status) }]}>{d.name[0]}</Text>
                    </View>
                    <View style={styles.rowInfo}>
                        <Text style={styles.name}>{d.name}</Text>
                        <Text style={styles.days}>{d.days} days outstanding</Text>
                    </View>
                    <View style={styles.rowAction}>
                        <Text style={styles.amount}>₹{d.amount}L</Text>
                        <View style={[styles.statusPill, { backgroundColor: getStatusColor(d.status) + '18' }]}>
                            <Text style={[styles.statusPillText, { color: getStatusColor(d.status) }]}>
                                {getStatusLabel(d.status)}
                            </Text>
                        </View>
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
    banner: { backgroundColor: '#E0F2FE', borderRadius: 20, padding: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: '#BAE6FD', marginBottom: 16 },
    bannerLabel: { fontSize: 11, fontWeight: '700', color: '#475569', letterSpacing: 0.5 },
    bannerValue: { fontSize: 30, fontWeight: '800', color: '#0369A1', marginTop: 4 },
    bannerSub: { fontSize: 13, color: '#475569', marginTop: 2 },
    blastBtn: { backgroundColor: '#0284C7', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 14, alignItems: 'center', flexDirection: 'row', gap: 6 },
    blastIcon: { fontSize: 16 },
    blastText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },

    // Filters
    filterRow: { marginBottom: 16, maxHeight: 40 },
    filterPill: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, marginRight: 8, backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: '#E2EAF4' },
    filterPillActive: { backgroundColor: '#0B2E4F', borderColor: '#0B2E4F' },
    filterPillText: { fontSize: 13, fontWeight: '700', color: '#475569' },
    filterPillTextActive: { color: '#FFFFFF' },
    listCount: { fontSize: 13, fontWeight: '600', color: '#94A3B8', marginBottom: 12 },

    // List Rows
    row: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', marginBottom: 8, borderWidth: 1, borderColor: '#E2EAF4' },
    avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
    avatarText: { fontSize: 20, fontWeight: '800' },
    rowInfo: { flex: 1, marginLeft: 12 },
    name: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
    days: { fontSize: 12, color: '#64748B', marginTop: 2 },
    rowAction: { alignItems: 'flex-end' },
    amount: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
    statusPill: { paddingVertical: 4, paddingHorizontal: 8, borderRadius: 8, marginTop: 4 },
    statusPillText: { fontSize: 10, fontWeight: '700' }
});