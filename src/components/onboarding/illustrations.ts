import type { VideoSource } from 'expo-video';
import type { ImageSourcePropType } from 'react-native';

import type { IllustrationSlug } from './illustration-layout';

export {
  ILLUSTRATION_LAYOUT,
  ILLUSTRATION_SLUGS,
  ONBOARDING_SLUGS,
  layoutFor,
  type IllustrationLayout,
  type IllustrationSlug,
  type OnboardingSlug,
} from './illustration-layout';

/**
 * The ONE registry that maps an onboarding screen slug to its illustration
 * asset. Screens never reference assets directly — they render
 * `<IllustrationSlot slug="…" />` and the slot looks the slug up here.
 *
 * A slug with no entry renders the slot's placeholder (hairline box with the
 * slug in the reading face), so the flow ships before any asset exists and each
 * illustration lands later by adding ONE line here — no screen files change.
 *
 * **EXPORT ON TRANSPARENCY, NOT ON A BACKGROUND.** Since 12 Aug 2026 the slot
 * draws its asset straight onto the paper canvas — no card, no border, no tint,
 * no rounded clip — and fits it with `contain`. An asset baked onto its own
 * off-white rectangle will show that rectangle as a seam against `color.bg`.
 * Transparent PNG at 3× (or a Lottie) is the shape that belongs here.
 *
 * ## The manifest is two files
 *
 * This one holds the ASSETS, and `illustration-layout.ts` holds the NUMBERS —
 * per-slug `scale` and `offsetX/offsetY`, plus the flow's slug list they are
 * keyed by. They are split because that file has no imports and therefore runs
 * under `node --test`, which is what makes "every screen has an entry" an
 * executable check instead of a comment. Adding an illustration is still one
 * line here; adjusting how it sits in the band is one line there.
 *
 * `video` and `lottie` stay declared so an animated asset needs no type change
 * when it arrives — but since §A.1 (13 Aug 2026) the slot renders a `video`
 * entry's POSTER and never plays it: onboarding illustrations do not move.
 * Export one still from any clip that lands here.
 *
 * ## The set, 13 August 2026
 *
 * The owner's nineteen drawings (`assets/new_onboarding/`, one per screen of
 * the Claude Design canvas) arrived as 1024² frames with the generator's
 * transparency CHECKERBOARD flattened into the pixels — opaque files that would
 * have shown a grey grid against the paper. The alpha was rebuilt from that
 * pattern, each drawing trimmed to its own bounding box so `contain` fills the
 * band instead of fitting empty margin, and the result written here at 880 px
 * on the long edge (the band is ~304 pt, so 3× has room to spare).
 *
 * ## The v3 import, 18 August 2026
 *
 * The flow is now the design's fourteen screens, and their slugs are new. The
 * owner's nineteen drawings are unchanged — this file re-points the surviving
 * slugs at the drawings that still fit their screen, and the five that no
 * longer have a screen (`demo`, `gender`, `bodyweight`, `rest-timer`,
 * `social-proof`) stay in `assets/onboarding/` unreferenced rather than being
 * deleted, so a screen the owner puts back finds its picture waiting.
 *
 * ONE screen carries no illustration: the parse demo is typographic by design —
 * the line being typed and the record made of it ARE the picture.
 */
export type Illustration =
  | { kind: 'image'; source: ImageSourcePropType }
  | { kind: 'lottie'; source: unknown }
  | { kind: 'video'; source: VideoSource; poster: ImageSourcePropType };

/** slug → asset. Every unlisted slug shows the slot's placeholder until its
 * illustration is dropped in. */
export const ILLUSTRATIONS: Partial<Record<IllustrationSlug, Illustration>> = {
  welcome: { kind: 'image', source: require('../../../assets/onboarding/welcome.png') },
  tracker: { kind: 'image', source: require('../../../assets/onboarding/tracker.png') },
  obstacles: { kind: 'image', source: require('../../../assets/onboarding/style.png') },
  // `demo` is deliberately absent — v3 screen 4 draws no character (see
  // `SLUGS_WITHOUT_ARTWORK`), so the slot renders nothing rather than a
  // placeholder box.
  'why-written': {
    kind: 'image',
    source: require('../../../assets/onboarding/why-tracking.png'),
  },
  goal: { kind: 'image', source: require('../../../assets/onboarding/goal.png') },
  experience: { kind: 'image', source: require('../../../assets/onboarding/experience.png') },
  'about-you': { kind: 'image', source: require('../../../assets/onboarding/name.png') },
  days: { kind: 'image', source: require('../../../assets/onboarding/days.png') },
  'key-lifts': { kind: 'image', source: require('../../../assets/onboarding/key-lift.png') },
  overload: { kind: 'image', source: require('../../../assets/onboarding/overload.png') },
  commitment: { kind: 'image', source: require('../../../assets/onboarding/commitment.png') },
  recap: { kind: 'image', source: require('../../../assets/onboarding/notifications.png') },
  projection: { kind: 'image', source: require('../../../assets/onboarding/summary.png') },
  // Not a step of `STEPS` — the paywall is its own route, and it reads this
  // registry by the same slug so the flow's last screen keeps the same mascot.
  paywall: { kind: 'image', source: require('../../../assets/onboarding/paywall.png') },
};

export function illustrationFor(slug: string): Illustration | null {
  return ILLUSTRATIONS[slug as IllustrationSlug] ?? null;
}
