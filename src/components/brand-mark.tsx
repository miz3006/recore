import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

/**
 * THE RECORE MARK — the same R that fills the app icon, drawn in one ink.
 *
 * ## Why the path is inline rather than an imported `.svg`
 *
 * `metro.config.js` wraps Expo's default config for Sentry and adds nothing
 * else, so there is no `react-native-svg-transformer` and `import Mark from
 * './mark.svg'` resolves to a string, not a component. `react-native-svg` IS
 * installed, so the working route is the one `onboarding-v2/BrandIcon.tsx`
 * already takes: the path data lives in the component and the renderer is the
 * same one that draws the charts.
 *
 * The export it came from is kept at `assets/brand/mark.svg` — unchanged, so a
 * future re-export diffs against the real thing rather than against this file.
 * One edit was made on the way in: Figma wrote the second coordinate of the
 * opening curve as `8.2466e-06`, and exponent notation is the corner of path
 * syntax most likely to differ between parsers. It is zero to within a
 * hundred-millionth of the mark's height, so it is written as `0`.
 *
 * ## It is not square, and must not be forced into a square
 *
 * The mark is 495 × 594 — the descending leg makes it taller than it is wide.
 * `size` is therefore its HEIGHT, and the width follows from the aspect. Fit it
 * to a square box and the R squashes.
 *
 * ## `tint` is required
 *
 * The export bakes in `#171914`, which is `color.textPrimary`. Baking it here
 * would make the mark invisible the first time it sits on a filled blue row,
 * exactly as `BrandIcon` found. The caller names the ink.
 */

/** The mark's own canvas, from `assets/brand/mark.svg`. */
const VIEW_WIDTH = 495;
const VIEW_HEIGHT = 594;

/** Width per unit of height. Exported so a caller can reserve the slot. */
export const MARK_ASPECT = VIEW_WIDTH / VIEW_HEIGHT;

const MARK_PATH =
  'M168.277 0C261.214 0 336.555 75.3403 336.555 168.277C336.555 222.851 310.574 271.355 270.309 302.102L481.013 512.806C499.568 531.361 499.568 561.445 481.013 580C462.457 598.555 432.374 598.555 413.818 580L170.359 336.541C169.666 336.549 168.972 336.555 168.277 336.555C142.022 336.555 117.172 330.54 95.0273 319.816V546.406C95.0273 572.647 73.7547 593.92 47.5137 593.92C21.2726 593.92 0 572.647 0 546.406V168.277C0 75.3403 75.3403 0 168.277 0ZM168.277 100.967C131.103 100.967 100.967 131.103 100.967 168.277C100.967 205.452 131.103 235.588 168.277 235.588C205.452 235.588 235.588 205.452 235.588 168.277C235.588 131.103 205.452 100.967 168.277 100.967Z';

export function BrandMark({
  /** The mark's HEIGHT in points. Width follows from `MARK_ASPECT`. */
  size = 24,
  tint,
  /**
   * What VoiceOver reads. The mark usually STANDS IN for the word, so it says
   * it. `null` where the word is already printed beside it — two "Recore"s in
   * a row is a lockup read twice, so the mark steps out of the tree.
   */
  label = 'Recore',
}: {
  size?: number;
  tint: string;
  label?: string | null;
}) {
  const a11y =
    label === null
      ? ({ accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' } as const)
      : ({ accessible: true, accessibilityRole: 'image', accessibilityLabel: label } as const);

  return (
    <View {...a11y}>
      <Svg width={size * MARK_ASPECT} height={size} viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}>
        <Path fillRule="evenodd" clipRule="evenodd" d={MARK_PATH} fill={tint} />
      </Svg>
    </View>
  );
}
