import { useSyncExternalStore } from 'react';
import { useColorScheme } from 'react-native';

import { type ColorScheme } from './color';
import { themeFor, type Theme } from './theme';

/**
 * `useTheme()` — the only way a component gets a colour (CLAUDE.md §6.3).
 *
 * Resolves the user's preference (`system | light | dark`) against the device
 * and returns the live palette. Because both palettes carry identical keys, a
 * consumer never branches on the theme: it asks for `surface` and gets whatever
 * `surface` means here.
 *
 * The preference is held in a tiny external store rather than React state so
 * that `setColorScheme` can be called from anywhere — a settings row, a deep
 * link, a test — and every subscribed component re-renders in the same commit.
 * Persistence belongs to the settings screen that owns the control (§11.3), not
 * to the theme layer; this module keeps the value for the session and takes an
 * initial value from whoever restores it.
 *
 * Separate from `./color` on purpose: that module must stay importable under
 * plain `node` so the contrast test (1.5) can read the palettes, and this one
 * imports React Native.
 */

let preference: ColorScheme = 'system';
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getPreference(): ColorScheme {
  return preference;
}

/** Set the scheme for this session. Notifies every mounted `useTheme`. */
export function setColorScheme(next: ColorScheme): void {
  if (next === preference) return;
  preference = next;
  for (const listener of listeners) listener();
}

/** Read the current preference without subscribing. */
export function getColorScheme(): ColorScheme {
  return preference;
}

/** Subscribe to the preference. Prefer `useTheme()` unless you need the raw value. */
export function useColorSchemePreference(): ColorScheme {
  return useSyncExternalStore(subscribe, getPreference, getPreference);
}

/** The resolved theme for right now — palette, scheme, and §6.8's elevation. */
export function useTheme(): Theme {
  const pref = useColorSchemePreference();
  const system = useColorScheme();
  return themeFor(pref, system);
}
