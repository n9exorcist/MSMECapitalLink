import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const TOKEN_KEY = 'mfos_session_jwt';

export const storage = {
    getToken: async () => {
        try {
            if (Platform.OS === 'web') {
                return window.localStorage.getItem(TOKEN_KEY);
            }
            return await SecureStore.getItemAsync(TOKEN_KEY);
        } catch (e) {
            return null;
        }
    },
    setToken: async (value: string) => {
        try {
            if (Platform.OS === 'web') {
                window.localStorage.setItem(TOKEN_KEY, value);
            } else {
                await SecureStore.setItemAsync(TOKEN_KEY, value);
            }
        } catch (e) {
            console.error('Error saving token', e);
        }
    },
    removeToken: async () => {
        try {
            if (Platform.OS === 'web') {
                window.localStorage.removeItem(TOKEN_KEY);
            } else {
                await SecureStore.deleteItemAsync(TOKEN_KEY);
            }
        } catch (e) {
            console.error('Error removing token', e);
        }
    }
};