import { create } from 'zustand';

interface AuthState {
    loggedIn: boolean;
    login: () => void;
    logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
    loggedIn: false,
    login: () => set({ loggedIn: true }),
    logout: () => set({ loggedIn: false }),
}));