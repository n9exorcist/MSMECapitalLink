import { create } from 'zustand';
import { MSME } from '@/types/msme';

interface MSMEState {
    activeMsmeId: string | null;
    activeMsmeData: MSME | null;
    setActiveMsme: (msme: MSME) => void;
    clearActiveMsme: () => void;
}

export const useMsmeStore = create<MSMEState>((set) => ({
    activeMsmeId: null,
    activeMsmeData: null,

    setActiveMsme: (msme) => set({
        activeMsmeId: msme.id,
        activeMsmeData: msme
    }),

    clearActiveMsme: () => set({
        activeMsmeId: null,
        activeMsmeData: null
    }),
}));