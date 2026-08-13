import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/icon';
import { PressableScale } from '@/components/motion';
import { findExerciseByName } from '@/lib/db/exercises';
import { addPlanDay, deletePlanDay, getPlanDay, updatePlanDay } from '@/lib/db/plan';
import { tap, tapMedium } from '@/lib/haptics';
import {
  color,
  fonts,
  lineFor,
  MAX_FONT_SCALE,
  moderateScale,
  radius,
  spacing,
  type,
} from '@/lib/theme';
import { useSession } from '@/state/session-store';

/**
 * /plan-day — author ONE day-template by WRITING it (pre-plan). The Recore
 * differentiator, and a deliberate rejection of the Hevy/MyFitnessPal "Add
 * exercise → picker → set fields" flow: you type the movements, one per line,
 * and the SAME resolver that reads a note names them back to you (offline, no
 * row is created here — findExerciseByName is read-only). Targets are optional;
 * the engine supplies the loads. Saves to plan_days.raw_text — raw_text stays
 * the source of truth, exactly like a workout note.
 */
interface PreviewRow {
  typed: string;
  canonical: string | null;
}

export default function PlanDayEditor() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const userId = useSession((s) => s.userId);
  const params = useLocalSearchParams<{ id?: string }>();
  const editId = typeof params.id === 'string' && params.id.length > 0 ? params.id : null;
  const existing = useMemo(() => (editId ? getPlanDay(editId) : null), [editId]);

  const [label, setLabel] = useState(existing?.label ?? '');
  const [movements, setMovements] = useState(existing?.raw_text ?? '');

  // Live, offline resolution — the parser "reading" the written movements.
  const preview = useMemo<PreviewRow[]>(() => {
    if (!userId) return [];
    return movements
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .slice(0, 20)
      .map((line) => ({ typed: line, canonical: findExerciseByName(userId, line)?.canonical ?? null }));
  }, [movements, userId]);

  const canSave = label.trim().length > 0;

  const handleSave = () => {
    if (!userId || !canSave) return;
    tapMedium();
    if (editId && existing) updatePlanDay(editId, { label, rawText: movements });
    else addPlanDay(userId, label, movements);
    router.back();
  };

  const handleDelete = () => {
    if (!editId) return;
    tap();
    deletePlanDay(editId);
    router.back();
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
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
            {editId ? 'Edit day' : 'New day'}
          </Text>
          <PressableScale
            onPress={handleSave}
            disabled={!canSave}
            haptic="none"
            activeScale={0.92}
            hitSlop={spacing.sm}
            accessibilityRole="button"
            accessibilityLabel="Save">
            <Text
              style={[styles.save, !canSave && styles.saveDisabled]}
              maxFontSizeMultiplier={MAX_FONT_SCALE}>
              Save
            </Text>
          </PressableScale>
        </View>

        <ScrollView
          style={styles.scroll}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]}
          showsVerticalScrollIndicator={false}>
          <Text style={styles.caption} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            DAY
          </Text>
          <TextInput
            value={label}
            onChangeText={setLabel}
            placeholder="Upper"
            placeholderTextColor={color.textMuted}
            style={styles.labelInput}
            autoFocus={!editId}
            returnKeyType="next"
            maxFontSizeMultiplier={MAX_FONT_SCALE}
          />

          <Text style={[styles.caption, styles.captionSpaced]} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            MOVEMENTS · ONE PER LINE
          </Text>
          <TextInput
            value={movements}
            onChangeText={setMovements}
            placeholder={'bench\nrow\nohp\ncurls'}
            placeholderTextColor={color.textMuted}
            style={styles.movesInput}
            multiline
            textAlignVertical="top"
            maxFontSizeMultiplier={MAX_FONT_SCALE}
          />

          {preview.length > 0 ? (
            <View style={styles.preview}>
              <Text style={styles.previewCap} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                RECORE READS
              </Text>
              {preview.map((p, i) => (
                <View key={i} style={styles.previewRow}>
                  <Text
                    style={styles.previewName}
                    numberOfLines={1}
                    maxFontSizeMultiplier={MAX_FONT_SCALE}>
                    {p.canonical ?? p.typed}
                  </Text>
                  {p.canonical && p.canonical.toLowerCase() !== p.typed.toLowerCase() ? (
                    <Text
                      style={styles.previewTyped}
                      numberOfLines={1}
                      maxFontSizeMultiplier={MAX_FONT_SCALE}>
                      “{p.typed}”
                    </Text>
                  ) : null}
                </View>
              ))}
            </View>
          ) : null}

          <Text style={styles.hint} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            Just the movements — Recore adds the weights from your history. No set fields, no picker.
          </Text>

          {editId ? (
            <PressableScale
              onPress={handleDelete}
              haptic="none"
              activeScale={0.98}
              style={styles.deleteBtn}
              pressedStyle={styles.pressedFill}
              accessibilityRole="button"
              accessibilityLabel="Remove this day">
              <Text style={styles.deleteText} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                Remove this day
              </Text>
            </PressableScale>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.bg },
  flex: { flex: 1 },
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
  save: { ...type.headline, fontWeight: '700', color: color.accent },
  saveDisabled: { color: color.textMuted, fontWeight: '600' },

  scroll: { flex: 1 },
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },

  caption: {
    fontFamily: fonts.reading,
    fontVariant: ['tabular-nums'],
    fontSize: moderateScale(10),
    letterSpacing: 1.2,
    color: color.textMuted,
    fontWeight: '500',
    marginBottom: spacing.sm,
  },
  captionSpaced: { marginTop: spacing.xl },
  labelInput: {
    fontSize: moderateScale(22),
    fontWeight: '700',
    letterSpacing: -0.3,
    color: color.textPrimary,
    borderBottomWidth: 1.5,
    borderBottomColor: color.border,
    paddingBottom: spacing.sm,
  },
  movesInput: {
    minHeight: moderateScale(150),
    fontSize: moderateScale(17),
    lineHeight: lineFor(28),
    color: color.textPrimary,
  },

  preview: {
    marginTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: color.divider,
    paddingTop: spacing.md,
    gap: spacing.sm,
  },
  previewCap: {
    fontFamily: fonts.reading,
    fontVariant: ['tabular-nums'],
    fontSize: moderateScale(9.5),
    letterSpacing: 1.2,
    color: color.textMuted,
    fontWeight: '500',
  },
  previewRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  previewName: { flexShrink: 1, fontSize: moderateScale(14.5), color: color.textPrimary },
  previewTyped: {
    fontFamily: fonts.reading,
    fontVariant: ['tabular-nums'],
    fontSize: moderateScale(11),
    color: color.textMuted,
  },

  hint: {
    marginTop: spacing.lg,
    ...type.footnote,
    lineHeight: lineFor(18),
    color: color.textMuted,
  },

  deleteBtn: {
    marginTop: spacing.xl,
    minHeight: moderateScale(46),
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteText: { ...type.subhead, fontWeight: '600', color: color.error },
});
