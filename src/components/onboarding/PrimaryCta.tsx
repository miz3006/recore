import {
  ActivityIndicator,
  StyleSheet,
  Text,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useAnimatedStyle } from 'react-native-reanimated';

import { PressableScale } from '@/components/motion';
import {
  color,
  CTA_HEIGHT,
  lineFor,
  MAX_FONT_SCALE,
  radius,
  shadow,
  spacing,
  type,
} from '@/lib/theme';

import { useSelectFill } from './use-select-fill';

/**
 * The funnel's primary button: full-width, fully rounded, filled brand blue, a
 * white label, and the brand glow underneath it.
 *
 * It is the same object as `AppButton`'s primary now — v6 made the app-wide
 * primary a filled brand pill with `shadow.glow` at `CTA_HEIGHT` (skill
 * §Decided-1/3), which is what this control already was. What it still owns
 * that `AppButton` does not is the pill radius and the WAKING-UP animation
 * below; the fill, the glow, the height and the label are the theme's.
 *
 * **The label is 17 pt at 600, and that changed with the blue** (20 Aug 2026).
 * It was 700 because white on `#007AFF` measured **3.4:1** — under the 4.5:1 a
 * body-weight label owes, so the weight had to push it into WCAG's large-text
 * class to be legal at all. White on Volt `#0B5CD6` measures **5.97:1**, which
 * clears the body-text rule outright, so the label is set at the app's own
 * headline weight instead of at a weight contrast was forcing on it. **Do not
 * lighten the fill** — that is what the 5.97 is bought with.
 *
 * The glow is `shadow.glow` — the one coloured shadow in the app, and the
 * reason the CTA reads as the live thing on an otherwise paper screen. It is
 * the theme's token rather than a hand-rolled `Platform.select` here, so the
 * funnel's CTA and every other primary button cast the same light. Press dips
 * to 0.97 on the shared 120 ms curve.
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
    backgroundColor: color.brand,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    ...shadow.glow,
  },
  ctaPressed: {
    backgroundColor: color.brandPressed,
  },
  label: {
    fontSize: type.headline.fontSize,
    lineHeight: lineFor(22),
    // 600, the app's headline weight. It was 700 only because #007AFF's 3.4:1
    // needed the large-text class; Volt's 5.97:1 does not. See the note above.
    fontWeight: '600',
    letterSpacing: -0.2,
    color: color.onInk,
  },
});
