import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { MonoTag } from '@/components/gutter-value';
import { Icon } from '@/components/icon';
import { PressableScale, Stagger } from '@/components/motion';
import { todayKey } from '@/lib/db/dates';
import {
  listPlanDays,
  resolveTodayPlanDay,
  setPlanDayWeekday,
  type PlanDayRow,
} from '@/lib/db/plan';
import { tap, tapMedium } from '@/lib/haptics';
import { maskHasWeekday, toggleWeekday, type ScheduleMode } from '@/lib/plan/resolve';
import { getScheduleMode, setScheduleMode } from '@/lib/prefs';
import {
  color,
  CONTROL_HEIGHT,
  fonts,
  hairline,
  MAX_FONT_SCALE,
  moderateScale,
  radius,
  spacing,
  type,
} from '@/lib/theme';
import { useSession } from '@/state/session-store';

/**
 * /split — the user's weekly split (pre-plan). A short, ordered list of
 * day-templates the athlete AUTHORS by writing (see /plan-day). The segmented
 * control flips the whole model between ROTATION (an ordered cycle, "do the next
 * one when you train") and WEEKDAY (each day pinned to weekdays). Owner picks
 * (2026-07-22): rotation is the default; weekday is an optional overlay.
 *
 * No green anywhere here — the accent belongs to future prescription VALUES
 * (the plan-in-view strip), never to a tag or chrome. "NEXT UP" is neutral.
 */
const SHORT_DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const;

function movementPreview(raw: string): string {
  const lines = raw
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const head = lines.slice(0, 6).join(' · ');
  return lines.length > 6 ? `${head} …` : head;
}

export default function Split() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const userId = useSession((s) => s.userId);
  const [days, setDays] = useState<PlanDayRow[]>([]);
  const [mode, setMode] = useState<ScheduleMode>('rotation');

  const reload = useCallback(() => {
    if (!userId) return;
    setDays(listPlanDays(userId));
    setMode(getScheduleMode());
  }, [userId]);

  // Re-read on every focus so edits made in /plan-day show up on return.
  useFocusEffect(reload);

  // Cheap enough to compute each render (a few sync reads) — and it naturally
  // re-resolves when the mode toggles, since resolveTodayPlanDay reads the mode.
  const dueId =
    userId && days.length > 0 ? resolveTodayPlanDay(userId, todayKey())?.id ?? null : null;
  const dueLabel = dueId ? days.find((d) => d.id === dueId)?.label ?? null : null;

  const chooseMode = (next: ScheduleMode) => {
    if (next === mode) return;
    tap();
    setScheduleMode(next);
    setMode(next);
  };

  const openDay = (id: string) => {
    tap();
    router.push({ pathname: '/plan-day', params: { id } });
  };

  const addDay = () => {
    tapMedium();
    router.push('/plan-day');
  };

  const toggleDayWeekday = (day: PlanDayRow, weekday: number) => {
    tap();
    setPlanDayWeekday(day.id, toggleWeekday(day.weekday_mask ?? 0, weekday));
    reload();
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.nav}>
        <PressableScale
          onPress={() => {
            tap();
            router.back();
          }}
          haptic="none"
          activeScale={0.9}
          hitSlop={spacing.sm}
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={styles.backBtn}
          pressedStyle={styles.pressedFill}>
          <Icon name="chevron-back" size={moderateScale(16)} tint={color.textPrimary} />
        </PressableScale>
        <Text style={styles.navTitle} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          Your split
        </Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]}
        showsVerticalScrollIndicator={false}>
        <View style={styles.segments}>
          {(['rotation', 'weekday'] as const).map((m) => {
            const on = mode === m;
            return (
              <PressableScale
                key={m}
                onPress={() => chooseMode(m)}
                haptic="none"
                activeScale={0.97}
                style={[styles.segment, on && styles.segmentSelected]}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}>
                <Text
                  style={[styles.segmentLabel, on && styles.segmentLabelSelected]}
                  maxFontSizeMultiplier={MAX_FONT_SCALE}>
                  {m === 'rotation' ? 'Rotation' : 'Weekday'}
                </Text>
              </PressableScale>
            );
          })}
        </View>

        {days.length > 0 ? (
          <Text style={styles.todayLine} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            Today · <Text style={styles.todayLabel}>{dueLabel ?? 'rest'}</Text>
          </Text>
        ) : null}

        {days.length === 0 ? (
          <EmptyState onAdd={addDay} />
        ) : (
          <>
            <Stagger step={55} initialDelay={60}>
              {days.map((day) => (
                <DayCard
                  key={day.id}
                  day={day}
                  isNext={day.id === dueId}
                  mode={mode}
                  onOpen={() => openDay(day.id)}
                  onToggleWeekday={(wd) => toggleDayWeekday(day, wd)}
                />
              ))}
            </Stagger>
            <PressableScale
              onPress={addDay}
              haptic="none"
              activeScale={0.98}
              style={styles.addDay}
              pressedStyle={styles.pressedFill}
              accessibilityRole="button"
              accessibilityLabel="Add a day">
              <Text style={styles.addDayText} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                ＋  Add a day
              </Text>
            </PressableScale>
            <Text style={styles.footnote} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              {mode === 'rotation'
                ? 'Do the next one when you train — miss a day and the cycle just slides.'
                : 'Tap the weekday chips to pin each day. Days you don’t pin are rest days.'}
            </Text>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function DayCard({
  day,
  isNext,
  mode,
  onOpen,
  onToggleWeekday,
}: {
  day: PlanDayRow;
  isNext: boolean;
  mode: ScheduleMode;
  onOpen: () => void;
  onToggleWeekday: (weekday: number) => void;
}) {
  const moves = movementPreview(day.raw_text);
  return (
    <View style={[styles.card, isNext && styles.cardNext]}>
      <PressableScale
        onPress={onOpen}
        haptic="none"
        activeScale={0.99}
        style={styles.cardTap}
        pressedStyle={styles.cardTapPressed}
        accessibilityRole="button"
        accessibilityLabel={`Edit ${day.label}`}>
        <View style={styles.cardHead}>
          <Text style={styles.cardLabel} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {day.label}
          </Text>
          {isNext && mode === 'rotation' ? <MonoTag label="NEXT UP" /> : null}
          <Icon name="chevron-forward" size={moderateScale(14)} tint={color.textMuted} />
        </View>
        <Text style={styles.cardMoves} numberOfLines={2} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {moves || 'No movements yet — tap to write them'}
        </Text>
      </PressableScale>
      {mode === 'weekday' ? (
        <View style={styles.weekChips}>
          {SHORT_DAYS.map((s, i) => {
            const on = maskHasWeekday(day.weekday_mask, i);
            return (
              <PressableScale
                key={i}
                onPress={() => onToggleWeekday(i)}
                haptic="none"
                activeScale={0.9}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                style={[styles.weekChip, on && styles.weekChipOn]}>
                <Text
                  style={[styles.weekChipText, on && styles.weekChipTextOn]}
                  maxFontSizeMultiplier={MAX_FONT_SCALE}>
                  {s}
                </Text>
              </PressableScale>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle} maxFontSizeMultiplier={MAX_FONT_SCALE}>
        Write your first day
      </Text>
      <Text style={styles.emptyBody} maxFontSizeMultiplier={MAX_FONT_SCALE}>
        Name a day — Upper, Push, Legs — and type the movements. Recore reads them and, on a training
        day, shows that day in view while you log.
      </Text>
      <PressableScale
        onPress={onAdd}
        haptic="none"
        activeScale={0.98}
        style={styles.emptyBtn}
        pressedStyle={styles.emptyBtnPressed}
        accessibilityRole="button"
        accessibilityLabel="Add your first day">
        <Text style={styles.emptyBtnText} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          Add your first day
        </Text>
      </PressableScale>
      <Text style={styles.emptyHint} maxFontSizeMultiplier={MAX_FONT_SCALE}>
        Or skip it — Recore can read your split from your training as you log.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.bg },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  backBtn: {
    width: moderateScale(38),
    height: moderateScale(38),
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressedFill: { backgroundColor: color.surfaceHigh },
  navTitle: {
    ...type.headline,
    fontWeight: '700',
    color: color.textPrimary,
  },
  scroll: { flex: 1 },
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },

  segments: {
    flexDirection: 'row',
    backgroundColor: color.surfaceHigh,
    borderRadius: radius.md,
    padding: moderateScale(3),
    gap: moderateScale(3),
    marginBottom: spacing.lg,
  },
  segment: {
    flex: 1,
    paddingVertical: moderateScale(9),
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: hairline,
    borderColor: 'transparent',
  },
  segmentSelected: { backgroundColor: color.surface, borderColor: color.border },
  segmentLabel: { fontSize: moderateScale(13.5), fontWeight: '600', color: color.textSecondary },
  segmentLabelSelected: { color: color.textPrimary },

  todayLine: {
    fontFamily: fonts.mono,
    fontSize: moderateScale(11.5),
    color: color.textMuted,
    marginBottom: spacing.md,
    marginLeft: spacing.xs,
  },
  todayLabel: { color: color.textSecondary, fontWeight: '600' },

  card: {
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    marginBottom: spacing.md,
  },
  cardNext: { borderColor: color.textMuted },
  cardTap: { gap: spacing.xs, borderRadius: radius.sm, margin: -spacing.xs, padding: spacing.xs },
  cardTapPressed: { backgroundColor: color.surfaceHigh },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  cardLabel: { flex: 1, ...type.headline, color: color.textPrimary },
  cardMoves: {
    fontFamily: fonts.mono,
    fontSize: moderateScale(11.5),
    lineHeight: moderateScale(17),
    color: color.textSecondary,
  },

  weekChips: {
    flexDirection: 'row',
    gap: moderateScale(5),
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: color.divider,
  },
  weekChip: {
    flex: 1,
    height: moderateScale(34),
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: color.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.surface,
  },
  weekChipOn: { backgroundColor: color.accent, borderColor: color.accent },
  weekChipText: {
    fontFamily: fonts.mono,
    fontSize: moderateScale(12),
    fontWeight: '600',
    color: color.textMuted,
  },
  weekChipTextOn: { color: color.bg },

  addDay: {
    height: CONTROL_HEIGHT,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: color.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xs,
  },
  addDayText: { ...type.subhead, fontWeight: '600', color: color.textSecondary },

  footnote: {
    ...type.footnote,
    color: color.textMuted,
    marginTop: spacing.md,
    marginHorizontal: spacing.xs,
  },

  empty: { paddingTop: spacing.xl, paddingHorizontal: spacing.xs, gap: spacing.md },
  emptyTitle: { ...type.title2, color: color.textPrimary },
  emptyBody: { ...type.subhead, lineHeight: moderateScale(21), color: color.textSecondary },
  emptyBtn: {
    height: CONTROL_HEIGHT,
    borderRadius: radius.md,
    backgroundColor: color.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  emptyBtnPressed: { backgroundColor: color.accentPressed },
  emptyBtnText: { ...type.headline, color: color.bg },
  emptyHint: { ...type.footnote, color: color.textMuted },
});
