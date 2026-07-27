import { StyleSheet } from 'react-native';

import { moderateScale } from './scale';

/**
 * Spacing, radii, and hairline tokens (CLAUDE.md §5).
 *
 * "Generous whitespace; let the blank page breathe. Density is not the goal."
 * Large corner radii on cards (16–20px), pill shapes for controls, hairline
 * 0.5px borders instead of heavy dividers. ALL padding/margins come from this
 * scale — no one-off values on screens (task §2).
 */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 48,
  giant: 64,
} as const;

export const radius = {
  sm: 10,
  md: 14, // buttons
  lg: 18, // cards / sheets (16–20px band)
  xl: 22,
  xxl: 28, // hero surfaces (paywall plans, onboarding cards) — the soft-depth band
  pill: 999, // controls, chips, date pill
} as const;

/** 0.5px where the device allows it; hairlineWidth resolves to the crispest line. */
export const hairline = StyleSheet.hairlineWidth;

/** Standard tap target for round toolbar buttons. */
export const HIT = 44;

/** One consistent height for primary/secondary buttons (task §3). */
export const CONTROL_HEIGHT = moderateScale(50);

/** Round toolbar-button diameter; scales down so four still fit on an SE. */
export const ROUND_BUTTON = moderateScale(40);

export type SpacingToken = keyof typeof spacing;
export type RadiusToken = keyof typeof radius;
