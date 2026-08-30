import { Platform } from 'react-native';

import { color, CONTROL_HEIGHT, moderateScale, spacing } from '@/lib/theme';

/**
 * THE v2 FLOW'S TOKENS — **colour now comes from `src/lib/theme/color.ts` and
 * this file holds none of its own** (owner, 28 August 2026).
 *
 * ## What happened to the isolation rule
 *
 * This file used to end its header with: *"v2 may read the theme. Nothing in v2
 * may read `src/components/onboarding/`, and nothing outside v2 may read this
 * file — deleting either directory has to leave the other standing."*
 *
 * **That rule is retired FOR COLOUR and stands for everything else.** It existed
 * because the spec's palette and the live theme disagreed and the two had to be
 * able to diverge; on 28 Aug 2026 the owner ruled that the spec's palette wins
 * and becomes the app's, so there is nothing left to isolate. Duplicating the
 * values here would now be the bug the rule was written to prevent.
 *
 * Still true, and not weakened by this change:
 * - Nothing in v2 may read `src/components/onboarding/` (the v1 flow).
 * - v2's components, flow logic, store and routes stay separate, and deleting
 *   either onboarding directory must leave the other standing.
 * - The geometry below is still v2's own, measured off Cal AI at 393 pt. It is
 *   not the app's spacing system and nothing outside v2 should read it.
 *
 * ## `v2color` is an alias, kept on purpose
 *
 * Twelve of its keys are live across 22 files. Renaming them all in the same
 * change as an app-wide palette shift would put two unrelated risks in one
 * unreviewable diff, so the values are single-sourced NOW and the call-site
 * rename is a separate mechanical pass. New v2 code should import `color`
 * directly; `v2color` is a bridge, not an API.
 */

/** @deprecated Import `color` from `@/lib/theme`. Kept so the 28 Aug palette
 * merge did not have to touch 22 files at once — every key below is an alias. */
export const v2color = {
  /** The world. Flat — no gradient in this flow, per §0. */
  canvas: color.canvas,
  /** Rows, cards, fields, the raised things that float on the canvas. */
  surface: color.surface,
  /** Warm black. Everything the flow says, and every value it reports. */
  ink: color.textPrimary,
  /** Supporting copy, sublines, units, captions. */
  inkSecondary: color.textSecondary,
  /** What the eye may skip: placeholders, disabled labels, axis ticks. Raised
   * from 42 % to 50 % of ink in the merge — at 42 % it measured 2.63:1 and
   * failed the 3:1 floor a non-text mark owes. */
  inkMuted: color.textMuted,
  /** The one blue: primary CTA, selected option rows and their checks, links,
   * progress fill, chart lines. */
  blue: color.brand,
  /** Held down. A darker blue, never an opacity flash. */
  bluePressed: color.brandPressed,
  /** A blue wash for the info banner on screen 12 and nothing else. */
  blueWash: color.brandWash,
  /** PLANNED VALUES ONLY (CLAUDE.md §3, recore-design §Colour). A load not yet
   * lifted. It is never a CTA, never a selected state, never "success". In this
   * flow it has exactly one home: the prescribed loads on screen 17. */
  planned: color.signal,
  plannedWash: color.signalWash,
  /** A label, glyph or check sitting ON blue. */
  onBlue: color.onInk,
  /** The disabled CTA. Cal AI greys the whole pill and keeps the label white;
   * the button stays the same object, it is simply not awake yet. */
  disabled: color.disabled,
  /** Hairlines — card edges, field underlines, the rule above a pinned CTA. */
  border: color.border,
  /** The progress rail's unfilled track. */
  track: color.track,
} as const;

/** §0: "radii (button 14, card 18, hero 22–28)". */
export const v2radius = {
  button: 14,
  card: 18,
  hero: 24,
  heroLarge: 28,
  pill: 999,
} as const;

/**
 * GEOMETRY, measured off Cal AI's own screens at 393 pt (`research/calai/`).
 * These are the numbers that make an unfamiliar flow feel like a familiar one.
 */
export const v2metrics = {
  /** Body gutter. Cal AI: 24 pt, and so is `spacing.xxl`. */
  gutter: spacing.xxl,
  /** The back circle, top left. Cal AI: ~40 pt with a light fill. */
  backButton: moderateScale(40),
  /** The progress rail sits beside the back circle on the same centre line. */
  railHeight: 4,
  railGap: spacing.xxl,
  /** Option row. Cal AI: 68 pt tall, 12 pt apart. A 44 pt target with room. */
  optionHeight: moderateScale(68),
  optionGap: spacing.md,
  /** The leading icon/emoji slot inside an option row. */
  optionIcon: moderateScale(36),
  /** §0 froze the primary CTA at CONTROL_HEIGHT (50), not the app's 56. */
  ctaHeight: CONTROL_HEIGHT,
  /** Distance from the headline block to the first row of content. */
  headlineGap: spacing.xxxl,
  /**
   * How tall the character stands on a hero screen.
   *
   * 248 since 28 August 2026, and it is not a 24 % increase in practice: the
   * drawings used to be square canvases that were three-quarters empty, so a
   * 200 pt box drew a ~200 pt picture of a small character. They are trimmed to
   * the ink now, so this is the character. `Character.tsx` caps it against the
   * window height on small screens.
   */
  characterSize: moderateScale(248),
} as const;

/**
 * The soft warm shadow that makes a `surface` visible against the canvas. Cast
 * in the canvas's own ink family rather than in black, which reads as a grey
 * smudge on warm paper.
 */
export const v2shadow = Platform.select({
  ios: {
    shadowColor: color.shadowCast,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 14,
  },
  android: { elevation: 1, shadowColor: color.shadowCast },
  default: {},
}) as object;

/** The CTA's glow — the one coloured shadow in the flow, on the primary CTA
 * alone, and only while it is awake. */
export const v2glow = Platform.select({
  ios: {
    shadowColor: color.brand,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 20,
  },
  android: { elevation: 4, shadowColor: color.brand },
  default: {},
}) as object;
