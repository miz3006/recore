import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { searchExercises } from '@/lib/db/exercises';
import { tap } from '@/lib/haptics';
import { type ParsedSet } from '@/lib/parse/types';
import { getSmallestPlateKg } from '@/lib/prefs';
import {
  color,
  CONTROL_HEIGHT,
  fonts,
  ink,
  MAX_FONT_SCALE,
  moderateScale,
  radius,
  spacing,
  type,
} from '@/lib/theme';
import { useSession } from '@/state/session-store';

import { BottomSheet } from './bottom-sheet';

/**
 * "Fix reading" (wireframe 10): fix what the parser got wrong,
 * deterministically. The user's quoted words sit untouched in a bg-inset mono
 * card; the fields below are 48pt rows; the scope section states plainly what
 * the fix will do — "Only this line" when only numbers changed, the alias
 * scope the moment the exercise name differs (that IS the existing
 * correction-vs-alias-override logic in parse/correct.ts, surfaced honestly).
 * Quiet monochrome form — a fix is routine bookkeeping, not an error state.
 */

interface SetDraft {
  kind: ParsedSet['kind'];
  parent: number | null;
  reps: string;
  weight: string;
  rir: string;
  distance: string;
  duration: string;
  /** Which inputs this row shows, decided once from the original set. */
  mode: 'strength' | 'distance' | 'duration';
}

const str = (n: number | null): string => (n == null ? '' : String(n));

const toInt = (s: string, max: number): number | null => {
  const n = Number.parseInt(s.replace(',', '.'), 10);
  if (!Number.isFinite(n)) return null;
  return Math.min(max, Math.max(0, n));
};

const toNum = (s: string, max: number): number | null => {
  const n = Number.parseFloat(s.replace(',', '.'));
  if (!Number.isFinite(n)) return null;
  return Math.round(Math.min(max, Math.max(0, n)) * 100) / 100;
};

/** Same normalization as parse/correct.ts — the scope display must agree with
 * what applyCorrection will actually decide. */
const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

function draftOf(set: ParsedSet): SetDraft {
  return {
    kind: set.kind,
    parent: set.parent,
    reps: str(set.reps),
    weight: str(set.weight_kg),
    rir: str(set.rir),
    distance: str(set.distance_m),
    duration: str(set.duration_s),
    mode: set.distance_m != null ? 'distance' : set.duration_s != null ? 'duration' : 'strength',
  };
}

function setOf(d: SetDraft): ParsedSet {
  return {
    kind: d.kind,
    parent: d.parent,
    reps: d.mode === 'strength' ? toInt(d.reps, 1000) : null,
    weight_kg: d.mode === 'strength' ? toNum(d.weight, 2000) : null,
    distance_m: d.mode === 'distance' ? toNum(d.distance, 1_000_000) : null,
    duration_s: d.mode === 'duration' ? toInt(d.duration, 86_400) : null,
    rir: d.mode === 'strength' ? toNum(d.rir, 10) : null,
  };
}

export function FixSheet() {
  const insets = useSafeAreaInsets();
  const userId = useSession((s) => s.userId);
  const fixTarget = useSession((s) => s.fixTarget);
  const closeFixSheet = useSession((s) => s.closeFixSheet);
  const submitFix = useSession((s) => s.submitFix);

  const [exercise, setExercise] = useState('');
  const [drafts, setDrafts] = useState<SetDraft[]>([]);
  const exerciseRef = useRef<TextInput>(null);

  useEffect(() => {
    if (!fixTarget) return;
    setExercise(fixTarget.item.exercise);
    setDrafts(fixTarget.item.sets.map(draftOf));
  }, [fixTarget]);

  const suggestions = useMemo(() => {
    if (!userId || !fixTarget) return [];
    return searchExercises(userId, exercise).map((e) => e.canonical);
  }, [userId, fixTarget, exercise]);

  const close = () => {
    tap();
    closeFixSheet();
  };

  const save = () => {
    tap();
    submitFix(exercise, drafts.map(setOf));
  };

  const patchDraft = (index: number, patch: Partial<SetDraft>) =>
    setDrafts((prev) => prev.map((d, i) => (i === index ? { ...d, ...patch } : d)));

  // Load stepper: a pair of the user's smallest plates (the same step
  // roundToPlate uses), so − / + moves in real-world increments.
  const weightStep = (getSmallestPlateKg() ?? 1.25) * 2;
  const stepWeight = (index: number, dir: 1 | -1) => {
    tap();
    const d = drafts[index];
    if (!d) return;
    const current = toNum(d.weight, 2000) ?? 0;
    const next = Math.max(0, Math.min(2000, Math.round((current + dir * weightStep) * 100) / 100));
    patchDraft(index, { weight: String(next) });
  };

  // Scope, DERIVED from the one thing the existing logic keys on: whether the
  // typed exercise differs from the parsed one. Changing the name IS the alias
  // scope; leaving it is "only this line". The radios state it — they never
  // fork behavior applyCorrection doesn't have.
  const original = fixTarget?.item.exercise ?? '';
  const exerciseChanged =
    exercise.trim().length > 0 && normalize(exercise) !== normalize(original);
  const shorthand = fixTarget?.item.aliases_seen[0] ?? original;

  const selectLineOnly = () => {
    if (!exerciseChanged) return;
    tap();
    setExercise(original);
  };

  const selectAlias = () => {
    tap();
    exerciseRef.current?.focus();
  };

  const canSave = exercise.trim().length > 0;

  return (
    <BottomSheet
      visible={fixTarget !== null}
      onClose={close}
      sheetStyle={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
      <Text style={styles.title} maxFontSizeMultiplier={MAX_FONT_SCALE}>
        Fix reading
      </Text>

          {/* The user's own words — never rewritten, only quoted. */}
          <View style={styles.quoteCard}>
            <Text style={styles.quote} numberOfLines={2} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              “{fixTarget?.lineText ?? ''}”
              <Text style={styles.quoteLine}>
                {fixTarget ? `  · line ${fixTarget.line + 1}` : ''}
              </Text>
            </Text>
          </View>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            style={styles.scroll}>
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                Exercise
              </Text>
              <TextInput
                ref={exerciseRef}
                style={styles.exerciseInput}
                value={exercise}
                onChangeText={setExercise}
                placeholder="Exercise name"
                placeholderTextColor={color.textMuted}
                selectionColor={color.accent}
                cursorColor={color.accent}
                keyboardAppearance="dark"
                autoCapitalize="words"
                autoCorrect={false}
                allowFontScaling
                maxFontSizeMultiplier={MAX_FONT_SCALE}
              />
            </View>
            {suggestions.length > 0 ? (
              <View style={styles.suggestions}>
                {suggestions.map((name) => (
                  <Pressable
                    key={name}
                    style={styles.suggestion}
                    onPress={() => {
                      tap();
                      setExercise(name);
                    }}>
                    <Text style={styles.suggestionText} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                      {name}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}

            {drafts.map((d, i) => (
              <View key={i} style={styles.setRow}>
                <Text style={styles.setKind} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                  {d.kind === 'working' ? `SET ${i + 1}` : d.kind.toUpperCase()}
                </Text>

                {d.mode === 'strength' ? (
                  <View style={styles.fields}>
                    <TextInput
                      style={styles.numInput}
                      value={d.reps}
                      onChangeText={(t) => patchDraft(i, { reps: t })}
                      placeholder="reps"
                      placeholderTextColor={color.textMuted}
                      keyboardType="number-pad"
                      keyboardAppearance="dark"
                      selectionColor={color.accent}
                      maxFontSizeMultiplier={MAX_FONT_SCALE}
                    />
                    <Text style={styles.times} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                      ×
                    </Text>
                    <Pressable
                      onPress={() => stepWeight(i, -1)}
                      style={({ pressed }) => [styles.stepBtn, pressed && styles.stepBtnPressed]}>
                      <Text style={styles.stepGlyph} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                        −
                      </Text>
                    </Pressable>
                    <TextInput
                      style={styles.numInput}
                      value={d.weight}
                      onChangeText={(t) => patchDraft(i, { weight: t })}
                      placeholder="kg"
                      placeholderTextColor={color.textMuted}
                      keyboardType="decimal-pad"
                      keyboardAppearance="dark"
                      selectionColor={color.accent}
                      maxFontSizeMultiplier={MAX_FONT_SCALE}
                    />
                    <Pressable
                      onPress={() => stepWeight(i, 1)}
                      style={({ pressed }) => [styles.stepBtn, pressed && styles.stepBtnPressed]}>
                      <Text style={styles.stepGlyph} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                        +
                      </Text>
                    </Pressable>
                    <TextInput
                      style={styles.rirInput}
                      value={d.rir}
                      onChangeText={(t) => patchDraft(i, { rir: t })}
                      placeholder="—"
                      placeholderTextColor={color.textMuted}
                      keyboardType="decimal-pad"
                      keyboardAppearance="dark"
                      selectionColor={color.accent}
                      maxFontSizeMultiplier={MAX_FONT_SCALE}
                    />
                    <Text style={styles.unit} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                      RIR
                    </Text>
                  </View>
                ) : d.mode === 'distance' ? (
                  <View style={styles.fields}>
                    <TextInput
                      style={[styles.numInput, styles.wideInput]}
                      value={d.distance}
                      onChangeText={(t) => patchDraft(i, { distance: t })}
                      placeholder="distance"
                      placeholderTextColor={color.textMuted}
                      keyboardType="decimal-pad"
                      keyboardAppearance="dark"
                      selectionColor={color.accent}
                      maxFontSizeMultiplier={MAX_FONT_SCALE}
                    />
                    <Text style={styles.unit} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                      m
                    </Text>
                  </View>
                ) : (
                  <View style={styles.fields}>
                    <TextInput
                      style={[styles.numInput, styles.wideInput]}
                      value={d.duration}
                      onChangeText={(t) => patchDraft(i, { duration: t })}
                      placeholder="duration"
                      placeholderTextColor={color.textMuted}
                      keyboardType="number-pad"
                      keyboardAppearance="dark"
                      selectionColor={color.accent}
                      maxFontSizeMultiplier={MAX_FONT_SCALE}
                    />
                    <Text style={styles.unit} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                      s
                    </Text>
                  </View>
                )}
              </View>
            ))}

            {/* Scope — what this fix will do, stated plainly. */}
            <View style={styles.scopes}>
              <Pressable style={styles.scopeRow} onPress={selectLineOnly}>
                <View style={[styles.radio, !exerciseChanged && styles.radioSelected]} />
                <View style={styles.scopeBody}>
                  <Text style={styles.scopeTitle} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                    Only this line
                  </Text>
                  <Text style={styles.scopeSub} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                    Applies to this session&apos;s reading.
                  </Text>
                </View>
              </Pressable>
              <Pressable style={styles.scopeRow} onPress={selectAlias}>
                <View style={[styles.radio, exerciseChanged && styles.radioSelected]} />
                <View style={styles.scopeBody}>
                  <Text style={styles.scopeTitle} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                    Always read “{shorthand}” as {exerciseChanged ? exercise.trim() : '…'}
                  </Text>
                  <Text style={styles.scopeSub} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                    Future parsing only · never rewrites your words.
                  </Text>
                </View>
              </Pressable>
            </View>

            <Pressable
              style={[styles.save, !canSave && styles.saveDisabled]}
              disabled={!canSave}
              onPress={save}>
              <Text style={styles.saveText} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                Save correction
              </Text>
            </Pressable>
            <Pressable style={styles.cancel} onPress={close}>
              <Text style={styles.cancelText} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                Cancel
              </Text>
            </Pressable>
            <Text style={styles.footer} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              Never changes your written words. Corrections stay private to you.
            </Text>
          </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheet: {
    paddingHorizontal: spacing.xl,
    maxHeight: '86%',
  },
  title: {
    color: color.textPrimary,
    fontSize: type.headline.fontSize,
    fontWeight: '700',
    marginTop: spacing.md,
  },
  quoteCard: {
    marginTop: spacing.sm + 2,
    backgroundColor: color.bg,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 1,
  },
  quote: {
    fontFamily: fonts.mono,
    fontSize: moderateScale(12.5),
    lineHeight: moderateScale(18),
    color: color.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  quoteLine: {
    color: color.textMuted,
  },
  scroll: {
    flexGrow: 0,
    marginTop: spacing.md,
  },
  fieldRow: {
    minHeight: moderateScale(48),
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: color.surfaceHigh,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md + 2,
    gap: spacing.md,
  },
  fieldLabel: {
    fontSize: type.caption.fontSize,
    color: color.textSecondary,
  },
  exerciseInput: {
    flex: 1,
    textAlign: 'right',
    color: color.textPrimary,
    fontSize: moderateScale(14.5),
    fontWeight: '600',
    paddingVertical: spacing.sm,
  },
  suggestions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  suggestion: {
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 1,
  },
  suggestionText: {
    ...type.caption,
    color: color.textSecondary,
  },
  setRow: {
    minHeight: moderateScale(48),
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: color.surfaceHigh,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm + 2,
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  setKind: {
    width: moderateScale(52),
    fontFamily: fonts.mono,
    fontSize: moderateScale(9.5),
    letterSpacing: 1,
    color: color.textMuted,
  },
  fields: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.xs + 1,
  },
  numInput: {
    minWidth: moderateScale(46),
    textAlign: 'center',
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.sm - 1,
    paddingHorizontal: spacing.xs + 1,
    paddingVertical: spacing.xs + 2,
    color: color.textPrimary,
    fontFamily: fonts.mono,
    fontSize: type.subhead.fontSize,
    fontVariant: ['tabular-nums'],
  },
  rirInput: {
    minWidth: moderateScale(36),
    textAlign: 'center',
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.sm - 1,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs + 2,
    color: color.textPrimary,
    fontFamily: fonts.mono,
    fontSize: type.subhead.fontSize,
    fontVariant: ['tabular-nums'],
  },
  wideInput: {
    minWidth: moderateScale(96),
  },
  stepBtn: {
    width: moderateScale(30),
    height: moderateScale(34),
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.sm - 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnPressed: {
    backgroundColor: color.surface,
  },
  stepGlyph: {
    color: color.textPrimary,
    fontSize: type.headline.fontSize,
    lineHeight: type.headline.lineHeight,
  },
  times: {
    color: color.textMuted,
    fontSize: type.subhead.fontSize,
  },
  unit: {
    ...type.caption,
    color: color.textMuted,
  },
  scopes: {
    marginTop: spacing.lg,
    gap: spacing.md - 2,
  },
  scopeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  radio: {
    width: moderateScale(20),
    height: moderateScale(20),
    borderRadius: moderateScale(10),
    borderWidth: 1.5,
    borderColor: color.textMuted,
    marginTop: 1,
  },
  radioSelected: {
    borderWidth: moderateScale(6.5),
    borderColor: color.accent,
  },
  scopeBody: {
    flex: 1,
  },
  scopeTitle: {
    fontSize: moderateScale(14.5),
    fontWeight: '600',
    color: color.textPrimary,
  },
  scopeSub: {
    fontSize: type.caption.fontSize,
    color: color.textSecondary,
    marginTop: 1,
  },
  save: {
    marginTop: spacing.lg,
    height: CONTROL_HEIGHT,
    borderRadius: radius.md,
    backgroundColor: color.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveDisabled: {
    opacity: ink.disabled,
  },
  saveText: {
    color: color.bg,
    fontSize: moderateScale(16),
    fontWeight: '600',
  },
  cancel: {
    marginTop: spacing.sm + 1,
    height: moderateScale(44),
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    color: color.textPrimary,
    fontSize: type.subhead.fontSize,
    fontWeight: '600',
  },
  footer: {
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    fontSize: moderateScale(11.5),
    lineHeight: moderateScale(16),
    color: color.textMuted,
    textAlign: 'center',
  },
});
