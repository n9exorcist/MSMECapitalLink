import { create } from 'zustand';
import type { Session } from '@supabase/supabase-js';
import { storage } from '@/lib/secureStore';
import { supabase } from '@/lib/supabase';
import { AUTH_MODE } from '@/lib/authMode';

type Role = 'owner' | 'cfo';

// Role from the Supabase user's metadata; defaults to 'owner' (real role model
// is a later track — see spec §7 co-owner/viewer).
const roleFrom = (session: Session | null): Role =>
    ((session?.user?.user_metadata?.role as Role) || 'owner');

interface AuthState {
    isLoggedIn: boolean;
    userRole: Role | null;
    hydrated: boolean;   // true once checkAuth() has run at boot — gates the first redirect
    login: (token: string, role: Role) => Promise<void>;
    syncFromSupabase: () => Promise<void>;
    logout: () => Promise<void>;
    checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
    isLoggedIn: false,
    userRole: null,
    hydrated: false,

    // Mock-mode sign-in: persist a placeholder token so the (mock) session sticks.
    login: async (token, role) => {
        await storage.setToken(token);
        set({ isLoggedIn: true, userRole: role, hydrated: true });
    },

    // Supabase-mode sign-in: verifyOtp already created the session (persisted by
    // supabase-js); just reflect it into the store.
    syncFromSupabase: async () => {
        const { data } = await supabase.auth.getSession();
        set({ isLoggedIn: !!data.session, userRole: data.session ? roleFrom(data.session) : null, hydrated: true });
    },

    logout: async () => {
        if (AUTH_MODE === 'supabase') {
            await supabase.auth.signOut();
        } else {
            await storage.removeToken();
        }
        set({ isLoggedIn: false, userRole: null });
    },

    // Rehydrate the session on boot. Always ends hydrated=true so the router knows
    // the check is done and can stop holding.
    checkAuth: async () => {
        try {
            if (AUTH_MODE === 'supabase') {
                const { data } = await supabase.auth.getSession();
                set({ isLoggedIn: !!data.session, userRole: data.session ? roleFrom(data.session) : null });
                // Keep the store in sync with token refresh / external sign-out.
                supabase.auth.onAuthStateChange((_event, session) =>
                    set({ isLoggedIn: !!session, userRole: session ? roleFrom(session) : null }));
            } else {
                const token = await storage.getToken();
                if (token) set({ isLoggedIn: true, userRole: 'owner' }); // decode JWT later for real role
            }
        } finally {
            set({ hydrated: true });
        }
    },
}));
