import { StyleSheet, type ImageStyle, type TextStyle, type ViewStyle } from 'react-native';

import type { Theme } from './theme';
import { useTheme } from './use-theme';

/**
 * `makeStyles` — how a stylesheet becomes theme-aware (PLAN.md 1.1b).
 *
 * A module-level `StyleSheet.create` is evaluated once, at import, when no hook
 * can be called and no palette is known. That is the single structural reason
 * the v2 codebase is light-only: not the token values, but *when* they were
 * read. This turns the stylesheet into a function of the palette and hands back
 * a hook:
 *
 * ```ts
 * const useStyles = makeStyles((t) => ({
 *   root: { flex: 1, backgroundColor: t.canvas },
 *   title: { color: t.ink },
 * }));
 *
 * function Screen() {
 *   const styles = useStyles();
 *   return <View style={styles.root} />;
 * }
 * ```
 *
 * Each palette's sheet is built once and cached, so switching themes never
 * re-creates a sheet that has already been seen, and a re-render costs a map
 * lookup rather than a `StyleSheet.create`. The cache is keyed on the palette
 * object identity — there are exactly two of those and they are module
 * constants, so it can never grow.
 */

type NamedStyles = Record<string, ViewStyle | TextStyle | ImageStyle>;

export function makeStyles<T extends NamedStyles>(factory: (theme: Theme) => T) {
  const cache = new WeakMap<Theme, T>();

  return function useStyles(): T {
    const palette = useTheme();
    const hit = cache.get(palette);
    if (hit) return hit;
    // StyleSheet.create is identity-preserving per call, so caching it here is
    // what keeps `styles.root` referentially stable across renders.
    const created = StyleSheet.create(factory(palette));
    cache.set(palette, created);
    return created;
  };
}
