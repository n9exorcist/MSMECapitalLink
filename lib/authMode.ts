// lib/authMode.ts — which auth backend the owner app uses.
//
//   'mock'     (default) — simulated OTP; lets anyone in for demos/dev without an
//              SMS provider. Stores a placeholder token in SecureStore.
//   'supabase'          — real Supabase phone OTP (signInWithOtp / verifyOtp).
//              REQUIRES an SMS provider (Twilio / MSG91 / …) configured under
//              Supabase → Authentication → Providers → Phone.
//   'email'             — real Supabase EMAIL OTP. Works with Supabase's built-in
//              email (no paid SMS provider), so it's the way to test real auth
//              NOW. Free tier rate-limits emails; production wants custom SMTP.
//
// 'supabase' and 'email' both use the supabase-js session (persisted in
// AsyncStorage); role comes from the user's metadata (defaults 'owner').
// Flip by setting EXPO_PUBLIC_AUTH_MODE=supabase|email in .env.
export const AUTH_MODE: 'mock' | 'supabase' | 'email' =
    process.env.EXPO_PUBLIC_AUTH_MODE === 'supabase' ? 'supabase'
        : process.env.EXPO_PUBLIC_AUTH_MODE === 'email' ? 'email'
            : 'mock';
