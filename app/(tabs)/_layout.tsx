import { Tabs } from 'expo-router';
import { Platform, Text, View, StyleSheet } from 'react-native';
import { C, T, shadow } from '@/constants/theme'; //[cite: 8]

function TabIcon({
    emoji,
    label,
    focused,
}: {
    emoji: string;
    label: string;
    focused: boolean;
}) {
    return (
        <View style={styles.tabItem}>
            <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
                <Text style={styles.emoji}>{emoji}</Text>
            </View>
            {/* Removed adjustsFontSizeToFit, kept numberOfLines */}
            <Text
                style={[styles.tabLabel, focused && styles.tabLabelActive]}
                numberOfLines={1}
            >
                {label}
            </Text>
            {focused && <View style={styles.tabDot} />}
        </View>
    );
}

export default function TabLayout() {
    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarStyle: styles.tabBar,
                tabBarShowLabel: false,
                tabBarActiveTintColor: C.navy,
                tabBarInactiveTintColor: C.textMuted,
            }}
        >
            <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: ({ focused }) => <TabIcon emoji="🏠" label="Home" focused={focused} /> }} />
            <Tabs.Screen name="money-in" options={{ title: 'Money In', tabBarIcon: ({ focused }) => <TabIcon emoji="📥" label="Money In" focused={focused} /> }} />
            <Tabs.Screen name="money-out" options={{ title: 'Money Out', tabBarIcon: ({ focused }) => <TabIcon emoji="📤" label="Money Out" focused={focused} /> }} />
            <Tabs.Screen name="more" options={{ title: 'More', tabBarIcon: ({ focused }) => <TabIcon emoji="☰" label="More" focused={focused} /> }} />
            <Tabs.Screen name="account" options={{ title: 'Account', tabBarIcon: ({ focused }) => <TabIcon emoji="👤" label="Account" focused={focused} /> }} />
        </Tabs>
    ); //[cite: 8]
}

const styles = StyleSheet.create({
    tabBar: {
        backgroundColor: C.surface,
        borderTopWidth: 1,
        borderTopColor: C.border,
        height: Platform.OS === 'ios' ? 84 : 68,
        paddingBottom: Platform.OS === 'ios' ? 24 : 8,
        paddingTop: 8,
        boxShadow: shadow.tab,
    } as any, //[cite: 8]
    tabItem: {
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        width: 76, // This provides exactly enough room for "Money Out" on one line
    },
    iconWrap: { width: 40, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }, //[cite: 8]
    iconWrapActive: { backgroundColor: `${C.navy}14` }, //[cite: 8]
    emoji: { fontSize: 18, lineHeight: 22 }, //[cite: 8]
    tabLabel: {
        fontSize: 10,
        fontWeight: '600',
        color: C.textMuted,
        letterSpacing: 0.1,
        textAlign: 'center', // Ensures perfect alignment
    },
    tabLabelActive: { color: C.navy, fontWeight: '800' }, //[cite: 8]
    tabDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: C.teal, marginTop: 1 }, //[cite: 8]
});