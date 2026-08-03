import { useEffect, useRef, type ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import type { Rect } from '@/lib/tour';

/**
 * Where the spotlight tour finds what it points at. A surface wraps the element
 * in `<TourTarget id>`; the tour measures it in window coordinates when it
 * opens. The registry is a module-level map like `noteInputRef` (note-focus.ts)
 * — no context, no re-renders. A target that is not mounted measures to null,
 * and the tour drops that step rather than spotlighting nothing.
 */
export type TourTargetId = 'dayPill';

const nodes = new Map<TourTargetId, View>();

export function TourTarget({
  id,
  children,
  style,
}: {
  id: TourTargetId;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const ref = useRef<View>(null);

  useEffect(() => {
    const node = ref.current;
    if (node) nodes.set(id, node);
    return () => {
      if (nodes.get(id) === node) nodes.delete(id);
    };
  }, [id]);

  // collapsable={false}: Android flattens plain Views away, and a flattened
  // view has nothing to measure.
  return (
    <View ref={ref} collapsable={false} style={style}>
      {children}
    </View>
  );
}

export function measureTourTarget(id: TourTargetId): Promise<Rect | null> {
  const node = nodes.get(id);
  if (!node) return Promise.resolve(null);
  return new Promise((resolve) => {
    node.measureInWindow((x, y, w, h) => {
      resolve(w > 0 && h > 0 ? { x, y, w, h } : null);
    });
  });
}
