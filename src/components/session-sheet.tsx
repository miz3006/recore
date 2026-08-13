import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  getAllTimePRs,
  getWorkoutDetail,
  type WorkoutSet,
} from '@/lib/db/insights';
import { groupThousands } from '@/lib/parse/estimate';
import { fmtNumber } from '@/lib/parse/summarize';
import { color, fonts, lineFor, MAX_FONT_SCALE, moderateScale, radius, spacing, type } from '@/lib/theme';
import { labelForDay, useSession } from '@/state/session-store';

import { BottomSheet } from './bottom-sheet';

/**
 * SessionSheet (progress spec §3.7) — the forensic floor of the drill-down.
 * Tap a recorded session anywhere and this answers "what were the exact sets
 * that day?": every counted set as `100 kg × 8 · e1RM 125`, warm-ups dimmed and
 * excluded, drops indented under their parent, supersets flagged by their
 * shared group. The parser's RIR reading rides along in the quiet INTERPRETED
 * voice (mono, muted) — never dressed up as the user's verbatim words. RECORDED
 * work only: no chart, no green, PR is the one neutral outlined mono label.
 */

const PR_SCAN = 400;

/** Epley over a sane rep cap so a 20-rep burnout doesn't fake a max. */
function e1rmOf(weight: number | null, reps: number | null): number | null {
  if (weight == null || reps == null || reps < 1 || reps > 12) return null;
  return Math.round((weight * (1 + reps / 30)) / 0.5) * 0.5;
}

function fmtDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const r = sec % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

/** The right-aligned mono reading for one set — weight, cardio, or bodyweight. */
function setValue(s: WorkoutSet): string {
  if (s.weightKg != null) {
    return s.reps != null ? `${fmtNumber(s.weightKg)} kg × ${s.reps}` : `${fmtNumber(s.weightKg)} kg`;
  }
  if (s.distanceM != null) {
    const km = `${fmtNumber(s.distanceM / 1000)} km`;
    return s.durationS != null ? `${km} · ${fmtDuration(s.durationS)}` : km;
  }
  if (s.durationS != null) return fmtDuration(s.durationS);
  if (s.reps != null) return `× ${s.reps}`;
  return '—';
}

export function SessionSheet() {
  const insets = useSafeAreaInsets();
  const userId = useSession((s) => s.userId);
  const sheetSession = useSession((s) => s.sheetSession);
  const closeSessionSheet = useSession((s) => s.closeSessionSheet);

  const detail = useMemo(
    () => (sheetSession ? getWorkoutDetail(sheetSession) : null),
    [sheetSession],
  );

  // All-time bests, to mark the set that set a record (same rule as the lift
  // sheet: heaviest counted set on the day it was set).
  const prMap = useMemo(() => {
    const m = new Map<string, { weightKg: number; day: string }>();
    if (!userId) return m;
    for (const p of getAllTimePRs(userId, PR_SCAN)) {
      m.set(p.canonical.toLowerCase(), { weightKg: p.weightKg, day: p.day });
    }
    return m;
  }, [userId]);

  const close = () => {
    closeSessionSheet();
  };

  const exerciseCount = detail?.exercises.length ?? 0;

  return (
    <BottomSheet
      visible={sheetSession !== null}
      onClose={close}
      sheetStyle={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
      <View style={styles.header}>
        <View style={styles.namePill}>
          <Text style={styles.nameText} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {detail ? labelForDay(detail.day) : 'Session'}
          </Text>
        </View>
      </View>

      {detail && exerciseCount > 0 ? (
        <>
          <Text style={styles.heroLine} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {exerciseCount} {exerciseCount === 1 ? 'exercise' : 'exercises'} · {detail.countedSets}{' '}
            {detail.countedSets === 1 ? 'set' : 'sets'}
            {detail.volume > 0 ? ` · ${groupThousands(detail.volume)} kg` : ''}
          </Text>

          <ScrollView
            style={styles.scroll}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}>
            {detail.exercises.map((ex, ei) => {
              const prForEx = prMap.get(ex.canonical.toLowerCase());
              let working = 0;
              return (
                <View key={ex.itemId} style={[styles.exBlock, ei > 0 && styles.exDivider]}>
                  <View style={styles.exHead}>
                    <Text style={styles.exName} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                      {ex.canonical}
                    </Text>
                    {ex.groupKey ? (
                      <Text style={styles.groupTag} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                        SUPERSET
                      </Text>
                    ) : null}
                  </View>

                  {ex.sets.map((s, si) => {
                    const isWarm = s.kind === 'warmup';
                    const isDrop = !isWarm && (s.kind === 'drop' || s.parentSetId != null);
                    if (!isWarm && !isDrop) working += 1;
                    const label = isWarm ? 'Warm-up' : isDrop ? 'Drop' : `Set ${working}`;
                    const e = isWarm ? null : e1rmOf(s.weightKg, s.reps);
                    const isPr =
                      !isWarm &&
                      s.weightKg != null &&
                      prForEx != null &&
                      s.weightKg === prForEx.weightKg &&
                      detail.day === prForEx.day;
                    return (
                      <View key={si} style={[styles.setRow, isDrop && styles.setRowDrop]}>
                        <View style={styles.setLeft}>
                          <Text
                            style={[styles.setLabel, isWarm && styles.setLabelMuted]}
                            maxFontSizeMultiplier={MAX_FONT_SCALE}>
                            {label}
                          </Text>
                          {isPr ? (
                            <Text style={styles.prLabel} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                              PR
                            </Text>
                          ) : null}
                        </View>
                        <Text
                          style={[styles.setValue, isWarm && styles.setValueMuted]}
                          maxFontSizeMultiplier={MAX_FONT_SCALE}>
                          {setValue(s)}
                          {e != null ? <Text style={styles.setMeta}>{`  ·  e1RM ${fmtNumber(e)}`}</Text> : null}
                          {!isWarm && s.rir != null ? (
                            <Text style={styles.setMeta}>{`  ·  RIR ${fmtNumber(s.rir)}`}</Text>
                          ) : null}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              );
            })}

            <Text style={styles.footer} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              Recorded work only, exactly as read from your note.
            </Text>
          </ScrollView>
        </>
      ) : (
        <Text style={styles.empty} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          Nothing recorded for this session.
        </Text>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: color.bg,
    paddingHorizontal: spacing.xl,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  namePill: {
    paddingVertical: moderateScale(9),
    paddingHorizontal: spacing.xl,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surface,
    borderRadius: radius.pill,
    maxWidth: '80%',
  },
  nameText: {
    fontSize: type.subhead.fontSize,
    fontWeight: '600',
    color: color.textPrimary,
  },
  heroLine: {
    marginTop: spacing.lg,
    fontFamily: fonts.reading,
    fontSize: moderateScale(13),
    color: color.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  scroll: {
    flexShrink: 1,
    marginTop: spacing.sm,
  },
  scrollContent: {
    paddingBottom: spacing.sm,
  },

  exBlock: {
    paddingVertical: spacing.md,
  },
  exDivider: {
    borderTopWidth: 1,
    borderTopColor: color.tableRule,
  },
  exHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  exName: {
    flexShrink: 1,
    fontSize: type.subhead.fontSize,
    fontWeight: '600',
    color: color.textPrimary,
  },
  groupTag: {
    fontFamily: fonts.reading,
    fontVariant: ['tabular-nums'],
    fontSize: moderateScale(9),
    fontWeight: '700',
    letterSpacing: 0.6,
    color: color.textMuted,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: 5,
    paddingHorizontal: 5,
    paddingVertical: 1,
    overflow: 'hidden',
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.sm - 1,
  },
  setRowDrop: {
    paddingLeft: spacing.lg,
  },
  setLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  setLabel: {
    fontSize: moderateScale(13),
    color: color.textSecondary,
  },
  setLabelMuted: {
    color: color.textMuted,
  },
  prLabel: {
    fontFamily: fonts.reading,
    fontVariant: ['tabular-nums'],
    fontSize: moderateScale(10),
    fontWeight: '700',
    letterSpacing: 0.5,
    color: color.textPrimary,
    borderWidth: 1,
    borderColor: color.accent,
    borderRadius: 5,
    paddingHorizontal: 5,
    paddingVertical: 0,
    overflow: 'hidden',
  },
  setValue: {
    flexShrink: 1,
    textAlign: 'right',
    fontFamily: fonts.reading,
    fontSize: moderateScale(13),
    color: color.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  setValueMuted: {
    color: color.textMuted,
  },
  setMeta: {
    color: color.textMuted,
  },
  footer: {
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    fontSize: moderateScale(12),
    lineHeight: lineFor(19),
    color: color.textMuted,
  },
  empty: {
    ...type.subhead,
    color: color.textMuted,
    paddingVertical: spacing.xxl,
  },
});
