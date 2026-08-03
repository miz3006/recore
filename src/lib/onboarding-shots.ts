import type { ImageSourcePropType } from 'react-native';

/**
 * The three real screenshots the onboarding shows inside a `DeviceFrame`
 * (owner, 28 July). One file, so a stale picture has exactly one place to be
 * found and replaced.
 *
 * **They are `null` until someone captures them, and that is a working state,
 * not a bug**: `DeviceFrame` renders the screen's live composition whenever a
 * shot is missing, so the funnel is complete and the bundle builds with no
 * assets committed. Dropping the files in turns the pictures on; nothing else
 * changes.
 *
 * ── How to add them ──────────────────────────────────────────────────────────
 *
 *     npm run shots                 # which of the three exist, and their sizes
 *     npm run shots -- compose --delay 8
 *
 * `scripts/capture-shots.ts` owns every mechanical step: it boots an iOS 26
 * iPhone (the runtime whose tab bar is the Liquid Glass one the app actually
 * ships — an iOS 18 capture shows a bar the product does not have), waits out
 * the delay while you navigate, writes `assets/onboarding/<name>.png`, checks
 * the ratio against `DeviceFrame`'s own constant, and flips the `require` below
 * from `null` to the file. Rerunning it on a captured shot just recaptures.
 *
 * WHAT IT CANNOT DO is the only part that matters: it does not know what is on
 * the screen. **The two rules under "the capture itself" are yours**, and the
 * app has to be in the state named in the table above before the shutter.
 *
 * Getting to a state worth capturing needs a signed-in account with real
 * history — `parse-workout` is JWT-gated, so there is no no-account path. The
 * fast route is the repo's own `seed-strong.csv`: sign in, then You → Import,
 * which lands structure directly with no parse call (§13) and gives the
 * predictor enough to draw a real briefing for the `plan` shot.
 *
 * By hand, if you would rather: capture with ⌘S in the Simulator, save under
 * `assets/onboarding/<name>.png`, and uncomment the matching `require`.
 *
 * ── What to capture ──────────────────────────────────────────────────────────
 *
 * | key       | the screen                                                      |
 * |-----------|-----------------------------------------------------------------|
 * | `compose` | Today, mid-session: three or four settled cards, the readings on |
 * |           | the right, the keyboard up so the accessory bar is in frame.     |
 * |           | The frame is anchored to the BOTTOM of this one.                 |
 * | `plan`    | Next, with a real briefing: the planned values in green. This is |
 * |           | the one picture that carries the app's only hue.                 |
 * | `ready`   | A finished session — the receipt, with its counted totals.       |
 *
 * ── Two rules for the capture itself ─────────────────────────────────────────
 *
 * - **A real session, never a staged fiction.** These sit next to a paywall
 *   whose fabricated proof was deleted on 28 July (CLAUDE.md §12.1). Numbers in
 *   a picture are a claim like any other.
 * - **Nothing personal in frame** — no real email, no name that is not the
 *   owner's, and check the status bar before shipping it.
 *
 * Recapture whenever the screen in the picture is redesigned. A screenshot of a
 * screen that no longer exists is the staleness §0.3 exists to prevent, and it
 * is the known cost of this approach.
 */
export type OnboardingShot = 'compose' | 'plan' | 'ready';

export const SHOTS: Record<OnboardingShot, ImageSourcePropType | null> = {
  // compose: require('../../assets/onboarding/compose.png'),
  compose: null,
  // plan: require('../../assets/onboarding/plan.png'),
  plan: null,
  // ready: require('../../assets/onboarding/ready.png'),
  ready: null,
};
