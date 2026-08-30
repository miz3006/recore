import { type ReactNode, useCallback } from 'react';
import { Pressable, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { selection as selectionHaptic, tap } from '@/lib/haptics';

import { press } from './springs';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Spec §3, "Option rows": "Press → scale 0.97 + `impactLight`". */
export const PRESS_SCALE = 0.97;

/**
 * EVERY TAPPABLE SURFACE IN THE v2 FLOW.
 *
 * Press in → 0.97 on a spring plus a haptic; release → spring back with a
 * small bounce, which is the part that makes it read as physical. The haptic
 * fires on press-IN, not on the action, so the feedback beats the render.
 *
 * `haptic` picks which one: `selection` is the dry picker click for choosing
 * among options, `impact` is the firmer tick for committing (a Continue, a
 * hold). `none` is for a surface that is pressable but whose feedback belongs
 * to something else on screen.
 *
 * REDUCE MOTION: the scale is dropped entirely; the haptic stays. Spec §3,
 * "Restraint": "everything degrades to a cross-fade, haptics stay" — a person
 * who has turned motion off has not turned touch off, and taking the tick away
 * would leave the only remaining confirmation of a tap on the screen.
 */
export function PressScale({
  onPress,
  disabled = false,
  haptic = 'selection',
  scaleTo = PRESS_SCALE,
  style,
  accessibilityRole = 'button',
  accessibilityLabel,
  accessibilityState,
  accessibilityHint,
  testID,
  children,
}: {
  onPress?: () => void;
  disabled?: boolean;
  haptic?: 'selection' | 'impact' | 'none';
  scaleTo?: number;
  style?: StyleProp<ViewStyle>;
  accessibilityRole?: 'button' | 'radio' | 'checkbox' | 'link';
  accessibilityLabel?: string;
  accessibilityState?: { selected?: boolean; disabled?: boolean; checked?: boolean };
  accessibilityHint?: string;
  testID?: string;
  children: ReactNode;
}) {
  const reduced = useReducedMotion();
  const scale = useSharedValue(1);

  const onPressIn = useCallback(() => {
    if (disabled) return;
    if (haptic === 'selection') selectionHaptic();
    else if (haptic === 'impact') tap();
    if (!reduced) scale.value = withSpring(scaleTo, press);
  }, [disabled, haptic, reduced, scale, scaleTo]);

  const onPressOut = useCallback(() => {
    if (!reduced) scale.value = withSpring(1, press);
  }, [reduced, scale]);

  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <AnimatedPressable
      onPress={disabled ? undefined : onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      disabled={disabled}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled, ...accessibilityState }}
      accessibilityHint={accessibilityHint}
      testID={testID}
      style={[style, animated]}>
      {children}
    </AnimatedPressable>
  );
}
