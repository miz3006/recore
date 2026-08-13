import { useEffect } from 'react';
import {
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { DUR, EASE } from '@/lib/motion';

/**
 * Selection progress for the onboarding controls: 0 = idle, 1 = selected,
 * animated over ~160 ms so the ink fill SWEEPS in instead of snapping — one
 * shared feel across option rows, day circles, the kg/lb toggle and the
 * suggestion chips. Callers interpolate colors (and whatever else) off the
 * returned value. Reduce Motion resolves instantly.
 */
export function useSelectFill(selected: boolean): SharedValue<number> {
  const reduce = useReducedMotion();
  const p = useSharedValue(selected ? 1 : 0);

  useEffect(() => {
    const target = selected ? 1 : 0;
    p.value = reduce ? target : withTiming(target, { duration: DUR.fast, easing: EASE.standard });
  }, [selected, reduce, p]);

  return p;
}
