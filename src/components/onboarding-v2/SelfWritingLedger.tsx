import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { MAX_FONT_SCALE, readingStyle, spacing, type } from '@/lib/theme';

import { LiveLedger } from './LiveLedger';
import { v2color, v2radius, v2shadow } from './tokens';

/** The two lines the welcome screen writes for itself. Both are read by the
 * offline grammar, and they are written the way a person actually writes in a
 * notebook — lower case, a bare unit, commas between sets. */
const SCRIPT = ['bench 100kg 5,5,4', 'squat 120kg 5,5,5'] as const;

const CHAR_MS = 42;
const AFTER_LINE_MS = 620;

/**
 * THE LEDGER THAT WRITES AND PARSES ITSELF — screen 1.
 *
 * §2, screen 1: "No question. Live ledger demo that writes and parses itself."
 * It is the only autoplaying thing in the flow, and the case for it is that it
 * is not decoration: it is the product, performed. A person who has never seen
 * Recore learns the entire premise in four seconds without touching anything.
 *
 * IT RUNS ONCE AND STOPS. A loop would make it wallpaper, and the app's own
 * motion rules ban looping decoration outright; a demonstration that ends is a
 * demonstration you can look away from.
 *
 * THE PARSE IS REAL AND SO ARE THE CARDS. It renders `LiveLedger`, which
 * renders `ExerciseCard` from `note-surface.tsx` — the component Today draws an
 * entry with. The first thing anyone sees of Recore is therefore the actual
 * product drawing an actual reading, not an illustration of one. If the grammar
 * or the card ever regresses, this screen shows it before any other.
 *
 * REDUCE MOTION: both lines and their readings are present immediately. There
 * is nothing to watch, so there is nothing to wait for.
 */
export function SelfWritingLedger() {
  const reduced = useReducedMotion();
  const [typed, setTyped] = useState(reduced ? SCRIPT.join('\n') : '');
  const [settled, setSettled] = useState(reduced ? SCRIPT.length : 0);
  const timers = useRef<ReturnType<typeof setTimeout>[] | null>(null);

  useEffect(() => {
    if (reduced) return;
    const scheduled: ReturnType<typeof setTimeout>[] = [];
    timers.current = scheduled;
    let at = 320;

    SCRIPT.forEach((line, lineIndex) => {
      const prefix = SCRIPT.slice(0, lineIndex).join('\n');
      for (let c = 1; c <= line.length; c += 1) {
        const text = (lineIndex === 0 ? '' : `${prefix}\n`) + line.slice(0, c);
        scheduled.push(setTimeout(() => setTyped(text), at));
        at += CHAR_MS;
      }
      // The reading lands after the line finishes, not with it — the pause is
      // where "it read that" happens.
      at += 180;
      scheduled.push(setTimeout(() => setSettled(lineIndex + 1), at));
      at += AFTER_LINE_MS;
    });

    return () => {
      scheduled.forEach(clearTimeout);
      timers.current = null;
    };
  }, [reduced]);

  /** Only the lines that have finished typing get read — the reading follows
   * the writing, it does not race it. */
  const settledText = useMemo(() => SCRIPT.slice(0, settled).join('\n'), [settled]);

  return (
    <View style={[styles.card, v2shadow]}>
      <Text style={styles.eyebrow} maxFontSizeMultiplier={MAX_FONT_SCALE}>
        TODAY
      </Text>
      <Text style={styles.written} maxFontSizeMultiplier={MAX_FONT_SCALE}>
        {typed}
        {!reduced && typed.length > 0 && settled < SCRIPT.length ? (
          <Text style={styles.caret}>|</Text>
        ) : null}
      </Text>

      {settledText ? (
        <>
          <View style={styles.rule} />
          <LiveLedger text={settledText} showWritten={false} stagger={false} />
        </>
      ) : null}
    </View>
  );
}


/** Exported so screen 1 can reserve the card's final height and never reflow
 * while it types. A card that grows under the CTA is the one thing that would
 * make this read as a glitch. */
export const LEDGER_MIN_HEIGHT = 236;

/** How long the whole performance takes, so callers can time anything that has
 * to follow it. */
export const LEDGER_DURATION_MS =
  320 + SCRIPT.reduce((sum, line) => sum + line.length * CHAR_MS + 180 + AFTER_LINE_MS, 0);

const styles = StyleSheet.create({
  card: {
    backgroundColor: v2color.surface,
    borderRadius: v2radius.heroLarge,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: v2color.border,
    padding: spacing.xl,
    minHeight: LEDGER_MIN_HEIGHT,
  },
  eyebrow: {
    ...type.footnote,
    color: v2color.inkMuted,
    letterSpacing: 1.6,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  written: { ...readingStyle('500'), fontSize: 17, lineHeight: 25, color: v2color.ink, minHeight: 50 },
  caret: { color: v2color.blue },
  rule: { height: StyleSheet.hairlineWidth, backgroundColor: v2color.border, marginVertical: spacing.lg },
});
