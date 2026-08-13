import type { VideoSource } from 'expo-video';
import type { ImageSourcePropType } from 'react-native';

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
 * A `video` entry loops silently in the slot (expo-video). Its `poster` is not
 * optional: it is the frame shown while the first video frame decodes, and it
 * is the WHOLE illustration under Reduce Motion, where nothing may loop. Export
 * one square still from the clip whenever a video lands here.
 *
 * `lottie` is declared for the same reason `video` was — so an animated asset
 * needs no type change when it arrives.
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
 * Two screens carry no illustration and never will: `building` and
 * `trial-timeline` are typographic by design — the checklist writing itself and
 * the three trial nodes ARE the picture. `founder-note` has its own portrait.
 */
export type Illustration =
  | { kind: 'image'; source: ImageSourcePropType }
  | { kind: 'lottie'; source: unknown }
  | { kind: 'video'; source: VideoSource; poster: ImageSourcePropType };

/** slug → asset. Every unlisted slug shows the slot's placeholder until its
 * illustration is dropped in. */
export const ILLUSTRATIONS: Partial<Record<string, Illustration>> = {
  welcome: { kind: 'image', source: require('../../../assets/onboarding/welcome.png') },
  demo: { kind: 'image', source: require('../../../assets/onboarding/demo.png') },
  name: { kind: 'image', source: require('../../../assets/onboarding/name.png') },
  gender: { kind: 'image', source: require('../../../assets/onboarding/gender.png') },
  goal: { kind: 'image', source: require('../../../assets/onboarding/goal.png') },
  experience: { kind: 'image', source: require('../../../assets/onboarding/experience.png') },
  tracker: { kind: 'image', source: require('../../../assets/onboarding/tracker.png') },
  'why-tracking': {
    kind: 'image',
    source: require('../../../assets/onboarding/why-tracking.png'),
  },
  style: { kind: 'image', source: require('../../../assets/onboarding/style.png') },
  days: { kind: 'image', source: require('../../../assets/onboarding/days.png') },
  'key-lift': { kind: 'image', source: require('../../../assets/onboarding/key-lift.png') },
  'rest-timer': { kind: 'image', source: require('../../../assets/onboarding/rest-timer.png') },
  bodyweight: { kind: 'image', source: require('../../../assets/onboarding/bodyweight.png') },
  overload: { kind: 'image', source: require('../../../assets/onboarding/overload.png') },
  commitment: { kind: 'image', source: require('../../../assets/onboarding/commitment.png') },
  notifications: {
    kind: 'image',
    source: require('../../../assets/onboarding/notifications.png'),
  },
  summary: { kind: 'image', source: require('../../../assets/onboarding/summary.png') },
  'social-proof': {
    kind: 'image',
    source: require('../../../assets/onboarding/social-proof.png'),
  },
  // Not a step of `STEPS` — the paywall is its own route, and it reads this
  // registry by the same slug so the flow's last screen keeps the same mascot.
  paywall: { kind: 'image', source: require('../../../assets/onboarding/paywall.png') },
};

export function illustrationFor(slug: string): Illustration | null {
  return ILLUSTRATIONS[slug] ?? null;
}
