import Svg, { Path } from 'react-native-svg';

/**
 * THE CHECK MARK, drawn here rather than imported.
 *
 * `components/icon.tsx` has no check, and the two places that already needed
 * one — the v2 onboarding and `app/paywall.tsx` — each drew their own for the
 * same reason. This is the third, and it stays local on purpose: `paywall-v2`
 * borrows the onboarding flow's ARITHMETIC (`copy.ts` reads the reveal's own
 * targets, because two copies of a prescribed load is how a paywall ends up
 * contradicting the screen before it) and none of its chrome. Deleting either
 * directory has to leave the other standing.
 *
 * One shape, so a check means the same thing in the selected plan card and in
 * the "no payment due now" row above the button.
 */
export function Check({
  size = 14,
  tint,
  strokeWidth = 2.5,
}: {
  size?: number;
  tint: string;
  strokeWidth?: number;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M4.5 12.5 L9.5 17.5 L19.5 6.5"
        stroke={tint}
        strokeWidth={strokeWidth * (24 / 14)}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}
