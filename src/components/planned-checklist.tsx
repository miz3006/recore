import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';

import { tap, tapMedium } from '@/lib/haptics';
import {
  formatKg,
  movesOf,
  ownsExercise,
  plannedTotals,
  remainingSets,
  type PlannedSet,
} from '@/lib/planned-session';
import {
  color,
  CONTROL_HEIGHT,
  FIXED_FONT_SCALE,
  fonts,
  hairline,
  HIT,
  lineFor,
  MAX_FONT_SCALE,
  moderateScale,
  radius,
  shadow,
  spacing,
  type,
} from '@/lib/theme';
import { useSession } from '@/state/session-store';

import { MonoTag } from './gutter-value';
import { BottomSheet } from './bottom-sheet';
import { PressableScale } from './motion';

/**
 * UNMOUNTED. Its only entry point was the session picker (retired 17 Aug 2026),
 * and its host `components/session-start.tsx` was deleted on 18 Aug when the
 * plan left Today for Next. Kept on disk, like `plan-strip.tsx`, so the
 * checklist is one wire away if a way back in is ever wanted.
 */

/**
 * The prefilled session (owner's spec §E, 13 Aug 2026): the picker's answer,
 * drawn as a checklist of PLANNED sets above the note.
 *
 * Each row is one set — an unchecked circle, its number, and the load and reps
 * the prescription engine recommends, in the app's planned green (#547C00,
 * `color.signal`). That green is the record contract's fourth state and means
 * exactly one thing: a number nobody has lifted yet. The instant a set is
 * ticked its row loses the green and joins the record's own ink, because by
 * then it is history rather than a plan.
 *
 * NONE of it counts until it is ticked (§E.2), and that is structural rather
 * than remembered: a planned row has never been written into `raw_text`, which
 * is the only thing today's totals, the week, the streak and every statistic
 * are computed from. Ticking a circle writes the line (§E.3) — and from that
 * moment the set counts everywhere, through the path a typed line has always
 * taken.
 *
 * Tapping the VALUES (or holding the row) opens the editor, for the ordinary
 * case where the plan said 80 × 8 and the eighth rep was not there.
 *
 * Writing free text keeps working exactly as before (§E.4). A movement the
 * athlete writes themselves is released by the state machine: its rows still
 * tick, and the checklist never touches its line again.
 */
export function PlannedChecklist() {
  const session = useSession((s) => s.plannedSession);
  const logSet = useSession((s) => s.logPlannedSet);
  const unlogSet = useSession((s) => s.unlogPlannedSet);
  const clear = useSession((s) => s.clearPlannedSession);
  const reduceMotion = useReducedMotion();
  const [editing, setEditing] = useState<PlannedSet | null>(null);

  if (!session || session.sets.length === 0) return null;

  const totals = plannedTotals(session);
  const remaining = remainingSets(session);

  const toggle = (set: PlannedSet) => {
    if (set.state === 'logged') {
      tap();
      unlogSet(set.id);
      return;
    }
    tapMedium();
    logSet(set.id);
  };

  return (
    <Animated.View
      entering={reduceMotion ? undefined : FadeInDown.duration(220)}
      style={styles.card}>
      <View style={styles.top}>
        <MonoTag label="PLANNED" />
        <Text style={styles.label} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {session.label}
        </Text>
        <PressableScale
          onPress={() => {
            tap();
            clear();
          }}
          haptic="none"
          hitSlop={spacing.sm}
          accessibilityRole="button"
          accessibilityLabel="Put the plan away"
          style={styles.dismiss}>
          <Text style={styles.dismissText} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            Clear
          </Text>
        </PressableScale>
      </View>

      <Text style={styles.progress} maxFontSizeMultiplier={MAX_FONT_SCALE}>
        {totals.sets} of {session.sets.length} sets
        {remaining > 0 ? ' · nothing counts until you tick it' : ' · all done'}
      </Text>

      {movesOf(session).map(({ exercise, sets }, moveIndex) => (
        <View key={`${exercise}:${moveIndex}`} style={styles.move}>
          <View style={styles.moveHead}>
            <Text style={styles.exercise} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              {exercise}
            </Text>
            {ownsExercise(session, exercise) ? null : (
              <Text style={styles.written} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                you wrote this
              </Text>
            )}
          </View>

          {sets.map((set, i) => (
            <View key={set.id}>
              {i > 0 ? <View style={styles.rowRule} /> : null}
              <View style={styles.row}>
                <PressableScale
                  onPress={() => toggle(set)}
                  haptic="none"
                  activeScale={0.9}
                  hitSlop={spacing.sm}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: set.state === 'logged' }}
                  accessibilityLabel={`${exercise}, set ${set.index}${
                    valueOf(set) ? `, ${valueOf(set)}` : ''
                  }`}
                  style={styles.ringHit}>
                  {set.state === 'logged' ? (
                    <View style={styles.ringDone}>
                      <Text style={styles.ringCheck} maxFontSizeMultiplier={FIXED_FONT_SCALE}>
                        ✓
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.ring} />
                  )}
                </PressableScale>

                <Text style={styles.setNumber} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                  Set {set.index}
                </Text>

                <PressableScale
                  onPress={() => {
                    tap();
                    setEditing(set);
                  }}
                  onLongPress={() => {
                    tap();
                    setEditing(set);
                  }}
                  haptic="none"
                  activeScale={0.98}
                  hitSlop={spacing.xs}
                  accessibilityRole="button"
                  accessibilityLabel={`Edit set ${set.index} of ${exercise}`}
                  style={styles.valueHit}>
                  <Text
                    style={[styles.value, set.state === 'logged' && styles.valueLogged]}
                    numberOfLines={1}
                    maxFontSizeMultiplier={MAX_FONT_SCALE}>
                    {valueOf(set) || '—'}
                  </Text>
                </PressableScale>
              </View>
            </View>
          ))}
        </View>
      ))}

      <EditSetSheet set={editing} onClose={() => setEditing(null)} />
    </Animated.View>
  );
}

/** "80kg × 8", "16", or "" when the movement carries no numbers. */
function valueOf(set: PlannedSet): string {
  if (set.weightKg != null && set.reps != null) return `${formatKg(set.weightKg)} × ${set.reps}`;
  if (set.weightKg != null) return formatKg(set.weightKg);
  if (set.reps != null) return `${set.reps} reps`;
  return '';
}

/**
 * Log what actually happened instead of the plan (§E.3).
 *
 * Saving marks the set done at the edited numbers, whether it was planned or
 * already logged — editing a record is never a way to leave it. The values go
 * into the note as text, so the correction is a correction to the record and
 * not to a second, private copy of it.
 */
function EditSetSheet({ set, onClose }: { set: PlannedSet | null; onClose: () => void }) {
  const editSet = useSession((s) => s.editPlannedSet);
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');
  const [openFor, setOpenFor] = useState<string | null>(null);

  // Load the row's values once per row opened, without an effect: the sheet is
  // mounted the whole time and only its subject changes.
  if (set && openFor !== set.id) {
    setOpenFor(set.id);
    setWeight(set.weightKg == null ? '' : String(set.weightKg));
    setReps(set.reps == null ? '' : String(set.reps));
  }

  const save = () => {
    if (!set) return;
    tapMedium();
    editSet(set.id, { weightKg: toNumber(weight), reps: toNumber(reps) });
    setOpenFor(null);
    onClose();
  };

  return (
    <BottomSheet
      visible={set !== null}
      onClose={() => {
        setOpenFor(null);
        onClose();
      }}
      sheetStyle={[styles.sheet, { paddingBottom: spacing.lg }]}>
      <Text style={styles.sheetTitle} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
        {set?.exercise ?? ''}
      </Text>
      <Text style={styles.sheetCaption} maxFontSizeMultiplier={MAX_FONT_SCALE}>
        Set {set?.index ?? 1} — log what you actually did
      </Text>

      <View style={styles.fields}>
        <Field label="Weight (kg)" value={weight} onChange={setWeight} />
        <Field label="Reps" value={reps} onChange={setReps} />
      </View>

      <PressableScale
        onPress={save}
        haptic="none"
        accessibilityRole="button"
        accessibilityLabel="Save this set to the record"
        style={styles.save}
        pressedStyle={styles.savePressed}>
        <Text style={styles.saveLabel} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          Save to the record
        </Text>
      </PressableScale>
    </BottomSheet>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel} maxFontSizeMultiplier={MAX_FONT_SCALE}>
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        keyboardType="decimal-pad"
        selectTextOnFocus
        placeholder="—"
        placeholderTextColor={color.textMuted}
        style={styles.input}
        maxFontSizeMultiplier={MAX_FONT_SCALE}
        accessibilityLabel={label}
      />
    </View>
  );
}

/** An empty or unreadable field means "this movement has no such number" —
 * bodyweight rows and holds arrive that way and must stay that way. */
function toNumber(text: string): number | null {
  const n = Number(text.replace(',', '.').trim());
  return Number.isFinite(n) && n > 0 ? n : null;
}

const RING = moderateScale(22);
const RING_COL_W = moderateScale(30);

const styles = StyleSheet.create({
  card: {
    marginHorizontal: spacing.xl,
    marginBottom: spacing.md,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.divider,
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    ...shadow.card,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  label: {
    flex: 1,
    ...type.footnote,
    color: color.textSecondary,
  },
  dismiss: {
    minHeight: moderateScale(28),
    justifyContent: 'center',
  },
  dismissText: {
    ...type.caption,
    color: color.textMuted,
  },
  progress: {
    marginTop: spacing.xs,
    fontFamily: fonts.reading,
    fontSize: type.caption.fontSize,
    fontVariant: ['tabular-nums'],
    color: color.textMuted,
  },

  move: {
    marginTop: spacing.md,
  },
  moveHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  exercise: {
    flex: 1,
    ...type.subhead,
    fontWeight: '600',
    color: color.textPrimary,
  },
  written: {
    ...type.caption,
    color: color.textMuted,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: HIT,
  },
  rowRule: {
    height: hairline,
    marginLeft: RING_COL_W + spacing.sm,
    backgroundColor: color.tableRule,
  },
  ringHit: {
    width: RING_COL_W,
    minHeight: HIT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
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
    color: color.onInk,
    fontSize: moderateScale(12),
    fontWeight: '700',
    lineHeight: lineFor(14),
  },
  setNumber: {
    flex: 1,
    ...type.footnote,
    color: color.textSecondary,
  },
  valueHit: {
    minHeight: HIT,
    justifyContent: 'center',
    paddingLeft: spacing.sm,
    borderRadius: radius.sm,
    borderCurve: 'continuous',
  },
  /** THE ONLY GREEN: a load nobody has lifted yet (record contract, §4.2). */
  value: {
    fontFamily: fonts.reading,
    fontSize: type.footnote.fontSize,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
    color: color.signal,
  },
  /** Ticked: it is history now, and history is ink. */
  valueLogged: {
    color: color.textPrimary,
  },

  sheet: {
    backgroundColor: color.surface,
    paddingHorizontal: spacing.xl,
  },
  sheetTitle: {
    marginTop: spacing.sm,
    ...type.title,
    color: color.textPrimary,
  },
  sheetCaption: {
    marginTop: spacing.xs,
    ...type.caption,
    color: color.textMuted,
  },
  fields: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  field: {
    flex: 1,
    gap: spacing.xs,
  },
  fieldLabel: {
    ...type.caption,
    color: color.textSecondary,
  },
  input: {
    minHeight: CONTROL_HEIGHT,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.md,
    borderCurve: 'continuous',
    paddingHorizontal: spacing.md,
    fontFamily: fonts.reading,
    fontSize: moderateScale(17),
    fontVariant: ['tabular-nums'],
    color: color.textPrimary,
    backgroundColor: color.surface,
  },
  save: {
    marginTop: spacing.lg,
    minHeight: CONTROL_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderCurve: 'continuous',
    backgroundColor: color.ctaFill,
  },
  savePressed: {
    backgroundColor: color.ctaFillPressed,
  },
  saveLabel: {
    color: color.onInk,
    fontSize: moderateScale(16),
    fontWeight: '600',
  },
});
