import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { arrive, select } from '@/lib/motion/index';
import { MAX_FONT_SCALE, moderateScale, readingStyle, spacing, type } from '@/lib/theme';

import { Check } from './Check';
import { v2color, v2radius, v2shadow } from './tokens';

/**
 * THE GRID COLLAPSES INTO A LINE — screen 4's demonstration (owner,
 * 16 September 2026: *"a cluttered set/rep input grid (the Strong/Hevy style)
 * collapses into one clean typed line"*).
 *
 * The claim under it ("A session is one line.") is an argument against a
 * whole genre of tracker UI, and this is the argument performed: the familiar
 * grid — a header, SET/KG/REPS columns, a cell per number, an Add Set row —
 * folds in on itself, and the same three sets come back as one written line.
 * The numbers in the cells and the numbers in the line are identical on
 * purpose; the point is not that the grid is wrong, it is that it is MORE.
 *
 * Deliberately unlike screen 1's phone: no frame, no Today chrome, no cards —
 * one prop (the grid) and one line (the product). It loops, on the same
 * owner's directive that made the hero loop; each cycle fades out whole and
 * types back in from nothing.
 *
 * REDUCE MOTION: both states stand still — the grid above, dimmed, the line
 * below it, settled. The comparison is the content, so both are simply there.
 */
const LINE = 'bench 100kg 12, 12, 10';

const ROWS = [
  { set: '1', kg: '100', reps: '12' },
  { set: '2', kg: '100', reps: '12' },
  { set: '3', kg: '100', reps: '10' },
] as const;

const GRID_IN_AT = 350;
const COLLAPSE_AT = 2600;
const COLLAPSE_MS = 480;
const TYPE_AT = 3200;
const CHAR_MS = 44;
const HOLD_MS = 1700;
const FADE_MS = 340;

export function GridCollapse() {
  const reduced = useReducedMotion();
  const [typed, setTyped] = useState(reduced ? LINE : '');
  const [settled, setSettled] = useState(reduced);
  const [cycle, setCycle] = useState(0);
  const gridIn = useSharedValue(reduced ? 1 : 0);
  const collapse = useSharedValue(reduced ? 1 : 0);
  const fade = useSharedValue(1);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    if (reduced) return;
    const scheduled: ReturnType<typeof setTimeout>[] = [];
    timers.current = scheduled;
    const at = (ms: number, fn: () => void) => scheduled.push(setTimeout(fn, ms));

    gridIn.value = withDelay(GRID_IN_AT, withSpring(1, arrive));
    at(COLLAPSE_AT, () => {
      collapse.value = withTiming(1, { duration: COLLAPSE_MS });
    });
    for (let c = 1; c <= LINE.length; c += 1) {
      const text = LINE.slice(0, c);
      at(TYPE_AT + c * CHAR_MS, () => setTyped(text));
    }
    const typedDone = TYPE_AT + LINE.length * CHAR_MS;
    at(typedDone + 260, () => setSettled(true));

    at(typedDone + HOLD_MS, () => {
      fade.value = withTiming(0, { duration: FADE_MS });
    });
    at(typedDone + HOLD_MS + FADE_MS + 40, () => {
      setTyped('');
      setSettled(false);
      gridIn.value = 0;
      collapse.value = 0;
      fade.value = withTiming(1, { duration: FADE_MS });
      setCycle((c) => c + 1);
    });

    return () => {
      scheduled.forEach(clearTimeout);
      timers.current = [];
    };
  }, [collapse, cycle, fade, gridIn, reduced]);

  const whole = useAnimatedStyle(() => ({ opacity: fade.value }));
  const gridStyle = useAnimatedStyle(() => ({
    // All the way to nothing: a ghost of the empty card standing behind the
    // line would keep arguing after the argument is over (simulator pass,
    // 16 Sep 2026 — the 8% remnant read as a rendering fault).
    opacity: gridIn.value * (1 - collapse.value),
    transform: [
      { translateY: (1 - gridIn.value) * 16 + collapse.value * 26 },
      { scale: 1 - collapse.value * 0.12 },
    ],
  }));
  // Each row folds towards the card's middle, so the grid reads as closing
  // rather than as vanishing.
  const row0 = useRowFold(collapse, 26);
  const row1 = useRowFold(collapse, 0);
  const row2 = useRowFold(collapse, -26);
  const lineStyle = useAnimatedStyle(() => ({
    opacity: collapse.value,
    transform: [{ translateY: (1 - collapse.value) * 18 }],
  }));

  return (
    <Animated.View style={[styles.band, whole]} pointerEvents="none">
      <Animated.View style={[styles.grid, v2shadow, gridStyle]}>
        <View style={styles.gridHead}>
          <Text style={styles.gridTitle} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            Bench Press
          </Text>
          <Text style={styles.gridDots} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            ⋯
          </Text>
        </View>
        <View style={styles.cols}>
          <Text style={[styles.colHead, styles.colSet]} maxFontSizeMultiplier={1.2}>SET</Text>
          <Text style={[styles.colHead, styles.colCell]} maxFontSizeMultiplier={1.2}>KG</Text>
          <Text style={[styles.colHead, styles.colCell]} maxFontSizeMultiplier={1.2}>REPS</Text>
          <View style={styles.colTick} />
        </View>
        {ROWS.map((row, i) => (
          <Animated.View key={row.set} style={[styles.row, i === 0 ? row0 : i === 1 ? row1 : row2]}>
            <Text style={[styles.setNo, styles.colSet]} maxFontSizeMultiplier={1.2}>
              {row.set}
            </Text>
            <View style={[styles.cell, styles.colCell]}>
              <Text style={styles.cellText} maxFontSizeMultiplier={1.2}>{row.kg}</Text>
            </View>
            <View style={[styles.cell, styles.colCell]}>
              <Text style={styles.cellText} maxFontSizeMultiplier={1.2}>{row.reps}</Text>
            </View>
            <View style={[styles.tick, styles.colTick]} />
          </Animated.View>
        ))}
        <View style={styles.addRow}>
          <Text style={styles.addText} maxFontSizeMultiplier={1.2}>＋ Add Set</Text>
        </View>
      </Animated.View>

      <Animated.View style={[styles.lineWrap, lineStyle]}>
        <Text style={styles.line} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {typed}
          {!settled && !reduced ? <Text style={styles.caret}>|</Text> : null}
        </Text>
        <SettleMark on={settled} />
      </Animated.View>
    </Animated.View>
  );
}

/** One grid row's fold: towards the card's middle, thinning as it goes. A
 * custom hook because three rows share it and a worklet cannot be a loop. */
function useRowFold(collapse: { value: number }, offset: number) {
  return useAnimatedStyle(() => ({
    opacity: 1 - collapse.value,
    transform: [{ translateY: collapse.value * offset }, { scaleY: 1 - collapse.value * 0.6 }],
  }));
}

/** The small blue check that says the line was read — the same mark a settled
 * entry earns on Today, scaled to the demonstration. */
function SettleMark({ on }: { on: boolean }) {
  const reduced = useReducedMotion();
  const scale = useSharedValue(on ? 1 : 0);
  useEffect(() => {
    scale.value = reduced
      ? withTiming(on ? 1 : 0, { duration: 120 })
      : withSpring(on ? 1 : 0, select);
  }, [on, reduced, scale]);
  const style = useAnimatedStyle(() => ({
    opacity: scale.value,
    transform: [{ scale: 0.6 + scale.value * 0.4 }],
  }));
  return (
    <Animated.View style={[styles.mark, style]}>
      <Check size={moderateScale(14)} color={v2color.blue} strokeWidth={2.6} />
    </Animated.View>
  );
}

const CELL_H = moderateScale(30);

const styles = StyleSheet.create({
  band: { alignItems: 'stretch', justifyContent: 'center' },
  grid: {
    backgroundColor: v2color.surface,
    borderRadius: v2radius.card,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: v2color.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  gridHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  gridTitle: { ...type.subhead, fontWeight: '600', color: v2color.ink },
  gridDots: { ...type.subhead, color: v2color.inkMuted },
  cols: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md },
  colHead: {
    ...type.footnote,
    color: v2color.inkMuted,
    fontWeight: '600',
    letterSpacing: 1,
    textAlign: 'center',
  },
  colSet: { width: moderateScale(30) },
  colCell: { flex: 1 },
  colTick: { width: moderateScale(26) },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  setNo: { ...type.subhead, color: v2color.inkSecondary, textAlign: 'center' },
  cell: {
    height: CELL_H,
    borderRadius: 8,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: v2color.border,
    backgroundColor: 'rgba(23,25,20,0.03)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellText: { ...readingStyle('500'), fontSize: moderateScale(14), color: v2color.ink },
  tick: {
    height: CELL_H,
    borderRadius: 8,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: v2color.border,
    backgroundColor: 'rgba(23,25,20,0.03)',
  },
  addRow: { alignItems: 'center', marginTop: spacing.md },
  addText: { ...type.subhead, color: v2color.inkSecondary },
  lineWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.xl,
    minHeight: moderateScale(28),
  },
  line: { ...readingStyle('500'), fontSize: moderateScale(19), color: v2color.ink },
  caret: { color: v2color.blue },
  mark: { marginTop: 2 },
});
