import { alpha, color, moderateScale } from '@/lib/theme';

/**
 * The onboarding surface's own tokens — the mascot-led restyle (owner's spec,
 * 12 Aug 2026).
 *
 * ONE accent. Recore blue is THE onboarding colour and it does every job the
 * reference app gave its purple: the filled primary CTA, the progress fill, a
 * selected option's border and check, an emphasised value, a text link. Nothing
 * else on these screens is coloured — no second hue, no emoji, no green (the
 * paywall's billing line is the single, named exception). Everything that is
 * not blue is ink on warm paper.
 *
 * This is inside product-direction §4.2: "Recore blue may be used for selected
 * onboarding choices, interactive focus, active controls." It is an accent, not
 * a reward.
 *
 * The ink washes are the reference's soft-card language recoloured: a card is
 * ink at 3 %, a chrome circle ink at 6 %, an empty track ink at 10 %. They are
 * named here rather than spelled at each call site so the whole flow shifts
 * together if the owner wants them lighter.
 */

/** Recore blue (#007AFF) — the one accent of the flow. */
export const BLUE = color.trained;

/** Soft card fill: option rows, the value card, the founder photo disc. */
export const INK_CARD = alpha(color.accent, 0.03);
/** Chrome circle: the back button. */
export const INK_CHROME = alpha(color.accent, 0.06);
/** Empty track: the progress bar, the idle switch. */
export const INK_TRACK = alpha(color.accent, 0.1);

/**
 * Radii, from the Claude Design canvas (13 Aug 2026 import). Three values and
 * no others: rows and fields take 20, the value card 24, controls and chips are
 * pills.
 */
export const CARD_RADIUS = 24;
export const ROW_RADIUS = 20;

/**
 * The CTA's own height. `CONTROL_HEIGHT` is the app's 50 pt button and stays
 * that everywhere else; the funnel's button is the design's 56 and is the one
 * control on these screens, so it is allowed to be the bigger thing.
 */
export const CTA_HEIGHT = moderateScale(56);

/** Selected-state border. Constant width, animated colour: a border that grows
 * would move the label under it, and product-direction §4.3 bans animating a
 * layout property. Unselected draws it in the card's own fill, so the row reads
 * as a plain soft card until it is chosen. */
export const SELECT_BORDER = 2;

/** Entrance stagger: each zone lands ~60 ms after the one above it. */
export const STAGGER_MS = 60;
/** Fade duration and rise distance of one staggered zone. */
export const ENTER_MS = 250;
export const RISE_PX = 12;
/**
 * How far a zone travels sideways on arrival. Deliberately short: this is the
 * tail of the page's own slide, not a second slide of its own, and a long throw
 * would read as two screens moving past each other.
 */
export const SLIDE_PX = 20;

/** Fixed stagger slots, so a screen with no subtext still starts its content on
 * the same beat as one that has it — the flow's rhythm must not depend on which
 * strings a step happens to carry. */
export const SLOT = {
  illustration: 0,
  eyebrow: 1,
  headline: 1,
  subtext: 2,
  /** First content item; the i-th is `SLOT.content + i`. */
  content: 3,
} as const;

/** Delay of the i-th staggered slot. */
export function slotDelay(slot: number): number {
  return slot * STAGGER_MS;
}

/**
 * The idle loop of the illustration: one full float-and-breathe cycle. Halved
 * for each leg of the sequence.
 */
export const IDLE_CYCLE_MS = 3500;
/** ±3 pt of drift and a 2 % breath — a mascot that is alive, not a bounce. */
export const IDLE_RISE_PX = 3;
export const IDLE_SCALE = 0.02;

/**
 * How tall the illustration zone is, as a share of the window. Derived from the
 * WINDOW ONLY — never from a screen's content — so the mascot, the headline
 * baseline and the CTA sit at exactly the same y on every step of the flow.
 * Short devices give the band less, or the four-option screens would scroll for
 * their whole height.
 */
export function illustrationHeight(windowHeight: number): number {
  const fraction = windowHeight >= 800 ? 0.36 : windowHeight >= 700 ? 0.33 : 0.28;
  return Math.round(windowHeight * fraction);
}

/**
 * The same band with the keyboard up (owner, 12 Aug 2026: "I don't want it to
 * hide"). The mascot STAYS — it just stands smaller, because the keyboard takes
 * roughly 40 % of the screen and the field it raises has to stay above it along
 * with the headline and the button.
 *
 * The slot fits its asset with `contain`, so this is a scale change and never a
 * crop: the whole figure is still on the page. Content-independent like the
 * full height, so the two typed screens shrink to exactly the same band.
 */
export function illustrationHeightCompact(windowHeight: number): number {
  return Math.max(80, Math.round(illustrationHeight(windowHeight) * 0.42));
}

/** The back button's circle — a real 44 pt target with a 40 pt disc. */
export const BACK_DIAMETER = moderateScale(40);
