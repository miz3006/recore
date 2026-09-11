import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { MetricCard } from '@/components/progression/metric-card';
import { lastDayPhrase } from '@/lib/day-phrase';
import { shiftDayKey, todayKey } from '@/lib/db/dates';
import { getLiftSessions } from '@/lib/db/progression';
import { tap } from '@/lib/haptics';
import { PAPER_FIELD_CSS } from '@/lib/paper-field';
import { getWeightUnit } from '@/lib/prefs';
import { buildMetrics, seriesInUnit, sessionsFor } from '@/lib/progression-metrics';
import { MAX_FONT_SCALE, TAB_BAR_CLEARANCE, color, spacing, type } from '@/lib/theme';
import { type WeightUnit } from '@/lib/units';
import { labelForDay, useSession } from '@/state/session-store';

/**
 * PROGRESSION, LEVEL TWO — "what is this lift doing?" (28 August 2026).
 *
 * One lift, one card per metric, pushed from the Progression root. This is the
 * screen the rebuild was measured from: Lyfta's Exercise Progress
 * (`research/lyfta/screens.md`), which has **no exercise selector** because the
 * screen you arrived from was the picker.
 *
 * The first build of this rebuild put a chip row at the top of the tab instead,
 * and that was the mistake: it capped the app at eight visible lifts, wrapped at
 * the Dynamic Type ceiling, and left no way to see anything at all without first
 * choosing something. Splitting the tab in two deleted the control and the
 * problem together.
 *
 * Nothing here ranks or compares against another exercise. The title is the
 * lift's own name and every card below it measures the same eight weeks.
 */

/** The same window the root measures. */
const RANGE_DAYS = 56;

export default function LiftProgress() {
  const { key } = useLocalSearchParams<{ key: string }>();
  const userId = useSession((s) => s.userId);
  const openExerciseSheet = useSession((s) => s.openExerciseSheet);

  const [refresh, setRefresh] = useState(0);
  useFocusEffect(
    useCallback(() => {
      setRefresh((n) => n + 1);
    }, []),
  );

  /* eslint-disable react-hooks/exhaustive-deps */
  const rows = useMemo(() => (userId ? getLiftSessions(userId) : []), [userId, refresh]);
  /* eslint-enable react-hooks/exhaustive-deps */

  const fromDay = shiftDayKey(todayKey(), -RANGE_DAYS);
  const sessions = useMemo(
    () => (key ? sessionsFor(rows, key, fromDay) : []),
    [rows, key, fromDay],
  );
  /**
   * The athlete's display unit, re-read on the same focus as the record.
   *
   * `seriesInUnit` is the LAST step and the only one that knows about pounds:
   * the cards, the sub-labels and the charts all read off the converted series,
   * so the level-two screen can never quote a lift in a different system than
   * the row that pushed it (`(tabs)/progress.tsx`). Storage stays kilograms.
   */
  /* eslint-disable react-hooks/exhaustive-deps */
  const unit = useMemo<WeightUnit>(() => getWeightUnit() ?? 'kg', [refresh]);
  /* eslint-enable react-hooks/exhaustive-deps */
  const metrics = useMemo(
    () => buildMetrics(sessions).map((m) => seriesInUnit(m, unit)),
    [sessions, unit],
  );

  const canonical = sessions[0]?.canonical ?? key ?? 'Lift';
  const last = sessions[sessions.length - 1];
  const subtitle = last
    ? `${sessions.length} ${sessions.length === 1 ? 'session' : 'sessions'} · ${lastDayPhrase(
        labelForDay(last.day),
      )}`
    : undefined;

  return (
    <>
      {/* THE CHROME IS UIKIT'S (10 September 2026). `StubScreen` drew a
          `headline` in a row with a chevron beside it — a bar that cannot
          collapse, cannot be Liquid Glass and cannot say "Progress" beside the
          back control, which is the one thing a two-level drill-down owes the
          person in it. It is UIKit's now, dressed by `../_layout.tsx`.

          The screen MOVED with it, from the root stack into Progress's, so the
          tab bar survives the push the way it does in every app iOS ships.

          The title stays INLINE rather than large: this is a single record, not
          a list, and a lift's name can run to three words. Strong's own
          exercise detail sets it the same way (appllama 464254577,
          `Exercise History`). */}
      <Stack.Screen options={{ title: canonical }} />

      {/* THE SCROLL VIEW IS THE SCREEN'S ROOT and paints the canvas itself —
          the measurement is in `(tabs)/next/_layout.tsx`. */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}>
        {/* WHAT THERE IS TO LOOK AT, under the system's title. It was the
            header's subtitle while this screen drew its own header; a
            `UINavigationItem` holds one string, so the counted line is content
            now — the same move Next and Progress made. */}
        {subtitle ? (
          <Text style={styles.subtitle} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {subtitle}
          </Text>
        ) : null}

        {sessions.length === 0 ? (
          // Reached from a lift that has fallen out of the window — say so
          // plainly rather than drawing eight weeks of nothing.
          <View>
            <Text style={styles.thin} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              No sessions of this lift in the last eight weeks. Its full record is still in the
              lift&apos;s own history.
            </Text>
          </View>
        ) : (
          metrics.map((series, i) => (
            <MetricCard
              key={series.key}
              series={series}
              index={i}
              // The per-metric detail view does not exist yet, so the chevron
              // opens the lift's full history — the nearest true destination
              // beats a control that does nothing.
              onPress={() => {
                tap();
                openExerciseSheet(canonical);
              }}
            />
          ))
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  /**
   * THE CANVAS IS THE SCROLL VIEW'S OWN BACKGROUND, and that is the whole
   * reason this screen can have both a paper canvas and a system title.
   * `(tabs)/next/_layout.tsx` has the measurement.
   */
  scroll: {
    flex: 1,
    experimental_backgroundImage: PAPER_FIELD_CSS,
  },
  content: {
    // ONE GUTTER, `spacing.lg` — the system's title hangs off its own inset.
    paddingHorizontal: spacing.lg,
    // An INLINE title has no large-title block under it to leave air, so the
    // first line would start against the bar. UIKit hands down the bar's
    // height, not the page's rhythm — this is the page's rhythm.
    paddingTop: spacing.lg,
    // The top is UIKit's now, but the bottom is not: content scrolls BEHIND
    // the glass tab bar so the bar has something to refract, and the last card
    // clears it by hand.
    paddingBottom: spacing.huge + TAB_BAR_CLEARANCE,
    // The reference's card rhythm: the next card peeks at the scroll edge.
    gap: spacing.xxl,
  },
  /** The counted line under the system title. It hugs the title — no top gap of
   * its own — because a title and its supporting line are one block. */
  subtitle: {
    ...type.subhead,
    // NO FIXED LINE BOX: `lineFor()` scales for the DEVICE, not for Dynamic
    // Type, so at the ×1.5 cap a 15 pt line in a 21 pt box loses its descenders.
    lineHeight: undefined,
    color: color.textSecondary,
    fontVariant: ['tabular-nums'],
    marginBottom: -spacing.md,
  },
  thin: {
    ...type.body,
    color: color.textSecondary,
  },
});
