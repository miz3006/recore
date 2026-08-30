/**
 * The v2 onboarding motion system. One import site for springs and the five
 * primitives every screen is built from, so no screen writes its own
 * animation (`docs/onboarding-v2-spec.md` §5.2).
 *
 * Deliberately NOT re-exported from `src/lib/motion.ts` — that file is the
 * shipping app's motion vocabulary and the two are separate experiments until
 * one of them wins.
 */
export * from './springs';
export { Enter, EnterWhen } from './enter';
export { PressScale, PRESS_SCALE } from './press';
export { CountUp, TrackingNumber } from './count';
export { SpringBar } from './bar';
export { ChecklistRow, type ChecklistStep } from './checklist';
export { DrawnLine, GrowingBar, MonotoneSeries, type Point } from './chart';
export { monotonePathD, pathUpperBound, pointFractions } from './path';

/**
 * IMPORT THIS AS `@/lib/motion/index`, NOT `@/lib/motion`.
 *
 * `src/lib/motion.ts` — the shipping app's motion vocabulary — already owns the
 * bare specifier, and both TypeScript and Metro resolve the file before the
 * directory. The spec (§0) puts the v2 system at `src/lib/motion/`, so the two
 * coexist and v2 always spells out the `/index`. It is one word of noise in
 * exchange for never having to wonder which motion system a screen is on.
 */
