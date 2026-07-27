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

/** Durations in ms. Reveals use `base`; micro-feedback uses `fast`. */
export const DUR = {
  fast: 160,
  base: 240,
  slow: 380,
  xslow: 560,
} as const;

/** Easings. `emphasized` is a smooth expo-out — the confident, expensive glide. */
export const EASE = {
  standard: Easing.out(Easing.cubic),
  emphasized: Easing.bezier(0.16, 1, 0.3, 1),
  inOut: Easing.inOut(Easing.cubic),
} as const;

/** Springs. `press` for tactile scale, `soft` for sheets/large surfaces. */
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
