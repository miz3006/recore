import { StyleSheet } from 'react-native';

import { moderateScale } from './scale';

/**
 * Spacing, radii, and hairline tokens (CLAUDE.md §5).
 *
 * "Generous whitespace; let the blank page breathe. Density is not the goal."
 * Large corner radii on cards (16–20px), pill shapes for controls, hairline
 * 0.5px borders instead of heavy dividers. ALL padding/margins come from this
 * scale — no one-off values on screens (task §2).
 */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 48,
  giant: 64,
} as const;

/**
 * ## Every rounded rect is a SQUIRCLE (18 Aug 2026)
 *
 * iOS has not drawn a circular corner since iOS 7 — the system rounds with
 * *continuous* curvature (the "squircle"), where the curve starts earlier and
 * eases into the straight edge instead of meeting it at a hard tangent. It is
 * the reason a hand-built card can sit next to a system sheet and look subtly
 * cheap without anyone being able to name why.
 *
 * React Native exposes it as `borderCurve: 'continuous'` (RN 0.71+, iOS only —
 * a no-op on Android and web, so it never needs a Platform.select). It is NOT
 * implied by these tokens: the property has to be set on the same style as the
 * radius.
 *
 *     { borderRadius: radius.lg, borderCurve: 'continuous' }
 *
 * **Set it on every new surface that uses `sm`/`md`/`lg`/`xl`.** Skip it
 * only where the shape is already a circle or a pill (`radius.pill`, `X / 2`) —
 * there is no corner left for the curve to change.
 */
/**
 * ## Four values and a pill — and the funnel has no scale of its own
 *
 * The design skill's §Spacing settles the radii for the whole app (20 Aug
 * 2026): `sm` 10 · `md` 14 (buttons) · `lg` 20 (rows, fields, option rows) ·
 * `xl` 24 (cards, sheets, hero surfaces) · `pill` 999. `onboarding/tokens.ts`
 * declares neither `CARD_RADIUS` nor `ROW_RADIUS` any more — the funnel's radii
 * ARE the app's radii (skill §Decided-2).
 *
 * `lg` and `xl` each grew two points, which is what makes a 24 pt sheet and a
 * 20 pt row read as one family rather than as 18/22/28 read as three. The 28 pt
 * `xxl` band is gone — its alias was deleted on 20 Aug 2026 with the last of its
 * call sites.
 */
export const radius = {
  sm: 10,
  md: 14, // buttons
  lg: 20, // rows, fields, option rows
  xl: 24, // cards, sheets, hero surfaces
  pill: 999, // controls, chips, date pill
} as const;

/** 0.5px where the device allows it; hairlineWidth resolves to the crispest line. */
export const hairline = StyleSheet.hairlineWidth;

/** Standard tap target for round toolbar buttons. */
export const HIT = 44;

/**
 * **The height of every PRIMARY button in the app** (skill §Decided-3).
 *
 * It was the onboarding funnel's private token, on the reasoning that the CTA is
 * the one control on those screens and may be the bigger thing. v6 makes that
 * true everywhere: a primary action is 56 wherever it is, so the button that
 * finishes a workout and the button that finishes onboarding are the same
 * object. It is not redeclared anywhere else.
 */
export const CTA_HEIGHT = moderateScale(56);

/** Secondary, ghost and compact controls — everything that is not the primary
 * button on its screen. */
export const CONTROL_HEIGHT = moderateScale(50);

/** Round toolbar-button diameter; scales down so four still fit on an SE. */
export const ROUND_BUTTON = moderateScale(40);

/**
 * How much room the system tab bar needs at the bottom of a tab screen
 * (CLAUDE.md §5.2).
 *
 * It has to be added by hand. `SafeAreaProvider` lives at the app root, so
 * `useSafeAreaInsets()` reports the *window's* insets (the home indicator)
 * rather than the tab content view's — the bar UIKit floats over the screen is
 * invisible to it. Content scrolls *behind* the bar and that is the point (glass
 * needs something to refract), but anything pinned to the bottom — the summary
 * pill, Finish — must clear it or it cannot be pressed at all.
 */
export const TAB_BAR_CLEARANCE = 56;

/**
 * WHERE THE FLOATING BAR ACTUALLY IS — the three numbers a spotlight needs
 * (9 September 2026).
 *
 * `TAB_BAR_CLEARANCE` above answers "how much room do I leave", which is all
 * pinned content ever asks. Drawing a hole around the bar asks the harder
 * question: where is its capsule, to the point. No inset reports it and no ref
 * reaches it, so these were **read off the running app** on the iPhone 17 Pro
 * simulator (iOS 26.5) by measuring the rendered screenshot — the same method
 * the design skill's sheet numbers came from.
 *
 * On a 402 x 874 pt window the capsule measured x 22, y 790.5, w 358, h 62, and
 * the four tab centres landed on 73.5 / 159 / 244.5 / 330 — even 85.5 pt slots
 * inside an 8 pt inner padding. The side margin and the gap under the bar came
 * out the same 22 pt, which is what a floating capsule inset equally on three
 * sides looks like, so `MARGIN` is one number rather than two.
 *
 * **Approximate by construction, and that is fine.** A spotlight hole that is a
 * point out reads as a spotlight; one derived from `TAB_BAR_CLEARANCE` was 28 pt
 * too wide and 11 pt too tall, which reads as a rectangle that missed.
 */
/**
 * THE NAVIGATION BAR'S COLLAPSED HEIGHT — 44, UIKit's own compact bar, safe
 * area excluded (9 September 2026).
 *
 * The three system-navigator tabs never need this: `contentInsetAdjustment`
 * gives content the right top inset and the bar measures itself. **The
 * spotlight does.** It draws a hole over Today's writing surface and has to
 * know where that surface starts, and with the chrome now native there is no
 * `onLayout` left to measure — the bar belongs to a `UINavigationController`
 * that no ref in this app reaches.
 *
 * A large title makes the bar taller than this while the page is at the top,
 * which is deliberate rather than ignored: the hole is placed under the
 * COLLAPSED bar, so it can only ever be too generous, and a spotlight that
 * starts a little high still spotlights the page. Sizing it to the expanded bar
 * would leave the hole in the wrong place the moment anything is scrolled.
 */
export const NAV_BAR_HEIGHT = 44;

export const TAB_BAR_MARGIN = 22;
/** The capsule's own height, home-indicator clearance excluded. */
export const TAB_BAR_HEIGHT = 62;
/** Padding inside the capsule before the first tab slot starts. */
export const TAB_BAR_SLOT_PAD = 8;

export type SpacingToken = keyof typeof spacing;
export type RadiusToken = keyof typeof radius;

/**
 * THE DISPLAY'S OWN CORNER RADIUS, in points, for the device this is running on.
 *
 * Needed because iOS 26 rounds a floating surface **concentrically**: a card
 * inset from the screen edge takes the screen's corner MINUS that inset, so the
 * two curves stay parallel. Get it wrong and the surface reads as running off
 * the bottom of the phone — its own corner is far tighter than the display's, so
 * the display's curve cuts across it and there is no clean corner left to see.
 * (Owner, 9 September 2026: *"noben ta sheet se ne konca lepo ampk so vsi nekak
 * cez ekran odspodej … mogoce da je mejcken vec zaobljeno al pa kej oz da se
 * prilagaja glede na telefon."* Both halves of that are right, and this is the
 * second half.)
 *
 * UIKit knows the number and does not export it — `UIScreen._displayCornerRadius`
 * is private and may not ship. So it is a table, keyed on the logical screen size,
 * which is what actually determines it. The values are Apple's published display
 * corner radii; a size not in the table falls back to `DEFAULT_DISPLAY_CORNER`,
 * which is the modern middle of the range rather than a guess at the extreme.
 *
 * **This is a lookup, so it can go stale on a phone that does not exist yet.**
 * The failure is graceful and one-directional: an unknown device gets 55, which
 * on a rounder screen is slightly too tight and on a squarer one slightly too
 * round — visible to a designer, invisible to everyone else, and never clipped.
 */
const DEFAULT_DISPLAY_CORNER = 55;

const DISPLAY_CORNER: Record<string, number> = {
  // Touch ID — square corners, no rounding at all.
  '320x568': 0,
  '375x667': 0,
  '414x736': 0,
  // The notch generation.
  '375x812': 39, // X · XS · 11 Pro
  '414x896': 41.5, // XR · 11 · XS Max · 11 Pro Max
  '390x844': 47.33, // 12 · 12 Pro · 13 · 13 Pro · 14
  '428x926': 53.33, // 12 Pro Max · 13 Pro Max · 14 Plus
  // Dynamic Island.
  '393x852': 55, // 14 Pro · 15 · 15 Pro · 16
  '430x932': 55, // 14 Pro Max · 15 Plus · 15 Pro Max · 16 Plus
  '402x874': 62, // 16 Pro · 17 Pro
  '440x956': 62, // 16 Pro Max · 17 Pro Max
  '396x868': 62, // 17 · Air
};

export function displayCornerRadius(width: number, height: number): number {
  const w = Math.round(Math.min(width, height));
  const h = Math.round(Math.max(width, height));
  return DISPLAY_CORNER[`${w}x${h}`] ?? DEFAULT_DISPLAY_CORNER;
}

/**
 * The radius a surface takes when it floats `inset` points inside the screen.
 *
 * Concentric with the display, floored at `radius.xl` so a flat-cornered Touch ID
 * phone still gets the app's own card corner instead of a rectangle.
 */
export function concentricRadius(width: number, height: number, inset: number): number {
  return Math.max(radius.xl, displayCornerRadius(width, height) - inset);
}
