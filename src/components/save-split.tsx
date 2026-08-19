import { useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { FadeSlideIn } from '@/components/motion';
import { AppButton, Eyebrow } from '@/components/primitives';
import { addPlanDay, listPlanDays } from '@/lib/db/plan';
import { entryNoteKey } from '@/lib/entry-note';
import { markSplitDaySaved } from '@/lib/funnel';
import { tap } from '@/lib/haptics';
import { typedNameOf, type ReceiptRow } from '@/lib/parse/receipt';
import { jaccard } from '@/lib/predict/split';
import { suggestSplitLabel } from '@/lib/split/pattern';
import {
  color,
  hairline,
  lineFor,
  MAX_FONT_SCALE,
  moderateScale,
  radius,
  spacing,
  type,
} from '@/lib/theme';
import { useSession } from '@/state/session-store';

/**
 * UNREACHABLE SINCE 18 AUGUST 2026 — its only host is `session-summary-sheet.tsx`,
 * whose only opener (the resting pill) left Today on the owner's call. Nothing
 * about the split-day data path changed; there is currently no door to it.
 */

/**
 * SAVE THIS DAY AS A SPLIT DAY (owner, 13 Aug 2026).
 *
 * Until now a split day could only be authored by hand in You → Session types →
 * a blank editor, which is the wrong end of the app: the athlete has just
 * written the session, the app has just read it back, and it then asked them to
 * go somewhere else and type the same movement names again. This turns the
 * session they already have into the template, in two taps.
 *
 * It lives in the session summary — the read-back of the day, reachable from
 * the resting pill whenever the day has a reading. Not behind Finish: a day is
 * worth keeping whether or not it was declared over, and an action that only
 * exists for four seconds after one button is an action nobody finds.
 *
 * ## What is saved, and what is not
 *
 * The MOVEMENT NAMES, one per line, in the order they were performed — which is
 * exactly what `plan_days.raw_text` is and what `computePlanStrip` reads (it
 * takes the name off each line and ignores everything else). **No loads and no
 * reps are copied into the template**, because the strip works them out from
 * real history every time it renders; baking today's numbers in would create a
 * second, staler source for the one thing this app is careful about.
 *
 * ## The name is offered, never assumed
 *
 * `suggestSplitLabel` reads the session's working sets and proposes "Push" —
 * and returns null rather than guessing when the record does not support a
 * name, in which case the field opens EMPTY. Either way the athlete's own word
 * is what gets stored (CLAUDE.md rule 2: personalise only from chosen
 * information). Nothing is written until Save is pressed.
 *
 * ## It refuses to make a duplicate
 *
 * A session that already looks like one of their split days (≥ 50 % exercise
 * overlap — the same `jaccard` threshold `predict/split.ts` clusters with) says
 * so and offers nothing. Two "Push" days with the same five movements would
 * split the rotation and quietly corrupt every prescription downstream.
 */

/** Below this, a session is not a template — it is a couple of lifts. */
const MIN_MOVEMENTS = 2;
/** Same threshold the session clusterer uses, for the same reason. */
const DUPLICATE_OVERLAP = 0.5;

export function SaveSplitBlock({ rows }: { rows: ReceiptRow[] }) {
  const userId = useSession((s) => s.userId);
  const [mode, setMode] = useState<'idle' | 'naming'>('idle');
  const [name, setName] = useState('');
  const [savedAs, setSavedAs] = useState<string | null>(null);

  /**
   * The movements, deduped on the key the rest of the app dedupes on, with the
   * counted sets behind each. Warm-ups and drops do not vote for the name and
   * are not part of the template.
   */
  const movements = useMemo(() => {
    const seen = new Set<string>();
    const out: { canonical: string; sets: number }[] = [];
    for (const row of rows) {
      const sets = row.table.rows.filter((r) => r.counted).length;
      if (sets === 0) continue;
      const key = entryNoteKey(row.exercise);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push({ canonical: row.exercise, sets });
    }
    return out;
  }, [rows]);

  const suggested = useMemo(() => suggestSplitLabel(movements), [movements]);

  /** The split day this session already is, if any. */
  const duplicateOf = useMemo(() => {
    if (!userId || movements.length === 0) return null;
    const mine = new Set(movements.map((m) => entryNoteKey(m.canonical)));
    for (const day of listPlanDays(userId)) {
      const theirs = new Set(
        day.raw_text
          .split('\n')
          .map((l) => entryNoteKey(typedNameOf(l) || l))
          .filter(Boolean),
      );
      if (theirs.size > 0 && jaccard(mine, theirs) >= DUPLICATE_OVERLAP) return day.label;
    }
    return null;
  }, [userId, movements]);

  if (!userId || movements.length < MIN_MOVEMENTS) return null;

  if (savedAs) {
    return (
      <FadeSlideIn distance={6}>
        <Text style={styles.settled} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {`Saved as ${savedAs}. Rename it or change its movements in You → Session types.`}
        </Text>
      </FadeSlideIn>
    );
  }

  if (duplicateOf) {
    return (
      <Text style={styles.settled} maxFontSizeMultiplier={MAX_FONT_SCALE}>
        {`This is your ${duplicateOf} day — it is already in your split.`}
      </Text>
    );
  }

  if (mode === 'idle') {
    return (
      <AppButton
        label="Save as a split day"
        variant="secondary"
        onPress={() => {
          tap();
          setName(suggested ?? '');
          setMode('naming');
        }}
        style={styles.action}
      />
    );
  }

  const trimmed = name.trim();

  const save = () => {
    if (!trimmed) return;
    addPlanDay(userId, trimmed, movements.map((m) => m.canonical).join('\n'));
    markSplitDaySaved();
    setSavedAs(trimmed);
    setMode('idle');
  };

  return (
    <FadeSlideIn distance={6} style={styles.panel}>
      <Eyebrow tone="muted">Name this day</Eyebrow>
      <TextInput
        value={name}
        onChangeText={setName}
        autoFocus
        autoCapitalize="words"
        autoCorrect={false}
        returnKeyType="done"
        maxLength={24}
        onSubmitEditing={save}
        placeholder="Push"
        placeholderTextColor={color.textMuted}
        style={styles.field}
        accessibilityLabel="Name for this split day"
        maxFontSizeMultiplier={MAX_FONT_SCALE}
      />
      <Text style={styles.hint} maxFontSizeMultiplier={MAX_FONT_SCALE}>
        {`Recore will work out what beats these ${movements.length} movements every time this day comes round.`}
      </Text>
      <View style={styles.actions}>
        <AppButton
          label="Not now"
          variant="ghost"
          compact
          onPress={() => {
            tap();
            setMode('idle');
          }}
          style={styles.flex}
        />
        <AppButton
          label="Save"
          compact
          disabled={trimmed.length === 0}
          onPress={save}
          style={styles.flex}
        />
      </View>
    </FadeSlideIn>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  action: {
    marginTop: spacing.sm,
  },
  panel: {
    marginTop: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    borderWidth: hairline,
    borderColor: color.border,
    backgroundColor: color.surface,
    gap: spacing.sm,
  },
  field: {
    fontSize: moderateScale(17),
    fontWeight: '600',
    color: color.textPrimary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderCurve: 'continuous',
    backgroundColor: color.surface,
  },
  hint: {
    ...type.footnote,
    lineHeight: lineFor(17),
    color: color.textMuted,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  settled: {
    marginTop: spacing.lg,
    ...type.footnote,
    lineHeight: lineFor(18),
    color: color.textSecondary,
  },
});
