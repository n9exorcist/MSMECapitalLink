// MFOS Design Tokens — single source of truth[cite: 9]
// Import this in every component: import { C, T, S } from '@/constants/theme'[cite: 9]

export const C = {
    navy: '#0B2E4F',
    navyDark: '#061D33',
    navyLight: '#1A4A70',
    teal: '#0F766E',
    tealLight: '#14B8A6',
    bg: '#F0F5FA',
    surface: '#FFFFFF',
    surfaceAlt: '#F8FAFC',
    border: '#E2EAF4',
    text: '#0F172A',
    textSub: '#475569',
    textMuted: '#94A3B8',
    green: '#059669',
    greenBg: '#ECFDF5',
    amber: '#D97706',
    amberBg: '#FFFBEB',
    red: '#DC2626',
    redBg: '#FEF2F2',
    white: '#FFFFFF',
    overlay: 'rgba(11,46,79,0.55)',
} as const; //[cite: 9]

export const T = {
    xs: 11, sm: 13, base: 15, md: 17, lg: 20, xl: 24, xxl: 30, hero: 46,
} as const; //[cite: 9]

export const S = {
    xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32,
} as const; //[cite: 9]

export const shadow = {
    sm: '0px 2px 6px rgba(11,46,79,0.06)',
    md: '0px 4px 12px rgba(11,46,79,0.08)',
    lg: '0px 6px 20px rgba(11,46,79,0.10)',
    xl: '0px 10px 30px rgba(11,46,79,0.14)',
    tab: '0px -4px 12px rgba(11,46,79,0.07)',
} as const; //[cite: 9]

export function bandColor(band: string): string {
    switch (band) {
        case 'EXCELLENT': return C.green;
        case 'GOOD': return C.teal;
        case 'MEDIUM': return C.amber;
        default: return C.red;
    }
} //[cite: 9]

export function runwayColor(days: number): string {
    if (days > 60) return C.green;
    if (days > 21) return C.amber;
    return C.red;
} //[cite: 9]