/**
 * The canvas field — Today's page, made of a surface instead of painted flat
 * (owner's spec §C, 13 Aug 2026; recoloured white 17 Aug 2026).
 *
 * The brief is unusually precise about what this may NOT be: the stops are the
 * same family as the canvas, the contrast between them is barely perceptible,
 * the drift is measured in tens of seconds, and the result must read as "not
 * flat" — never as "a gradient". So the numbers live here, pure and asserted,
 * rather than inline in a component where "a bit more contrast" is a
 * one-character edit nobody reviews.
 *
 * ## White (owner, 17 August 2026)
 *
 * The canvas is white, so the field is white: three neutral near-whites within
 * four units of each other. The warm paper family it was built from is gone
 * with the rest of the palette, and with it the one thing the field could
 * never survive — a texture the eye can name a colour for. If flat white is
 * what the app wants in the end, `<PaperField />` in `(tabs)/today.tsx` is the
 * single line that removes it.
 *
 * Everything about the motion is decided by `paperFieldMotion`, including the
 * only answer that matters for accessibility: with Reduce Motion on there is no
 * drift at all and the field is a STATIC gradient (CLAUDE.md §2 rule 4).
 */

/** The canvas the field must belong to. Kept in sync with `color.surface` —
 * the field's test reads the theme's source and fails if the two ever part.
 *
 * It tracked `color.bg` until 18 Aug 2026, when `bg` became the grouped grey
 * `#F2F2F7` that LIST screens sit on. Today is not a list — it is the document
 * you write in, so it keeps the white `surface`, and so does this field. */
export const CANVAS = '#FFFFFF';

/**
 * Three stops, light to deep, on the page diagonal.
 *
 * The canvas itself is the FIRST stop, not the middle one, for the reason the
 * whole change turns on: nothing is lighter than white, so the field can only
 * go down from it. Two and four units down — under the step an eye resolves on
 * a phone at arm's length, but enough that the surface stops being one dead
 * value.
 *
 * Few stops on purpose: a long, gentle ramp is what keeps an 8-bit display from
 * banding. More stops over the same tiny range would put the transitions closer
 * together and make the bands SHORTER and more visible, not fewer.
 */
export const PAPER_FIELD_STOPS = [CANVAS, '#FDFDFD', '#FBFBFB'] as const;

/** Where those stops sit along the diagonal. Off-centre, so the field never
 * reads as a symmetrical (and therefore noticeable) sweep. */
export const PAPER_FIELD_LOCATIONS = [0, 0.55, 1] as const;

/** One full there-and-back drift. Forty-two seconds: slow enough that the
 * change is never caught in the act, which is the whole point. */
export const PAPER_FIELD_CYCLE_MS = 42_000;

/** How far the field travels, in points. Small — it is the LIGHT moving across
 * the page, not the page moving. */
export const PAPER_FIELD_DRIFT_PX = 28;

/** The largest per-channel difference allowed between any two stops. Above
 * this, the field starts to read as a gradient rather than as a surface. */
export const MAX_STOP_DELTA = 8;

export interface PaperFieldMotion {
  /** False = draw the same gradient and never animate it. */
  animated: boolean;
  /** Full there-and-back cycle in ms; 0 when still. */
  cycleMs: number;
  /** Travel in points; 0 when still. */
  driftPx: number;
}

/**
 * What the field is allowed to do right now. Reduce Motion does not dim the
 * field, remove it, or swap it for a flat colour — the texture is not the
 * motion. It simply stops moving.
 */
export function paperFieldMotion(reduceMotion: boolean): PaperFieldMotion {
  if (reduceMotion) return { animated: false, cycleMs: 0, driftPx: 0 };
  return { animated: true, cycleMs: PAPER_FIELD_CYCLE_MS, driftPx: PAPER_FIELD_DRIFT_PX };
}

/** `#RRGGBB` → the three channels. Null for anything that is not one. */
export function channels(hex: string): [number, number, number] | null {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1]!, 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

/**
 * Is this colour in the white canvas family? Within a handful of units of
 * white, and NEUTRAL — no channel more than two apart from another. The warm
 * paper the field used to be made of fails here, and so does a cool grey: on a
 * white page any tint at all is the one thing the eye can name, which is what
 * stops "one more stop" from quietly reintroducing a colour the palette no
 * longer has.
 */
export function isCanvasTone(hex: string): boolean {
  const rgb = channels(hex);
  if (!rgb) return false;
  if (rgb.some((c) => c < 248)) return false; // white, or a hair under it
  return Math.max(...rgb) - Math.min(...rgb) <= 2; // and neutral: no tint
}

/** The largest per-channel distance between any two stops of the field. */
export function largestStopDelta(stops: readonly string[]): number {
  let worst = 0;
  for (const a of stops) {
    for (const b of stops) {
      const [ar, ag, ab] = channels(a) ?? [0, 0, 0];
      const [br, bg, bb] = channels(b) ?? [0, 0, 0];
      worst = Math.max(worst, Math.abs(ar - br), Math.abs(ag - bg), Math.abs(ab - bb));
    }
  }
  return worst;
}
