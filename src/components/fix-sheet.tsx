import { useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { searchExercises } from '@/lib/db/exercises';
import { tap } from '@/lib/haptics';
import { type ParsedSet } from '@/lib/parse/types';
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
import { useSession } from '@/state/session-store';

import { SheetGrabber } from './sheet-grabber';

/**
 * Parse correction sheet (CLAUDE.md §6.2): long-press a gutter value → fix
 * what the parser got wrong. Fixing the exercise name teaches the app the
 * user's shorthand forever (alias override); fixing numbers sticks to this
 * line across re-parses. Quiet monochrome form — no red, no warnings: a fix
 * is routine bookkeeping, not an error state.
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

  const canSave = exercise.trim().length > 0;

  return (
    <Modal visible={fixTarget !== null} transparent animationType="slide" onRequestClose={close}>
      <KeyboardAvoidingView
        style={styles.backdropWrap}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.backdrop} onPress={close} />

        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
          <SheetGrabber />
          <View style={styles.header}>
            <Text style={styles.title} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              Fix this line
            </Text>
            <Pressable onPress={close} hitSlop={spacing.sm}>
              <Text style={styles.cancel} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                Cancel
              </Text>
            </Pressable>
          </View>

          {/* The user's own words — never rewritten, only quoted. */}
          <Text style={styles.quote} numberOfLines={2} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {fixTarget?.lineText ?? ''}
          </Text>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            style={styles.scroll}>
            <Text style={styles.label} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              exercise
            </Text>
            <TextInput
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

            <Text style={[styles.label, styles.setsLabel]} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              sets
            </Text>
            {drafts.map((d, i) => (
              <View key={i} style={styles.setRow}>
                <Text style={styles.setKind} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                  {d.kind === 'working' ? String(i + 1) : d.kind}
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
                    <Text style={styles.unit} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                      kg
                    </Text>
                    <TextInput
                      style={styles.numInput}
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

            <Pressable
              style={[styles.save, !canSave && styles.saveDisabled]}
              disabled={!canSave}
              onPress={save}>
              <Text style={styles.saveText} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                Save
              </Text>
            </Pressable>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
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
    maxHeight: '86%',
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
  cancel: {
    color: color.textSecondary,
    fontSize: type.subhead.fontSize,
    fontWeight: '600',
  },
  quote: {
    ...type.subhead,
    color: color.textSecondary,
    marginBottom: spacing.md,
  },
  scroll: {
    flexGrow: 0,
  },
  label: {
    ...type.caption,
    color: color.textMuted,
    marginBottom: spacing.xs,
  },
  setsLabel: {
    marginTop: spacing.lg,
  },
  exerciseInput: {
    backgroundColor: color.surfaceHigh,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    color: color.textPrimary,
    fontSize: type.body.fontSize,
  },
  suggestions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  suggestion: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: alpha(color.accent, 0.4),
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 1,
  },
  suggestionText: {
    ...type.caption,
    color: color.textSecondary,
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: color.border,
    gap: spacing.md,
  },
  setKind: {
    width: moderateScale(56),
    fontFamily: fonts.mono,
    fontSize: type.caption.fontSize,
    color: color.textMuted,
  },
  fields: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
  numInput: {
    minWidth: moderateScale(52),
    textAlign: 'center',
    backgroundColor: color.surfaceHigh,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs + 2,
    color: color.textPrimary,
    fontFamily: fonts.mono,
    fontSize: type.subhead.fontSize,
    fontVariant: ['tabular-nums'],
  },
  wideInput: {
    minWidth: moderateScale(96),
  },
  times: {
    color: color.textMuted,
    fontSize: type.subhead.fontSize,
  },
  unit: {
    ...type.caption,
    color: color.textMuted,
  },
  save: {
    marginTop: spacing.xl,
    height: HIT,
    borderRadius: radius.pill,
    backgroundColor: color.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveDisabled: {
    opacity: 0.4,
  },
  saveText: {
    color: color.bg,
    fontSize: type.headline.fontSize,
    fontWeight: '600',
  },
});
