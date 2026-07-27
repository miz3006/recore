import * as AppleAuthentication from 'expo-apple-authentication';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { hasBlur, hasLiquidGlass, hasLiveActivity, hasPurchases, hasSymbols } from '@/lib/capabilities';
import { devLog } from '@/lib/log';
import { voiceAvailable } from '@/lib/voice';

/**
 * Dev-build self-check (CLAUDE.md §19.1–§19.3, PLAN.md 0.1, 0.2 and 0.5).
 *
 * Recore's foundations are native and invisible from JS until they fail: the
 * New Architecture (§19.2 — Reanimated 4 and the whole of §7 assume it), Sign
 * in with Apple, the Keychain the Supabase session lives in, on-device speech
 * recognition, and the five libraries installed in 0.5 — Liquid Glass, SF
 * Symbols, blur, Live Activities and RevenueCat. When one quietly stops
 * linking — a prebuild that was never re-run, an SDK bump, an autolinking
 * change — the app still launches and the only symptom is a button that does
 * nothing.
 *
 * So every development launch prints one line saying which of them are actually
 * present. It runs under __DEV__ only, reads nothing the user wrote, and writes
 * only its own throwaway Keychain key.
 */

export type NativeCheck = {
  /** Where the JS is running. Expo Go means the rest cannot work. */
  environment: ExecutionEnvironment;
  /** The New Architecture, answered by the running app rather than by a build flag. */
  fabric: boolean;
  appleSignIn: boolean;
  keychain: boolean;
  speechRecognition: boolean;
  /** The 0.5 libraries, each behind its runtime gate in `capabilities.ts`. */
  glass: boolean;
  symbols: boolean;
  blur: boolean;
  liveActivity: boolean;
  purchases: boolean;
};

/** Its own key — never the session's, which `secureSessionStorage` chunks. */
const PROBE_KEY = 'recore.native_check';
const PROBE_VALUE = 'ok';

/**
 * The same access class the real session uses, so the probe exercises the path
 * that actually breaks without Keychain entitlements rather than an easier one.
 */
const PROBE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
};

const ENVIRONMENT_LABEL: Record<ExecutionEnvironment, string> = {
  [ExecutionEnvironment.Bare]: 'dev build',
  [ExecutionEnvironment.Standalone]: 'standalone',
  [ExecutionEnvironment.StoreClient]: 'Expo Go',
};

/**
 * Fabric installs `nativeFabricUIManager` on the global, so its presence is the
 * canonical runtime answer to "is the New Architecture actually on". Worth
 * asking at runtime rather than trusting `newArchEnabled`: the build flag and
 * the running app can disagree after an SDK bump or a stale prebuild.
 */
function probeFabric(): boolean {
  return (globalThis as { nativeFabricUIManager?: unknown }).nativeFabricUIManager != null;
}

async function probeAppleSignIn(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  try {
    return await AppleAuthentication.isAvailableAsync();
  } catch {
    return false; // not linked, or no entitlement — either way, unavailable
  }
}

/** Write, read back, delete — through the real Keychain, cleaning up always. */
async function probeKeychain(): Promise<boolean> {
  try {
    await SecureStore.setItemAsync(PROBE_KEY, PROBE_VALUE, PROBE_OPTIONS);
    return (await SecureStore.getItemAsync(PROBE_KEY, PROBE_OPTIONS)) === PROBE_VALUE;
  } catch {
    return false;
  } finally {
    await SecureStore.deleteItemAsync(PROBE_KEY, PROBE_OPTIONS).catch(() => undefined);
  }
}

export async function checkNativeCapabilities(): Promise<NativeCheck> {
  const [appleSignIn, keychain] = await Promise.all([probeAppleSignIn(), probeKeychain()]);
  return {
    environment: Constants.executionEnvironment,
    fabric: probeFabric(),
    appleSignIn,
    keychain,
    speechRecognition: voiceAvailable(),
    glass: hasLiquidGlass(),
    symbols: hasSymbols(),
    blur: hasBlur(),
    liveActivity: hasLiveActivity(),
    purchases: hasPurchases(),
  };
}

export function formatNativeCheck(check: NativeCheck): string {
  return [
    `native · ${ENVIRONMENT_LABEL[check.environment]}`,
    `fabric ${mark(check.fabric)}`,
    `apple sign-in ${mark(check.appleSignIn)}`,
    `keychain ${mark(check.keychain)}`,
    `speech ${mark(check.speechRecognition)}`,
    `glass ${mark(check.glass)}`,
    `symbols ${mark(check.symbols)}`,
    `blur ${mark(check.blur)}`,
    `live-activity ${mark(check.liveActivity)}`,
    `purchases ${mark(check.purchases)}`,
  ].join(' · ');
}

function mark(ok: boolean): string {
  return ok ? 'ok' : 'FAIL';
}

/** Fire-and-forget from the root layout. A no-op outside development. */
export async function logNativeCheck(): Promise<void> {
  if (!__DEV__) return;
  devLog(formatNativeCheck(await checkNativeCapabilities()));
}
