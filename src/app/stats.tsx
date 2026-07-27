import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/icon';
import { FadeSlideIn, PressableScale, Stagger } from '@/components/motion';
import { AppButton, Eyebrow } from '@/components/primitives';
import { SessionSheet } from '@/components/session-sheet';
import { StubScreen } from '@/components/stub-screen';
import { shiftDayKey, type DayKey } from '@/lib/db/dates';
import {
  getAllTimePRs,
  getRecentSessions,
  getSessionExerciseNames,
} from '@/lib/db/insights';
import { getStatsSummary } from '@/lib/db/stats';
import { tap } from '@/lib/haptics';
import { groupThousands } from '@/lib/parse/estimate';
import { fmtNumber } from '@/lib/parse/summarize';
import { color, fonts, MAX_FONT_SCALE, moderateScale, radius, shadow, spacing, type } from '@/lib/theme';
import { labelForDay, useSession } from '@/state/session-store';

/**
 * /stats — the Progress hub, reshaped to design frame 07 "History — week in
 * review". A segmented control swaps between HISTORY (a paginated week: the
 * "Volume by day" 7-bar chart + the week's session list, with the offered plan
 * as the last, green PLANNED row) and LIFTS (the all-time record book). Every
 * number still comes from the data layer — this screen just says it out loud in
 * the record-contract voice: recorded work is ink, the ONE planned session is
 * the only green on the screen, and a PR is a neutral outlined label.
 */
const PR_ROWS = 8;
/** How many recent parsed sessions to hold in memory for week pagination. */
const SESSION_WINDOW = 200;
const MIN_BAR_PCT = 8;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/** "Jul 13" from a DayKey — the week paginator's endpoint labels. */
function monthDay(day: DayKey): string {
  const [, m, d] = day.split('-').map(Number);
  return `${MONTHS[(m ?? 1) - 1]} ${d}`;
}

/** A session's title, derived from its logged exercises (no session names in
 * the data) — "Bench Press, Squat +2". Falls back to a neutral word. */
function sessionTitle(workoutId: string, exercises: number): string {
  const names = getSessionExerciseNames(workoutId, 2);
  if (names.length === 0) return 'Session';
  const extra = exercises - names.length;
  return extra > 0 ? `${names.join(', ')} +${extra}` : names.join(', ');
}

type BarKind = 'recorded' | 'rest';
interface DayBar {
  letter: string;
  kind: BarKind;
  pct: number;
}
interface WeekSession {
  workoutId: string;
  day: DayKey;
  sets: number;
  volume: number;
  title: string;
  isPr: boolean;
}

export default function Stats() {
  const router = useRouter();
  const userId = useSession((s) => s.userId);
  const openSessionSheet = useSession((s) => s.openSessionSheet);

  // Cheap synchronous SQLite reads — re-run on every focus so a round trip
  // through /settings (CSV import) or a fresh parse lands here immediately.
  const [refresh, setRefresh] = useState(0);
  useFocusEffect(
    useCallback(() => {
      setRefresh((n) => n + 1);
    }, []),
  );

  const [tab, setTab] = useState<'history' | 'lifts'>('history');
  /** Weeks stepped back from the current ISO week (0 = this week). */
  const [weekBack, setWeekBack] = useState(0);

  /* eslint-disable react-hooks/exhaustive-deps */
  const data = useMemo(() => (userId ? getStatsSummary(userId) : null), [userId, refresh]);
  // A generous slice of the record book: the LIFTS tab shows the top PR_ROWS,
  // the "Full record book" affordance keys off the overflow, and every PR day
  // becomes a session's PR chip.
  const prs = useMemo(() => (userId ? getAllTimePRs(userId, SESSION_WINDOW) : []), [userId, refresh]);
  const sessions = useMemo(
    () => (userId ? getRecentSessions(userId, SESSION_WINDOW) : []),
    [userId, refresh],
  );

  // The week's view model: label, paginator bounds, the 7 day bars, the
  // enriched session list, and the week-over-week delta. Recomputes when the
  // data refreshes or the user steps to another week.
  const view = useMemo(() => {
    if (!data) return null;
    const weeks = data.weeks;
    const weekIndex = Math.max(0, Math.min(weeks.length - 1, weeks.length - 1 - weekBack));
    const isCurrentWeek = weekBack === 0;
    const monday = weeks[weekIndex]!.weekStart;
    const sunday = shiftDayKey(monday, 6);

    const prDays = new Set(prs.map((p) => p.day));
    const inWeek = sessions
      .filter((s) => s.day >= monday && s.day <= sunday)
      .sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));

    const volByDay = new Map<DayKey, number>();
    for (const s of inWeek) volByDay.set(s.day, (volByDay.get(s.day) ?? 0) + s.volume);

    const recordedVols = Array.from({ length: 7 }, (_, i) => volByDay.get(shiftDayKey(monday, i)) ?? 0);
    const maxVol = Math.max(1, ...recordedVols);

    const bars: DayBar[] = DAY_LETTERS.map((letter, i) => {
      const dk = shiftDayKey(monday, i);
      const vol = volByDay.get(dk) ?? 0;
      if (vol > 0) {
        return { letter, kind: 'recorded', pct: Math.max(MIN_BAR_PCT, Math.round((vol / maxVol) * 100)) };
      }
      return { letter, kind: 'rest', pct: 0 };
    });

    const weekSessions: WeekSession[] = inWeek.map((s) => ({
      workoutId: s.workoutId,
      day: s.day,
      sets: s.sets,
      volume: s.volume,
      title: sessionTitle(s.workoutId, s.exercises),
      isPr: prDays.has(s.day),
    }));

    const cur = weeks[weekIndex]!.volume;
    const prevW = weekIndex > 0 ? weeks[weekIndex - 1]!.volume : 0;
    const selectedWoW =
      cur > 0 && prevW > 0 ? Math.round(((cur - prevW) / prevW) * 100) : null;

    return {
      weekLabel: `${monthDay(monday)} – ${monthDay(sunday)}`,
      weekSub: weekBack === 0 ? 'This week' : weekBack === 1 ? 'Last week' : `${weekBack} weeks ago`,
      canGoBack: weekBack < weeks.length - 1,
      canGoForward: weekBack > 0,
      isCurrentWeek,
      weekTotal: cur,
      bars,
      sessions: weekSessions,
      selectedWoW,
    };
  }, [data, sessions, prs, weekBack]);
  /* eslint-enable react-hooks/exhaustive-deps */

  const hasAny = (data?.weeks.some((w) => w.volume > 0) ?? false) || prs.length > 0;

  if (!hasAny || !view) {
    // The honest empty state: a dashed card, a plain explanation, a bordered
    // action — never an invented dashboard.
    return (
      <StubScreen title="Progress">
        <FadeSlideIn>
          <View style={styles.emptyCard}>
            <Eyebrow>Progress</Eyebrow>
            <Text style={styles.emptyTitle} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              Your training, measured.
            </Text>
            <Text style={styles.emptyBody} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              Log one session — or import your history — and this screen fills with volume,
              records, and what the predictor writes next.
            </Text>
            <View style={styles.emptyActions}>
              <AppButton
                label="Import from Hevy or Strong"
                variant="secondary"
                compact
                onPress={() => router.push('/settings')}
              />
            </View>
          </View>
        </FadeSlideIn>
      </StubScreen>
    );
  }

  const weeks = data!.weeks;
  const rowCount = view.sessions.length;

  return (
    <StubScreen title="Progress">
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        {/* Segmented control — History (ink pill) / Lifts. */}
        <View style={styles.segmentRow}>
          <View style={styles.segment}>
            {(['history', 'lifts'] as const).map((t) => {
              const active = tab === t;
              return (
                <PressableScale
                  key={t}
                  haptic="none"
                  activeScale={0.96}
                  onPress={() => {
                    tap();
                    setTab(t);
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  style={[styles.segItem, active && styles.segItemActive]}
                  pressedStyle={active ? undefined : styles.pressed}>
                  <Text
                    style={[styles.segText, active && styles.segTextActive]}
                    maxFontSizeMultiplier={MAX_FONT_SCALE}>
                    {t === 'history' ? 'History' : 'Lifts'}
                  </Text>
                </PressableScale>
              );
            })}
          </View>
        </View>

        {tab === 'history' ? (
          <Stagger step={55} initialDelay={80}>
            {/* Week paginator — back enabled, forward disabled on the current week. */}
            <View style={styles.paginator}>
              <PressableScale
                haptic="none"
                activeScale={0.92}
                disabled={!view.canGoBack}
                onPress={() => {
                  tap();
                  setWeekBack((w) => Math.min(weeks.length - 1, w + 1));
                }}
                accessibilityRole="button"
                accessibilityLabel="Previous week"
                style={[styles.chevBtn, !view.canGoBack && styles.chevDisabled]}
                pressedStyle={styles.pressed}>
                <Icon name="chevron-back" size={moderateScale(16)} tint={color.textPrimary} />
              </PressableScale>
              <View style={styles.paginatorCenter}>
                <Text style={styles.weekLabel} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                  {view.weekLabel}
                </Text>
                <Text style={styles.weekSub} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                  {view.weekSub}
                </Text>
              </View>
              <PressableScale
                haptic="none"
                activeScale={0.92}
                disabled={!view.canGoForward}
                onPress={() => {
                  tap();
                  setWeekBack((w) => Math.max(0, w - 1));
                }}
                accessibilityRole="button"
                accessibilityLabel="Next week"
                style={[styles.chevBtn, !view.canGoForward && styles.chevDisabled]}
                pressedStyle={styles.pressed}>
                <Icon name="chevron-forward" size={moderateScale(16)} tint={color.textPrimary} />
              </PressableScale>
            </View>

            {/* Volume by day. */}
            <View style={styles.card}>
              <View style={styles.cardHead}>
                <Eyebrow>Volume by day</Eyebrow>
                <Text style={styles.cardTotal} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                  {groupThousands(view.weekTotal)} kg
                </Text>
              </View>
              <View style={styles.chartRow}>
                {view.bars.map((b, i) => (
                  <View key={i} style={styles.barCol}>
                    {b.kind === 'recorded' ? (
                      <View style={[styles.barRecorded, { height: `${b.pct}%` }]} />
                    ) : (
                      <View style={styles.barRest} />
                    )}
                  </View>
                ))}
              </View>
              <View style={styles.dayRow}>
                {view.bars.map((b, i) => (
                  <Text
                    key={i}
                    style={[styles.dayLetter, b.kind === 'recorded' && styles.dayRecorded]}
                    maxFontSizeMultiplier={MAX_FONT_SCALE}>
                    {b.letter}
                  </Text>
                ))}
              </View>
              <View style={styles.legend}>
                <View style={styles.legendItem}>
                  <View style={styles.swatchRecorded} />
                  <Text style={styles.legendText} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                    Recorded
                  </Text>
                </View>
              </View>
            </View>

            {/* One quiet archival insight — the week-over-week delta (never green). */}
            {view.selectedWoW != null ? (
              <Text style={styles.insight} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                {view.selectedWoW >= 0
                  ? `Up ${view.selectedWoW}% on the previous week.`
                  : `Down ${Math.abs(view.selectedWoW)}% on the previous week.`}
              </Text>
            ) : null}

            {/* The week's session list. Recorded rows are ink; the offered plan
                is the last row, in green, with a PLANNED chip. */}
            <View style={styles.listCard}>
              {rowCount === 0 ? (
                <Text style={styles.emptyWeek} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                  No sessions recorded this week.
                </Text>
              ) : (
                <>
                  {view.sessions.map((s, i) => {
                    const isLast = i === view.sessions.length - 1;
                    return (
                      <PressableScale
                        key={s.workoutId}
                        haptic="none"
                        activeScale={0.98}
                        onPress={() => {
                          tap();
                          openSessionSheet(s.workoutId);
                        }}
                        accessibilityRole="button"
                        style={[styles.sessionRow, !isLast && styles.rowDivider]}
                        pressedStyle={styles.pressed}>
                        <View style={styles.rowText}>
                          <View style={styles.titleLine}>
                            <Text
                              style={styles.rowTitle}
                              numberOfLines={1}
                              maxFontSizeMultiplier={MAX_FONT_SCALE}>
                              {s.title}
                            </Text>
                            {s.isPr ? (
                              <View style={styles.prChip}>
                                <Text style={styles.prChipText} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                                  PR
                                </Text>
                              </View>
                            ) : null}
                          </View>
                          <Text style={styles.rowSub} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                            {labelForDay(s.day)} · {s.sets} {s.sets === 1 ? 'set' : 'sets'}
                          </Text>
                        </View>
                        <Text style={styles.rowValue} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                          {s.volume > 0 ? `${groupThousands(s.volume)} kg` : '—'}
                        </Text>
                      </PressableScale>
                    );
                  })}
                </>
              )}
            </View>
          </Stagger>
        ) : (
          /* LIFTS — the all-time record book, heaviest first. */
          <View style={styles.listCard}>
            <Stagger step={45} initialDelay={60}>
              {prs.slice(0, PR_ROWS).map((pr, i, arr) => {
                // Last row drops its divider; when the Pro affordance follows, its
                // own top border is the separating rule (no doubled hairline).
                const isLast = i === arr.length - 1;
                return (
                  <View key={pr.canonical} style={[styles.sessionRow, !isLast && styles.rowDivider]}>
                    <View style={styles.rowText}>
                      <Text
                        style={styles.rowTitle}
                        numberOfLines={1}
                        maxFontSizeMultiplier={MAX_FONT_SCALE}>
                        {pr.canonical}
                      </Text>
                      <Text style={styles.rowSub} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                        {labelForDay(pr.day)}
                      </Text>
                    </View>
                    <Text style={styles.rowValue} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                      {fmtNumber(pr.weightKg)}
                      {pr.reps != null ? ` × ${pr.reps}` : ''} kg
                    </Text>
                  </View>
                );
              })}
              {prs.length > PR_ROWS ? (
                <PressableScale
                  haptic="none"
                  activeScale={0.98}
                  onPress={() => {
                    tap();
                    router.push('/paywall');
                  }}
                  accessibilityRole="button"
                  style={styles.proRow}
                  pressedStyle={styles.pressed}>
                  <Text style={styles.proLabel} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                    Full record book · Recore Pro
                  </Text>
                </PressableScale>
              ) : null}
            </Stagger>
          </View>
        )}

      </ScrollView>
      <SessionSheet />
    </StubScreen>
  );
}

const CHEV = moderateScale(34);

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    marginHorizontal: -spacing.xxl, // StubScreen pads the body; the scroll owns it
  },
  content: {
    paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.huge,
    gap: spacing.lg,
  },

  // --- segmented control ------------------------------------------------------
  segmentRow: {
    alignItems: 'center',
  },
  segment: {
    flexDirection: 'row',
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.pill,
    padding: moderateScale(3),
  },
  segItem: {
    paddingVertical: spacing.sm - 1,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.pill,
  },
  segItemActive: {
    backgroundColor: color.accent,
  },
  segText: {
    ...type.subhead,
    fontWeight: '600',
    color: color.textSecondary,
  },
  segTextActive: {
    color: color.bg,
  },

  // --- week paginator ---------------------------------------------------------
  paginator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xl,
  },
  chevBtn: {
    width: CHEV,
    height: CHEV,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chevDisabled: {
    opacity: 0.4,
  },
  paginatorCenter: {
    alignItems: 'center',
    minWidth: moderateScale(140),
  },
  weekLabel: {
    ...type.headline,
    color: color.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  weekSub: {
    ...type.caption,
    marginTop: 2,
    color: color.textSecondary,
  },

  // --- cards ------------------------------------------------------------------
  card: {
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.divider,
    borderRadius: radius.lg,
    padding: spacing.xl,
    ...shadow.card,
  },
  cardHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  cardTotal: {
    fontFamily: fonts.mono,
    fontSize: type.caption.fontSize,
    color: color.textSecondary,
    fontVariant: ['tabular-nums'],
  },

  // --- volume-by-day chart ----------------------------------------------------
  chartRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.md,
    height: moderateScale(120),
    marginTop: spacing.lg,
  },
  barCol: {
    flex: 1,
    height: '100%',
    justifyContent: 'flex-end',
  },
  barRecorded: {
    width: '100%',
    backgroundColor: color.accent,
    borderRadius: 5,
  },
  barRest: {
    width: '100%',
    height: 2,
    backgroundColor: color.border,
    borderRadius: 1,
  },
  dayRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  dayLetter: {
    flex: 1,
    textAlign: 'center',
    fontSize: moderateScale(12),
    color: color.textMuted,
  },
  dayRecorded: {
    color: color.textSecondary,
    fontWeight: '600',
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.lg,
    marginTop: spacing.lg,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm - 1,
  },
  swatchRecorded: {
    width: moderateScale(10),
    height: moderateScale(10),
    borderRadius: 3,
    backgroundColor: color.accent,
  },
  legendText: {
    fontSize: moderateScale(12),
    color: color.textSecondary,
  },

  insight: {
    ...type.caption,
    color: color.textSecondary,
    fontVariant: ['tabular-nums'],
    marginTop: -spacing.sm,
  },

  // --- session / record list --------------------------------------------------
  listCard: {
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.divider,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.xl,
    ...shadow.card,
  },
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.md + 1,
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: color.tableRule,
  },
  rowText: {
    flex: 1,
  },
  titleLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  rowTitle: {
    ...type.subhead,
    flexShrink: 1,
    fontWeight: '600',
    color: color.textPrimary,
  },
  rowSub: {
    ...type.caption,
    marginTop: 3,
    color: color.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  rowValue: {
    ...type.caption,
    fontFamily: fonts.mono,
    color: color.textSecondary,
    fontVariant: ['tabular-nums'],
    textAlign: 'right',
  },
  prChip: {
    borderWidth: 1,
    borderColor: color.textPrimary,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  prChipText: {
    fontFamily: fonts.mono,
    fontSize: moderateScale(11),
    fontWeight: '700',
    letterSpacing: 0.5,
    color: color.textPrimary,
  },

  emptyWeek: {
    ...type.subhead,
    color: color.textMuted,
    paddingVertical: spacing.xl,
  },

  proRow: {
    paddingVertical: spacing.md + 1,
    borderTopWidth: 1,
    borderTopColor: color.tableRule,
  },
  proLabel: {
    ...type.caption,
    color: color.textSecondary,
  },

  // --- empty state ------------------------------------------------------------
  pressed: {
    backgroundColor: color.surfaceHigh,
  },
  emptyCard: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: color.border,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.md,
  },
  emptyTitle: {
    ...type.headline,
    fontWeight: '600',
    color: color.textPrimary,
  },
  emptyBody: {
    ...type.subhead,
    color: color.textSecondary,
  },
  emptyActions: {
    flexDirection: 'row',
    marginTop: spacing.xs,
  },
});
