/**
 * The illustration band's geometry — the ONE place that answers "how tall is
 * the mascot right now", for a still screen and for every frame of the keyboard
 * coming up.
 *
 * Pure and import-free so `band.test.ts` can run it under `node --test`: the
 * keyboard transition is the part of this flow that used to jump, and a
 * reducer that is only exercised on a device is a reducer nobody checks.
 *
 * ## The transition (owner's spec §B, 13 Aug 2026)
 *
 * The band used to swap between two heights on a `setState` from
 * `keyboardWillShow` — one React re-render, one instant jump, and the whole
 * page reflowing under a rising keyboard. Now a single shared value follows the
 * keyboard's OWN height and this file interpolates the band from it, so the
 * shrink cannot be anything but smooth: it borrows the system's duration and
 * curve by being driven by the system's animation, and reverses by running the
 * same interpolation backwards. There is no second animation to fall out of
 * step with, and no layout state to re-render.
 */

/**
 * How tall the illustration zone is, as a share of the window. Derived from the
 * WINDOW ONLY — never from a screen's content — so the mascot, the headline
 * baseline and the CTA sit at exactly the same y on every step of the flow.
 * Short devices give the band less, or the four-option screens would scroll for
 * their whole height.
 *
 * ## The drawings got smaller twice
 *
 * **14 Aug 2026 (owner).** A third of the window became roughly a quarter:
 * 0.36 to 0.26 on a tall phone, 0.33 to 0.24, 0.28 to 0.20 on a short one. A
 * drawing that takes a third of the screen competes with the question under it,
 * and the smaller band made the page fit with the keyboard up WITHOUT the
 * shrink transition running — a layout that depends on an animation to fit has
 * a single point of failure.
 *
 * **18 Aug 2026 (the v3 design board).** A sixth: 0.26 to 0.17, 0.24 to 0.16,
 * 0.20 to 0.15. This is a MEASURED number, not a taste — the board's
 * placeholder occupies 0.164 of its phone screen — and the reason it measures
 * that way is arithmetic: the new flow's longest questions carry FIVE option
 * rows, and at 0.26 the fifth row sat under the CTA. A screen whose last answer
 * is only reachable by scrolling past the button is a screen where that answer
 * gets chosen less often, which quietly biases the funnel's own data.
 *
 * The three sizes §A.4 names: iPhone SE (667) takes the 0.15 band, iPhone 15
 * (852) and Pro Max (932) the 0.17 one.
 */
export function illustrationHeight(windowHeight: number): number {
  const fraction = windowHeight >= 800 ? 0.17 : windowHeight >= 700 ? 0.16 : 0.15;
  return Math.round(windowHeight * fraction);
}

/**
 * The same band with the keyboard fully up (owner, 12 Aug 2026: "I don't want
 * it to hide"). The mascot STAYS — it just stands smaller, because the keyboard
 * takes roughly 40 % of the screen and the field it raises has to stay above it
 * along with the headline and the button.
 *
 * The slot fits its asset with `contain`, so this is a scale change and never a
 * crop: the whole figure is still on the page. Content-independent like the
 * full height, so the typed screens shrink to exactly the same band.
 *
 * It gives up a THIRD now rather than well over half (0.42 → 0.68 of the full
 * band, 14 Aug 2026). The band it starts from is smaller, so there is far less
 * to give up, and a short travel is a transition that cannot look like a jump
 * even if it ends up running as one.
 */
export function illustrationHeightCompact(windowHeight: number): number {
  return Math.max(MIN_BAND_PX, Math.round(illustrationHeight(windowHeight) * 0.68));
}

/** The band never goes below this, whatever the arithmetic says — under it the
 * mascot is a smudge and may as well have been faded out. */
export const MIN_BAND_PX = 80;

/**
 * The share of the window at which the keyboard counts as fully open. Software
 * keyboards land between ~35 % (a plain QWERTY on a tall phone) and ~48 % (with
 * a suggestion strip on a short one), and the band must be settled by the time
 * the keyboard is, never still shrinking under a field that has stopped moving.
 * Normalising at 0.30 means the band finishes a beat EARLY on every device
 * instead of late on some, which is the direction that reads as calm.
 */
export const KEYBOARD_FULL_FRACTION = 0.3;

/**
 * ## Every worklet below is SELF-CONTAINED, and has to stay that way
 *
 * These three run on the UI thread. They call nothing — not each other, not a
 * shared `clamp01`, not the two height functions above. A worklet that calls
 * another module-scope function crashed this screen on the first device run
 * (`TypeError: clamp01 is not a function`): the plugin rewrites a workletized
 * declaration into a binding, and the helper is not initialised in the closure
 * the UI runtime evaluates. So the clamp is written out three times, on
 * purpose. Anything a worklet needs that is not arithmetic on its arguments is
 * computed on the render thread and passed IN — which is why `bandHeightAt`
 * takes the two heights rather than the window.
 */

/**
 * Keyboard height (points, as the system reports it) → 0…1 of the transition.
 * Monotonic, clamped, continuous — an interactive dismissal drags it backwards
 * through the same values it came up through.
 */
export function keyboardProgress(keyboardHeight: number, windowHeight: number): number {
  'worklet';
  if (windowHeight <= 0) return 0;
  const open = windowHeight * KEYBOARD_FULL_FRACTION;
  if (open <= 0) return 0;
  const p = keyboardHeight / open;
  return p > 1 ? 1 : p > 0 ? p : 0; // the `> 0` test also catches NaN
}

/**
 * The band's height at a point in the transition: `0` = keyboard down (the
 * full band), `1` = keyboard up (the compact one). Deliberately UNROUNDED
 * between the ends — this is read on every frame, and rounding it would put a
 * staircase in the one animation the spec asks to be smooth.
 */
export function bandHeightAt(progress: number, full: number, compact: number): number {
  'worklet';
  const p = progress > 1 ? 1 : progress > 0 ? progress : 0;
  return full + (compact - full) * p;
}

/**
 * The band's margins collapse on the same value, so the whole zone tightens as
 * one gesture rather than a height animating inside static whitespace.
 */
export function bandMarginAt(progress: number, full: number): number {
  'worklet';
  const p = progress > 1 ? 1 : progress > 0 ? progress : 0;
  return full * (1 - p);
}

/**
 * How far the CTA band lifts so it sits just clear of the keyboard.
 *
 * ## Why the button moves at all, and why it moves like THIS
 *
 * Until 19 Aug 2026 the whole page sat inside a `KeyboardAvoidingView` with
 * `behavior="padding"`. That is a React re-render driven by a `keyboardWillShow`
 * event which arrives on the JS thread AFTER the keyboard has already begun
 * moving, animating a padding — a layout property — for every frame of the
 * transition. It lagged the keyboard it was supposed to be riding, it re-laid
 * out the entire page while somebody was typing, and it fought the illustration
 * band, which was already reading the same keyboard correctly.
 *
 * Now it is a translate on the keyboard's own height, sampled on the UI thread,
 * exactly like `bandHeightAt` above. There is no duration and no easing to pick
 * because the animation has none of its own: it IS the system's curve. An
 * interactive swipe-down drags the button back by hand, and nothing re-renders
 * for any of it.
 *
 * **The bottom inset is subtracted** because the CTA band already reserves it
 * (see `OnboardingScreen`), and the keyboard's reported height already covers
 * the home-indicator strip. Lifting by the raw height would leave a 34 pt gap
 * of paper under a button that is supposed to sit ON the keyboard.
 *
 * Returns a NEGATIVE offset (up the screen) or 0. Never positive: a keyboard
 * shorter than the inset must not push the button down off the page.
 */
export function ctaLiftAt(keyboardHeight: number, bottomInset: number): number {
  'worklet';
  const lift = keyboardHeight - bottomInset;
  // The `> 0` test also catches NaN, the same way `keyboardProgress` does.
  return lift > 0 ? -lift : 0;
}
