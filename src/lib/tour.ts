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
 *  - One shot: finishing OR skipping sets `pref_tour_done` and it never returns.
 *  - A step whose target is not on screen is dropped, not shown pointing at
 *    nothing (§1.1 invariant 6).
 *  - The copy is §15's voice: sentence case, numbers specific, no "AI", no
 *    exclamation marks, no emoji — and the test file lints exactly that.
 */

export type Rect = { x: number; y: number; w: number; h: number };
export type HoleRect = Rect & { r: number };

/**
 * Where a step's spotlight comes from. `dayPill` is measured off the mounted
 * view; `page` and `tabBar` are computed regions — the tab bar is a native
 * `UITabBarController` bar no ref can reach, so its rect is derived from the
 * window and `TAB_BAR_CLEARANCE`, the same way bottom-pinned content clears it.
 *
 * `dayPill` is no longer used by any step: §7's five steps replaced the
 * day-pill beat with "Finish and check-in". The variant stays because the
 * component's measurement plumbing does.
 */
export type TourTarget = 'page' | 'dayPill' | 'tabBar';

export type TourStepDef = {
  id: 'page' | 'finish' | 'next' | 'progress' | 'you';
  target: TourTarget;
  title: string;
  body: string;
};

export const TOUR_STEPS: TourStepDef[] = [
  {
    id: 'page',
    target: 'page',
    title: 'Write your training',
    body: 'One lift per line, in your own words — “bench 3x8 80kg”. Return settles the line into a card.',
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
    title: 'Finish, then a few words',
    body: 'Finish records the session. Recore then asks how it went — energy, fatigue, food, anything that mattered. It is optional and it is yours.',
  },
  {
    id: 'next',
    target: 'tabBar',
    title: 'Next',
    body: 'Your next session, computed from your own numbers — the load, and the reason beside it.',
  },
  {
    id: 'progress',
    target: 'tabBar',
    title: 'Progress',
    body: 'One card per lift: what you actually lifted, session by session, with the sets behind its latest point.',
  },
  {
    id: 'you',
    target: 'tabBar',
    title: 'You',
    body: 'Import from Hevy or Strong, export any time, your weekly split, and settings.',
  },
];

/** Grow a measured rect into its spotlight hole; the radius never exceeds the
 * hole's own half-size, so a pill target keeps a pill hole. */
export function inflate(rect: Rect, pad: number, r: number): HoleRect {
  const w = rect.w + pad * 2;
  const h = rect.h + pad * 2;
  return { x: rect.x - pad, y: rect.y - pad, w, h, r: Math.min(r, w / 2, h / 2) };
}

/** The writing surface between the top bar and the tab bar. */
export function pageRect(
  win: { w: number; h: number },
  topInset: number,
  tabTop: number,
  pad: number,
): Rect {
  return {
    x: pad,
    y: topInset + pad,
    w: win.w - pad * 2,
    h: Math.max(0, tabTop - topInset - pad * 2),
  };
}

/** The floating tab bar's region, approximated: no inset reports the bar (§4),
 * so this is the same arithmetic bottom-pinned content uses to clear it. */
export function tabBarRect(
  win: { w: number; h: number },
  bottomInset: number,
  clearance: number,
  inset: number,
): Rect {
  return {
    x: inset,
    y: win.h - bottomInset - clearance,
    w: win.w - inset * 2,
    h: clearance + bottomInset * 0.5,
  };
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

/** Where the step card sits: under the hole when it fits, above it otherwise,
 * always clamped inside the window and under the glass header. */
export function placeCard(
  hole: Rect,
  win: { w: number; h: number },
  cardH: number,
  margin: number,
  minTop: number,
): number {
  const below = hole.y + hole.h + margin;
  if (below + cardH + margin <= win.h) return below;
  const above = hole.y - margin - cardH;
  const hi = Math.max(minTop, win.h - cardH - margin);
  return Math.max(minTop, Math.min(above, hi));
}
