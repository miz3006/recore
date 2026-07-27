import { Easing, type WithSpringConfig, type WithTimingConfig } from 'react-native-reanimated';

/**
 * The physics (CLAUDE.md §7.1). **One spring family for the entire app**, and
 * three timings for things that only change appearance rather than position.
 *
 * §4.8 is the rule this serves: *motion explains, never entertains.* An
 * animation that could be removed without losing meaning is removed, which is
 * why there are three springs rather than a library of them — a card, a sheet
 * and a chart move differently because they weigh different amounts, not because
 * variety is nice.
 *
 * **Nothing in this app overshoots except one element** (§7.6), and `damping`
 * below 20 exists in exactly one place below. Reanimated 4 + worklets, UI thread
 * only (§19.3).
 */

/** Springs — anything that moves in space. */
export const spring = {
  /** Cards, chips, small elements. The default. */
  snap: { damping: 26, stiffness: 340, mass: 0.9 } satisfies WithSpringConfig,
  /** Sheets and large surfaces — more mass, so it arrives rather than snaps. */
  settle: { damping: 30, stiffness: 220, mass: 1.0 } satisfies WithSpringConfig,
  /** Ambient, background, charts. Slow enough to read as atmosphere. */
  gentle: { damping: 34, stiffness: 140, mass: 1.0 } satisfies WithSpringConfig,

  /**
   * The gesture spring — the ONLY one that ever receives a release velocity.
   * Critically damped so a thrown sheet lands without wobbling, but
   * velocity-aware so there is no seam between the finger and the animation.
   * Not a fourth family: `settle` with the overshoot clamped, for the one case
   * where the user, not the app, chose the starting speed.
   */
  gesture: {
    damping: 30,
    stiffness: 260,
    mass: 0.9,
    overshootClamping: true,
  } satisfies WithSpringConfig,

  /**
   * §7.6 — the single exuberant moment in the product. A personal record, and
   * nothing else, ever. `damping: 14` is the only sub-20 number in the file and
   * it is the whole point: this is the app's one overshoot.
   */
  prFlag: { damping: 14, stiffness: 220, mass: 0.6 } satisfies WithSpringConfig,
} as const;

/** Easings. `emphasized` is the confident expo-out used for reveals. */
export const easing = {
  standard: Easing.out(Easing.cubic),
  emphasized: Easing.bezier(0.16, 1, 0.3, 1),
  inOut: Easing.inOut(Easing.cubic),
} as const;

/**
 * Timings — anything that only changes appearance (opacity, colour, a wash).
 * Spread whole into `withTiming(v, timing.base)`; the duration and its curve
 * belong together and separating them is how a codebase ends up with nine
 * durations.
 */
export const timing = {
  fast: { duration: 140, easing: Easing.out(Easing.quad) } satisfies WithTimingConfig,
  base: { duration: 220, easing: Easing.out(Easing.cubic) } satisfies WithTimingConfig,
  slow: { duration: 380, easing: Easing.out(Easing.cubic) } satisfies WithTimingConfig,
} as const;

/**
 * Where a flick would come to rest, from iOS's own deceleration model (the
 * `project` function in Apple's *Designing Fluid Interfaces*). Used to decide
 * dismiss-vs-return from where the gesture is GOING rather than from where the
 * finger happened to lift — a short fast flick should throw a sheet away even
 * though it barely moved.
 */
export function projectDecay(velocity: number, decelerationRate = 0.998): number {
  'worklet';
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate);
}

/**
 * Progressive resistance past a boundary (iOS rubber-banding). Real things slow
 * before they stop; an invisible wall reads as a frozen app, so a drag beyond
 * the edge keeps moving — just less and less.
 */
export function rubberband(overshoot: number, dimension: number, constant = 0.55): number {
  'worklet';
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
}

/**
 * The entrance delay for the i-th item in a staggered list. §7.2 sets the cadence
 * at 40ms per card; the cap keeps a long session from turning its last card into
 * a wait. Under Reduce Motion the caller drops the stagger entirely (§7.5) —
 * everything arrives at once, which is a mapping, not a removal.
 */
export function stagger(i: number, step = 40, cap = 8): number {
  return Math.min(i, cap) * step;
}
