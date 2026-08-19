/**
 * The NUMERIC half of the illustration manifest — every onboarding slug, and
 * how its artwork is placed inside the illustration band.
 *
 * It is a separate file from `illustrations.ts` for one reason: that file
 * `require()`s PNGs and therefore only loads inside Metro, while this one is
 * plain data with zero imports and runs under `node --test`. The manifest's
 * completeness is a real, executable check that way (`illustration-layout.test`)
 * instead of a promise in a comment.
 *
 * ## Why per-slug numbers exist at all
 *
 * The owner's drawings were exported trimmed to their own alpha bounding box,
 * so every file's aspect ratio is the artwork's aspect ratio — measured, 13 Aug
 * 2026, from the PNG headers in `assets/onboarding/`:
 *
 *     notifications 307×880 (0.35)   overload 363×880 (0.41)
 *     bodyweight    427×880 (0.49)   days     433×880 (0.49)
 *     summary       482×880 (0.55)   tracker  514×798 (0.64)
 *     welcome       530×880 (0.60)   gender   570×878 (0.65)
 *     name          581×880 (0.66)   demo     652×871 (0.75)
 *     social-proof  665×880 (0.76)   commitment 702×714 (0.98)
 *     style         754×880 (0.86)   rest-timer 771×837 (0.92)
 *     why-tracking  745×880 (0.85)   paywall  788×880 (0.90)
 *     goal          867×871 (1.00)   experience 880×703 (1.25)
 *     key-lift      880×660 (1.33)
 *
 * The band fits its asset with `contain`, so an asset WIDER than the band is
 * limited by width and lands SHORTER than the band — the figure in it reads
 * smaller than the figure beside it in the flow, through no fault of the
 * drawing. The band's own aspect on the reference device (iPhone 15: 393 pt
 * wide, 24 pt page padding each side, band = 36 % of an 852 pt window) is
 *
 *     column 345 pt / band 307 pt = 1.12
 *
 * so every asset up to 1.12 already fills the band's height and needs nothing.
 * Only `experience` (1.25) and `key-lift` (1.33) are wider than that.
 *
 * ## EVERY SCALE IS 1 (corrected on the recording, 14 Aug 2026)
 *
 * Those two were briefly scaled up by their shortfall — `AR / 1.12`, capped
 * where the width reached the screen edge — to put their figures back on the
 * same height as the other seventeen. On a device the correction was worse
 * than the problem it fixed:
 *
 *  - The cap was derived on ONE device and does not hold on the others. The
 *    ratio of screen to text column shrinks as phones get wider (375 → 1.147,
 *    393 → 1.139, 430 → 1.126), so the 1.14 cap was over the limit on a Pro
 *    Max. `key-lift`'s barbell plates were cut off flat by both screen edges.
 *  - `experience` at 1.11 was not clipped but ran the full width of the glass,
 *    which reads as cropped anyway and abandons the page margin every other
 *    screen keeps.
 *  - And the premise was thin: these two drawings hold three figures and a
 *    loaded bar, so their figures are smaller INSIDE the frame on purpose.
 *    Scaling the frame to band height does not make the character match the
 *    one on the screen before it; it just makes the composition bigger.
 *
 * So the manifest leaves `contain` alone. `MAX_SAFE_SCALE` below is the wall
 * any future deviation has to stay under, and the test enforces it — the fix
 * for a drawing that reads small is a re-export with less air in it.
 *
 * OFFSETS ARE ZERO EVERYWHERE, and that is a finding rather than a default:
 * because each file is trimmed to its own content bounds, the geometric centre
 * of the file IS the centre of the drawn artwork, and `contain` centres that in
 * the band. The fields exist so a drawing whose optical centre later disagrees
 * with its bounding box (a figure holding a long bar low, say) can be nudged
 * without a code change — in points, positive = right / down.
 */

/**
 * Every screen of the flow, in order — the same slugs `STEPS` carries, and the
 * type its `slug` field is declared as, so a screen added to the config without
 * an entry here is a TYPE ERROR rather than a silently missing illustration.
 */
export const ONBOARDING_SLUGS = [
  'welcome',
  'tracker',
  'obstacles',
  'demo',
  'why-written',
  'goal',
  'experience',
  'about-you',
  'days',
  'key-lifts',
  'overload',
  'commitment',
  'recap',
  'projection',
] as const;

export type OnboardingSlug = (typeof ONBOARDING_SLUGS)[number];

/** Not a step of the flow, but drawn by the same slot from the same registry:
 * the paywall is its own route and keeps the flow's mascot. */
export const EXTRA_ILLUSTRATION_SLUGS = ['paywall'] as const;

export const ILLUSTRATION_SLUGS = [...ONBOARDING_SLUGS, ...EXTRA_ILLUSTRATION_SLUGS] as const;

export type IllustrationSlug = (typeof ILLUSTRATION_SLUGS)[number];

/**
 * ONE screen carries no artwork and never will: the parse demo (v3 screen 4)
 * gives its whole page to the line being typed and the record made of it, and
 * the design draws no character on it. It still holds a manifest entry so the
 * manifest is TOTAL over the flow — a missing key can then only ever mean a
 * mistake.
 */
export const SLUGS_WITHOUT_ARTWORK: readonly OnboardingSlug[] = ['demo'];

export interface IllustrationLayout {
  /** Multiplier on the `contain` fit. 1 = the artwork as the band fits it. */
  scale: number;
  /** Optical nudge in points; positive = right. */
  offsetX: number;
  /** Optical nudge in points; positive = down. */
  offsetY: number;
}

/** The band the scales above were derived against: page column ÷ band height on
 * the reference device. Kept next to the numbers it explains. */
export const REFERENCE_BAND_ASPECT = 1.12;

/** Nothing in the manifest may leave this range — a value outside it is a sign
 * the asset itself is wrong (mis-exported, untrimmed) and wants re-exporting,
 * not a bigger number here. Enforced by `illustration-layout.test.ts`. */
export const MIN_SCALE = 0.5;
export const MAX_SCALE = 1.5;

/**
 * The hard ceiling on top of `MAX_SCALE`: the point where an asset that
 * already fills the text column reaches the edge of the GLASS.
 *
 * `contain` fits the artwork to the column (window − 2 × 24 pt of page
 * padding), so a scale of `window / column` puts its edges exactly on the
 * screen. That ratio is worst — smallest — on the widest phone:
 *
 *     iPhone SE  375 / 327 = 1.147
 *     iPhone 15  393 / 345 = 1.139
 *     Pro Max    430 / 382 = 1.126   ← the binding one
 *
 * The 14 Aug clipping shipped because the cap was taken from the middle device
 * instead of this one. An illustration may bleed into the margin the text keeps
 * — it may never leave the screen.
 */
export const MAX_SAFE_SCALE = 1.12;

const NEUTRAL: IllustrationLayout = { scale: 1, offsetX: 0, offsetY: 0 };

/**
 * slug → placement. `Record` and not `Partial<Record>` on purpose: the compiler
 * refuses an incomplete manifest.
 */
export const ILLUSTRATION_LAYOUT: Record<IllustrationSlug, IllustrationLayout> = {
  welcome: NEUTRAL,
  tracker: NEUTRAL,
  obstacles: NEUTRAL,
  // No artwork at all: the parse demo IS the picture on that screen.
  demo: NEUTRAL,
  'why-written': NEUTRAL,
  goal: NEUTRAL,
  // 880x703 (1.25) — wider than the band, so `contain` leaves it ~10 % shorter
  // than the figure on the screen before it. Left alone: see the note above.
  experience: NEUTRAL,
  'about-you': NEUTRAL,
  days: NEUTRAL,
  // 880x660 (1.33) — the widest drawing in the set, and the one whose plates
  // were cut off flat by both screen edges at 1.14 on a Pro Max.
  'key-lifts': NEUTRAL,
  overload: NEUTRAL,
  commitment: NEUTRAL,
  recap: NEUTRAL,
  projection: NEUTRAL,
  paywall: NEUTRAL,
};

/** Placement for a slug; an unknown one is drawn as-is rather than not at all. */
export function layoutFor(slug: string): IllustrationLayout {
  return ILLUSTRATION_LAYOUT[slug as IllustrationSlug] ?? NEUTRAL;
}

/**
 * Does this screen have artwork at all?
 *
 * The three typographic screens answer NO, and that answer has to be readable
 * from code rather than only from the comment above: until 14 Aug 2026 the slot
 * drew its faint "asset missing" placeholder on them, so `building` and
 * `founder-note` each shipped a large empty box with their own slug printed in
 * the middle of it. The box is for an illustration that has not landed YET; a
 * screen that will never have one must reserve nothing at all.
 *
 * An unknown slug answers YES, so a genuinely missing asset still shows the
 * placeholder that says so.
 */
export function hasArtwork(slug: string): boolean {
  return !SLUGS_WITHOUT_ARTWORK.includes(slug as OnboardingSlug);
}
