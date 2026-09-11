/**
 * The first-open spotlight tour (owner, 29 Jul) — the walk-through that shows a
 * new user what the app can do before the FIRST SESSION ledger teaches them to
 * do it. An explicit owner ask, built the tab-bar way: on the v2 visual system,
 * with nothing new attached — the scrim is one evenodd path drawn by
 * `react-native-svg`, which is already in the stack, so no dependency was added.
 *
 * This module is pure (no React, no react-native) so the step list and every
 * piece of geometry are testable under plain `node --test`. Spacing and radius
 * values arrive as parameters — tokens live in `src/lib/theme` (§17) and this
 * file must stay importable from node.
 *
 * Rules the component enforces with these definitions:
 *  - One shot, and owed to ONE person: the funnel's end arms it (`armTour`),
 *    putting it on screen spends it, and nothing else ever arms it again. The
 *    old contract — "the absence of `pref_tour_done` means show it" — also
 *    described a returning athlete's new phone; see `prefs.ts`.
 *  - A step whose target is not on screen is dropped, not shown pointing at
 *    nothing (§1.1 invariant 6).
 *  - The copy is §15's voice: sentence case, numbers specific, no "AI", no
 *    exclamation marks, no emoji — and the test file lints exactly that.
 *
 * ## THE 9 SEPTEMBER 2026 PASS — one tab at a time
 *
 * The three tab steps all resolved to the SAME rectangle: the whole bar. Three
 * consecutive beats lit an identical 386 pt band while the words changed
 * underneath, so the spotlight looked frozen and — worse — never actually
 * answered "which one of these four is Next". A tour that names a control and
 * then points at four of them has not pointed at anything.
 *
 * Each `tabBar` step now carries the `tab` index it means, and the hole is that
 * slot alone (`tabSlotRect`). The bar's own geometry stopped being derived from
 * `TAB_BAR_CLEARANCE` — a number about how much room to leave, not about where
 * the capsule is — and became the measured values in `spacing.ts`.
 */

export type Rect = { x: number; y: number; w: number; h: number };
export type HoleRect = Rect & { r: number };

/**
 * Where a step's spotlight comes from. `dayPill` is measured off the mounted
 * view; `page` and `tabBar` are computed regions — the tab bar is a native
 * `UITabBarController` bar no ref can reach, so its rect is derived from the
 * window and the measured capsule geometry in `spacing.ts`.
 *
 * `dayPill` is no longer used by any step: §7's five steps replaced the
 * day-pill beat with "Finish and check-in". The variant stays because the
 * component's measurement plumbing does.
 */
export type TourTarget = 'page' | 'dayPill' | 'tabBar';

/**
 * The glyph a step leads with. These are `IconName`s (`components/icon.tsx`)
 * spelled as a local union so this file stays node-importable; the component's
 * `Icon name={step.glyph}` is what type-checks the two lists against each other.
 *
 * The three tab glyphs are the SF Symbols `(tabs)/_layout.tsx` actually puts in
 * the bar, not lookalikes — the card shows a person the mark it is about to
 * spotlight, so the eye has somewhere to land before the hole moves.
 */
export type TourGlyph =
  | 'tour-write'
  | 'tour-checkin'
  | 'tour-next'
  | 'tour-progress'
  | 'tour-you';

export type TourStepDef = {
  id: 'page' | 'finish' | 'next' | 'progress' | 'you';
  target: TourTarget;
  /**
   * Which slot of the tab bar a `tabBar` step lights, 0-based and left to
   * right. Today is 0 and no step claims it: the tour runs ON Today, so the
   * only tabs worth a beat are the three a new person has not opened.
   */
  tab?: number;
  glyph: TourGlyph;
  title: string;
  body: string;
};

/** How many triggers `(tabs)/_layout.tsx` puts in the bar. The slot arithmetic
 * needs the count, and a fifth tab must move this line in the same change. */
export const TAB_COUNT = 4;

export const TOUR_STEPS: TourStepDef[] = [
  {
    id: 'page',
    target: 'page',
    glyph: 'tour-write',
    title: 'Write it the way you say it',
    body: 'One lift per line, in plain words: bench 3x8 80kg. Press return and the line settles into your record.',
  },
  {
    // §7 step 2: "Finish and check-in". It shares the page target with step 1
    // rather than pointing at the Finish button, because Finish lives on the
    // composer's accessory bar and that bar only exists while the keyboard is
    // up — during the tour the note is empty and the button is not on screen.
    // A spotlight goes on a measurable target or it does not go (§7), so this
    // one keeps the surface both steps are about and changes the sentence.
    id: 'finish',
    target: 'page',
    glyph: 'tour-checkin',
    title: 'Finish, then a few words',
    body: 'Finish records the session. Recore then asks how it went: energy, fatigue, food, whatever mattered. It is optional, and it stays yours.',
  },
  {
    id: 'next',
    target: 'tabBar',
    tab: 1,
    glyph: 'tour-next',
    title: 'Next',
    body: 'The load for your next session, worked out from the sets you have already written, with the session it came from underneath.',
  },
  {
    id: 'progress',
    target: 'tabBar',
    tab: 2,
    glyph: 'tour-progress',
    title: 'Progress',
    body: 'One row per lift: which way it is going, how many sessions that took, and the estimate behind it. Open a lift for the sets.',
  },
  {
    id: 'you',
    target: 'tabBar',
    tab: 3,
    glyph: 'tour-you',
    title: 'You',
    body: 'Import from Strong or Hevy, export your whole record any time, and change any answer you gave during setup.',
  },
];

/** Grow a measured rect into its spotlight hole; the radius never exceeds the
 * hole's own half-size, so a pill target keeps a pill hole. */
export function inflate(rect: Rect, pad: number, r: number): HoleRect {
  const w = rect.w + pad * 2;
  const h = rect.h + pad * 2;
  return { x: rect.x - pad, y: rect.y - pad, w, h, r: Math.min(r, w / 2, h / 2) };
}

/**
 * The writing surface between the top bar and the tab bar. `pad` is the air it
 * leaves on the left, the right and the bottom — **and deliberately not on the
 * top**, where the edge sits flush against the nav block's own bottom.
 *
 * Air up there is what a card wants and the opposite of what this needs. The
 * first thing under the header is the weekly line, which begins about three
 * points below it, so an 8 pt top inset put the hole's edge THROUGH that line:
 * the top half of every glyph dimmed, the bottom half lit (seen on the
 * simulator, 9 September 2026). Flush, the line falls wholly inside the light,
 * and the `radius.xl` corner has curved back out of the way by the time it
 * reaches the text.
 */
export function pageRect(
  win: { w: number; h: number },
  topInset: number,
  tabTop: number,
  pad: number,
): Rect {
  return {
    x: pad,
    y: topInset,
    w: win.w - pad * 2,
    h: Math.max(0, tabTop - topInset - pad),
  };
}

/**
 * The floating tab bar's capsule. `margin` is the gap it leaves on the left,
 * the right and the bottom (one number — the bar is inset equally on three
 * sides), `height` the capsule itself. Both are measured, not derived; see
 * `TAB_BAR_MARGIN` in `theme/spacing.ts` for how and on what.
 */
export function tabBarRect(
  win: { w: number; h: number },
  margin: number,
  height: number,
): Rect {
  return {
    x: margin,
    y: win.h - margin - height,
    w: Math.max(0, win.w - margin * 2),
    h: height,
  };
}

/**
 * One tab's slot inside that capsule — the hole a `tabBar` step actually gets.
 *
 * The bar divides its width evenly between its triggers after an inner padding,
 * which is why the measured centres came out 85.5 pt apart on a 402 pt window.
 * Full capsule height on purpose: a pill hole the same height as the bar reads
 * as a segment of it, and at `radius.pill` its ends carry the bar's own 31 pt
 * curve.
 */
export function tabSlotRect(bar: Rect, index: number, count: number, pad: number): Rect {
  const slot = Math.max(0, bar.w - pad * 2) / Math.max(1, count);
  return { x: bar.x + pad + slot * index, y: bar.y, w: slot, h: bar.h };
}

/** One full-screen rect plus one rounded-rect hole; with `fillRule="evenodd"`
 * the overlap is the spotlight. Runs on the UI thread while the hole animates
 * between steps. */
export function scrimPathD(w: number, h: number, hole: HoleRect): string {
  'worklet';
  const n = (v: number) => Math.round(v * 100) / 100;
  const x = n(hole.x);
  const y = n(hole.y);
  const hw = n(hole.w);
  const hh = n(hole.h);
  const r = n(Math.max(0, Math.min(hole.r, hole.w / 2, hole.h / 2)));
  return (
    `M0 0H${n(w)}V${n(h)}H0Z` +
    `M${n(x + r)} ${y}` +
    `H${n(x + hw - r)}` +
    `A${r} ${r} 0 0 1 ${n(x + hw)} ${n(y + r)}` +
    `V${n(y + hh - r)}` +
    `A${r} ${r} 0 0 1 ${n(x + hw - r)} ${n(y + hh)}` +
    `H${n(x + r)}` +
    `A${r} ${r} 0 0 1 ${x} ${n(y + hh - r)}` +
    `V${n(y + r)}` +
    `A${r} ${r} 0 0 1 ${n(x + r)} ${y}` +
    `Z`
  );
}

/**
 * Which edge of the card the pointer leaves from, and therefore where the card
 * sits. `none` is not a failure: it is the placement for a hole too tall to
 * stand outside of, where a caret would point at the surface the card is
 * already resting on.
 */
export type CaretSide = 'up' | 'down' | 'none';
export type CardPlacement = { top: number; caret: CaretSide };

/**
 * Where the step card sits: under the hole when it fits, above it when that
 * fits instead, and otherwise INSIDE the hole resting on its bottom edge.
 *
 * That third branch is what the page steps take. The writing surface is most of
 * the screen, so "above" resolved to the top of the window — the card landed
 * inside the lit area anyway, clamped against the header, looking like it had
 * been pushed there rather than placed. Anchoring it to the bottom of the hole
 * instead puts it where an inline tip belongs: on the page, over the part of it
 * that is still blank, clear of the bar.
 */
export function placeCard(
  hole: Rect,
  win: { w: number; h: number },
  cardH: number,
  margin: number,
  minTop: number,
): CardPlacement {
  const below = hole.y + hole.h + margin;
  if (below + cardH + margin <= win.h) return { top: below, caret: 'up' };
  const above = hole.y - margin - cardH;
  if (above >= minTop) return { top: above, caret: 'down' };
  const inside = hole.y + hole.h - margin - cardH;
  return { top: Math.max(minTop, inside), caret: 'none' };
}

/**
 * The caret's left offset INSIDE the card: aimed at the hole's centre, then
 * pulled back so it never rides onto one of the card's rounded corners (where
 * it would look detached from the edge it is supposed to grow out of).
 */
export function caretOffset(
  hole: Rect,
  cardLeft: number,
  cardWidth: number,
  caretWidth: number,
  cornerRadius: number,
): number {
  const centre = hole.x + hole.w / 2 - cardLeft;
  const lo = cornerRadius + caretWidth / 2;
  const hi = cardWidth - cornerRadius - caretWidth / 2;
  const clamped = Math.min(Math.max(centre, lo), Math.max(lo, hi));
  return clamped - caretWidth / 2;
}
