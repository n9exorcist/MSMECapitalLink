import * as SecureStore from 'expo-secure-store';

const API_BASE_URL = 'http://127.0.0.1:8000'; // Update for production

export async function apiFetch(endpoint: string, options: RequestInit = {}) {
    const token = await SecureStore.getItemAsync('mfos_session_jwt');

    const headers = {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        ...options.headers,
    };

    const response = await fetch(`${API_BASE_URL}${endpoint}`, { ...options, headers });

    if (!response.ok) {
        throw new Error(`API Error: ${response.statusText}`);
    }

    return response.json();
}