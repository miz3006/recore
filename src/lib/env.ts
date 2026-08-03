/**
 * Client-side environment. ONLY PUBLISHABLE keys are allowed here — keys that
 * identify the app rather than authorise anything, and that are designed to sit
 * in a bundle any user can unzip.
 *
 *  · Supabase URL + anon key — public by design; RLS protects the data.
 *  · RevenueCat iOS SDK key  — RevenueCat's own "public SDK key". The SECRET
 *    key (the one that can read and modify subscriber data through their REST
 *    API) is a server credential and must never appear in this file, in .env,
 *    or anywhere else in the app.
 *
 * The AI provider key lives exclusively in the Supabase Edge Function
 * environment; nothing in the app bundle ever holds it.
 */
export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

/**
 * RevenueCat's publishable iOS SDK key (`appl_…`). Empty until the owner fills
 * it in, and an empty key is a WORKING STATE: `store.ts` reports the store as
 * unconfigured and every surface degrades to an honest "not available" rather
 * than a crash or a fake price.
 */
export const REVENUECAT_IOS_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY ?? '';

/** True once .env is filled in — the sign-in screen surfaces a hint if not. */
export function isSupabaseConfigured(): boolean {
  return SUPABASE_URL.length > 0 && SUPABASE_ANON_KEY.length > 0;
}
