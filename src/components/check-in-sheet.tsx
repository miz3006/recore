import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getReflection, setReflection } from '@/lib/db/workouts';
import { EFFORT_HINT, EFFORT_LABEL, EFFORTS, readEffort } from '@/lib/effort';
import { markReflectionAdded } from '@/lib/funnel';
import { tap } from '@/lib/haptics';
import {
  MAX_REFLECTION_CHARS,
  normalizeReflection,
  REFLECTION_PLACEHOLDER,
  REFLECTION_PROMPTS,
  reflectionCharsLeft,
} from '@/lib/reflection';
import {
  color,
  hairline,
  MAX_FONT_SCALE,
  moderateScale,
  monoText,
  radius,
  spacing,
  type,
} from '@/lib/theme';
import { useCurrentNote, useSession } from '@/state/session-store';

import { BottomSheet } from './bottom-sheet';
import { AppButton, Eyebrow } from './primitives';
import { PressableScale } from './motion';

/**
 * The end-of-session check-in (product-direction §8.1) — ONE sheet, opened once
 * right after Finish, and reachable again from the receipt at the bottom of the
 * note because the honest moment to answer is sometimes twenty minutes later on
 * the train home.
 *
 * IT CARRIES TWO THINGS, and the owner's ruling of 29 July is why they share a
 * surface rather than queueing two sheets behind one Finish:
 *
 *  1. **The reflection** (§8.1) — a free-text field first, with the four
 *     lightweight prompts under it. This is the spec'd feature and it leads,
 *     because burying it under a list of exercises would make it invisible and
 *     §8.1's whole point is that it is easy to reach and easier to skip.
 *  2. **The effort scale** — per-line RPE, an explicit owner ask from 28 July.
 *     RIR is load-bearing in the engine (rule 2 adds weight the moment the
 *     athlete had two or more in reserve) and the only other way it arrives is
 *     if someone types "@8" themselves, which almost nobody does.
 *
 * WHAT EACH ONE WRITES, and they are deliberately different:
 *
 *  · Effort APPENDS `rpe 8` into the line the user wrote (`lib/effort.ts`), so
 *    the parser reads it like any other word. The words are the record (§3).
 *  · The reflection is stored in its OWN COLUMN on the workout. It is prose
 *    about the session, not notation inside it — appending it to `raw_text`
 *    would hand "legs felt heavy" to the parser, and a re-parse could then
 *    rewrite or lose it.
 *
 * THE PROMPTS ARE PLACEHOLDERS, NEVER INSERTED TEXT. Tapping one changes what
 * the empty field suggests and nothing else, so every character stored is a
 * character the athlete typed. §8.1 calls these "the athlete's own notes"; text
 * the app wrote for them and then kept would not be.
 *
 * SKIP IS A REAL BUTTON, not a corner. Nothing here is required, nothing nags,
 * and closing the sheet by any route saves whatever was written and no more.
 *
 * NOT A HEALTH ASSESSMENT (§8.1, §12). Nothing read here becomes a number, a
 * chart, a streak or a verdict. Step 4 may let the guarded brief quote a recent
 * reflection; it will never let one change a load.
 */
export function CheckInSheet() {
  const open = useSession((s) => s.checkInOpen);
  const close = useSession((s) => s.closeCheckIn);
  const receipt = useSession((s) => s.receipt);
  const workoutId = useSession((s) => s.workoutId);
  const setLineEffort = useSession((s) => s.setLineEffort);
  const note = useCurrentNote();
  const insets = useSafeAreaInsets();

  const [text, setText] = useState('');
  const [placeholder, setPlaceholder] = useState(REFLECTION_PLACEHOLDER);
  // What was already stored when the sheet opened, so re-opening from the
  // receipt shows the note instead of an empty field, and so the §13 event
  // fires on a genuinely NEW reflection rather than on every edit.
  const stored = useRef<string | null>(null);

  useEffect(() => {
    if (!open || !workoutId) return;
    const existing = getReflection(workoutId);
    stored.current = existing;
    setText(existing ?? '');
    setPlaceholder(REFLECTION_PLACEHOLDER);
  }, [open, workoutId]);

  // One entry per parsed exercise, carrying whatever marker its line already
  // has — typed by the user or set here earlier. Read from the note rather than
  // held in state, so the sheet and the note can never disagree.
  const rows = useMemo(() => {
    const lines = note.split('\n');
    const seen = new Set<number>();
    return (receipt?.rows ?? [])
      .filter((r) => {
        if (seen.has(r.line)) return false; // a run-on line is rated once
        seen.add(r.line);
        return true;
      })
      .map((r) => ({
        line: r.line,
        exercise: r.exercise,
        setText: r.setText,
        current: readEffort(lines[r.line] ?? ''),
      }));
  }, [receipt, note]);

  // The sheet renders whenever there is a session to attach a note to. It must
  // NOT wait for a parse: offline, or before the edge function answers, there
  // are no effort rows and the check-in still has to work (§2 invariant 1).
  if (!workoutId) return null;

  const rated = rows.filter((r) => r.current !== null).length;
  const charsLeft = reflectionCharsLeft(text);

  /**
   * Persist and close. Runs for Done, for Skip and for a swipe-dismiss, because
   * all three mean the same thing: keep exactly what is in the field.
   *
   * A cleared field clears the stored note — skipping stays free even after the
   * fact (`normalizeReflection` resolves empty and whitespace to null).
   */
  const commitAndClose = () => {
    const next = normalizeReflection(text);
    if (next !== stored.current) {
      setReflection(workoutId, next);
      // Counted only when a note appears where there was none. An edit is not a
      // new reflection, and a deletion is certainly not one.
      if (next !== null && stored.current === null) markReflectionAdded();
      stored.current = next;
    }
    close();
  };

  const handlePrompt = (prompt: string) => {
    tap();
    // Suggests, never writes. The field keeps whatever the person has typed.
    setPlaceholder(prompt);
  };

  return (
    <BottomSheet
      visible={open}
      onClose={commitAndClose}
      sheetStyle={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
      <Eyebrow tone="muted" style={styles.eyebrow}>
        Recorded
      </Eyebrow>
      <Text style={styles.title} maxFontSizeMultiplier={MAX_FONT_SCALE}>
        How did that go?
      </Text>
      <Text style={styles.sub} maxFontSizeMultiplier={MAX_FONT_SCALE}>
        Optional, in any language, and yours alone. Recore keeps it with the session and never
        reads it as training data.
      </Text>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        {/* The free-text field FIRST (§8.1), then the prompts under it. */}
        <View style={styles.reflection}>
          <TextInput
            value={text}
            onChangeText={setText}
            multiline
            maxLength={MAX_REFLECTION_CHARS}
            placeholder={placeholder}
            placeholderTextColor={color.textMuted}
            selectionColor={color.accent}
            cursorColor={color.accent}
            accessibilityLabel="How did that session go? Optional note."
            style={styles.input}
            maxFontSizeMultiplier={MAX_FONT_SCALE}
          />
          <View style={styles.prompts}>
            {REFLECTION_PROMPTS.map((p) => (
              <PressableScale
                key={p}
                onPress={() => handlePrompt(p)}
                haptic="none"
                activeScale={0.96}
                accessibilityRole="button"
                accessibilityLabel={`Suggest: ${p}`}
                accessibilityState={{ selected: placeholder === p }}
                style={[styles.prompt, placeholder === p && styles.promptOn]}
                pressedStyle={styles.pressed}>
                <Text
                  style={[styles.promptText, placeholder === p && styles.promptTextOn]}
                  maxFontSizeMultiplier={MAX_FONT_SCALE}>
                  {p}
                </Text>
              </PressableScale>
            ))}
          </View>
          {charsLeft != null ? (
            <Text style={styles.counter} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              {`${charsLeft} characters left`}
            </Text>
          ) : null}
        </View>

        {/* The effort scale, when there is parsed work to rate. Absent entirely
            before a parse lands, which is the offline case — the check-in above
            still works. */}
        {rows.length > 0 ? (
          <View style={styles.effort}>
            <View style={styles.effortHead}>
              <Text style={styles.effortTitle} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                How hard was it?
              </Text>
              <Text style={styles.effortCount} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                {rated > 0 ? `${rated} of ${rows.length}` : 'optional'}
              </Text>
            </View>
            <Text style={styles.effortSub} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              This one does change what Recore prescribes next: reps left in reserve are how the
              weight goes up.
            </Text>

            {rows.map((row) => (
              <View key={`${row.line}:${row.exercise}`} style={styles.item}>
                <View style={styles.itemHead}>
                  <Text
                    style={styles.itemName}
                    numberOfLines={1}
                    maxFontSizeMultiplier={MAX_FONT_SCALE}>
                    {row.exercise}
                  </Text>
                  <Text
                    style={styles.itemSets}
                    numberOfLines={1}
                    maxFontSizeMultiplier={MAX_FONT_SCALE}>
                    {row.setText}
                  </Text>
                </View>

                <View style={styles.scale}>
                  {EFFORTS.map((e) => {
                    const on = row.current === e;
                    return (
                      <PressableScale
                        key={e}
                        onPress={() => {
                          tap();
                          // Tapping the selected level again clears it.
                          setLineEffort(row.line, on ? null : e);
                        }}
                        haptic="none"
                        activeScale={0.94}
                        accessibilityRole="button"
                        accessibilityLabel={`${row.exercise}: ${EFFORT_LABEL[e]}, ${EFFORT_HINT[e]}`}
                        accessibilityState={{ selected: on }}
                        style={[styles.level, on && styles.levelOn]}
                        pressedStyle={styles.pressed}>
                        <Text
                          style={[styles.levelLabel, on && styles.levelLabelOn]}
                          numberOfLines={1}
                          maxFontSizeMultiplier={MAX_FONT_SCALE}>
                          {EFFORT_LABEL[e]}
                        </Text>
                        <Text
                          style={[styles.levelHint, on && styles.levelHintOn]}
                          numberOfLines={1}
                          maxFontSizeMultiplier={MAX_FONT_SCALE}>
                          {EFFORT_HINT[e]}
                        </Text>
                      </PressableScale>
                    );
                  })}
                </View>
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        <AppButton
          label={text.trim().length > 0 || rated > 0 ? 'Done' : 'Skip'}
          onPress={commitAndClose}
        />
        <Text style={styles.foot} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          Reachable again from the receipt at the bottom of your note.
        </Text>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: color.bg,
    paddingHorizontal: spacing.xl,
    maxHeight: '86%',
  },
  eyebrow: {
    marginTop: spacing.sm,
  },
  title: {
    marginTop: spacing.xs,
    ...type.title,
    color: color.textPrimary,
  },
  sub: {
    marginTop: spacing.sm,
    ...type.footnote,
    lineHeight: moderateScale(17),
    color: color.textMuted,
  },
  scroll: {
    marginTop: spacing.lg,
  },
  scrollContent: {
    gap: spacing.xl,
    paddingBottom: spacing.sm,
  },

  // --- the reflection (§8.1) ---
  reflection: {
    gap: spacing.sm,
  },
  input: {
    minHeight: moderateScale(96),
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.md,
    backgroundColor: color.surface,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    textAlignVertical: 'top',
    ...type.subhead,
    lineHeight: moderateScale(22),
    color: color.textPrimary,
  },
  prompts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs + 2,
  },
  prompt: {
    minHeight: moderateScale(34),
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: hairline,
    borderColor: color.border,
    backgroundColor: color.surface,
  },
  // Ink outline when chosen — it is a suggestion, not a committed answer, so it
  // never takes the filled state a real selection has.
  promptOn: {
    borderColor: color.accent,
  },
  promptText: {
    ...type.caption,
    color: color.textSecondary,
  },
  promptTextOn: {
    color: color.textPrimary,
    fontWeight: '600',
  },
  counter: {
    ...type.caption,
    color: color.textMuted,
    textAlign: 'right',
  },

  // --- the effort scale ---
  effort: {
    gap: spacing.sm,
    borderTopWidth: hairline,
    borderTopColor: color.divider,
    paddingTop: spacing.lg,
  },
  effortHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  effortTitle: {
    ...type.subhead,
    fontWeight: '600',
    color: color.textPrimary,
  },
  effortCount: {
    ...type.caption,
    color: color.textMuted,
  },
  effortSub: {
    ...type.footnote,
    lineHeight: moderateScale(17),
    color: color.textMuted,
  },
  item: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  itemHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  itemName: {
    flexShrink: 1,
    ...type.subhead,
    fontWeight: '600',
    color: color.textPrimary,
  },
  itemSets: {
    flexShrink: 1,
    ...monoText,
    fontSize: moderateScale(12),
    color: color.textMuted,
    textAlign: 'right',
  },
  scale: {
    flexDirection: 'row',
    gap: spacing.xs + 2,
  },
  level: {
    flex: 1,
    minHeight: moderateScale(56),
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.md,
    borderWidth: hairline,
    borderColor: color.border,
    backgroundColor: color.surface,
  },
  // Selected = ink fill, exactly like every other committed state in the app.
  levelOn: {
    backgroundColor: color.accent,
    borderColor: color.accent,
  },
  pressed: {
    backgroundColor: color.surfaceHigh,
  },
  levelLabel: {
    ...type.caption,
    fontWeight: '600',
    color: color.textPrimary,
  },
  levelLabelOn: {
    color: color.bg,
  },
  levelHint: {
    fontSize: moderateScale(9.5),
    lineHeight: moderateScale(12),
    textAlign: 'center',
    color: color.textMuted,
  },
  levelHintOn: {
    color: color.bg,
    opacity: 0.72,
  },
  footer: {
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  foot: {
    ...type.footnote,
    lineHeight: moderateScale(16),
    color: color.textMuted,
    textAlign: 'center',
  },
});
