import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { FadeSlideIn, PressableScale } from '@/components/motion';
import { todayKey } from '@/lib/db/dates';
import { getRecentSessions, getSessionExerciseNames } from '@/lib/db/insights';
import { hasSplit } from '@/lib/db/plan';
import { tap } from '@/lib/haptics';
import { groupThousands } from '@/lib/parse/estimate';
import { getObLanguage, getPrimaryLift, getWeightUnit, hasCoachRingDone } from '@/lib/prefs';
import {
  color,
  FIXED_FONT_SCALE,
  fonts,
  HIT,
  lineFor,
  MAX_FONT_SCALE,
  moderateScale,
  radius,
  shadow,
  spacing,
  type,
} from '@/lib/theme';
import { labelForDay, useSession } from '@/state/session-store';

import { MonoTag } from './gutter-value';
import { noteInputRef } from './note-focus';

/**
 * The empty page is never a void (CLAUDE.md §8), in the card vocabulary
 * (design brief: surface, 1px border, mono tags). Under the blank editor:
 *  - with history, the LAST SESSION peek — date, lifts, tonnage — one tap from
 *    re-reading it (the journal finally has visible depth), and
 *  - on a truly blank account, the FIRST SESSION ledger: three steps drawn in
 *    the composer's own check-ring vocabulary, where step one is performed
 *    right here — tapping a sample line writes it into the note as real text
 *    (the plan button's precedent) and the real parse runs on it. Nothing is
 *    completed by tapping "next"; every ring is earned by the real action.
 * Both disappear the moment the note has text.
 */
export function EmptyDayCards() {
  const userId = useSession((s) => s.userId);
  const selectedDay = useSession((s) => s.selectedDay);
  const selectDay = useSession((s) => s.selectDay);

  const last = useMemo(() => {
    if (!userId) return null;
    const [brief] = getRecentSessions(userId, 1, selectedDay);
    if (!brief) return null;
    return { ...brief, names: getSessionExerciseNames(brief.workoutId) };
  }, [userId, selectedDay]);

  if (!userId) return null;

  if (!last) {
    return <FirstSessionCard />;
  }

  // On an empty TODAY with a split, the session-start card (§8.2) already
  // carries the last-session line up top — a second peek here would say the
  // same thing twice on one screen.
  if (selectedDay === todayKey() && hasSplit(userId)) return null;

  return (
    <FadeSlideIn duration={260}>
      <PressableScale
        activeScale={0.98}
        haptic="none"
        onPress={() => {
          tap();
          selectDay(last.day);
        }}
        style={styles.card}
        pressedStyle={styles.pressed}
        accessibilityRole="button"
        accessibilityLabel={`Last session, ${labelForDay(last.day)}`}>
        <View style={styles.header}>
          <MonoTag label="LAST SESSION" />
          <Text style={styles.meta} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {labelForDay(last.day)}
          </Text>
        </View>
        {last.names.length > 0 ? (
          <Text style={styles.names} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {last.names.join(' · ')}
            {last.exercises > last.names.length ? ` · +${last.exercises - last.names.length}` : ''}
          </Text>
        ) : null}
        {last.sets > 0 ? (
          <Text style={styles.numbers} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {last.volume > 0 ? `${groupThousands(last.volume)} kg · ` : ''}
            {last.sets} sets
          </Text>
        ) : null}
      </PressableScale>
    </FadeSlideIn>
  );
}

/**
 * The first-run tutorial IS the product (Mobbin: Todoist's welcome project —
 * tutorial tasks completed by the real gesture; Jour — sentence starters that
 * write themselves into the first entry). Step one happens here: a tap puts a
 * real line on the page and the parse performs itself on the user's own note.
 * Steps two and three name what the settled card and Finish will teach; the
 * ring-step's live hint lives in the ledger (note-surface) and both retire on
 * the real action, never on a "got it".
 */
function FirstSessionCard() {
  const setNote = useSession((s) => s.setNote);
  const ringDone = hasCoachRingDone();

  // The samples are the user's own onboarding answers doing work: the lift
  // they said they care about leads, in their unit; a Slovenian writer gets a
  // Slovenian second line, because the parser reading their language IS the
  // pitch. Read once per mount — this card exists only on a blank account.
  const samples = useMemo(() => {
    const unit = getWeightUnit() ?? 'kg';
    const load = unit === 'lb' ? '3x8 175lb' : '3x8 80kg';
    const lift = (getPrimaryLift() ?? 'bench').toLowerCase();
    const second =
      getObLanguage() === 'slo' && unit === 'kg' ? 'počepi 5x5 100' : 'weighted dips 12-10-8';
    return [`${lift} ${load}`, second];
  }, []);

  const write = (line: string) => {
    tap();
    // The sample becomes REAL typed text — raw_text stays the source of truth
    // and the parse runs exactly as if they had written it. The trailing
    // newline settles the line and leaves a fresh input underneath.
    setNote(`${line}\n`);
    noteInputRef.current?.focus();
  };

  return (
    <FadeSlideIn duration={260}>
      <View style={styles.card}>
        <View style={styles.tagRow}>
          <MonoTag label="FIRST SESSION" />
        </View>

        {/* Step 1 — the only one that can be done right here. */}
        <View style={styles.step}>
          <View style={styles.ringCol} accessibilityElementsHidden>
            <View style={styles.ringActive} />
          </View>
          <View style={styles.stepBody}>
            <Text style={styles.stepTitle} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              Write a lift
            </Text>
            <Text style={styles.stepCaption} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              Type it like you’d text a friend — Recore reads the rest. Or tap a line to put it on
              the page:
            </Text>
            {samples.map((line) => (
              <PressableScale
                key={line}
                onPress={() => write(line)}
                haptic="none"
                activeScale={0.98}
                style={styles.sample}
                pressedStyle={styles.samplePressed}
                accessibilityRole="button"
                accessibilityLabel={`Write ${line} into the note`}>
                <Text
                  style={styles.sampleText}
                  numberOfLines={1}
                  maxFontSizeMultiplier={MAX_FONT_SCALE}>
                  {line}
                </Text>
                <Text style={styles.sampleHint} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                  write
                </Text>
              </PressableScale>
            ))}
          </View>
        </View>

        <View style={styles.stepRule} />

        {/* Step 2 — earned in the ledger: toggle a ring or open a history.
            Its ring fills from the same one-shot flag the live hint retires
            on, so the card and the hint can never disagree. */}
        <View style={styles.step}>
          <View style={styles.ringCol} accessibilityElementsHidden>
            {ringDone ? (
              <View style={styles.ringDone}>
                <Text style={styles.ringCheck} maxFontSizeMultiplier={FIXED_FONT_SCALE}>
                  ✓
                </Text>
              </View>
            ) : (
              <View style={styles.ringUpcoming} />
            )}
          </View>
          <View style={styles.stepBody}>
            <Text
              style={[styles.stepTitle, !ringDone && styles.stepTitleUpcoming]}
              maxFontSizeMultiplier={MAX_FONT_SCALE}>
              Read it back
            </Text>
            <Text style={styles.stepCaptionMuted} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              Each line settles into a card, its reading on the right. Tap the ring if you skipped
              a lift · the ⋯ opens its history.
            </Text>
          </View>
        </View>

        <View style={styles.stepRule} />

        {/* Step 3 — earned by the first Finish, which also retires this whole
            card: a finished session becomes history, and history shows the
            LAST SESSION peek here instead. */}
        <View style={styles.step}>
          <View style={styles.ringCol} accessibilityElementsHidden>
            <View style={styles.ringUpcoming} />
          </View>
          <View style={styles.stepBody}>
            <Text
              style={[styles.stepTitle, styles.stepTitleUpcoming]}
              maxFontSizeMultiplier={MAX_FONT_SCALE}>
              Finish
            </Text>
            <Text style={styles.stepCaptionMuted} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              Sets count when you finish — the receipt is your record.
            </Text>
          </View>
        </View>
      </View>
    </FadeSlideIn>
  );
}

const RING = moderateScale(22);
const RING_COL_W = moderateScale(28);

const styles = StyleSheet.create({
  card: {
    backgroundColor: color.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.divider,
    padding: spacing.lg,
    gap: spacing.sm,
    ...shadow.card,
  },
  pressed: {
    backgroundColor: color.surfaceHigh,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tagRow: {
    flexDirection: 'row', // the tag border hugs its text in a column layout
  },
  meta: {
    ...type.caption,
    fontFamily: fonts.reading,
    color: color.textMuted,
    fontVariant: ['tabular-nums'],
  },
  names: {
    ...type.subhead,
    color: color.textPrimary,
  },
  numbers: {
    ...type.caption,
    fontFamily: fonts.reading,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
    color: color.textSecondary,
  },

  // The first-session ledger: the composer's own ring + rule vocabulary, so
  // the card previews the exact marks the settled note will carry.
  step: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  ringCol: {
    width: RING_COL_W,
    alignItems: 'center',
    paddingTop: 1,
  },
  ringActive: {
    width: RING,
    height: RING,
    borderRadius: RING / 2,
    borderWidth: 1.5,
    borderColor: color.accent,
  },
  ringUpcoming: {
    width: RING,
    height: RING,
    borderRadius: RING / 2,
    borderWidth: 1.5,
    borderColor: color.border,
  },
  ringDone: {
    width: RING,
    height: RING,
    borderRadius: RING / 2,
    backgroundColor: color.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringCheck: {
    color: color.bg,
    fontSize: moderateScale(12),
    fontWeight: '700',
    lineHeight: lineFor(14),
  },
  stepBody: {
    flex: 1,
    gap: spacing.xs,
  },
  stepTitle: {
    ...type.subhead,
    fontWeight: '600',
    color: color.textPrimary,
  },
  stepTitleUpcoming: {
    color: color.textSecondary,
  },
  stepCaption: {
    ...type.caption,
    color: color.textSecondary,
  },
  stepCaptionMuted: {
    ...type.caption,
    color: color.textMuted,
  },
  // A separator between steps, never a border — inset past the ring column so
  // the rings stay one vertical run (§5.4's sibling-separator rule).
  stepRule: {
    height: StyleSheet.hairlineWidth,
    marginLeft: RING_COL_W + spacing.sm,
    backgroundColor: color.tableRule,
  },
  sample: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    minHeight: HIT,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  samplePressed: {
    backgroundColor: color.surfaceHigh,
  },
  sampleText: {
    flexShrink: 1,
    fontFamily: fonts.reading,
    fontSize: moderateScale(14),
    color: color.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  sampleHint: {
    fontSize: moderateScale(11),
    color: color.textMuted,
  },
});
