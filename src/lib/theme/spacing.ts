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
 * 20 pt row read as one family rather than as 18/22/28 read as three.
 */
export const radius = {
  sm: 10,
  md: 14, // buttons
  lg: 20, // rows, fields, option rows
  xl: 24, // cards, sheets, hero surfaces
  /** @deprecated the 28 pt hero band is gone — `xl` is the hero radius now. This
   * alias holds its 6 call sites through Phase 2 and is then deleted. */
  xxl: 24,
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

export type SpacingToken = keyof typeof spacing;
export type RadiusToken = keyof typeof radius;
