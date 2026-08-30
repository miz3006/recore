import { StyleSheet, Text, View } from 'react-native';

import { type GutterSignal } from '@/lib/parse/types';
import {
  color,
  lineFor,
  MAX_FONT_SCALE,
  moderateScale,
  readingStyle,
  spacing,
  type,
} from '@/lib/theme';

import { comparisonOf, PrLabel } from './gutter-value';
import { Eyebrow } from './primitives';

/**
 * THE HEADER EVERY PER-ENTRY SHEET WEARS (owner, 20 August 2026).
 *
 * The ⋯ sheet and the note sheet each carried their own copy of this — the same
 * eyebrow, the same title, the same mono set line, and three identical style
 * blocks in two files. They opened one out of the other, so a divergence would
 * have shown up as the sheet re-titling itself mid-flow. One component now, and
 * the ⋯ sheet's `title2` ruling reaches both by construction.
 *
 * ## It says what the entry IS, not just what it is called
 *
 * The old header repeated the exercise name and the set line — exactly what the
 * card forty points above it already said — and threw away everything that
 * would have made opening the sheet worth the tap. The card knows this entry is
 * a personal record, knows how it compares to last time, and knows what the
 * athlete already wrote about it. All three now travel with it:
 *
 * · **PR** rides beside the name as the same neutral label the card uses.
 * · **The comparison** ("up 2.5 kg vs last") is the card's own sentence, from
 *   the card's own `comparisonOf` — one function, so the two surfaces cannot
 *   disagree about the same lift.
 * · **The note** is quoted, which is what makes "Edit note" a decision rather
 *   than a guess about what is already in there.
 *
 * Everything is optional and nothing is invented: a caller that does not have a
 * signal passes none and the line is simply absent. The note sheet passes no
 * note on purpose — it is about to show the same words in an editable field,
 * and a header quoting the paragraph directly beneath it is an echo, not
 * context.
 *
 * Done state is deliberately NOT here. It is the one fact of the four that is
 * still on screen behind the sheet, on the card whose ⋯ was just tapped.
 */
export function EntrySheetHeader({
  eyebrow,
  exercise,
  setText,
  signal = null,
  note = null,
}: {
  /** The label over the name — "This entry", "Fix reading". */
  eyebrow: string;
  exercise: string;
  /** The faithful per-set reading, as the ledger card prints it. */
  setText?: string | null;
  /** This entry's comparison against the last session, if one was computed. */
  signal?: GutterSignal | null;
  /** The athlete's own remark, quoted — omit where the sheet itself shows it. */
  note?: string | null;
}) {
  const comparison = comparisonOf(signal);
  return (
    <View>
      <Eyebrow tone="muted" style={styles.eyebrow}>
        {eyebrow}
      </Eyebrow>
      <View style={styles.titleRow}>
        <Text
          style={styles.title}
          numberOfLines={2}
          accessibilityRole="header"
          maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {exercise}
        </Text>
        {signal?.kind === 'pr' ? <PrLabel /> : null}
      </View>
      {setText ? (
        // Three lines, not two. A five-set pyramid is a long reading, and the
        // header that cropped it was hiding the very numbers the athlete opened
        // the sheet to act on.
        <Text style={styles.sets} numberOfLines={3} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {setText}
        </Text>
      ) : null}
      {comparison ? (
        <Text style={styles.comparison} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {comparison}
        </Text>
      ) : null}
      {note ? (
        <Text style={styles.note} numberOfLines={3} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {`“${note}”`}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  eyebrow: {
    marginTop: spacing.sm,
  },
  titleRow: {
    marginTop: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: {
    // `title2`, not `title`: 27 is the screen-hero size and this is a sheet
    // header. It is also the size the note sheet uses, and the two open one out
    // of the other — a 27 → 22 jump on the name reads as a different sheet.
    ...type.title2,
    color: color.textPrimary,
    flexShrink: 1,
  },
  sets: {
    marginTop: spacing.xs,
    ...readingStyle('400'),
    fontSize: moderateScale(13),
    color: color.textSecondary,
  },
  // The card's own subline, at the card's own size and ink — this is the same
  // sentence about the same lift, so it may not look like a different fact.
  comparison: {
    marginTop: 2,
    ...readingStyle('400'),
    fontSize: moderateScale(11.5),
    color: color.textSecondary,
  },
  // Prose, so it leaves the reading voice: this is the one line in the header
  // that Recore did not compute.
  note: {
    marginTop: spacing.xs,
    ...type.caption,
    lineHeight: lineFor(18),
    color: color.textSecondary,
  },
});
