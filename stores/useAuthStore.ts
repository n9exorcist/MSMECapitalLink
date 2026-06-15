import { create } from 'zustand';
import { storage } from '@/lib/secureStore';

interface AuthState {
    isLoggedIn: boolean;
    userRole: 'owner' | 'cfo' | null;
    login: (token: string, role: 'owner' | 'cfo') => Promise<void>;
    logout: () => Promise<void>;
    checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
    isLoggedIn: false,
    userRole: null,

    login: async (token, role) => {
        await storage.setToken(token);
        set({ isLoggedIn: true, userRole: role });
    },

    logout: async () => {
        await storage.removeToken();
        set({ isLoggedIn: false, userRole: null });
    },

    checkAuth: async () => {
        const token = await storage.getToken();
        if (token) {
            set({ isLoggedIn: true, userRole: 'owner' }); // Decode JWT later for real role
        }
    }
}));