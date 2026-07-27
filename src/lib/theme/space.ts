import { StyleSheet } from 'react-native';

import { moderateScale } from './scale';

/**
 * Space (CLAUDE.md §6.6). A 4pt base, and **only these eleven values exist.**
 *
 * The point of a closed scale is not tidiness, it is that a long scroll reads as
 * organised without anyone deciding anything: if every gap in the app is one of
 * eleven numbers, rhythm happens by construction. A 14 or an 18 anywhere is the
 * beginning of the end of that, which is why 1.4 makes a raw spacing number a
 * build failure outside this directory.
 *
 * Deliberately NOT run through `moderateScale`. Type scales with the device
 * because glyphs must stay readable; space does not, because a 16pt margin is
 * 16pt on every iPhone Apple ships. Scaling both would make small screens feel
 * merely zoomed-out rather than tighter.
 */
export const space = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  7: 32,
  8: 40,
  9: 56,
  10: 72,
} as const;

/**
 * The same eleven values under the names the codebase already speaks. Not a
 * second scale — every value here IS a `space` rung, and that is enforced by
 * construction below rather than by anyone remembering.
 *
 * §6.6's own guidance in these terms: screen padding and card padding are `lg`,
 * cards within a session sit `md` apart, sections `xxxl`, and a section header
 * takes `space[8]` above — sections need more air above than below, and that
 * asymmetry is what makes a long scroll feel composed.
 */
export const spacing = {
  xs: space[1],
  sm: space[2],
  md: space[3],
  lg: space[4],
  xl: space[5],
  xxl: space[6],
  xxxl: space[7],
} as const;

/** 0.5px where the device allows it — the crispest line the screen can draw. */
export const hairline = StyleSheet.hairlineWidth;

/**
 * The minimum touch target, always, everywhere — including the inline steppers
 * and every control whose *visual* size is smaller (§6.6, §17). A lifter
 * mid-set has sweat on the screen and a shaking hand.
 */
export const HIT = 44;

/** §6.7's primary CTA: a 52pt capsule. One height for every primary control. */
export const CONTROL_HEIGHT = moderateScale(52);

/** Round toolbar-button diameter; scales down so four still fit on an SE. */
export const ROUND_BUTTON = moderateScale(40);

export type SpaceStep = keyof typeof space;
export type SpacingToken = keyof typeof spacing;
