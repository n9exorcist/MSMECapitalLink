import { create } from 'zustand';
import { storage } from '@/lib/secureStore';

interface AuthState {
    isLoggedIn: boolean;
    userRole: 'owner' | 'cfo' | null;
    hydrated: boolean;   // true once checkAuth() has run at boot — gates the first redirect
    login: (token: string, role: 'owner' | 'cfo') => Promise<void>;
    logout: () => Promise<void>;
    checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
    isLoggedIn: false,
    userRole: null,
    hydrated: false,

    login: async (token, role) => {
        await storage.setToken(token);
        set({ isLoggedIn: true, userRole: role, hydrated: true });
    },

    logout: async () => {
        await storage.removeToken();
        set({ isLoggedIn: false, userRole: null });
    },

    // Rehydrate the session from the persisted token on boot. Always ends with
    // hydrated=true (even with no token) so the router knows the check is done and
    // can stop showing a blank/holding state.
    checkAuth: async () => {
        try {
            const token = await storage.getToken();
            if (token) {
                set({ isLoggedIn: true, userRole: 'owner' }); // Decode JWT later for real role
            }
        } finally {
            set({ hydrated: true });
        }
    }
}));