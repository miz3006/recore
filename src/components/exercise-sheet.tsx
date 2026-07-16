import { useMemo } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getExerciseStats, type ExerciseStats } from '@/lib/db/exercise-stats';
import { tap } from '@/lib/haptics';
import {
  alpha,
  color,
  fonts,
  HIT,
  MAX_FONT_SCALE,
  moderateScale,
  radius,
  spacing,
  type,
} from '@/lib/theme';
import { groupThousands } from '@/lib/parse/estimate';
import { labelForDay, useSession } from '@/state/session-store';

import { SheetGrabber } from './sheet-grabber';

/**
 * Exercise bottom sheet (CLAUDE.md §8): tap a parsed value in the right gutter
 * → the last 5 sessions of that exercise, a volume chart, and an estimated
 * 1RM. Monochrome ledger, not a dashboard: the e1RM is the one big number
 * (the app's strongest voice), bars carry volume at 30% white with the latest
 * session at full, and each session reads as one quiet mono row.
 */
const CHART_HEIGHT = moderateScale(72);

export function ExerciseSheet() {
  const insets = useSafeAreaInsets();
  const userId = useSession((s) => s.userId);
  const sheetExercise = useSession((s) => s.sheetExercise);
  const closeExerciseSheet = useSession((s) => s.closeExerciseSheet);

  const stats: ExerciseStats | null = useMemo(() => {
    if (!userId || !sheetExercise) return null;
    return getExerciseStats(userId, sheetExercise);
  }, [userId, sheetExercise]);

  const close = () => {
    tap();
    closeExerciseSheet();
  };

  const maxVolume = Math.max(1, ...(stats?.sessions.map((s) => s.volume) ?? [1]));

  return (
    <Modal visible={sheetExercise !== null} transparent animationType="slide" onRequestClose={close}>
      <View style={styles.backdropWrap}>
        <Pressable style={styles.backdrop} onPress={close} />

        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
          <SheetGrabber />
          <View style={styles.header}>
            <Text style={styles.title} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              {stats?.canonical ?? sheetExercise}
            </Text>
            <Pressable onPress={close} hitSlop={spacing.sm}>
              <Text style={styles.done} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                Done
              </Text>
            </Pressable>
          </View>

          {stats ? (
            <>
              {/* Estimated 1RM — the one big number. */}
              {stats.e1rm != null ? (
                <View style={styles.e1rmBlock}>
                  <Text style={styles.e1rm} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                    {formatKg(stats.e1rm)}
                    <Text style={styles.e1rmUnit}> kg</Text>
                  </Text>
                  <Text style={styles.e1rmLabel} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                    estimated 1RM
                  </Text>
                </View>
              ) : null}

              {/* Volume per session — latest at full white. */}
              <View style={styles.chart}>
                {stats.sessions.map((s, i) => (
                  <View key={s.day} style={styles.barSlot}>
                    <View
                      style={[
                        styles.bar,
                        {
                          height: Math.max(3, (s.volume / maxVolume) * CHART_HEIGHT),
                          backgroundColor:
                            i === stats.sessions.length - 1
                              ? color.accent
                              : alpha(color.accent, 0.28),
                        },
                      ]}
                    />
                  </View>
                ))}
              </View>

              {/* Last sessions, newest first. */}
              <View style={styles.rows}>
                {[...stats.sessions].reverse().map((s) => (
                  <View key={s.day} style={styles.row}>
                    <Text style={styles.rowDay} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                      {labelForDay(s.day)}
                    </Text>
                    <Text style={styles.rowSet} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                      {s.topWeight != null
                        ? `${s.setCount}×${s.topReps ?? '—'}  ${formatKg(s.topWeight)}`
                        : s.topReps != null
                          ? `${s.setCount}×${s.topReps}`
                          : `${s.setCount} sets`}
                    </Text>
                    <Text style={styles.rowVolume} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                      {s.volume > 0 ? groupThousands(s.volume) : ''}
                    </Text>
                  </View>
                ))}
              </View>
            </>
          ) : (
            <Text style={styles.empty} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              No logged sessions yet.
            </Text>
          )}
        </View>
      </View>
    </Modal>
  );
}

function formatKg(n: number): string {
  return String(Math.round(n * 100) / 100);
}

const styles = StyleSheet.create({
  backdropWrap: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: alpha('#000000', 0.6),
  },
  sheet: {
    backgroundColor: color.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: HIT,
  },
  title: {
    color: color.textPrimary,
    fontSize: type.headline.fontSize,
    fontWeight: '600',
  },
  done: {
    color: color.textPrimary,
    fontSize: type.subhead.fontSize,
    fontWeight: '600',
  },
  e1rmBlock: {
    marginTop: spacing.sm,
  },
  e1rm: {
    ...type.bigNumber,
    color: color.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  e1rmUnit: {
    fontSize: type.headline.fontSize,
    fontWeight: '600',
    color: color.textSecondary,
  },
  e1rmLabel: {
    ...type.caption,
    color: color.textMuted,
    marginTop: -spacing.xs,
  },
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    height: CHART_HEIGHT,
    marginTop: spacing.xl,
  },
  barSlot: {
    flex: 1,
    alignItems: 'stretch',
    justifyContent: 'flex-end',
  },
  bar: {
    borderRadius: 2,
  },
  rows: {
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: color.border,
    gap: spacing.md,
  },
  rowDay: {
    flex: 1,
    color: color.textSecondary,
    fontSize: type.subhead.fontSize,
  },
  rowSet: {
    fontFamily: fonts.mono,
    fontSize: type.subhead.fontSize,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
    color: color.textPrimary,
  },
  rowVolume: {
    width: moderateScale(64),
    textAlign: 'right',
    fontFamily: fonts.mono,
    fontSize: type.caption.fontSize,
    fontVariant: ['tabular-nums'],
    color: color.textMuted,
  },
  empty: {
    ...type.subhead,
    color: color.textMuted,
    paddingVertical: spacing.xxl,
  },
});
