// lib/authMode.ts — which auth backend the owner app uses.
//
//   'mock'     (default) — simulated OTP; lets anyone in for demos/dev without an
//              SMS provider. Stores a placeholder token in SecureStore.
//   'supabase'          — real Supabase phone OTP (signInWithOtp / verifyOtp).
//              REQUIRES an SMS provider (Twilio / MSG91 / …) configured under
//              Supabase → Authentication → Providers → Phone. Session is managed
//              by supabase-js (persisted in AsyncStorage); role comes from the
//              user's metadata (defaults to 'owner').
//
// Flip by setting EXPO_PUBLIC_AUTH_MODE=supabase in .env once SMS is configured.
export const AUTH_MODE: 'mock' | 'supabase' =
    process.env.EXPO_PUBLIC_AUTH_MODE === 'supabase' ? 'supabase' : 'mock';
