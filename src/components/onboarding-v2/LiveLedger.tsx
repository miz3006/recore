import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { ExerciseCard } from '@/components/note-surface';
import { demoParseText } from '@/lib/demo-parse';
import { READING_STEP_MS } from '@/lib/motion/index';
import { buildReceipt, type ReceiptRow } from '@/lib/parse/receipt';
import { doneKeyFor } from '@/lib/parse/summarize';
import { MAX_FONT_SCALE, readingStyle, spacing, type } from '@/lib/theme';

import { v2color } from './tokens';

/**
 * THE REAL LEDGER, RENDERING A REAL PARSE — the demo screen and the read screen.
 *
 * Owner, 28 August 2026: *"Screen 5 should not be a mockup. Use the real Today
 * page components… The point of this screen is that it is not a demo. Anything
 * that makes it behave differently from Today is a bug."*
 *
 * So this file renders **`ExerciseCard` from `components/note-surface.tsx`** —
 * the same component Today draws an entry with, not a copy of it. Same
 * typography, same spacing, same check ring, same set table, same long-press to
 * show the words you wrote, same PR flag. There is one definition of what an
 * entry looks like in this app and both screens use it.
 *
 * ## The pipeline is the real one too
 *
 * `demoParseText` → `buildReceipt` → `ReceiptRow[]` → `ExerciseCard`. Only the
 * first step differs from Today, and it differs in the direction the spec asks
 * for: Today parses through the edge function with a local cache, and this
 * parses with `lib/demo-read.ts`, the offline grammar that is scored against
 * the same corpus. **No network and no account**, which is the state this
 * screen is always in — it runs before either exists.
 *
 * `buildReceipt(result, [])` — no signals, because there is no history to
 * compare against. That is not a special case: `ReceiptRow.signal` is null for
 * any first session and the gutter stays silent rather than labelled, exactly
 * as it will on their real first day.
 *
 * ## What the ~120 ms is
 *
 * §3: "The raw line stays visible; the structured reading resolves underneath
 * row by row, ~120ms apart." Rows are appended to the rendered list one at a
 * time, so each card plays Today's own entrance (`FadeInDown`, 220 ms) as it
 * arrives. The cadence is the demo's; the animation is Today's. Nothing here
 * re-implements how a card appears.
 */
export function LiveLedger({
  /** The person's own words, verbatim. The record (CLAUDE.md §3). */
  text,
  /** Reveal the rows one at a time. False on the read screen, where the parse
   * has already been watched once. */
  stagger = true,
  /** Extra ms before the first row lands. */
  delay = 0,
  /** Draw the person's own words above the reading. Off where the caller is
   * already showing them — the welcome screen types them live. */
  showWritten = true,
}: {
  text: string;
  stagger?: boolean;
  delay?: number;
  showWritten?: boolean;
}) {
  const reduceMotion = useReducedMotion();

  const rows = useMemo<ReceiptRow[]>(() => {
    const trimmed = text.trim();
    if (!trimmed) return [];
    return buildReceipt(demoParseText(trimmed), []).rows;
  }, [text]);

  const lines = useMemo(() => text.trim().split('\n'), [text]);

  // How many rows are on screen. Grows one at a time; jumps to all of them
  // under Reduce Motion, where the choreography is dropped but the outcome
  // must be identical and immediate.
  const [shown, setShown] = useState(() => (stagger && !reduceMotion ? 0 : rows.length));
  const [undone, setUndone] = useState<Set<string>>(new Set());
  const [wordsKey, setWordsKey] = useState<string | null>(null);

  useEffect(() => {
    if (!stagger || reduceMotion) {
      setShown(rows.length);
      return;
    }
    setShown(0);
    const timers = rows.map((_, i) =>
      setTimeout(() => setShown(i + 1), delay + i * READING_STEP_MS),
    );
    return () => timers.forEach(clearTimeout);
  }, [delay, reduceMotion, rows, stagger]);

  if (rows.length === 0) return null;

  return (
    <View style={styles.wrap}>
      {/* THE WORDS STAY. They are the record; the reading below is a
          projection of them, and the whole screen exists to show that the
          first does not change when the second appears. */}
      {showWritten ? (
        <>
          <View style={styles.written}>
            <Text style={styles.eyebrow} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              WHAT YOU WROTE
            </Text>
            <Text style={styles.raw} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              {text.trim()}
            </Text>
          </View>
          <View style={styles.rule} />
        </>
      ) : null}

      {rows.slice(0, shown).map((row, i) => {
        const key = doneKeyFor(row.exercise, row.setText);
        return (
          <ExerciseCard
            key={key}
            row={row}
            order={i}
            done={!undone.has(key)}
            alias={null}
            note={null}
            rawLine={lines[row.line] ?? text.trim()}
            showWords={wordsKey === key}
            reduceMotion={reduceMotion}
            onToggle={() =>
              setUndone((prev) => {
                const next = new Set(prev);
                if (next.has(key)) next.delete(key);
                else next.add(key);
                return next;
              })
            }
            onToggleWords={() => setWordsKey((prev) => (prev === key ? null : key))}
            // The three that open store-backed sheets. See FINDINGS §21: they
            // are inert here rather than faked, because a sheet that opened and
            // could not save would be a worse lie than a tap that does nothing.
            onEdit={() => {}}
            onActions={() => {}}
            onFix={() => {}}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%' },
  /**
   * NO INSET. `ExerciseCard` carries no horizontal padding of its own — on
   * Today it inherits `BODY_PADDING_H` (24) from the page, which is the same 24
   * this flow's `Frame` already applies. Any padding here would push the
   * person's own words a few points right of the reading made from them, and
   * the one thing this screen is claiming is that they are the same text.
   */
  written: {},
  eyebrow: {
    ...type.footnote,
    color: v2color.inkMuted,
    letterSpacing: 1.6,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  /** The reading face, because these are the person's own written numbers. */
  raw: { ...readingStyle('500'), fontSize: 17, lineHeight: 25, color: v2color.ink },
  rule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: v2color.border,
    marginVertical: spacing.lg,
  },
});
