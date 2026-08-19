import { Fragment, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, useReducedMotion, ZoomIn } from 'react-native-reanimated';

import { getAdherenceRecord, predictorIsProven } from '@/lib/db/insights';
import { tap, tapMedium } from '@/lib/haptics';
import { matchPlanIndex, nameKey, typedNameOf } from '@/lib/parse/receipt';
import { plateLine } from '@/lib/plates';
import { getBarWeightKg, getSmallestPlateKg, hasSeenGhostHint, markGhostHintSeen } from '@/lib/prefs';
import { color, CONTROL_HEIGHT, FIXED_FONT_SCALE, fonts, HIT, lineFor, MAX_FONT_SCALE, moderateScale, radius, spacing, type } from '@/lib/theme';
import { useSession } from '@/state/session-store';

import { MonoTag, repScheme } from './gutter-value';

/**
 * The PLANNED card (design frames 12/13 — the record contract's fourth
 * state). A bordered mono PLANNED tag and the standing disclaimer ("not
 * training until you lift it") head the card; each row is a neutral exercise
 * name on the left and the prescription value on the right in mono LIME —
 * **the only lime in the app**: a future prescription, never history, never
 * chrome. Rows keep their check circle (neutral ring; paper fill when done):
 * tap it and the prescribed line becomes real typed text in the note
 * (raw_text stays the source of truth). Did something different? Just write
 * it — the row checks itself off the moment the parse recognizes the
 * exercise. "Accept plan" commits the whole plan at once; "Skip this plan"
 * dismisses without judgment. The rule line, the evidence footer, and the
 * trust record ("Followed X of last Y", only with ≥3 settled outcomes and a
 * majority followed) stay quiet mono — evidence, not promises.
 */
const WEIGHT_TOKEN = /(\d+(?:\.\d+)?\s*kg)/i;
const CHECK_SIZE = moderateScale(24);

/** How far a pressed row's highlight bleeds past its content (see `row`). */
const PRESS_BLEED = spacing.sm;

/** "bench press 3×5  82.5 kg" split into name / prescription value. */
const PLAN_LINE_RE = /^(.+?)\s+(\d+)×(\d+)(?:\s+(\d+(?:\.\d+)?)\s*kg)?\s*$/;

/**
 * The neutral name and the lime value of a plan line ("bench press 3×5
 * 82.5 kg" → "bench press" + "82.5 kg × 5·5·5"). Cardio/hold lines keep the
 * trailing token as the value; an unmatched line stays a name-only row. The
 * check-off always uses the VERBATIM line text — display never drifts from
 * what would be written into the note.
 */
function planParts(line: string): { name: string; value: string | null } {
  const m = PLAN_LINE_RE.exec(line.trim());
  if (m) {
    const scheme = repScheme(Number(m[2]), m[3]!);
    return { name: m[1]!, value: m[4] != null ? `${m[4]} kg × ${scheme}` : scheme };
  }
  const words = line.trim().split(/\s+/);
  const tail = words[words.length - 1] ?? '';
  if (words.length > 1 && /\d/.test(tail)) {
    return { name: words.slice(0, -1).join(' '), value: tail };
  }
  return { name: line.trim(), value: null };
}

const capitalize = (s: string) => (s.length > 0 ? s.charAt(0).toUpperCase() + s.slice(1) : s);

export function GhostPrediction({
  onStart,
  onSomethingElse,
}: {
  onStart: () => void;
  onSomethingElse: () => void;
}) {
  const ghost = useSession((s) => s.ghost);
  const userId = useSession((s) => s.userId);
  const note = useSession((s) => s.note);
  const lineExercises = useSession((s) => s.lineExercises);
  const checkGhostLine = useSession((s) => s.checkGhostLine);
  const reduceMotion = useReducedMotion();
  /** Which row's plate math is open (long-press toggles). */
  const [platesLine, setPlatesLine] = useState<number | null>(null);

  // The predictor's public record — shown only when it's actually evidence.
  const trust = useMemo(() => {
    if (!userId) return null;
    const record = getAdherenceRecord(userId);
    // Enough settled ghosts to be evidence, and a majority followed — the rule
    // lives in insights.ts so the review gate reads the same reputation.
    if (!predictorIsProven(record)) return null;
    return `followed ${record.followed} of the last ${record.settled}`;
  }, [userId]);

  const planLines = useMemo(
    () => (ghost ? ghost.ghostText.split('\n').filter((l) => l.trim().length > 0) : []),
    [ghost],
  );

  // A plan row is DONE when the note already carries that exercise — parsed
  // (canonical names) or freshly typed/checked (instant feedback while the
  // parse is in flight). Each note name checks off AT MOST ONE row (exact key
  // wins, ambiguity checks nothing — matchPlanIndex, pure + tested), prose
  // sentences and mid-keystroke fragments never participate, and a checked
  // line always re-matches its own row verbatim as the safety net.
  const doneFlags = useMemo(() => {
    const planKeys = planLines.map((l) => nameKey(typedNameOf(l)));
    const noteLines = note.split('\n');
    const noteNames = [
      ...Object.values(lineExercises),
      ...noteLines
        .filter((l) => /\d/.test(l) || l.trim().split(/\s+/).length <= 4)
        .map((l) => typedNameOf(l)),
    ];

    const done = planLines.map(
      (line) => noteLines.some((l) => l.trim() === line.trim()), // checked verbatim
    );
    for (const name of noteNames) {
      const i = matchPlanIndex(name, planKeys);
      if (i !== null) done[i] = true;
    }
    return done;
  }, [planLines, lineExercises, note]);

  // The how-to hint is training wheels — shown on the first ghost only, then
  // it retires (the record contract needs explaining exactly once).
  const [hintSeen] = useState(() => hasSeenGhostHint());
  const hintVisible =
    !hintSeen && !!ghost && planLines.length > 0 && doneFlags.every((d) => !d);
  useEffect(() => {
    if (hintVisible) markGhostHintSeen();
  }, [hintVisible]);

  if (!ghost || planLines.length === 0) return null;

  const doneCount = doneFlags.filter(Boolean).length;
  const noteEmpty = note.trim().length === 0;

  const handleStart = () => {
    tapMedium();
    onStart();
  };
  const handleElse = () => {
    tap();
    onSomethingElse();
  };
  const handleCheck = (line: string) => {
    tapMedium();
    checkGhostLine(line);
  };
  const handlePlates = (i: number) => {
    tap();
    setPlatesLine((cur) => (cur === i ? null : i));
  };

  /** "hold for plates": the per-side breakdown for a row's prescribed load. */
  const platesFor = (line: string): string | null => {
    const match = line.match(WEIGHT_TOKEN);
    if (!match) return null;
    const target = Number.parseFloat(match[1]!);
    return plateLine(target, getBarWeightKg(), getSmallestPlateKg());
  };

  return (
    <Animated.View
      entering={reduceMotion ? undefined : FadeInDown.duration(260)}
      style={styles.card}>
      <View style={styles.header}>
        <MonoTag label="PLANNED" />
        <Text style={styles.tagline} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          not training until you lift it
        </Text>
        {doneCount > 0 ? (
          <Text style={styles.headerMeta} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {doneCount}/{planLines.length} done
          </Text>
        ) : null}
      </View>

      {planLines.map((line, i) => {
        const done = doneFlags[i] ?? false;
        const { name, value } = planParts(line);
        const plates = platesLine === i && !done ? platesFor(line) : null;
        return (
          // The rule between plan rows is a SIBLING, not a border on the row: a
          // bordered row cannot take a corner radius without the hairline
          // curving with it, and without a radius the pressed fill is a hard
          // grey rectangle sitting inside the card.
          <Fragment key={i}>
            <View style={styles.rowSep} />
            <Pressable
              disabled={done}
              onPress={() => handleCheck(line)}
              onLongPress={() => handlePlates(i)}
              style={({ pressed }) => [styles.row, pressed && !done && styles.rowPressed]}>
              <View style={styles.rowBody}>
                <View style={styles.rowLine}>
                  <Text
                    style={[styles.rowName, done && styles.rowDone]}
                    numberOfLines={1}
                    maxFontSizeMultiplier={MAX_FONT_SCALE}>
                    {capitalize(name)}
                  </Text>
                  {value ? (
                    <Text
                      style={[styles.rowValue, done && styles.rowValueDone]}
                      numberOfLines={1}
                      maxFontSizeMultiplier={MAX_FONT_SCALE}>
                      {value}
                    </Text>
                  ) : null}
                </View>
                {plates ? (
                  <Animated.Text
                    entering={reduceMotion ? undefined : FadeIn.duration(200)}
                    style={styles.plates}
                    numberOfLines={1}
                    maxFontSizeMultiplier={MAX_FONT_SCALE}>
                    {plates}
                  </Animated.Text>
                ) : null}
              </View>
              {done ? (
                <Animated.View
                  entering={reduceMotion ? undefined : ZoomIn.duration(220)}
                  style={[styles.check, styles.checkDone]}>
                  <Text style={styles.checkMark} maxFontSizeMultiplier={FIXED_FONT_SCALE}>
                    ✓
                  </Text>
                </Animated.View>
              ) : (
                <View style={styles.check} />
              )}
            </Pressable>
          </Fragment>
        );
      })}

      {hintVisible ? (
        <Text style={styles.hint} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          Tap a line when it&apos;s done · hold it for plate math · or just write what you did.
        </Text>
      ) : null}

      {/* The rule line — why the numbers moved. Quiet mono, never a pitch. */}
      {ghost.reason ? (
        <Text style={styles.reason} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {ghost.reason}
        </Text>
      ) : null}

      {/* The footer is the predictor's public record — shown ONLY when it's
          real evidence (a settled track record), never engine boilerplate. */}
      {trust ? (
        <Text style={styles.evidence} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {trust}
        </Text>
      ) : null}

      {noteEmpty ? (
        <View style={styles.buttons}>
          <Pressable
            onPress={handleStart}
            style={({ pressed }) => [styles.acceptBtn, pressed && styles.acceptPressed]}>
            <Text style={styles.acceptLabel} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              Accept plan
            </Text>
          </Pressable>
          <Pressable
            onPress={handleElse}
            style={({ pressed }) => [styles.skipBtn, pressed && styles.skipPressed]}>
            <Text style={styles.skipLabel} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              Skip this plan
            </Text>
          </Pressable>
        </View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // Not a floating widget — part of the page (minimalism pass): no surface
  // fill, no outer border/radius, just vertical rhythm and a hairline that
  // seats the plan against the note below. The rows keep their own dividers.
  card: {
    paddingVertical: spacing.md,
    marginBottom: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: color.divider,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  tagline: {
    flex: 1,
    fontFamily: fonts.reading,
    fontVariant: ['tabular-nums'],
    fontSize: moderateScale(10.5),
    color: color.textMuted,
  },
  headerMeta: {
    fontFamily: fonts.reading,
    fontSize: moderateScale(10.5),
    color: color.textMuted,
    fontVariant: ['tabular-nums'],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm + 1,
    // Rounded, and bleeding a little past the text, so checking a line lights
    // the row up instead of dropping a hard-cornered grey slab under it.
    marginHorizontal: -PRESS_BLEED,
    paddingHorizontal: PRESS_BLEED,
    borderRadius: radius.sm,
    borderCurve: 'continuous',
  },
  rowSep: {
    height: 1,
    backgroundColor: color.divider,
  },
  rowPressed: {
    opacity: 0.6,
  },
  rowBody: {
    flex: 1,
    gap: 2,
  },
  rowLine: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
  },
  rowName: {
    flex: 1,
    fontSize: moderateScale(14.5),
    color: color.textPrimary,
  },
  // THE ONLY LIME IN THE APP: a future prescription value (record contract).
  rowValue: {
    fontFamily: fonts.reading,
    fontSize: moderateScale(13.5),
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
    color: color.signal,
  },
  rowValueDone: {
    color: color.textMuted, // lifted — no longer a future value
    fontWeight: '400',
  },
  rowDone: {
    color: color.textMuted, // done rows recede — the note carries them now
  },
  plates: {
    fontFamily: fonts.reading,
    fontSize: moderateScale(10.5),
    fontVariant: ['tabular-nums'],
    color: color.textMuted,
  },
  check: {
    width: CHECK_SIZE,
    height: CHECK_SIZE,
    borderRadius: CHECK_SIZE / 2,
    borderWidth: 1.5,
    borderColor: color.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkDone: {
    backgroundColor: color.accent,
    borderColor: color.accent,
  },
  checkMark: {
    color: color.onInk,
    fontSize: type.caption.fontSize,
    fontWeight: '700',
  },
  hint: {
    marginTop: spacing.sm,
    fontSize: type.caption.fontSize,
    color: color.textMuted,
  },
  reason: {
    marginTop: spacing.md,
    fontFamily: fonts.reading,
    fontVariant: ['tabular-nums'],
    fontSize: moderateScale(10.5),
    lineHeight: lineFor(15),
    color: color.textMuted,
  },
  evidence: {
    marginTop: spacing.sm,
    fontFamily: fonts.reading,
    fontSize: moderateScale(10.5),
    color: color.textMuted,
    fontVariant: ['tabular-nums'],
  },
  buttons: {
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  acceptBtn: {
    minHeight: CONTROL_HEIGHT,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderCurve: 'continuous',
    backgroundColor: color.ctaFill,
  },
  acceptPressed: {
    backgroundColor: color.ctaFillPressed,
  },
  acceptLabel: {
    color: color.onInk,
    fontSize: moderateScale(16),
    fontWeight: '600',
  },
  skipBtn: {
    minHeight: HIT,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: color.border,
  },
  skipPressed: {
    opacity: 0.6,
  },
  skipLabel: {
    color: color.textPrimary,
    fontSize: moderateScale(14),
    fontWeight: '600',
  },
});
