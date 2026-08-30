import type { ImageSourcePropType } from 'react-native';

import type { CharacterArt } from './characters';

/**
 * THE DRAWINGS.
 *
 * The owner's cap character, from `assets/new_onboarding/`. Those files are
 * shared assets, not code — v2 reads them directly rather than importing the
 * existing flow's registry, so deleting `src/components/onboarding/` leaves
 * this standing (§0, isolation).
 *
 * Four poses, one character, one drawing medium. §4: "One consistent entrance …
 * so it reads as the same character arriving, not a different asset loading."
 *
 * ## THEY ARE CUT OUT NOW (owner, 28 August 2026)
 *
 * The originals are 1024×1024 with **no alpha channel**: what looked like
 * transparency was a checkerboard PAINTED INTO the picture, so on the warm
 * paper canvas the character arrived inside a grey tiled box. `cutout/` holds
 * the same drawings with that background keyed out — the outer field and the
 * enclosed gaps (between the legs, under the bag strap), which a flood from the
 * edge never reaches and which are identified by carrying both checker tones
 * where the character's own whites carry one.
 *
 * They are also TRIMMED to the drawing, which is the other half of "big enough
 * to see": a square canvas that is 78 % empty makes `contentFit: contain` fit
 * the emptiness. With the art tight, the height below is the character's real
 * height on the glass, and `aspect` is what keeps it undistorted.
 *
 * The originals are untouched and still on disk, and the cut is reproducible:
 * `python3 scripts/cutout-character-art.py` redoes all nineteen poses.
 */
export interface CharacterDrawing {
  source: ImageSourcePropType;
  /** width ÷ height of the trimmed drawing. The component sizes by HEIGHT. */
  aspect: number;
}

export const ART: Readonly<Record<CharacterArt, CharacterDrawing>> = {
  /** Walking in with the bag — the flow's first frame. */
  arriving: {
    source: require('../../../assets/new_onboarding/cutout/01_welcome.png'),
    aspect: 552 / 900,
  },
  /** Looking up, hand on the locker — the screen that says the person's name. */
  greeting: {
    source: require('../../../assets/new_onboarding/cutout/03_name.png'),
    aspect: 603 / 900,
  },
  /** Working — the building screen's ring. */
  building: {
    source: require('../../../assets/new_onboarding/cutout/14_overload.png'),
    aspect: 390 / 900,
  },
  /** Tying a lace: about to start. */
  committing: {
    source: require('../../../assets/new_onboarding/cutout/15_commitment.png'),
    aspect: 724 / 739,
  },
};
