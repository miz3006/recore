import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { getReflection, getWorkoutById, setReflection } from '@/lib/db/workouts';
import {
  EFFORT_CHOICE_LABEL,
  EFFORT_CHOICES,
  EFFORT_HINT,
  effortChoiceOf,
  readEffort,
} from '@/lib/effort';
import { markReflectionAdded } from '@/lib/funnel';
import { tap } from '@/lib/haptics';
import { groupThousands } from '@/lib/parse/estimate';
import { lastSetTextOf } from '@/lib/parse/receipt';
import { formatDistanceTotal } from '@/lib/parse/summarize';
import {
  composeReflection,
  REFLECTION_PLACEHOLDER,
  REFLECTION_TAGS,
  reflectionCharsLeft,
  reflectionRoomFor,
  splitReflection,
} from '@/lib/reflection';
import {
  color,
  hairline,
  lineFor,
  MAX_FONT_SCALE,
  moderateScale,
  monoText,
  radius,
  spacing,
  type,
} from '@/lib/theme';
import { useCurrentNote, useSession } from '@/state/session-store';

import { BottomSheet } from './bottom-sheet';
import { Icon } from './icon';
import { AppButton } from './primitives';
import { PressableScale } from './motion';

/**
 * The end-of-session check-in (product-direction §8.1) — ONE sheet, opened once
 * right after Finish, and reachable again from the session summary (the resting
 * today pill) because the honest moment to answer is sometimes twenty minutes
 * later on the train home.
 *
 * ## The shape the owner drew (17 Aug 2026)
 *
 * "How did it go?", the session's own line under it, then the two questions in
 * the order the athlete can answer them: **the lifts first, the words second.**
 * That ordering reverses the 29 July build, and the reason is the record: the
 * sheet now READS what was trained and asks about THAT — one row per lift, its
 * last set printed beside the name — instead of opening on a blank field. A
 * blank field is work; three chips against a lift you finished four minutes ago
 * is recall.
 *
 * IT CARRIES TWO THINGS, and they are stored in deliberately different places:
 *
 *  1. **How each lift felt** — three answers, not four (`lib/effort.ts`). A tap
 *     APPENDS `rpe 9` into the line the user wrote, so the parser reads it like
 *     any other word and the engine gets its RIR through the one path it
 *     already has. The words are the record (§3).
 *  2. **Anything worth remembering** — the reflection, in its own column on the
 *     workout. Prose about the session, not notation inside it: appending it to
 *     `raw_text` would hand "legs felt heavy" to the parser, and a re-parse
 *     could then rewrite or lose it.
 *
 * ONLY UNRATED LIFTS ARE ASKED ABOUT. A line that already carries an RPE — one
 * the lifter typed themselves, or one marked here in an earlier visit — is not
 * asked twice. The set is FROZEN when the sheet opens (or when the parse lands,
 * if it is still in flight), so answering a row never makes it vanish under the
 * thumb mid-tap.
 *
 * THE CHIPS UNDER THE FIELD ANSWER, they do not suggest (owner, 17 Aug 2026 —
 * this reverses the July placeholder ruling). Multi-select, nothing
 * preselected, every one togglable off, and what they contribute is visible on
 * the sheet the whole time. See `lib/reflection.ts` for how they are stored.
 *
 * NOTHING HERE IS REQUIRED. Skip is a real button, Save session is the same
 * commit as closing by any other route, and both keep exactly what is on the
 * sheet and no more — the app never throws away words a person typed.
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

  const [text, setText] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  // Which lines this visit asks about — see "only unrated lifts" above. Null
  // until there is a parse to read it from.
  const [askLines, setAskLines] = useState<number[] | null>(null);
  // What was already stored when the sheet opened, so re-opening from the
  // receipt shows the note instead of an empty field, and so the §13 event
  // fires on a genuinely NEW reflection rather than on every edit.
  const stored = useRef<string | null>(null);

  useEffect(() => {
    if (!open || !workoutId) return;
    const existing = getReflection(workoutId);
    stored.current = existing;
    const parts = splitReflection(existing);
    setText(parts.text);
    setTags(parts.tags);
  }, [open, workoutId]);

  /**
   * Freeze the question set. Deliberately NOT a plain derivation of the note:
   * the first tap on a row writes an RPE into that line, which would make the
   * row unrated no longer — and the row would disappear from under the finger
   * that just answered it. It is computed once per visit, from the first parse
   * this visit sees (the sheet opens before the parse lands when someone
   * finishes fast, and offline it may never land at all).
   */
  useEffect(() => {
    if (!open) {
      setAskLines(null);
      return;
    }
    if (!receipt) return;
    setAskLines((prev) => {
      if (prev !== null) return prev;
      const lines = note.split('\n');
      const seen = new Set<number>();
      const next: number[] = [];
      for (const row of receipt.rows) {
        if (seen.has(row.line)) continue; // a run-on line is rated once
        seen.add(row.line);
        if (readEffort(lines[row.line] ?? '') === null) next.push(row.line);
      }
      return next;
    });
  }, [open, receipt, note]);

  // One entry per lift still to rate, carrying whatever marker its line has
  // right now. Read from the note rather than held in state, so the sheet and
  // the note can never disagree.
  const rows = useMemo(() => {
    if (!receipt || !askLines) return [];
    const lines = note.split('\n');
    const ask = new Set(askLines);
    const seen = new Set<number>();
    const out = [];
    for (const row of receipt.rows) {
      if (!ask.has(row.line) || seen.has(row.line)) continue;
      seen.add(row.line);
      out.push({
        line: row.line,
        exercise: row.exercise,
        lastSet: lastSetTextOf(row),
        current: effortChoiceOf(readEffort(lines[row.line] ?? '')),
      });
    }
    return out;
  }, [receipt, askLines, note]);

  /**
   * The session's own line: "2 lifts · 9,840 kg · 48 min". Every part is read
   * from the record and any part that cannot be read honestly is simply absent
   * — a run-only day totals in distance, and a span too short or too long to be
   * a session drops the duration rather than printing a number nobody lived.
   */
  const summary = useMemo(() => {
    const parts: string[] = [];
    const lifts = receipt ? new Set(receipt.rows.map((r) => r.exercise)).size : 0;
    if (lifts > 0) parts.push(`${lifts} ${lifts === 1 ? 'lift' : 'lifts'}`);
    if (receipt && receipt.volume > 0) parts.push(`${groupThousands(receipt.volume)} kg`);
    else if (receipt && receipt.distanceM > 0) parts.push(formatDistanceTotal(receipt.distanceM));

    const w = workoutId ? getWorkoutById(workoutId) : null;
    if (w) {
      const mins = Math.round(
        (new Date(w.updated_at).getTime() - new Date(w.created_at).getTime()) / 60_000,
      );
      if (mins >= 10 && mins <= 360) parts.push(`${mins} min`);
    }
    return parts.join(' · ');
    // The workout row's timestamps move with every keystroke; re-read whenever
    // the parse behind the receipt does.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [receipt, workoutId, open]);

  // The sheet renders whenever there is a session to attach a note to. It must
  // NOT wait for a parse: offline, or before the edge function answers, there
  // are no lift rows and the check-in still has to work (§2 invariant 1).
  if (!workoutId) return null;

  const charsLeft = reflectionCharsLeft(text);

  /**
   * Persist and close. Runs for Save session, for Skip, for the × and for a
   * swipe-dismiss, because all four mean the same thing: keep exactly what is
   * on the sheet.
   *
   * Skip is not a discard. Words a person typed are never thrown away by the
   * app — and a Skip tapped on an untouched sheet stores nothing anyway, which
   * is what makes skipping free (`composeReflection` resolves empty to null).
   */
  const commitAndClose = () => {
    const next = composeReflection(tags, text);
    if (next !== stored.current) {
      setReflection(workoutId, next);
      // Counted only when a note appears where there was none. An edit is not a
      // new reflection, and a deletion is certainly not one.
      if (next !== null && stored.current === null) markReflectionAdded();
      stored.current = next;
    }
    close();
  };

  const toggleTag = (t: string) => {
    tap();
    setTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  };

  return (
    <BottomSheet
      visible={open}
      onClose={commitAndClose}
      sheetStyle={[styles.sheet, { paddingBottom: spacing.lg }]}>
      {/* Two ways out, both honest: × leaves the sheet, Skip says there is
          nothing to add. Neither loses anything already on it. */}
      <View style={styles.topRow}>
        <Pressable
          onPress={commitAndClose}
          hitSlop={spacing.md}
          accessibilityRole="button"
          accessibilityLabel="Close"
          style={({ pressed }) => [styles.close, pressed && styles.pressedDim]}>
          <Icon name="close" size={moderateScale(22)} tint={color.textPrimary} />
        </Pressable>
        <Pressable
          onPress={commitAndClose}
          hitSlop={spacing.md}
          accessibilityRole="button"
          accessibilityLabel="Skip the check-in"
          style={({ pressed }) => pressed && styles.pressedDim}>
          <Text style={styles.skip} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            Skip
          </Text>
        </Pressable>
      </View>

      <Text style={styles.title} maxFontSizeMultiplier={MAX_FONT_SCALE}>
        How did it go?
      </Text>
      {summary.length > 0 ? (
        <Text style={styles.summary} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {summary}
        </Text>
      ) : null}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        {/* The lifts, when there is parsed work left to rate. Absent entirely
            before a parse lands (the offline case) and absent when every line
            already carries an effort — the check-in below still works. */}
        {rows.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              How each lift felt
            </Text>

            {rows.map((row, i) => (
              <View
                key={`${row.line}:${row.exercise}`}
                style={[styles.lift, i > 0 && styles.liftDivided]}>
                <View style={styles.liftHead}>
                  <Text
                    style={styles.liftName}
                    numberOfLines={1}
                    maxFontSizeMultiplier={MAX_FONT_SCALE}>
                    {row.exercise}
                  </Text>
                  {row.lastSet ? (
                    <Text
                      style={styles.liftSet}
                      numberOfLines={1}
                      maxFontSizeMultiplier={MAX_FONT_SCALE}>
                      {`${row.lastSet} last set`}
                    </Text>
                  ) : null}
                </View>

                <View style={styles.choices}>
                  {EFFORT_CHOICES.map((e) => {
                    const on = row.current === e;
                    return (
                      <PressableScale
                        key={e}
                        onPress={() => {
                          tap();
                          // Tapping the chosen answer again clears it.
                          setLineEffort(row.line, on ? null : e);
                        }}
                        haptic="none"
                        activeScale={0.96}
                        accessibilityRole="button"
                        accessibilityLabel={`${row.exercise}: ${EFFORT_CHOICE_LABEL[e]}, ${EFFORT_HINT[e]}`}
                        accessibilityState={{ selected: on }}
                        style={[styles.choice, on && styles.choiceOn]}
                        // The press wash is a paper tone; on a chosen (blue)
                        // chip it would read as a de-selection.
                        pressedStyle={on ? styles.pressedOnFill : undefined}>
                        <Text
                          style={[styles.choiceLabel, on && styles.choiceLabelOn]}
                          numberOfLines={1}
                          adjustsFontSizeToFit
                          minimumFontScale={0.85}
                          maxFontSizeMultiplier={MAX_FONT_SCALE}>
                          {EFFORT_CHOICE_LABEL[e]}
                        </Text>
                      </PressableScale>
                    );
                  })}
                </View>
              </View>
            ))}

            <Text style={styles.hint} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              tap one — or leave it, Recore will not guess
            </Text>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            Anything worth remembering
          </Text>

          <TextInput
            value={text}
            onChangeText={setText}
            multiline
            maxLength={reflectionRoomFor(tags)}
            placeholder={REFLECTION_PLACEHOLDER}
            placeholderTextColor={color.textMuted}
            selectionColor={color.trained}
            cursorColor={color.trained}
            accessibilityLabel="Anything worth remembering about today. Optional."
            style={styles.input}
            maxFontSizeMultiplier={MAX_FONT_SCALE}
          />
          <Text style={styles.hint} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            optional · never shown to anyone
          </Text>

          {/* Preset answers, multi-select. What they contribute is stored as
              the reflection's own first line — the athlete's chosen words. */}
          <View style={styles.tags}>
            {REFLECTION_TAGS.map((t) => {
              const on = tags.includes(t);
              return (
                <PressableScale
                  key={t}
                  onPress={() => toggleTag(t)}
                  haptic="none"
                  activeScale={0.96}
                  accessibilityRole="button"
                  accessibilityLabel={t}
                  accessibilityState={{ selected: on }}
                  style={[styles.tag, on && styles.tagOn]}
                  pressedStyle={on ? styles.pressedOnFill : undefined}>
                  <Text
                    style={[styles.tagText, on && styles.tagTextOn]}
                    maxFontSizeMultiplier={MAX_FONT_SCALE}>
                    {t}
                  </Text>
                </PressableScale>
              );
            })}
          </View>

          {charsLeft != null ? (
            <Text style={styles.counter} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              {`${charsLeft} characters left`}
            </Text>
          ) : null}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <AppButton label="Save session" onPress={commitAndClose} />
        <Text style={styles.foot} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          You can change any of this later.
        </Text>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: color.surface,
    paddingHorizontal: spacing.xl,
    maxHeight: '92%',
  },
  topRow: {
    marginTop: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  close: {
    marginLeft: -spacing.xs,
  },
  skip: {
    ...type.headline,
    color: color.trained,
  },
  pressedDim: {
    opacity: 0.5,
  },
  title: {
    marginTop: spacing.lg,
    ...type.largeTitle,
    color: color.textPrimary,
  },
  summary: {
    marginTop: spacing.xs,
    ...type.body,
    color: color.textSecondary,
  },
  scroll: {
    marginTop: spacing.xl,
  },
  scrollContent: {
    gap: spacing.xxl,
    paddingBottom: spacing.sm,
  },
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    ...type.title2,
    color: color.textPrimary,
  },

  // --- how each lift felt ---
  lift: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  liftDivided: {
    borderTopWidth: hairline,
    borderTopColor: color.divider,
    paddingTop: spacing.lg,
    marginTop: spacing.md,
  },
  liftHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  liftName: {
    flexShrink: 1,
    ...type.lede,
    color: color.textPrimary,
  },
  liftSet: {
    flexShrink: 1,
    ...monoText,
    fontSize: moderateScale(12),
    color: color.textSecondary,
    textAlign: 'right',
  },
  choices: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  choice: {
    flex: 1,
    minHeight: moderateScale(44),
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: hairline,
    borderColor: color.border,
    backgroundColor: color.surface,
  },
  // Chosen = Recore blue, the app's one colour for a selected answer (§4.2).
  choiceOn: {
    backgroundColor: color.trained,
    borderColor: color.trained,
  },
  choiceLabel: {
    ...type.caption,
    color: color.textPrimary,
  },
  choiceLabelOn: {
    color: color.surface,
    fontWeight: '600',
  },
  hint: {
    marginTop: spacing.xs,
    ...type.footnote,
    lineHeight: lineFor(16),
    color: color.textMuted,
  },

  // --- anything worth remembering ---
  input: {
    minHeight: moderateScale(96),
    borderRadius: radius.md,
    borderCurve: 'continuous',
    backgroundColor: color.surfaceHigh,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    textAlignVertical: 'top',
    ...type.body,
    lineHeight: lineFor(24),
    color: color.textPrimary,
  },
  tags: {
    marginTop: spacing.xs,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  tag: {
    minHeight: moderateScale(40),
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: hairline,
    borderColor: color.border,
    backgroundColor: color.surface,
  },
  tagOn: {
    backgroundColor: color.trained,
    borderColor: color.trained,
  },
  tagText: {
    ...type.caption,
    color: color.textPrimary,
  },
  tagTextOn: {
    color: color.surface,
    fontWeight: '600',
  },
  /** Pressing something already chosen darkens the blue instead of washing it
   * out — the answer must not look like it is being taken away. */
  pressedOnFill: {
    opacity: 0.86,
  },
  counter: {
    ...type.caption,
    color: color.textMuted,
    textAlign: 'right',
  },
  footer: {
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  foot: {
    ...type.footnote,
    lineHeight: lineFor(16),
    color: color.textMuted,
    textAlign: 'center',
  },
});
