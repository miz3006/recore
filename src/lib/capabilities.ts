import { requireOptionalNativeModule } from 'expo-modules-core';

/**
 * Runtime capability gates for the native libraries installed in 0.5
 * (CLAUDE.md §19.3). No feature uses any of them yet — this module is the single
 * place every future consumer asks first, so an un-run prebuild, a missing
 * entitlement or an older iOS degrades to a fallback instead of crashing.
 *
 * Every function returns a boolean, never throws, and is safe on any platform
 * and in any build. That matters most for Liquid Glass: `isLiquidGlassAvailable`
 * resolves through `requireNativeModule`, which THROWS when the module is not
 * linked — §6.9 is explicit that this must be checked at runtime rather than by
 * reading the iOS version, because some iOS 26 builds lack the API entirely.
 *
 * Results are cached: linkage cannot change within a process, and these sit on
 * render paths where a per-frame native lookup would be waste.
 */

/** Expo module registry names, as declared by each package's own JS. */
const MODULES = {
  glass: 'ExpoGlassEffect',
  symbols: 'SymbolModule',
  blur: 'ExpoBlurView',
  liveActivity: 'ExpoLiveActivity',
} as const;

const cache = new Map<string, boolean>();

function memo(key: string, probe: () => boolean): boolean {
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  let value = false;
  try {
    value = probe();
  } catch {
    value = false; // not linked, or the native call threw — either way, absent
  }
  cache.set(key, value);
  return value;
}

function linked(name: string): boolean {
  return requireOptionalNativeModule(name) != null;
}

/**
 * True when the Liquid Glass components are actually available — the gate the
 * `Glass` primitive (1.8) opens before reaching for `GlassView` (§6.9).
 *
 * Note this answers "can it render", not "should it": Reduce Transparency is a
 * separate accessibility question and belongs to the component, not here.
 */
export function hasLiquidGlass(): boolean {
  return memo('glass', () => {
    if (!linked(MODULES.glass)) return false;
    // Resolved lazily so the throwing import never runs on a build without it.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('expo-glass-effect') as { isLiquidGlassAvailable?: () => boolean };
    return mod.isLiquidGlassAvailable?.() === true;
  });
}

/** SF Symbols via `expo-symbols` — the only icon source the design allows (§6.10). */
export function hasSymbols(): boolean {
  return memo('symbols', () => linked(MODULES.symbols));
}

/** `expo-blur`, the middle rung of the §6.9 fallback: glass → blur → solid. */
export function hasBlur(): boolean {
  return memo('blur', () => linked(MODULES.blur));
}

/** Live Activity + Dynamic Island for the rest timer (§8.7, task 6.2). */
export function hasLiveActivity(): boolean {
  return memo('liveActivity', () => linked(MODULES.liveActivity));
}

/**
 * RevenueCat (§14.4, task 5.11). Probed by requiring the module and confirming
 * its entry point, because it is not an Expo module and so is absent from the
 * Expo native registry.
 */
export function hasPurchases(): boolean {
  return memo('purchases', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('react-native-purchases') as { default?: { configure?: unknown } };
    return typeof mod.default?.configure === 'function';
  });
}
