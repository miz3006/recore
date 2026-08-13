import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { PressableScale } from '@/components/motion';
import { CONTROL_HEIGHT, lineFor, MAX_FONT_SCALE, radius, spacing, type } from '@/lib/theme';

import { BLUE } from './tokens';

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
 * otherwise paper screen. Press dips to 0.97 with the shared spring.
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
  return (
    <PressableScale
      onPress={onPress}
      disabled={inactive}
      haptic="medium"
      activeScale={0.97}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inactive }}
      style={[styles.cta, inactive && styles.ctaOff, style]}
      pressedStyle={styles.ctaPressed}>
      {loading ? (
        <ActivityIndicator color="#FFFFFF" />
      ) : (
        <Text style={styles.label} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {label}
        </Text>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  cta: {
    minHeight: CONTROL_HEIGHT,
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
    backgroundColor: '#0069DB',
  },
  ctaOff: {
    opacity: 0.4,
  },
  label: {
    fontSize: type.headline.fontSize,
    lineHeight: lineFor(22),
    // 700, not 600 — see the contrast note above.
    fontWeight: '700',
    letterSpacing: -0.2,
    color: '#FFFFFF',
  },
});
