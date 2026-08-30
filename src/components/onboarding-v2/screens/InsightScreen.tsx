import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { CountUp, Enter, GrowingBar } from '@/lib/motion/index';
import { MAX_FONT_SCALE, moderateScale, readingStyle, spacing, type } from '@/lib/theme';
import { useV2 } from '@/state/onboarding-v2';

import { Character } from '../Character';
import { Frame } from '../Frame';
import { insightFor, MONTHS, sessionsByMonth, yearInsight } from '../insights';
import { v2color } from '../tokens';
import type { ScreenProps } from './types';

/**
 * THE INSIGHT SCREENS — 4 and 13.
 *
 * No question, one centred statement built out of what they just answered, and
 * a Continue. Cal AI runs the same shape twice (`Habit Insight` 12/38, `AI
 * Comparison` 14/38) and it is the only screen type in its funnel that has no
 * input at all — the flow stops asking for a beat and tells you something.
 *
 * ## Its one highlighted span
 *
 * `Insight.accent` names a substring of the headline to draw in brand blue,
 * and the renderer splits on it rather than the copy carrying markup. On the
 * year screen the accent is the session count, so it also counts up — it is a
 * RESULT, computed from their answer, which is exactly what §3 reserves the
 * count-up for. On the obstacle screen the accent is a phrase and simply
 * changes colour, because animating a phrase would be decoration.
 *
 * ## What moves on each of them
 *
 * The year screen draws twelve bars, one a month, growing from the baseline on
 * the shared `GrowingBar` primitive (§3: "Bars grow from baseline, ~40ms
 * stagger"). It is the same number the count-up is reaching, shown as an amount
 * rather than a figure — "208" is read, a year of training is seen.
 *
 * It was 52 dots, one a week, and it was replaced: at that density a
 * four-a-week year rendered as a texture rather than as a count, which is the
 * opposite of the point. Twelve bars are countable, a month is a unit people
 * feel, and four of them stand slightly taller because 52 weeks do not divide
 * into 12 — that unevenness is the calendar, and it is what stops the chart
 * looking like a picture of a division sum.
 *
 * The obstacle screen has no figure at all, so it gets the cap character
 * instead — §4's rule is that the character appears where the app SPEAKS and
 * never where it asks, and an insight screen is the app speaking. It arrives
 * after the sentence has landed, so it reads as a reaction to it.
 *
 * Neither screen animates its own statement beyond the shared `Enter`. One
 * moving thing per screen; the sentence is the subject.
 *
 * ## It disappears when it has nothing to say
 *
 * If the answer it depends on is missing — someone reached the URL directly, or
 * went back and cleared it — `insightFor` returns null and the screen advances
 * itself rather than showing an empty statement. A personalised screen with no
 * personalisation is worse than no screen.
 */
export function InsightScreen({ def, progress, onAdvance, onBack, echo }: ScreenProps) {
  const answers = useV2((s) => s.answers);
  const insight = useMemo(() => insightFor(def.id, answers), [answers, def.id]);
  const year = useMemo(
    () => (def.id === 'year-insight' ? yearInsight(answers) : null),
    [answers, def.id],
  );
  const months = useMemo(
    () => (year ? sessionsByMonth(Number(answers.frequency)) : []),
    [answers.frequency, year],
  );
  const peak = months.length > 0 ? Math.max(...months) : 1;
  const [chartWidth, setChartWidth] = useState(0);

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

  const [before, after] = splitOn(insight.headline, insight.accent);

  return (
    <Frame
      headline=""
      progress={progress}
      echo={echo}
      onBack={onBack}
      cta={{ enabled: true, onPress: onAdvance }}
      testID={`v2-screen-${def.id}`}>
      <View style={styles.body}>
        <Enter index={1}>
          <Text style={styles.statement} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {before}
            {year ? (
              <CountUp
                value={year.sessions}
                delay={220}
                style={styles.count}
                accessibilityLabel={`${year.sessions}`}
              />
            ) : (
              <Text style={styles.accent}>{insight.accent}</Text>
            )}
            {after}
          </Text>
        </Enter>

        {year ? (
          <Enter index={2} style={styles.chartWrap}>
            <View
              style={styles.bars}
              onLayout={(e) => setChartWidth(e.nativeEvent.layout.width)}>
              {chartWidth > 0
                ? months.map((sessions, i) => (
                    <GrowingBar
                      key={i}
                      fraction={sessions / peak}
                      width={(chartWidth - BAR_GAP * (months.length - 1)) / months.length}
                      height={CHART_HEIGHT}
                      color={v2color.blue}
                      index={i}
                      radius={3}
                    />
                  ))
                : null}
            </View>
            <View style={styles.axis}>
              {MONTHS.map((m, i) => (
                <Text
                  key={i}
                  style={[
                    styles.month,
                    { width: (chartWidth - BAR_GAP * 11) / 12 },
                  ]}
                  maxFontSizeMultiplier={1.2}>
                  {m}
                </Text>
              ))}
            </View>
          </Enter>
        ) : null}

        <Enter index={year ? 3 : 2}>
          <Text style={styles.support} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {insight.body}
          </Text>
        </Enter>

        {/* The table decides whether this draws anything — the obstacle screen
            is the only insight it says yes to. */}
        <View style={styles.character}>
          <Character screen={def.id} delay={520} />
        </View>
      </View>
    </Frame>
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

const CHART_HEIGHT = moderateScale(76);
const BAR_GAP = 6;

const styles = StyleSheet.create({
  /**
   * Optically centred, not mathematically. A block centred in the space between
   * the rail and the CTA sits low, because the eye reads the top of the screen
   * as emptier than it is; lifting it by the CTA's own height puts it where it
   * looks centred. Everything inside is centre-aligned on one axis, so the
   * sentence, the grid, the support line and the character share a centre line.
   */
  body: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'stretch',
    paddingBottom: spacing.huge,
  },
  statement: {
    ...type.largeTitle,
    fontWeight: '800',
    color: v2color.ink,
    textAlign: 'center',
  },
  accent: { color: v2color.blue },
  /** The count sits inline in the sentence, so it takes the sentence's size and
   * the reading face's tabular figures — the width cannot jitter mid-count. */
  count: {
    ...readingStyle('800'),
    fontSize: moderateScale(34),
    lineHeight: moderateScale(40),
    color: v2color.blue,
  },
  support: {
    ...type.body,
    color: v2color.inkSecondary,
    textAlign: 'center',
    marginTop: spacing.xl,
    paddingHorizontal: spacing.sm,
  },
  chartWrap: { marginTop: spacing.xxl },
  bars: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: CHART_HEIGHT,
  },
  axis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm },
  month: { ...type.footnote, color: v2color.inkMuted, textAlign: 'center' },
  character: { alignItems: 'center', marginTop: spacing.xxl },
});
