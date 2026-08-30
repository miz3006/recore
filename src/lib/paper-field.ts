import { color } from './theme/color.ts';

/**
 * The canvas — the app's page, made of a surface instead of painted flat
 * (owner's spec §C, 13 Aug 2026; recoloured warm and made static 20 Aug 2026;
 * re-derived onto the v2 paper palette 28 August 2026).
 *
 * ## It is the whole app, and it does not move
 *
 * These three tones are the canvas of every screen, and the gradient is
 * **static**: "diagonal, subtle, static, and never animates". Nothing here is
 * gated on Reduce Motion because nothing here moves.
 *
 * ## The stops are DERIVED, and they are matched on luminance
 *
 * The 28 Aug palette merge moved the canvas to `#F4F5EF`. Rather than
 * hand-picking two new tints, the field kept the OLD field's own hue endpoints —
 * **peach 71° and lavender 326° in OKLCH** — and re-derived them at the new
 * paper's lightness. Same field, new paper.
 *
 * They are then solved so that **every stop carries the same WCAG relative
 * luminance as `canvas`** (0.9077 ± 0.0043). That is stronger than the old
 * field, which held OKLCH lightness instead and let the chroma of the peach end
 * cost it real contrast: `signal` measured 4.48 on that stop against 4.50 on the
 * canvas. Matching luminance makes `largestStopContrast` **1.005:1** and means
 * every ink in the app measures the same on all three stops — which is the
 * property `theme/color.ts`'s ladder actually depends on when it says "on
 * canvas". The stops differ by HUE alone, which is the only way to have warmth
 * without spending contrast.
 *
 * The values live in `theme/color.ts` as `canvasTop` / `canvas` / `canvasBot`
 * and are imported here, so there is one palette and this module cannot drift
 * from it. **Deepening the canvas means re-measuring the whole ink ladder there.**
 * The guard below is the cheap half of that: it says what a canvas tone may be.
 */

/** The canvas itself — the middle stop, and the flat fill for anywhere the
 * gradient cannot render. */
export const CANVAS = color.canvas;

/**
 * Three stops along the page diagonal, top-left to bottom-right.
 *
 * The canvas is the MIDDLE stop, so the two tints fall either side of the value
 * everything else in the app is measured against.
 *
 * Few stops on purpose: a long, gentle ramp is what keeps an 8-bit display from
 * banding. More stops over the same tiny range would put the transitions closer
 * together and make the bands SHORTER and more visible, not fewer.
 */
export const PAPER_FIELD_STOPS = [color.canvasTop, CANVAS, color.canvasBot] as const;

/** Where those stops sit along the diagonal. Off-centre, so the field never
 * reads as a symmetrical (and therefore noticeable) sweep. */
export const PAPER_FIELD_LOCATIONS = [0, 0.55, 1] as const;

/** The largest contrast ratio allowed between any two stops. Above this the
 * field starts to read as a gradient rather than as a surface — and the ink
 * ladder stops being measurable against one canvas value. */
export const MAX_STOP_CONTRAST = 1.03;

/** `#RRGGBB` → the three channels. Null for anything that is not one. */
export function channels(hex: string): [number, number, number] | null {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1]!, 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

/** WCAG relative luminance. */
function luminance(hex: string): number {
  const rgb = channels(hex);
  if (!rgb) return 0;
  const [r, g, b] = rgb.map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two `#RRGGBB` colours. */
export function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/**
 * Is this colour in the canvas family?
 *
 * Three conditions, and each one closes a door the palette has walked through
 * before:
 *
 * 1. **Indistinguishable from `CANVAS` in lightness** (≤ `MAX_STOP_CONTRAST`).
 *    The ink ladder is measured against one canvas value; a tone the eye can
 *    resolve as a step is a tone the ladder no longer answers for.
 * 2. **Tinted, never a flat neutral.** A neutral near-white is a *surface* —
 *    `surface` is what pills and sheets are made of, and the canvas has to be
 *    the thing they sit ON. This also stops the field reverting to the white
 *    page of 17 Aug 2026.
 * 3. **BLUE NEVER LEADS: `b ≤ max(r, g)`.**
 *
 * Rule 3 was `r >= g && r >= b` — *"warm-led: red is never the lowest channel"*
 * — and it was rewritten on 28 August 2026 because **the palette merge would
 * otherwise have rejected the app's own canvas.** `#F4F5EF` is `rgb(244, 245,
 * 239)`: green leads red by one unit, so the old rule called it green-cast and
 * said no. (This file previously named `#F4F5EF` in as many words as "the
 * green-cast paper" the warm family replaced. The owner has since ruled the
 * other way, and the guard follows the ruling.)
 *
 * The restatement keeps everything the old rule was actually protecting. What
 * makes a tone read as *screen* rather than as *paper* is a blue cast, and the
 * lavender end of the diagonal has always leaned magenta — where blue is high
 * but red is never lower. So the rule now bars the one thing it was ever really
 * barring, and it still says no to every tone the old one did: the grouped grey
 * `#F2F2F7`, the cool near-white `#F8F9FB`, flat `#F0F0F0`, white, and the
 * brand. It is one degree looser in exactly one direction — a green-led paper
 * is now admissible, because the app's paper is one.
 */
export function isCanvasTone(hex: string): boolean {
  const rgb = channels(hex);
  if (!rgb) return false;
  if (contrast(hex, CANVAS) > MAX_STOP_CONTRAST) return false;
  const [r, g, b] = rgb;
  if (Math.max(r, g, b) - Math.min(r, g, b) < 3) return false; // a flat neutral is a surface
  return b <= Math.max(r, g); // blue never leads
}

/** The largest contrast ratio between any two stops of the field. */
export function largestStopContrast(stops: readonly string[]): number {
  let worst = 1;
  for (const a of stops) {
    for (const b of stops) {
      worst = Math.max(worst, contrast(a, b));
    }
  }
  return worst;
}
