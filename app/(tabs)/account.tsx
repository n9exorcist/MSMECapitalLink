import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { C } from '@/constants/theme';
import { useMsmeData } from '../../hooks/useMsmeData';

export default function AccountScreen() {
    const router = useRouter();

    // Same entity the rest of the app reads — no more hardcoded identity.
    const { data: msmeEntities } = useMsmeData();
    const entity = msmeEntities && msmeEntities.length > 0 ? msmeEntities[0] : null;
    const name = entity?.owner_name ?? '—';
    const company = entity?.company_name ?? '—';

    return (
        <ScrollView style={styles.container}>
            {/* Profile Card */}
            <View style={styles.profileCard}>
                <Text style={styles.name}>{name}</Text>
                <Text style={styles.company}>{company}</Text>
            </View>

            {/* Concierge Feature */}
            <TouchableOpacity style={styles.cfoButton} onPress={() => console.log('Initiate CFO Consult')}>
                <Text style={styles.cfoButtonText}>📞 Talk to my CFO</Text>
            </TouchableOpacity>

            {/* Settings Group */}
            <View style={styles.settingsGroup}>
                {['Notifications', 'Documents', 'Subscription Plan', 'Security'].map((item) => (
                    <TouchableOpacity key={item} style={styles.settingItem}>
                        <Text style={styles.settingText}>{item}</Text>
                    </TouchableOpacity>
                ))}
                <TouchableOpacity onPress={() => router.replace('/login')}>
                    <Text style={[styles.settingItem, styles.logout]}>Logout</Text>
                </TouchableOpacity>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f9f9f9', padding: 20 },
    profileCard: { backgroundColor: C.navy, padding: 24, borderRadius: 16, marginBottom: 20 },
    name: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
    company: { color: C.teal, fontSize: 14, marginTop: 4 },
    cfoButton: { backgroundColor: C.teal, padding: 18, borderRadius: 12, alignItems: 'center', marginBottom: 24 },
    cfoButtonText: { color: C.navy, fontWeight: 'bold', fontSize: 16 },
    settingsGroup: { backgroundColor: '#fff', borderRadius: 12, padding: 10, borderWidth: 1, borderColor: '#eee' },
    settingItem: { padding: 18, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
    settingText: { fontSize: 16, color: '#333' },
    logout: { color: C.red, fontWeight: 'bold' }
});
