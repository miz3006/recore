import Svg, { Path } from 'react-native-svg';

/**
 * THE CHECK MARK.
 *
 * `components/icon.tsx` has no check, and v2 may not reach into the existing
 * onboarding for one, so it draws its own — a single stroked path, the same
 * glyph on a selected row, a finished checklist line and the commitment ring.
 * One shape, so a check always means the same thing in this flow.
 */
export function Check({ size = 14, color, strokeWidth = 2.5 }: { size?: number; color: string; strokeWidth?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M4.5 12.5 L9.5 17.5 L19.5 6.5"
        stroke={color}
        strokeWidth={strokeWidth * (24 / 14)}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}
