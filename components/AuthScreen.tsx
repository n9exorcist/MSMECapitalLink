import React, { useState } from 'react';
import { Text, View, TouchableOpacity } from 'react-native';
import { styles } from './styles';

// Strict type contract forcing synchronization with App.tsx
interface AuthScreenProps {
    onLoginSuccess: (role: 'ADMIN' | 'USER') => void;
}

export default function AuthScreen({ onLoginSuccess }: AuthScreenProps) {
    const [isMerchantUserMode, setIsMerchantUserMode] = useState<boolean>(true);

    return (
        <View style={styles.authContainer}>
            <Text style={styles.authTitle}>
                {isMerchantUserMode ? "MSME Capital Link" : "Banker Portal Login"}
            </Text>
            <Text style={styles.authSubtitle}>
                {isMerchantUserMode
                    ? "Access your dashboard & cash-flow health analytics"
                    : "Enterprise administrative underwriting terminal"}
            </Text>

            <Text style={styles.inputLabel}>Corporate Identifier / Email ID</Text>
            <View style={styles.textInputMock}>
                <Text style={{ color: '#9CA3AF' }}>
                    {isMerchantUserMode ? "partner@alibiyaenterprises.in" : "underwriter.desk@canarabank.com"}
                </Text>
            </View>

            <Text style={styles.inputLabel}>Security Token</Text>
            <View style={styles.textInputMock}>
                <Text style={{ color: '#9CA3AF' }}>••••••••••••</Text>
            </View>

            <TouchableOpacity
                style={styles.authButtonPrimary}
                onPress={() => onLoginSuccess(isMerchantUserMode ? 'USER' : 'ADMIN')}
            >
                <Text style={styles.authButtonText}>
                    {isMerchantUserMode ? "Authenticate Application" : "Access Admin Console"}
                </Text>
            </TouchableOpacity>

            <TouchableOpacity
                style={styles.toggleAuthModeButton}
                onPress={() => setIsMerchantUserMode(!isMerchantUserMode)}
            >
                <Text style={styles.toggleAuthModeText}>
                    {isMerchantUserMode ? "Switch to Banker Portal Login →" : "← Return to Borrower Account Login"}
                </Text>
            </TouchableOpacity>
        </View>
    );
}