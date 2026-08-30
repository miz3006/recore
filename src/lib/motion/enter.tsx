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

import { arrive, REDUCED_FADE_MS, stagger } from './springs';

/**
 * CONTENT ARRIVING — the one entrance in the v2 flow.
 *
 * Everything that appears when a screen mounts comes in through this: headline,
 * subline, every option row, every card. Screens never write their own
 * entrance (spec §5.2: "every screen on those primitives, no bespoke per-screen
 * animation"), so the whole flow assembles itself with one hand.
 *
 * `index` is the stagger position, not a delay in ms — the cadence lives in
 * `springs.ts` and changing it there changes it everywhere.
 *
 * REDUCE MOTION: the rise is dropped and the element cross-fades in place. It
 * still fades rather than snapping, because a fade carries no direction and
 * therefore no vestibular cost; what is banned is travel.
 */
export function Enter({
  index = 0,
  from = 14,
  extraDelay = 0,
  style,
  children,
}: {
  index?: number;
  /** How far below its final position the element starts, in points. */
  from?: number;
  /** Milliseconds added on top of the stagger — for content that waits on
   * something else finishing (a chart drawing, a name resolving). */
  extraDelay?: number;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const reduced = useReducedMotion();
  const progress = useSharedValue(0);
  const delay = stagger(index) + extraDelay;

  useEffect(() => {
    progress.value = withDelay(
      delay,
      reduced ? withTiming(1, { duration: REDUCED_FADE_MS }) : withSpring(1, arrive),
    );
  }, [delay, progress, reduced]);

  const travel = reduced ? 0 : from;
  const animated = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * travel }],
  }));

  return <Animated.View style={[style, animated]}>{children}</Animated.View>;
}

/**
 * The same arrival, but for something that appears LATER in the life of a
 * screen rather than on mount — a reading resolving under a raw line, a
 * projection appearing once its inputs exist. Driven by `visible` instead of by
 * mount, so it can also leave.
 */
export function EnterWhen({
  visible,
  index = 0,
  from = 14,
  style,
  children,
}: {
  visible: boolean;
  index?: number;
  from?: number;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const reduced = useReducedMotion();
  const progress = useSharedValue(visible ? 1 : 0);
  const delay = stagger(index);

  useEffect(() => {
    const to = visible ? 1 : 0;
    progress.value = withDelay(
      visible ? delay : 0,
      reduced ? withTiming(to, { duration: REDUCED_FADE_MS }) : withSpring(to, arrive),
    );
  }, [delay, progress, reduced, visible]);

  const travel = reduced ? 0 : from;
  const animated = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * travel }],
  }));

  return <Animated.View style={[style, animated]}>{children}</Animated.View>;
}
