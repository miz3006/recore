import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { DUR, EASE } from '@/lib/motion';
import {
  alpha,
  color,
  fonts,
  ink,
  lineFor,
  MAX_FONT_SCALE,
  moderateScale,
  readingStyle,
  spacing,
  type,
} from '@/lib/theme';

import { BLUE, INK_CARD, ROW_RADIUS } from './tokens';

/**
 * The one animated promise in the funnel (Claude Design canvas, 13 Aug 2026 —
 * "the aha moment ... the core promise, animated once").
 *
 * A line of raw text appears the way a person would type it; then the record
 * the parser makes of it WIPES IN underneath, left to right, as if it were
 * being written. Nothing else on this screen argues that Recore reads plain
 * language — this shows it, in the time it takes to read one line.
 *
 * ## The example is real
 *
 * `bench 100kg 5,5,4` is the exact shape `parse-eval-cases.json` covers ("rep
 * list commas after weight"), and the row below is what the parser genuinely
 * returns for it: Bench Press, three sets at 100 kg, the last one dropping to
 * four reps. A demo of a syntax that did not work would be the worst possible
 * first impression, and an invented capability on the second screen of the
 * funnel is exactly the fabrication CLAUDE.md §2 rule 2 forbids.
 *
 * ## Two voices, not two fonts
 *
 * The design set the typed line in a script face to separate "what you wrote"
 * from "what Recore kept". Recore already owns that distinction and spells it
 * differently: MONO is the parser's own echo of raw text (`fonts.mono`) and the
 * reading face carries every number the record reports. Using the app's two
 * established voices says the same thing without introducing a third face — and
 * without a decorative script at the mercy of Dynamic Type.
 *
 * ## Motion
 *
 * Quote fades up, the arrow follows, the row wipes in from the left. The wipe
 * is a paper-coloured cover scaled off its right edge — transforms only, on the
 * UI thread, no layout property animated (§4.3). Reduce Motion shows the
 * finished record with no reveal at all, which is the whole point of the screen
 * anyway. Tapping replays it; it never loops on its own.
 */

const QUOTE = 'bench 100kg 5,5,4';

export function ParseDemo() {
  const reduce = useReducedMotion();
  // Remounts the animated subtree, which is how the replay restarts a
  // mount-only entrance without a second set of timing code.
  const [run, setRun] = useState(0);

  const replay = useCallback(() => setRun((n) => n + 1), []);

  return (
    <Pressable
      onPress={replay}
      accessibilityRole="button"
      accessibilityLabel={`You type ${QUOTE}. Recore records Bench press, three sets of 100 kilograms, five, five and four reps. Tap to replay.`}
      style={styles.wrap}>
      <Reveal key={run} reduce={reduce} />
    </Pressable>
  );
}

function Reveal({ reduce }: { reduce: boolean }) {
  const quote = useSharedValue(reduce ? 1 : 0);
  const arrow = useSharedValue(reduce ? 1 : 0);
  const wipe = useSharedValue(reduce ? 1 : 0);

  useEffect(() => {
    if (reduce) return;
    quote.value = withTiming(1, { duration: DUR.slow, easing: EASE.emphasized });
    arrow.value = withDelay(400, withTiming(1, { duration: DUR.base, easing: EASE.emphasized }));
    wipe.value = withDelay(550, withTiming(1, { duration: 500, easing: EASE.emphasized }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const quoteStyle = useAnimatedStyle(() => ({
    opacity: quote.value,
    transform: [{ translateY: (1 - quote.value) * 12 }],
  }));
  const arrowStyle = useAnimatedStyle(() => ({ opacity: arrow.value }));
  // The cover retreats to its own right edge, so the record appears to be
  // written from the left rather than to fade in all at once.
  const coverStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: 1 - wipe.value }],
    opacity: wipe.value < 1 ? 1 : 0,
  }));

  return (
    <>
      <Animated.Text
        style={[styles.quote, quoteStyle]}
        maxFontSizeMultiplier={MAX_FONT_SCALE}>
        {QUOTE}
      </Animated.Text>

      <Animated.View style={[styles.arrow, arrowStyle]}>
        <Svg width={moderateScale(14)} height={moderateScale(18)} viewBox="0 0 14 18">
          <Path
            d="M7 1v14M2.5 11 7 15.5 11.5 11"
            stroke={color.textMuted}
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </Svg>
      </Animated.View>

      <View style={styles.rowClip}>
        <View style={styles.row}>
          <Text style={styles.exercise} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            Bench press
          </Text>
          <View style={styles.readings}>
            <Text style={styles.reading} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              100 kg
            </Text>
            <Text style={styles.dot} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              ·
            </Text>
            <Text style={styles.reading} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              5 · 5 · 4
            </Text>
          </View>
        </View>
        <Animated.View style={[styles.cover, coverStyle]} pointerEvents="none" />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.sm,
  },
  quote: {
    ...type.body,
    fontFamily: fonts.mono,
    fontSize: moderateScale(15),
    lineHeight: lineFor(21),
    color: alpha(color.textPrimary, ink.echo),
  },
  arrow: {
    paddingLeft: spacing.sm,
  },
  rowClip: {
    borderRadius: ROW_RADIUS,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    backgroundColor: INK_CARD,
    borderRadius: ROW_RADIUS,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  exercise: {
    ...type.headline,
    fontWeight: '500',
    color: color.textPrimary,
    flexShrink: 1,
  },
  readings: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
  },
  reading: {
    ...readingStyle('600'),
    fontSize: moderateScale(17),
    lineHeight: lineFor(22),
    color: BLUE,
  },
  dot: {
    ...type.subhead,
    color: color.textMuted,
  },
  cover: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: color.bg,
    transformOrigin: 'right',
  },
});
