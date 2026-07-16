/**
 * Client-side environment. ONLY the Supabase URL and anon key are allowed here
 * (both are public by design — RLS protects the data). The AI provider key
 * lives exclusively in the Supabase Edge Function environment; nothing in the
 * app bundle ever holds it.
 */
export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

/** True once .env is filled in — the sign-in screen surfaces a hint if not. */
export function isSupabaseConfigured(): boolean {
  return SUPABASE_URL.length > 0 && SUPABASE_ANON_KEY.length > 0;
}
