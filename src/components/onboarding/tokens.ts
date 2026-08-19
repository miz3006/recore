import { alpha, color, moderateScale } from '@/lib/theme';

/**
 * The onboarding surface's own tokens — the mascot-led restyle (owner's spec,
 * 12 Aug 2026).
 *
 * ONE accent. Recore blue is THE onboarding colour and it does every job the
 * reference app gave its purple: the filled primary CTA, the progress fill, a
 * selected option's border, wash and check, an emphasised value, a text link,
 * and the three eyebrows the design colours (WHY WE ASKED, YOUR COMMITMENT,
 * YOUR PROJECTION). Nothing else on these screens is coloured — no second hue,
 * no green (the paywall's billing line is the single, named exception).
 *
 * EMOJI are the one exception to "nothing else is coloured", and they are the
 * product authority's own (product-direction §12: "Emoji may appear sparingly
 * as an onboarding choice label when they improve scanning"). Two screens of
 * the v3 flow carry one per option row — the goal and the weekly recap.
 * Nowhere else in the app.
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

/**
 * Soft card fill: option rows, the value cards, the notification preview.
 * Five per cent of ink on white lands on the same grey as the system's grouped
 * canvas (#F2F2F7), which is what the design draws these rows in.
 */
export const INK_CARD = alpha(color.accent, 0.05);
/** Chrome circle: the back button. */
export const INK_CHROME = alpha(color.accent, 0.06);
/** Empty track: the progress bar, the idle switch. */
export const INK_TRACK = alpha(color.accent, 0.1);
/**
 * The EMPTY RING of an unanswered option row. Heavier than `INK_TRACK` because
 * it is a 1.5 pt outline rather than a filled bar, and an outline at 10 % is
 * invisible on a card that is itself 5 %.
 */
export const INK_RING = alpha(color.accent, 0.22);

/**
 * The wash behind a CHOSEN option row — Recore blue at 8 %, which is the
 * lightest tint that still reads as "this one" beside four grey rows without
 * competing with the filled CTA underneath them.
 */
export const BLUE_WASH = alpha(color.trained, 0.08);
/** The commitment screen's stat card, one step lighter than a chosen row. */
export const BLUE_CARD = alpha(color.trained, 0.06);

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

/**
 * Entrance stagger: each zone lands 40 ms after the one above it.
 *
 * It was 60, which is inside the 30–80 ms band that reads as a sequence rather
 * than as one movement — but 60 was chosen when the funnel's step transition
 * was ALSO a JS slide. The step transition is now the native push (350 ms), and
 * the two run together: the page arrives while its contents settle in. At 60 ms
 * a five-option screen was still assembling 320 ms after the push had finished,
 * which reads as the screen loading rather than as the screen arriving.
 */
export const STAGGER_MS = 40;
/** Fade duration and rise distance of one staggered zone. */
export const ENTER_MS = 250;
export const RISE_PX = 12;

/**
 * The stagger stops counting after this many content items.
 *
 * Without a cap the delay is a function of how many options a step happens to
 * carry, so the longest questions — the ones that already ask the most — also
 * make you wait the longest, and the button waits behind all of them. The five
 * real screens of this flow have at most five content items, so the cap costs
 * nothing today; it exists so that adding a sixth option to a step can never
 * again push the primary action past half a second.
 */
export const STAGGER_CAP = 4;

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
 * ## The progress rail's own timing
 *
 * **220 ms, ease-out, no spring.** The bar is on all thirteen answered screens,
 * which is the most-seen animation in the flow, so it is frequency-gated: short
 * enough to be felt rather than watched. It used to spring on `SPRING.snappy`,
 * whose damping ratio is about 0.69 — underdamped, so the fill overshot its new
 * value and settled back. A bar that reports progress must never show a number
 * that is not true, even for 80 ms.
 *
 * **It starts a beat after the push.** Each step is a fresh route, so the bar
 * animating at mount ran underneath the native transition: the outgoing
 * screen's rail slid left while the incoming one's rail advanced, and the one
 * moment in the flow that says "you covered ground" was composited away. The
 * delay lets the page land first. It is short of the 350 ms push on purpose —
 * the bar begins moving as the screen settles, not after a pause.
 */
export const RAIL_MS = 220;
export const RAIL_DELAY_MS = 260;

/**
 * The native push's duration, in the one place both the route and the rail can
 * read it. It is the platform's own transition — configured, never rebuilt in
 * JS — and 350 ms is iOS's push, so the flow moves at the speed of every other
 * app on the device rather than at a speed we invented.
 *
 * Under Reduce Motion the route swaps to a fade at `DUR.base`; a slide is
 * exactly the translation the setting asks to be dropped.
 */
export const PUSH_MS = 350;

/**
 * THE MASCOT DOES NOT MOVE (owner's spec §A, 13 Aug 2026). The float-and-breathe
 * loop that used to live here is gone with its tokens; the only motion left on
 * an onboarding illustration is the flow's one-shot entrance above, and the
 * keyboard transition — whose geometry lives in `band.ts`, along with the band
 * heights that used to be in this file. They moved so `node --test` can run
 * them: this file imports the theme and cannot be loaded outside Metro.
 */

/** The back button's circle — a real 44 pt target with a 40 pt disc. */
export const BACK_DIAMETER = moderateScale(40);
