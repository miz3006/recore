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
 * shared feel across option rows, day circles and the suggestion chips.
 * Callers interpolate colours, opacity, scale and whatever else off the single
 * returned value, so every part of a control moves as one thing.
 *
 * It is a TIMING curve, not a spring, and that is the reason it can be shared:
 * a selection is a two-state flip with no finger travel behind it, so there is
 * no velocity to carry and nothing that should overshoot. 160 ms is the
 * small-state-change band — long enough to read as a transition, short enough
 * that a person changing their mind three times never waits on it.
 *
 * Reduce Motion resolves instantly.
 */
export function useSelectFill(selected: boolean): SharedValue<number> {
  const reduce = useReducedMotion();
  const p = useSharedValue(selected ? 1 : 0);

  useEffect(() => {
    const target = selected ? 1 : 0;
    p.set(reduce ? target : withTiming(target, { duration: DUR.fast, easing: EASE.standard }));
  }, [selected, reduce, p]);

  return p;
}
