import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { Enter } from '@/lib/motion/index';
import { MAX_FONT_SCALE, moderateScale, readingStyle, spacing, type } from '@/lib/theme';
import { useV2, type V2Answers } from '@/state/onboarding-v2';

import { Frame } from '../Frame';
import { FLOW, KEY_LIFTS } from '../flow';
import { kg } from '../projection';
import { v2color, v2radius, v2shadow } from '../tokens';
import type { ScreenProps } from './types';

/**
 * SCREEN 19 — HERE'S WHAT RECORE KNOWS. The reveal.
 *
 * REPLACED 16 September 2026 on the owner's directive, and shaped by the
 * second half of it the same day: *"naj bo to kot da je na nekem papirju …
 * kao notes"*. Nineteen screens of answering earn one page of being READ
 * BACK — so the answers arrive on a sheet of the app's own paper, and they
 * arrive the way everything in Recore arrives: WRITTEN. Each row's value
 * types itself in the reading face, one row after another, the caret moving
 * on exactly as it does on Today. The app is keeping its first record, and
 * the record is the person.
 *
 * ## The rules this screen lives under
 *
 * Every value is something they typed or tapped; an unanswered question's
 * row simply does not exist (§2 rule 2 — personalise only from chosen
 * information, never invent). The closing line is warm the only way this
 * app is allowed to be warm: specific evidence — their name and the year
 * their frequency answer multiplies out to. No praise, no claims about
 * their body.
 *
 * REDUCE MOTION: the whole sheet stands finished on arrival. The writing is
 * choreography; the facts never wait for it.
 */
export function RevealScreen({ def, progress, onAdvance, onBack, echo }: ScreenProps) {
  const reduced = useReducedMotion();
  const answers = useV2((s) => s.answers);
  const rows = useMemo(() => knownRows(answers), [answers]);
  const closing = useMemo(() => closingLine(answers), [answers]);

  // The writing timeline: each row starts once the one above has finished,
  // plus a breath. Computed up front so the closing line knows when the pen
  // is done.
  const starts = useMemo(() => {
    let at = FIRST_ROW_MS;
    return rows.map((row) => {
      const mine = at;
      at += row.value.length * CHAR_MS + ROW_GAP_MS;
      return mine;
    });
  }, [rows]);
  const penDone = starts.length > 0 ? starts[starts.length - 1]! + (rows[rows.length - 1]?.value.length ?? 0) * CHAR_MS : 0;

  return (
    <Frame
      headline={def.headline}
      subline={def.subline}
      progress={progress}
      echo={echo}
      onBack={onBack}
      cta={{ label: "Let's go", enabled: true, onPress: onAdvance }}
      testID="v2-screen-reveal">
      <Enter index={2}>
        <View style={[styles.paper, v2shadow]}>
          {rows.map((row, i) => (
            <Enter key={row.label} index={0} extraDelay={reduced ? 0 : starts[i]! - 160}>
              <View style={[styles.row, i === rows.length - 1 && !closing && styles.lastRow]}>
                <Text style={styles.rowLabel} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                  {row.label}
                </Text>
                <TypedValue text={row.value} startAt={starts[i]!} />
              </View>
            </Enter>
          ))}

          {closing ? (
            <Enter index={0} extraDelay={reduced ? 0 : penDone + 260}>
              <Text style={styles.closing} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                {closing}
              </Text>
            </Enter>
          ) : null}
        </View>
      </Enter>
    </Frame>
  );
}

/**
 * One value writing itself onto the sheet — the same caret, the same reading
 * face, the same cadence as the note the whole app is built around.
 */
function TypedValue({ text, startAt }: { text: string; startAt: number }) {
  const reduced = useReducedMotion();
  const [chars, setChars] = useState(reduced ? text.length : 0);

  useEffect(() => {
    if (reduced) {
      setChars(text.length);
      return;
    }
    setChars(0);
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (let c = 1; c <= text.length; c += 1) {
      timers.push(setTimeout(() => setChars(c), startAt + c * CHAR_MS));
    }
    return () => timers.forEach(clearTimeout);
  }, [reduced, startAt, text]);

  const writing = !reduced && chars > 0 && chars < text.length;

  return (
    <Text style={styles.rowValue} maxFontSizeMultiplier={MAX_FONT_SCALE}>
      {text.slice(0, chars)}
      {writing ? <Text style={styles.caret}>|</Text> : null}
    </Text>
  );
}

interface KnownRow {
  label: string;
  value: string;
}

/** The label a screen's option list gives an answer id — the person's own
 * words for it, never a re-phrasing invented here. */
function optionLabel(screenId: string, value: string | null): string | null {
  if (!value) return null;
  const screen = FLOW.find((s) => s.id === screenId);
  return screen?.options?.find((o) => o.id === value)?.label ?? null;
}

/**
 * Every answered question, one row each, in the order the flow asked. An
 * unanswered one contributes nothing — a dash against a question they
 * skipped would read as a reproach.
 */
function knownRows(a: V2Answers): KnownRow[] {
  const rows: KnownRow[] = [];
  const name = a.name.trim();
  if (name) rows.push({ label: 'NAME', value: name });

  const goal = optionLabel('goal', a.goal);
  if (goal) rows.push({ label: 'TRAINING FOR', value: goal });

  const experience = optionLabel('experience', a.experience);
  if (experience) rows.push({ label: 'TRAINING AGE', value: experience });

  const frequency = optionLabel('frequency', a.frequency);
  if (frequency) rows.push({ label: 'SESSIONS A WEEK', value: frequency });

  const split = optionLabel('split', a.split);
  if (split) rows.push({ label: 'SPLIT', value: split });

  const lifts = a.keyLifts
    .map((id) => {
      const label = KEY_LIFTS.find((l) => l.id === id)?.label ?? id;
      const load = a.liftLoads[id];
      return load != null && load > 0 ? `${label} · ${kg(load)} kg` : label;
    })
    .join('\n');
  if (lifts) rows.push({ label: 'KEY LIFTS', value: lifts });

  if (a.smallestPlateKg != null) {
    rows.push({ label: 'SMALLEST PLATE', value: `${kg(a.smallestPlateKg)} kg` });
  }

  // The flow writes and shows kilograms; saying so here is a fact about the
  // record being started, not a question that was asked.
  rows.push({ label: 'UNITS', value: 'Kilograms' });

  return rows;
}

/**
 * The closing line: their name, their arithmetic. `frequency × 52` is the
 * same multiplication screen 13 performed — repeated here because it is the
 * one number in the funnel that is both theirs and worth ending on.
 */
function closingLine(a: V2Answers): string {
  const name = a.name.trim();
  const perWeek = Number(a.frequency);
  const sessions = Number.isFinite(perWeek) && perWeek > 0 ? perWeek * 52 : null;
  if (name && sessions) {
    return `${name} — ${sessions} sessions a year starts with one written line.`;
  }
  if (name) return `${name} — the record starts with one written line.`;
  if (sessions) return `${sessions} sessions a year starts with one written line.`;
  return 'The record starts with one written line.';
}

/** The writing cadence — a touch quicker than the hero's demo typing, because
 * eight rows are being written and the reader already knows the words. */
const CHAR_MS = 20;
const ROW_GAP_MS = 240;
const FIRST_ROW_MS = 420;

const styles = StyleSheet.create({
  /**
   * THE SHEET. The app's own paper — a white surface with the warm shadow —
   * ruled like a notebook: one hairline under every written row. The one
   * sanctioned card family in onboarding is the value card, and this is one.
   */
  paper: {
    backgroundColor: v2color.surface,
    borderRadius: v2radius.hero,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: v2color.border,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
  },
  row: {
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: v2color.border,
  },
  lastRow: { borderBottomWidth: 0 },
  rowLabel: {
    ...type.footnote,
    color: v2color.inkMuted,
    letterSpacing: 1.6,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  rowValue: {
    ...readingStyle('600'),
    fontSize: moderateScale(18),
    lineHeight: moderateScale(26),
    color: v2color.ink,
    minHeight: moderateScale(26),
  },
  caret: { color: v2color.blue },
  closing: {
    ...type.lede,
    color: v2color.ink,
    marginTop: spacing.lg,
  },
});
