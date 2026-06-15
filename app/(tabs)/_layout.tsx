import { Tabs } from 'expo-router';
import { Text, Platform } from 'react-native';

export default function TabLayout() {
    return (
        <Tabs
            screenOptions={{
                headerShown: true,
                tabBarActiveTintColor: '#0B2E4F',
                tabBarInactiveTintColor: '#94A3B8',
                tabBarStyle: {
                    backgroundColor: '#FFFFFF',
                    borderTopWidth: 1,
                    borderTopColor: '#E2EAF4',
                    paddingBottom: Platform.OS === 'ios' ? 20 : 8,
                    paddingTop: 10,
                    height: Platform.OS === 'ios' ? 85 : 65,
                },
            }}
        >
            <Tabs.Screen
                name="index"
                options={{
                    title: 'Home',
                    tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>🏠</Text>,
                }}
            />
            <Tabs.Screen
                name="money-in"
                options={{
                    title: 'Money In',
                    tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>📥</Text>,
                }}
            />
            <Tabs.Screen
                name="money-out"
                options={{
                    title: 'Money Out',
                    tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>📤</Text>,
                }}
            />
            <Tabs.Screen
                name="more"
                options={{
                    title: 'More',
                    tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 22 }}>⋯</Text>,
                }}
            />
        </Tabs>
    );
}