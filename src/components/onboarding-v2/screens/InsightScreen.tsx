import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated';

import { count, CountUp, Enter } from '@/lib/motion/index';
import { MAX_FONT_SCALE, moderateScale, readingStyle, spacing, type } from '@/lib/theme';
import { useV2 } from '@/state/onboarding-v2';

import { Frame } from '../Frame';
import { GridCollapse } from '../GridCollapse';
import { insightFor, yearInsight } from '../insights';
import { v2color } from '../tokens';
import type { ScreenProps } from './types';

/**
 * THE INSIGHT SCREENS — 4 and 13. Both rebuilt 16 September 2026 on the
 * owner's premium pass; what they are ALLOWED to say is unchanged (arithmetic
 * on their own answers, facts about the app, nothing about anybody else —
 * `insights.ts` holds that argument).
 *
 * ## Screen 4 — the demonstration, then the claim
 *
 * The top half is the grid-collapse loop (`GridCollapse`): a Strong-style
 * set grid folding into one written line. The statement and its supporting
 * sentence moved to the bottom half, under the thing they describe — a claim
 * below its own evidence rather than a sentence with a mascot.
 *
 * ## Screen 13 — the year, counted and seen
 *
 * A hero count-up ("208") over a grid of 52 week cells that fill on the same
 * spring family, so the number and the amount arrive as one fact. The twelve
 * monthly bars this replaces averaged the year into a texture; 52 cells ARE
 * the year, one square per week they said they would train. Pure arithmetic
 * on the frequency answer, as before.
 *
 * ## It disappears when it has nothing to say
 *
 * If the answer a screen depends on is missing — someone reached the URL
 * directly, or went back and cleared it — `insightFor` returns null and the
 * screen offers a plain Continue rather than an empty statement.
 */
export function InsightScreen({ def, progress, onAdvance, onBack, echo }: ScreenProps) {
  const answers = useV2((s) => s.answers);
  const insight = useMemo(() => insightFor(def.id, answers), [answers, def.id]);
  const year = useMemo(
    () => (def.id === 'year-insight' ? yearInsight(answers) : null),
    [answers, def.id],
  );

  if (!insight) {
    // Nothing to say. Render the frame with a Continue so the flow is never a
    // dead end, but say nothing rather than something generic.
    return (
      <Frame
        headline="Let's keep going."
        progress={progress}
        echo={echo}
        onBack={onBack}
        centred
        cta={{ enabled: true, onPress: onAdvance }}
        testID={`v2-screen-${def.id}`}
      />
    );
  }

  if (year) {
    const perWeek = Number(answers.frequency);
    return (
      <Frame
        headline=""
        progress={progress}
        echo={echo}
        onBack={onBack}
        cta={{ enabled: true, onPress: onAdvance }}
        testID={`v2-screen-${def.id}`}>
        <View style={styles.yearBody}>
          <Enter index={1}>
            <View style={styles.hero}>
              <CountUp
                value={year.sessions}
                delay={260}
                style={styles.heroNumber}
                sized
                accessibilityLabel={`${year.sessions}`}
              />
              <Text style={styles.heroCaption} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                sessions a year
              </Text>
            </View>
          </Enter>

          <Enter index={2} style={styles.gridWrap}>
            <WeekGrid />
            <Text style={styles.gridCaption} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              52 weeks · {perWeek} a week
            </Text>
          </Enter>

          <Enter index={3}>
            <Text style={styles.support} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              {insight.body}
            </Text>
          </Enter>
        </View>
      </Frame>
    );
  }

  const [before, after] = splitOn(insight.headline, insight.accent);

  return (
    <Frame
      headline=""
      progress={progress}
      echo={echo}
      onBack={onBack}
      cta={{ enabled: true, onPress: onAdvance }}
      testID={`v2-screen-${def.id}`}>
      <View style={styles.splitBody}>
        <View style={styles.demoHalf}>
          <GridCollapse />
        </View>
        <View style={styles.copyHalf}>
          <Enter index={1}>
            <Text style={styles.statement} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              {before}
              <Text style={styles.accent}>{insight.accent}</Text>
              {after}
            </Text>
          </Enter>
          <Enter index={2}>
            <Text style={styles.support} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              {insight.body}
            </Text>
          </Enter>
        </View>
      </View>
    </Frame>
  );
}

/**
 * 52 WEEKS, ONE CELL EACH, filling on the count's own spring — the year as an
 * amount. One shared value sweeps 0→52 and every cell reads its own threshold
 * off it, so the fill is one gesture rather than 52 animations.
 */
function WeekGrid() {
  const reduced = useReducedMotion();
  const sweep = useSharedValue(reduced ? WEEKS : 0);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    if (reduced) {
      sweep.value = WEEKS;
      return;
    }
    sweep.value = 0;
    sweep.value = withDelay(260, withSpring(WEEKS, count));
  }, [reduced, sweep]);

  const cell = width > 0 ? (width - CELL_GAP * (COLS - 1)) / COLS : 0;

  return (
    <View
      style={styles.grid}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      accessible
      accessibilityRole="image"
      accessibilityLabel="52 weeks of training, one square each">
      {width > 0
        ? Array.from({ length: WEEKS }, (_, i) => (
            <WeekCell key={i} index={i} sweep={sweep} size={cell} />
          ))
        : null}
    </View>
  );
}

function WeekCell({
  index,
  sweep,
  size,
}: {
  index: number;
  sweep: SharedValue<number>;
  size: number;
}) {
  const style = useAnimatedStyle(() => {
    const on = Math.min(Math.max(sweep.value - index, 0), 1);
    return {
      opacity: 0.18 + on * 0.82,
      transform: [{ scale: 0.86 + on * 0.14 }],
    };
  });
  return (
    <Animated.View
      style={[
        styles.cellFill,
        { width: size, height: size, borderRadius: Math.max(3, size * 0.28) },
        style,
      ]}
    />
  );
}

/** Split a headline around its accent, keeping both halves verbatim. Falls back
 * to the whole string when the accent is absent, so a copy edit that loses it
 * degrades to an unhighlighted sentence rather than to a crash. */
function splitOn(headline: string, accent: string): [string, string] {
  const at = headline.indexOf(accent);
  if (at < 0) return [headline, ''];
  return [headline.slice(0, at), headline.slice(at + accent.length)];
}

const WEEKS = 52;
const COLS = 13;
const CELL_GAP = 6;

const styles = StyleSheet.create({
  /** Screen 4: demonstration above, claim below — the two halves the owner
   * asked for by name. */
  splitBody: { flex: 1, paddingBottom: spacing.xl },
  demoHalf: { flex: 11, justifyContent: 'center' },
  copyHalf: { flex: 9, justifyContent: 'center' },
  statement: {
    ...type.largeTitle,
    fontWeight: '800',
    color: v2color.ink,
    textAlign: 'center',
  },
  accent: { color: v2color.blue },
  support: {
    ...type.body,
    color: v2color.inkSecondary,
    textAlign: 'center',
    marginTop: spacing.xl,
    paddingHorizontal: spacing.sm,
  },

  /** Screen 13: number, amount, sentence — optically centred, lifted by the
   * CTA's own height like every centred screen in the flow. */
  yearBody: {
    flex: 1,
    justifyContent: 'center',
    paddingBottom: spacing.huge,
  },
  hero: { alignItems: 'center' },
  heroNumber: {
    ...readingStyle('800'),
    fontSize: moderateScale(72),
    lineHeight: moderateScale(80),
    color: v2color.blue,
  },
  heroCaption: {
    ...type.title2,
    fontWeight: '700',
    color: v2color.ink,
    marginTop: spacing.xs,
  },
  gridWrap: { marginTop: spacing.xxl },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: CELL_GAP,
    justifyContent: 'center',
  },
  cellFill: { backgroundColor: v2color.blue },
  gridCaption: {
    ...type.footnote,
    color: v2color.inkMuted,
    letterSpacing: 1.2,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: spacing.md,
  },
});
