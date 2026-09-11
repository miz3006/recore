import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Pressable,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/motion';
import { findExerciseByName } from '@/lib/db/exercises';
import { addPlanDay, deletePlanDay, getPlanDay, updatePlanDay } from '@/lib/db/plan';
import { tap, tapMedium } from '@/lib/haptics';
import {
  color,
  lineFor,
  MAX_FONT_SCALE,
  moderateScale,
  radius,
  readingStyle,
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
 *
 * ## IT IS A MODAL NOW, WITH CANCEL AND SAVE (10 September 2026)
 *
 * It was a push wearing its own bar: a bordered circle drawn with
 * `chevron-back`, a `Text` in the middle, and a `Save` label on the right. Two
 * things were wrong with that beyond the chrome. A chevron says "you are one
 * level deeper in the same thing", and this is not that — it is a self-contained
 * piece of authoring with a commit at the end, which the navigation laws give a
 * modal with its own Cancel and Done. And the chevron **discarded typing
 * without asking**: the one case the laws say a modal must intercept.
 *
 * So: `presentation: 'modal'` (registered in `_layout.tsx`), the two bar buttons
 * are real `headerLeft` / `headerRight` items, and Cancel asks before throwing
 * away work. Save stays disabled until the day has a name, which is the same
 * rule it always had — now stated by the control being dim rather than by a tap
 * doing nothing.
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

  /** Whether there is work a dismissal would throw away. A new day is dirty the
   * moment anything is typed; an edited one only once it differs from what is
   * stored — reopening a day and closing it again must not accuse the user of
   * having changed something. */
  const dirty = editId
    ? label !== (existing?.label ?? '') || movements !== (existing?.raw_text ?? '')
    : label.trim().length > 0 || movements.trim().length > 0;

  const handleSave = () => {
    if (!userId || !canSave) return;
    tapMedium();
    if (editId && existing) updatePlanDay(editId, { label, rawText: movements });
    else addPlanDay(userId, label, movements);
    router.back();
  };

  /**
   * THE ONE PLACE BACK IS ALLOWED TO ASK (navigation law 4: unsaved work in a
   * modal). Nothing is written until Save, so leaving with typing in the fields
   * is a real loss and a silent one — this is the sentence that makes it a
   * choice. With nothing typed it closes straight away, because a confirmation
   * over an empty form is the dialog everybody learns to dismiss without
   * reading.
   */
  const handleCancel = () => {
    tap();
    if (!dirty) {
      router.back();
      return;
    }
    Alert.alert(
      editId ? 'Discard your changes?' : 'Discard this day?',
      'What you have written here has not been saved.',
      [
        { text: 'Keep editing', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: () => router.back() },
      ],
    );
  };

  const handleDelete = () => {
    if (!editId) return;
    tap();
    deletePlanDay(editId);
    router.back();
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: editId ? 'Edit day' : 'New day',
          // A modal's title is inline — a large title belongs to a page you
          // scroll, and this is a form you fill.
          //
          // THE BAR IS PAINTED, and this is the one screen where naming a
          // header background is right rather than an opt-out of Liquid Glass.
          // Glass is the material of chrome floating over content that moves
          // under it; a modal is a card that covers the app, its bar has
          // nothing live behind it, and left unpainted it rendered as a hard
          // white strip over the warm form. `surface` is what the app's other
          // real sheet is painted (the check-in form sheet, `_layout.tsx`), so
          // the two read as the same material.
          headerStyle: { backgroundColor: color.surface },
          contentStyle: { backgroundColor: color.surface },
          headerLeft: () => (
            <BarButton label="Cancel" onPress={handleCancel} accessibilityLabel="Cancel" />
          ),
          headerRight: () => (
            <BarButton
              label="Save"
              bold
              disabled={!canSave}
              onPress={handleSave}
              accessibilityLabel="Save"
            />
          ),
        }}
      />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

        <ScrollView
          style={styles.scroll}
          // The movements field is MULTILINE — its return key writes the next
          // movement rather than finishing — so the ways out are a scroll
          // (here), a tap on anything in the page that is not a control, and
          // Save itself. The DAY field above is single-line and its return key
          // still ends editing.
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
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
              accessibilityRole="button"
              accessibilityLabel="Remove this day">
              <Text style={styles.deleteText} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                Remove this day
              </Text>
            </PressableScale>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

/**
 * A NAVIGATION-BAR BUTTON, and deliberately a plain label rather than one of
 * the app's pills. UIKit's own bar buttons are text at `headline`, tinted with
 * the bar's tint, and Done/Save is the one that comes back bold — copying that
 * is what makes a modal read as the system's. It is a `Pressable` and not a
 * `PressableScale` for the same reason: a bar button dims, it does not shrink
 * (motion laws — press feedback on a bar button is opacity).
 */
function BarButton({
  label,
  onPress,
  disabled = false,
  bold = false,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  bold?: boolean;
  accessibilityLabel: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={spacing.md}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      accessibilityLabel={accessibilityLabel}>
      {({ pressed }) => (
        <Text
          style={[
            styles.barButton,
            bold ? styles.barButtonBold : null,
            disabled ? styles.barButtonOff : null,
            pressed && !disabled ? styles.barButtonPressed : null,
          ]}
          maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  /** NO PAPER FIELD HERE. The canvas is the app's page; this is a card ON that
   * page, and the design system paints a sheet `surface` — one flat warm
   * near-white, bar included, set on the route so the header and the form
   * cannot disagree. */
  flex: { flex: 1 },
  barButton: {
    ...type.body,
    color: color.brand,
  },
  barButtonBold: {
    fontWeight: '600',
  },
  /** A disabled bar button is dim, not hidden: it says Save exists and what it
   * is waiting for (a name) rather than appearing once the form is valid. */
  barButtonOff: {
    color: color.textMuted,
  },
  barButtonPressed: {
    opacity: 0.4,
  },
  navTitle: {
    ...type.headline,
    fontWeight: '700',
    color: color.textPrimary,
  },
  save: { ...type.headline, fontWeight: '700', color: color.accent },
  saveDisabled: { color: color.textMuted, fontWeight: '600' },

  scroll: { flex: 1 },
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },

  caption: {
    ...readingStyle('500'),
    fontSize: moderateScale(10),
    letterSpacing: 1.2,
    color: color.textMuted,
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
    // MIN-HEIGHT, NOT HEIGHT (design skill §Typography). A single-line iOS
    // `TextInput` takes its intrinsic height from the font's ascent and leaves
    // the descenders to the box — at 22 pt/700 the underline landed on the
    // baseline and cut the "pp" out of "Upper". Verified on the iOS 26.5
    // simulator, 10 September 2026.
    minHeight: moderateScale(38),
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
    borderTopColor: color.border,
    paddingTop: spacing.md,
    gap: spacing.sm,
  },
  previewCap: {
    ...readingStyle('500'),
    fontSize: moderateScale(9.5),
    letterSpacing: 1.2,
    color: color.textMuted,
  },
  previewRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  previewName: { flexShrink: 1, fontSize: moderateScale(14.5), color: color.textPrimary },
  previewTyped: {
    ...readingStyle('400'),
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
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: color.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteText: { ...type.subhead, fontWeight: '600', color: color.error },
});
