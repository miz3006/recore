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

const RAW_REVENUECAT_KEY = (process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY ?? '').trim();

/**
 * Which store the configured key actually talks to.
 *
 *  · `production`  — an `appl_` key: the real iOS App Store.
 *  · `test`        — a `test_` key: RevenueCat's **Test Store**. Offerings and
 *                    paywalls come from the real dashboard, but a purchase is
 *                    SIMULATED. No App Store sheet, no receipt, no money.
 *  · `unconfigured`— no key. An honest, fully supported state.
 */
export type StoreMode = 'production' | 'test' | 'unconfigured';

export function storeMode(): StoreMode {
  if (RAW_REVENUECAT_KEY.length === 0) return 'unconfigured';
  return RAW_REVENUECAT_KEY.startsWith('test_') ? 'test' : 'production';
}

/** True while the simulated Test Store is in use. Surfaces a dev-only marker. */
export function isTestStore(): boolean {
  return storeMode() === 'test';
}

/**
 * RevenueCat's publishable SDK key. Empty until the owner fills it in, and an
 * empty key is a WORKING STATE: `store.ts` reports the store as unconfigured
 * and every surface degrades to an honest "not available" rather than a crash
 * or a fake price.
 *
 * THE RELEASE GUARD, and why it is this blunt. A `test_` key grants entitlement
 * for a purchase that never charged and prints prices no App Store will honour.
 * Shipping one would break CLAUDE.md §2 rule 5 ("the subscription is real
 * before release") in the worst possible direction — silently, and in the
 * customer's favour until the day it is not. So a test key simply does not
 * exist outside `__DEV__`: the release bundle reads an empty key, the store
 * reports itself unconfigured, and the paywall says it cannot reach the App
 * Store instead of inventing an offer. Loud, recoverable, and impossible to
 * mistake for a working build.
 */
export const REVENUECAT_IOS_KEY =
  !__DEV__ && storeMode() === 'test' ? '' : RAW_REVENUECAT_KEY;

/**
 * Sentry's DSN — a publishable ingest URL, like the two above: it can only
 * WRITE events into one project and reads nothing back, which is why it is
 * allowed in a bundle at all. The auth token that uploads source maps is a
 * server credential and belongs in EAS, never here.
 *
 * Empty is a WORKING STATE and the default: `lib/crash.ts` then initialises
 * nothing and every call it exports is a no-op, so a build without this key
 * behaves exactly as Recore did before crash reporting existed.
 */
export const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN ?? '';

/** Which build this is, for separating dev noise from TestFlight (`eas.json`). */
export const APP_ENV = process.env.EXPO_PUBLIC_ENV ?? 'development';

/** True once .env is filled in — the sign-in screen surfaces a hint if not. */
export function isSupabaseConfigured(): boolean {
  return SUPABASE_URL.length > 0 && SUPABASE_ANON_KEY.length > 0;
}
