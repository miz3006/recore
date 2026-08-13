import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';

import { todayKey } from '@/lib/db/dates';
import { getRecentSessions } from '@/lib/db/insights';
import { listPlanDays } from '@/lib/db/plan';
import { tap, tapMedium } from '@/lib/haptics';
import { groupThousands } from '@/lib/parse/estimate';
import {
  alpha,
  color,
  CONTROL_HEIGHT,
  fonts,
  hairline,
  MAX_FONT_SCALE,
  moderateScale,
  radius,
  shadow,
  spacing,
  type,
} from '@/lib/theme';
import { labelForDay, useCurrentNote, usePlanStrip, useSession } from '@/state/session-store';

import { MonoTag } from './gutter-value';
import { PressableScale } from './motion';
import { focusNote } from './note-focus';
import { PlanStrip } from './plan-strip';

/**
 * The session-start question (§8.2, owner 6 Aug): on an empty TODAY, the plan
 * strip grows into the card that opens a training day — "What are you
 * training?", the split's days as chips with the due one pre-answered
 * (rotation/weekday resolution, deterministic), that day's movements with the
 * engine's progressed loads, one line of last-session context, and Start
 * training. Answering a chip pins the day through resolveTodayPlanDay, so the
 * strip, the calendar, and the Next brief follow the same answer.
 *
 * It is a suggestion layer, never a gate: tapping the page and writing works
 * exactly as before, and Start only drops the athlete into the composer — it
 * writes NOTHING into the note ("Planned into Actual" never bends). The card
 * yields to the plain strip the moment composing starts, and on any day that
 * already has text; a blank account keeps the FIRST SESSION tutorial instead
 * (this card needs a split and at least one logged session to have anything
 * true to say).
 */
export function SessionStart({ composing }: { composing: boolean }) {
  const userId = useSession((s) => s.userId);
  const selectedDay = useSession((s) => s.selectedDay);
  const selectDay = useSession((s) => s.selectDay);
  const choosePlanDay = useSession((s) => s.choosePlanDay);
  const note = useCurrentNote();
  const strip = usePlanStrip();
  const reduceMotion = useReducedMotion();

  const isToday = selectedDay === todayKey();
  const empty = note.trim().length === 0;

  // Both reads are cheap synchronous SQLite, refreshed when the viewed day
  // changes — the same cadence the empty-day peek lives on.
  const days = useMemo(
    () => (userId && isToday ? listPlanDays(userId) : []),
    [userId, isToday, selectedDay], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const last = useMemo(
    () => (userId ? (getRecentSessions(userId, 1, selectedDay)[0] ?? null) : null),
    [userId, selectedDay],
  );

  const eligible = isToday && empty && days.length > 0 && last !== null;
  if (!eligible || composing) return <PlanStrip />;

  const handleChip = (id: string) => {
    if (id === strip?.dayId) return;
    tap();
    choosePlanDay(id);
  };
  const handleStart = () => {
    tapMedium();
    focusNote();
  };
  const handleLast = () => {
    tap();
    selectDay(last.day);
  };

  const lastLine = [
    'Last session',
    labelForDay(last.day),
    `${last.sets} sets`,
    ...(last.volume > 0 ? [`${groupThousands(last.volume)} kg`] : []),
  ].join(' · ');

  return (
    <Animated.View
      entering={reduceMotion ? undefined : FadeInDown.duration(220)}
      style={styles.card}>
      <View style={styles.top}>
        <MonoTag label="TODAY" />
      </View>
      <Text style={styles.question} accessibilityRole="header" maxFontSizeMultiplier={MAX_FONT_SCALE}>
        What are you training?
      </Text>

      {/* The split's days; the due one arrives pre-answered (blue = the chosen
          answer, §4.2). Re-answering re-resolves the strip below in place. */}
      <View style={styles.chips}>
        {days.map((d) => {
          const selected = d.id === strip?.dayId;
          return (
            <PressableScale
              key={d.id}
              onPress={() => handleChip(d.id)}
              haptic="none"
              activeScale={0.96}
              hitSlop={spacing.xs}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={`Train ${d.label} today`}
              style={[styles.chip, selected && styles.chipSelected]}
              pressedStyle={styles.chipPressed}>
              <Text
                style={[styles.chipLabel, selected && styles.chipLabelSelected]}
                numberOfLines={1}
                maxFontSizeMultiplier={MAX_FONT_SCALE}>
                {d.label}
              </Text>
            </PressableScale>
          );
        })}
      </View>

      {/* The answered day's movements with the engine's progressed loads —
          the strip's own row vocabulary, every ring still owed. */}
      {strip ? (
        <View style={styles.rows}>
          {strip.rows.map((r, i) => (
            <View key={`${r.name}:${i}`}>
              {i > 0 ? <View style={styles.rowSep} /> : null}
              <View
                style={styles.row}
                accessible
                accessibilityLabel={`${r.name}${r.value ? `, ${r.value}` : ''}`}>
                <View style={styles.ring} />
                <Text style={styles.ex} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                  {r.name}
                </Text>
                {r.value ? (
                  <Text style={styles.val} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                    {r.value}
                  </Text>
                ) : null}
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {/* One line of record before the day starts — a door back to re-reading
          it, same as the empty-day peek this card replaces. */}
      <PressableScale
        onPress={handleLast}
        haptic="none"
        activeScale={0.98}
        accessibilityRole="button"
        accessibilityLabel={`Review last session, ${labelForDay(last.day)}`}
        style={styles.last}
        pressedStyle={styles.lastPressed}>
        <Text style={styles.lastText} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {lastLine}
        </Text>
      </PressableScale>

      {/* Start writes nothing — it only hands the athlete the pen. */}
      <PressableScale
        onPress={handleStart}
        haptic="none"
        accessibilityRole="button"
        accessibilityLabel="Start training"
        style={styles.startBtn}
        pressedStyle={styles.startPressed}>
        <Text style={styles.startLabel} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          Start training
        </Text>
      </PressableScale>
    </Animated.View>
  );
}

const RING = moderateScale(18);

const styles = StyleSheet.create({
  // The plan strip's own card chrome — this IS the strip, grown for the
  // question it asks before the day has ink.
  card: {
    marginHorizontal: spacing.xl,
    marginBottom: spacing.md,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.divider,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    ...shadow.card,
  },
  top: { flexDirection: 'row' },
  question: {
    marginTop: spacing.sm,
    ...type.subhead,
    fontWeight: '600',
    color: color.textPrimary,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  chip: {
    minHeight: moderateScale(38),
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  // The chosen answer wears Recore blue (§4.2: selected choices) — the same
  // wash/border pair the Progress range picker settled on.
  chipSelected: {
    backgroundColor: alpha(color.trained, 0.12),
    borderColor: alpha(color.trained, 0.45),
  },
  chipPressed: {
    backgroundColor: color.surfaceHigh,
  },
  chipLabel: {
    ...type.subhead,
    color: color.textPrimary,
  },
  chipLabelSelected: {
    color: color.trained,
    fontWeight: '600',
  },

  rows: { marginTop: spacing.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: moderateScale(38),
    paddingVertical: spacing.xs,
  },
  rowSep: {
    height: hairline,
    marginLeft: RING + spacing.md,
    backgroundColor: color.divider,
  },
  ring: {
    width: RING,
    height: RING,
    borderRadius: RING / 2,
    borderWidth: 1.5,
    borderColor: color.border,
  },
  ex: { flex: 1, ...type.subhead, color: color.textPrimary },
  // THE ONLY GREEN: a future prescription value (record contract, §4.2).
  val: {
    fontFamily: fonts.reading,
    fontSize: type.caption.fontSize,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
    color: color.signal,
  },

  last: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: hairline,
    borderTopColor: color.divider,
    minHeight: moderateScale(32),
    justifyContent: 'center',
    borderRadius: radius.sm,
  },
  lastPressed: {
    backgroundColor: color.surfaceHigh,
  },
  lastText: {
    fontFamily: fonts.reading,
    fontSize: type.footnote.fontSize,
    fontVariant: ['tabular-nums'],
    color: color.textMuted,
  },
  startBtn: {
    marginTop: spacing.md,
    minHeight: CONTROL_HEIGHT,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: color.accent,
  },
  startPressed: {
    backgroundColor: color.accentPressed,
  },
  startLabel: {
    color: color.bg,
    fontSize: moderateScale(16),
    fontWeight: '600',
  },
});
