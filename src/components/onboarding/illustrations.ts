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
 */
export type Illustration =
  | { kind: 'image'; source: ImageSourcePropType }
  | { kind: 'lottie'; source: unknown }
  | { kind: 'video'; source: VideoSource; poster: ImageSourcePropType };

/** slug → asset. Every unlisted slug shows the slot's placeholder until its
 * illustration is dropped in. */
export const ILLUSTRATIONS: Partial<Record<string, Illustration>> = {
  welcome: {
    kind: 'video',
    source: require('../../../assets/onboarding/welcome.mp4'),
    poster: require('../../../assets/onboarding/welcome-poster.png'),
  },
};

export function illustrationFor(slug: string): Illustration | null {
  return ILLUSTRATIONS[slug] ?? null;
}
