import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useAnimatedStyle } from 'react-native-reanimated';

import { PressableScale } from '@/components/motion';
import { color, lineFor, MAX_FONT_SCALE, radius, spacing, type } from '@/lib/theme';

import { BLUE, CTA_HEIGHT } from './tokens';
import { useSelectFill } from './use-select-fill';

/**
 * The funnel's primary button: full-width, fully rounded, filled Recore blue,
 * a white label, and a soft blue glow underneath it (owner's restyle, 12 Aug
 * 2026). It is deliberately NOT `AppButton` — that one is the app's ink-filled
 * control and stays ink everywhere else; blue belongs to onboarding and the
 * paywall, which are one continuous surface.
 *
 * **The label is 17 pt at 700 on purpose.** White on #007AFF measures 3.4:1,
 * which clears WCAG's 3:1 floor for LARGE text (≥14 pt bold) but not the 4.5:1
 * body-text rule. At semibold it would be a body-text weight failing that rule;
 * bold puts the label in the large-text class it actually needs to be in. Do
 * not lighten the fill or thin the label back down.
 *
 * The glow is cast in the button's own blue at a whisper — the one coloured
 * shadow in the app, and the reason the CTA reads as the live thing on an
 * otherwise paper screen. Press dips to 0.97 on the shared 120 ms curve.
 *
 * ## The button WAKING UP is animated (19 August 2026)
 *
 * On the three required screens (tracker, goal, experience) Continue is inert
 * until an answer exists, and the moment it becomes live is the most meaningful
 * state change on the page: it is the screen confirming that what you just
 * tapped counted. It was a hard cut from `opacity: 0.4` to 1 — a jump on the
 * one element the eye is about to move to.
 *
 * On the same 160 ms as the row that enabled it, the two read as one event:
 * the answer fills and the button comes up with it.
 *
 * The haptic is LIGHT, not medium. Medium is for something heavy landing or a
 * destructive action; Continue is a page turn, and it happens thirteen times.
 */
export function PrimaryCta({
  label,
  onPress,
  disabled = false,
  loading = false,
  style,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const inactive = disabled || loading;
  const off = useSelectFill(inactive);
  const wakeStyle = useAnimatedStyle(() => ({ opacity: 1 - CTA_DIM * off.get() }));

  return (
    <PressableScale
      onPress={onPress}
      disabled={inactive}
      haptic="light"
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inactive }}
      style={[styles.cta, wakeStyle, style]}
      pressedStyle={styles.ctaPressed}>
      {loading ? (
        <ActivityIndicator color={color.onInk} />
      ) : (
        <Text style={styles.label} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {label}
        </Text>
      )}
    </PressableScale>
  );
}

/** How far an inert Continue drops. It was `opacity: 0.4` as a static style. */
const CTA_DIM = 0.6;

const styles = StyleSheet.create({
  cta: {
    minHeight: CTA_HEIGHT,
    borderRadius: radius.pill,
    backgroundColor: BLUE,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    ...Platform.select({
      ios: {
        shadowColor: BLUE,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.28,
        shadowRadius: 18,
      },
      android: { elevation: 4, shadowColor: BLUE },
      default: {},
    }),
  },
  ctaPressed: {
    backgroundColor: color.ctaFillPressed,
  },
  label: {
    fontSize: type.headline.fontSize,
    lineHeight: lineFor(22),
    // 700, not 600 — see the contrast note above.
    fontWeight: '700',
    letterSpacing: -0.2,
    color: color.onInk,
  },
});
