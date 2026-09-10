import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { MetricCard } from '@/components/progression/metric-card';
import { StubScreen } from '@/components/stub-screen';
import { lastDayPhrase } from '@/lib/day-phrase';
import { shiftDayKey, todayKey } from '@/lib/db/dates';
import { getLiftSessions } from '@/lib/db/progression';
import { tap } from '@/lib/haptics';
import { getWeightUnit } from '@/lib/prefs';
import { buildMetrics, seriesInUnit, sessionsFor } from '@/lib/progression-metrics';
import { MAX_FONT_SCALE, color, spacing, type } from '@/lib/theme';
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
    <StubScreen title={canonical} subtitle={subtitle}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
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
    </StubScreen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    marginHorizontal: -spacing.xxl, // StubScreen pads the body; the scroll owns it
  },
  content: {
    paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.huge,
    // The reference's card rhythm: the next card peeks at the scroll edge.
    gap: spacing.xxl,
  },
  thin: {
    ...type.body,
    color: color.textSecondary,
  },
});
