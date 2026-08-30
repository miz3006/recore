/**
 * THE v2 ONBOARDING MOTION SYSTEM — springs, named for what they do.
 *
 * `docs/onboarding-v2-spec.md` §3: "Springs throughout — no linear or
 * ease-in-out anywhere in this flow. Name springs semantically, not
 * `spring1`/`spring2`." So there are no durations in this file and no easing
 * curves; every number below is a physical constant with a damping ratio
 * written beside it, because the ratio is the thing you actually feel.
 *
 * ζ (zeta) = damping / (2 · √(stiffness · mass)).
 *   ζ < 1  underdamped — overshoots, then settles. A bounce.
 *   ζ = 1  critically damped — arrives as fast as possible without overshoot.
 *   ζ > 1  overdamped — slides in, never overshoots. Reads as weight.
 *
 * This file is v2-only and deliberately separate from `src/lib/motion.ts`,
 * which is the shipping app's vocabulary (durations + eases + two springs).
 * The v2 flow is an experiment in one motion language; when it wins, the two
 * merge. Until then neither imports the other.
 */
import type { WithSpringConfig } from 'react-native-reanimated';

/**
 * THE SCREEN PUSH — and the progress rail, which rides the same spring so the
 * bar and the screen read as one gesture (§3, "Progress bar").
 *
 * ζ ≈ 0.85: about 1.5% overshoot, which on a 300 pt rail is 4 pt and on a
 * 393 pt screen is 6 — enough to feel like travel arrested rather than travel
 * stopped, small enough that the rail never visibly claims more progress than
 * it has. Settles in ~280 ms, which is the ~350 ms of perceived travel the
 * spec asks for once the eye's own latency is counted.
 */
export const push = { mass: 0.9, damping: 26, stiffness: 260 } satisfies WithSpringConfig;

/**
 * A CHOICE SETTLING — the fill and check of a selected option row.
 * ζ ≈ 0.90. Just short of critical: it lands, it does not bounce. Selection is
 * a statement of fact and a wobble would undercut it.
 */
export const select = { mass: 0.6, damping: 24, stiffness: 300 } satisfies WithSpringConfig;

/**
 * A FINGER ON A SURFACE — press in to 0.97, spring back on release.
 * ζ ≈ 0.74, and the small bounce on the way back out is the whole point: it is
 * what makes the row read as a physical thing that was pushed.
 */
export const press = { mass: 0.35, damping: 18, stiffness: 420 } satisfies WithSpringConfig;

/**
 * THE CONTINUE BUTTON COMING ALIVE (§3, "Continue button" — "it animates
 * alive… It makes the CTA a reward rather than furniture").
 * ζ ≈ 0.53 — ~14% overshoot. The loudest spring in the flow and the only one
 * that is allowed to look pleased with itself, because it fires at most once
 * per screen and it is the moment the screen says yes.
 */
export const pop = { mass: 0.5, damping: 12, stiffness: 260 } satisfies WithSpringConfig;

/**
 * A NUMBER COUNTING UP from zero (§3, "Numbers").
 * ζ ≈ 1.58 — overdamped on purpose. A result that overshot its own value and
 * came back would be a lie for two frames, and this flow shows real loads.
 * Slow settle (~1 s) so the count is legible rather than a blur.
 */
export const count = { mass: 1, damping: 30, stiffness: 90 } satisfies WithSpringConfig;

/**
 * CONTENT ARRIVING — headline, subline, rows, cards, on a stagger.
 * ζ ≈ 0.90. Same family as `select`, a touch softer, so a screen assembling
 * itself and a choice landing on it feel like one hand.
 */
export const arrive = { mass: 0.8, damping: 24, stiffness: 220 } satisfies WithSpringConfig;

/**
 * THE CAP CHARACTER — one entrance everywhere it appears (§4: "One consistent
 * entrance — scale from 0.9 + fade, on a spring — so it reads as the same
 * character arriving, not a different asset loading").
 * ζ ≈ 0.76 — a visible settle. It is a character, not a control.
 */
export const character = { mass: 0.9, damping: 20, stiffness: 190 } satisfies WithSpringConfig;

/**
 * A CHECKMARK SCALING IN on screen 16.
 * ζ ≈ 0.60. Bouncier than `select` because these are not choices — they are
 * work reporting itself finished, sixteen times in three seconds, and the
 * bounce is what carries the light haptic that fires with it.
 */
export const tick = { mass: 0.45, damping: 11, stiffness: 300 } satisfies WithSpringConfig;

/**
 * STAGGER — one cadence for the whole flow.
 *
 * 60 ms between siblings, capped at 7 so a long option list still finishes
 * assembling before a finger can reach the first row. `CHECKLIST_STEP` is
 * separate and much slower: screen 16 is the one place where the delay IS the
 * content (§3, "Do not make it faster — this is where perceived effort is
 * manufactured").
 */
export const STAGGER_STEP = 60;
export const STAGGER_CAP = 7;
export const CHECKLIST_STEP = 520;

export function stagger(i: number, step = STAGGER_STEP, cap = STAGGER_CAP): number {
  return Math.min(Math.max(i, 0), cap) * step;
}

/**
 * How long a line takes to draw itself across a chart (§3, "Charts": "Lines
 * draw left to right on mount, ~800ms"). The one timing-driven value in the
 * system — a line's progress along its own path is travel, not settling, and a
 * spring would make the pen accelerate into the end of the stroke.
 */
export const DRAW_MS = 800;

/** How long the raw line waits before its reading resolves underneath, row by
 * row (§3, "Screen 5" — "~120ms apart"). */
export const READING_STEP_MS = 120;

/** The cross-fade every animation degrades to under Reduce Motion. */
export const REDUCED_FADE_MS = 160;
