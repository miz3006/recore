/**
 * The canvas — the app's page, made of a surface instead of painted flat
 * (owner's spec §C, 13 Aug 2026; recoloured warm and made static 20 Aug 2026,
 * design skill §Canvas).
 *
 * ## It is the whole app now, and it does not move
 *
 * Two things changed with v6. The field used to be Today's own surface, sitting
 * on white while LIST screens sat on the grouped grey `#F2F2F7`; that split is
 * abolished, so these three tones are the canvas of every screen. And the
 * gradient is **static**: "diagonal, subtle, static, and never animates". The
 * forty-two-second drift is gone with the rule that allowed it — motion has to
 * make cause and effect clearer, and a page breathing under a person who is
 * writing down a workout does the opposite. Nothing here is gated on Reduce
 * Motion any more because nothing here moves.
 *
 * ## The tones are measured, not taste
 *
 * `canvasTop` peach → `canvas` → `canvasBot` lavender-pink, on the diagonal. The
 * step between them is under what an eye resolves on a phone at arm's length —
 * `largestStopContrast` is about **1.007:1** — so the page reads as "not flat"
 * and never as "a gradient". What differs is the HUE, not the lightness, which
 * is the only way to have warmth without spending contrast.
 *
 * And contrast is exactly what these values were bought with: on all three
 * tints `textSecondary` clears 4.70:1, `signal` 4.57, `attention` 4.65, `gain`
 * 5.00 — every information-carrying ink over AA, which the retired `#F2F2F7`
 * was not (`signal` 4.42). **Deepening the canvas means re-measuring the whole
 * ink ladder in `theme/color.ts`.** The guard below is the cheap half of that:
 * it says what a canvas tone may be at all.
 *
 * The numbers live here, pure and asserted, rather than inline in a component
 * where "a bit more contrast" is a one-character edit nobody reviews.
 */

/** The canvas itself — kept in sync with `color.canvas`; the field's test reads
 * the theme's source and fails if the two ever part. It is also the flat fill
 * for anywhere the gradient cannot render. */
export const CANVAS = '#FCF9F4';

/**
 * Three stops along the page diagonal, top-left to bottom-right.
 *
 * The canvas is the MIDDLE stop, so the two tints fall either side of the value
 * everything else in the app is measured against: whatever the gradient is
 * doing under a given pixel, the page is never further from `canvas` than the
 * ends are.
 *
 * Few stops on purpose: a long, gentle ramp is what keeps an 8-bit display from
 * banding. More stops over the same tiny range would put the transitions closer
 * together and make the bands SHORTER and more visible, not fewer.
 */
export const PAPER_FIELD_STOPS = ['#FDF6EE', CANVAS, '#F9F5F9'] as const;

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
 *    `#FFFFFF` is what pills and sheets are made of, and the canvas has to be
 *    the thing they sit ON. This is also what stops the field from quietly
 *    reverting to the white page of 17 Aug.
 * 3. **Warm-led: red is never the lowest channel.** The lavender end leans
 *    magenta and is allowed to; a canvas that leans BLUE reads as a screen
 *    rather than as paper, and the green-cast paper this family replaced
 *    (`#F4F5EF`) reads as a stain.
 */
export function isCanvasTone(hex: string): boolean {
  const rgb = channels(hex);
  if (!rgb) return false;
  if (contrast(hex, CANVAS) > MAX_STOP_CONTRAST) return false;
  const [r, g, b] = rgb;
  if (Math.max(r, g, b) - Math.min(r, g, b) < 3) return false; // a flat neutral is a surface
  return r >= g && r >= b; // never cool
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
