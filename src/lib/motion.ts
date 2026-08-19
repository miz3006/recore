import { Easing, type WithSpringConfig, type WithTimingConfig } from 'react-native-reanimated';

/**
 * The motion language (CLAUDE.md §14 — one vocabulary, UI-thread only). The
 * redesign carries its "premium" on type + motion (the palette stays
 * monochrome), so movement has to feel deliberate and consistent: the same few
 * durations, one expo-style ease for reveals, and two springs — a snappy one
 * for taps, a soft one for sheets. Nothing bounces except the single PR flag.
 *
 * "Calm core, rich edges": the logging surface stays fast and quiet; the richer
 * motion lives in onboarding, screen/sheet transitions, and the moments that
 * earn a flourish (PR, finish, timer).
 */

/**
 * Durations in ms.
 *
 * `press` is the ceiling for something touched dozens of times a session — the
 * feedback has to be near-imperceptible or it becomes a tax on every tap.
 * Reveals use `base`; a value changing in place uses `fast`.
 */
export const DUR = {
  press: 120,
  fast: 160,
  base: 240,
  slow: 380,
  xslow: 560,
} as const;

/**
 * Easings.
 *
 * **`emphasized` is THE ease-out of the app** — a strong expo-out, and the
 * curve every entrance, exit and press uses. It is deliberately steeper than
 * `Easing.out(Easing.cubic)`: the built-in eases are weak enough that motion
 * driven by them reads as sluggish rather than as calm.
 *
 * `standard` is the gentler cubic, kept for a value settling IN PLACE (a fill
 * sweeping, a swap fading) where a steep curve would look like a snap.
 *
 * There is no ease-IN. It starts slow, which delays the exact moment the user
 * is watching; `inOut` is for something moving ACROSS the screen, which is the
 * only case where the deceleration at both ends is the truth.
 */
export const EASE = {
  standard: Easing.out(Easing.cubic),
  emphasized: Easing.bezier(0.16, 1, 0.3, 1),
  inOut: Easing.inOut(Easing.cubic),
} as const;

/**
 * How far a pressable dips under a finger. Three per cent — enough that the
 * label and icons travel with the surface (which is what makes it read as
 * physical) and small enough that it never looks like a separate animation.
 */
export const PRESS_SCALE = 0.97;

/**
 * Springs — for anything a FINGER was on, because a spring carries velocity
 * through an interruption and a timing curve restarts.
 *
 * `press` is no longer used for press feedback (that is `DUR.press` on the
 * emphasized ease: at 120 ms a spring's settle is the only part you can see,
 * and `press` is underdamped enough — dampingRatio ~0.58 — to wobble on
 * release). It stays for callers that genuinely bounce.
 */
export const SPRING = {
  press: { mass: 0.5, damping: 16, stiffness: 380 } satisfies WithSpringConfig,
  snappy: { mass: 0.8, damping: 18, stiffness: 210 } satisfies WithSpringConfig,
  soft: { mass: 1, damping: 22, stiffness: 150 } satisfies WithSpringConfig,
} as const;

/** The one PR overshoot — the only place a bounce is allowed. */
export const SPRING_OVERSHOOT = { mass: 0.6, damping: 9, stiffness: 220 } satisfies WithSpringConfig;

/** Reveal timing preset (fade + rise). */
export const REVEAL: WithTimingConfig = { duration: DUR.base, easing: EASE.emphasized };

/** Staggered entrance delay for the i-th item in a list (capped so long lists
 * don't drag). Keep one cadence across every staggered surface. */
export function stagger(i: number, step = 55, cap = 8): number {
  return Math.min(i, cap) * step;
}
