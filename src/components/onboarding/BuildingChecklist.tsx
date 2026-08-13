import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { FadeSlideIn } from '@/components/motion';
import { tap } from '@/lib/haptics';
import { DUR, EASE, stagger } from '@/lib/motion';
import { color, lineFor, MAX_FONT_SCALE, moderateScale, spacing, type } from '@/lib/theme';

import { BLUE, INK_TRACK } from './tokens';

/**
 * The building screen's typographic checklist. Every line restates an answer
 * the person just gave (`buildingLines` in config.ts) — nothing here is
 * invented, and the work it narrates (writing prefs) genuinely happens at
 * completion.
 *
 * The Mobbin pass (Calm Sleep, Rocket Money, Quicken) settled the shape: the
 * WHOLE list is visible from the start — pending lines muted behind a hollow
 * circle — and lines complete one per beat, the check springing in as the
 * text rises to full ink. A list completing reads calmer and more truthful
 * than lines materialising out of nowhere. Each check lands with a light
 * haptic tick — the record being stamped, felt as well as seen. `onDone`
 * fires a moment after the last check so the screen advances itself.
 *
 * Reduce Motion shows everything settled at once and advances after one
 * readable beat — the sequence is presentation, never a gate.
 */

const LINE_INTERVAL_MS = 700;
const DONE_DELAY_MS = 1000;
const REDUCED_DONE_DELAY_MS = 1400;

export function BuildingChecklist({ lines, onDone }: { lines: string[]; onDone: () => void }) {
  const reduce = useReducedMotion();
  const [ticked, setTicked] = useState(() => (reduce ? lines.length : 0));

  useEffect(() => {
    if (reduce) {
      const t = setTimeout(onDone, REDUCED_DONE_DELAY_MS);
      return () => clearTimeout(t);
    }
    if (ticked >= lines.length) {
      const t = setTimeout(onDone, DONE_DELAY_MS);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => {
      setTicked((v) => v + 1);
      tap();
    }, LINE_INTERVAL_MS);
    return () => clearTimeout(t);
  }, [ticked, reduce, lines.length, onDone]);

  return (
    <View style={styles.wrap}>
      {lines.map((line, i) => (
        <FadeSlideIn key={line} delay={stagger(i, 60)} distance={8}>
          <Row label={line} done={i < ticked} reduce={reduce} />
        </FadeSlideIn>
      ))}
    </View>
  );
}

function Row({ label, done, reduce }: { label: string; done: boolean; reduce: boolean }) {
  const p = useSharedValue(done ? 1 : 0);

  useEffect(() => {
    if (reduce) {
      p.value = done ? 1 : 0;
      return;
    }
    p.value = done
      ? withTiming(1, { duration: DUR.base, easing: EASE.standard })
      : withTiming(0, { duration: DUR.base, easing: EASE.standard });
  }, [done, reduce, p]);

  // Muted while pending, full ink once its answer is in the record.
  const textStyle = useAnimatedStyle(() => ({ opacity: 0.4 + p.value * 0.6 }));
  const circleStyle = useAnimatedStyle(() => ({ opacity: 1 - p.value }));
  const checkStyle = useAnimatedStyle(() => ({
    opacity: p.value,
    transform: [{ scale: 0.6 + p.value * 0.4 }],
  }));

  return (
    <View style={styles.row}>
      <View style={styles.indicator}>
        <Animated.View style={[styles.circle, circleStyle]} />
        <Animated.View style={[StyleSheet.absoluteFill, styles.checkWrap, checkStyle]}>
          <Svg width={moderateScale(14)} height={moderateScale(14)} viewBox="0 0 16 16">
            <Path
              d="M3 8.5L6.5 12 13 4.5"
              stroke={BLUE}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </Svg>
        </Animated.View>
      </View>
      <Animated.Text style={[styles.text, textStyle]} maxFontSizeMultiplier={MAX_FONT_SCALE}>
        {label}
      </Animated.Text>
    </View>
  );
}

const INDICATOR = moderateScale(18);

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  indicator: {
    width: INDICATOR,
    height: INDICATOR,
    marginTop: moderateScale(2),
  },
  circle: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: INDICATOR,
    borderWidth: 1.5,
    borderColor: INK_TRACK,
  },
  checkWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    ...type.headline,
    lineHeight: lineFor(22),
    color: color.textPrimary,
    flexShrink: 1,
  },
});
