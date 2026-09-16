import { type ReactNode, useEffect } from 'react';
import { type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { character, REDUCED_FADE_MS } from '@/lib/motion/index';

/**
 * A HERO ARRIVING — the drawn phone's entrance on screens 1 and 20 (owner,
 * 16 September 2026: *"naredi animacijo da se telefon pokaze"*).
 *
 * Bigger travel than `Enter`'s 14 pt because these are the two screens where
 * something the size of half the display takes the stage: it rises 44 pt and
 * settles from 0.94 on the character spring — the flow's one "something has
 * arrived" voice — so the phone lands with presence and everything after it
 * (typing, the sliding banner) reads as happening ON a thing that is already
 * there. Reduce Motion: a cross-fade in place, nothing travels.
 */
export function RiseIn({
  delay = 0,
  style,
  children,
}: {
  delay?: number;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const reduced = useReducedMotion();
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      delay,
      reduced ? withTiming(1, { duration: REDUCED_FADE_MS }) : withSpring(1, character),
    );
  }, [delay, progress, reduced]);

  const travel = reduced ? 0 : 44;
  const animated = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [
      { translateY: (1 - progress.value) * travel },
      { scale: reduced ? 1 : 0.94 + progress.value * 0.06 },
    ],
  }));

  return <Animated.View style={[style, animated]}>{children}</Animated.View>;
}
