import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { type SetTable as SetTableData, type SetTableRow } from '@/lib/parse/summarize';
import { color, fonts, MAX_FONT_SCALE, moderateScale, spacing } from '@/lib/theme';
import { useDisplay } from '@/state/display';

/**
 * The per-set mini table (owner, 4 Aug 2026) — the sets of ONE exercise under
 * its name, a row each.
 *
 * The ledger used to compress an exercise into a single faithful line
 * ("120·100·90 kg × 10·15·8"): exact, and unreadable at a glance the moment the
 * weight moved between sets. Here the same sets stand in columns — position,
 * load, work — in tabular mono, so a session is SCANNED rather than decoded.
 *
 * It is a projection, not a second record: every cell is a set the parser
 * already read (`setTableOf`), nothing is computed, nothing is rounded that the
 * summary does not round. Warm-ups, drops and skipped work stay visible and
 * labelled instead of numbered, which is the same contract the totals keep —
 * present in the record, absent from the count.
 *
 * ## Low vision (owner, 9 Aug 2026) — what actually changed and why
 *
 * The first version leaned on `textMuted` for the position and the note column.
 * Measured against the paper canvas that token is **2.45:1** — it fails WCAG AA
 * (4.5:1) and even the 3:1 floor for large text, so the set numbers were the
 * least readable thing in a table whose whole job is to be read. Nothing in the
 * table is muted any more: counted work is full ink (16:1), everything else is
 * `textSecondary` (4.7:1). Warm-ups and drops are told apart by their WORD, not
 * by a lighter grey — tone alone was never a safe distinction anyway.
 *
 * Three more changes, in order of how much they help:
 *
 * 1. **Bigger.** Every cell went up roughly two points; the header is a
 *    legible label rather than a 9pt whisper.
 * 2. **Closer.** Load and work used to sit at opposite ends of the card, so
 *    reading one set meant crossing the screen. They are now one tight group —
 *    short eye travel is worth more to a low-vision reader than a full-width
 *    grid, and the digits still line up because each cell is a fixed width.
 * 3. **It stops being a table when a table stops working.** At large Dynamic
 *    Type the columns cannot hold their content, and a cropped number is worse
 *    than no column. Past `STACK_AT` every set becomes its own spelled-out line
 *    ("Set 1 · 100 kg · 10 reps"), which wraps instead of truncating. The
 *    switch is live: `useWindowDimensions().fontScale` re-renders when the OS
 *    text size changes, so no relaunch is needed.
 *
 * Deliberately NOT done: zebra striping. On this palette the lightest band that
 * keeps text at AA is 1.04:1 against the canvas — invisible to the person it
 * was meant to help, and noise for everyone else.
 *
 * Structure otherwise comes from ONE rule under the header and from alignment,
 * not from a box: the card it sits in already has its own separators. No motion
 * — the card's own entrance is the only movement a settling record needs.
 */

/** Above this OS text scale the columns give way to one spelled-out line per
 * set. Chosen so it triggers at the accessibility sizes, not at "Large". */
const STACK_AT = 1.2;
/** …one step earlier when a note column is competing for the same width. */
const STACK_AT_WITH_NOTE = 1.1;

/**
 * The stacked layout may grow PAST the app-wide 1.3 clamp, because it is the
 * one surface built to take it: nothing here has a fixed height or a column to
 * crop, and the line wraps. The clamp exists so a layout cannot break — where
 * it cannot break, honouring more of the reader's setting is the point. This is
 * local to the set list; raising `MAX_FONT_SCALE` app-wide is a separate pass.
 */
const STACK_MAX_SCALE = 1.6;

/** How wide one value cell is at 1× — sized for "82.5", "1200 m", "1:30". */
const CELL = moderateScale(64);
/** The position column — sized for "warm" / "drop" / "skip". */
const POS = moderateScale(38);

/**
 * Is this exercise worth a table? Two or more sets always are — that is the
 * case the one-line reading could not carry. A single set earns one when it has
 * something extra to say (RIR, a run's duration), which the compact line drops;
 * otherwise "60 s" stays one quiet line rather than a header over one row.
 */
export function worthTable(table: SetTableData): boolean {
  return table.rows.length > 1 || table.hasNote;
}

/** "Set 1" · "Warm-up" · "Drop" · "Skipped" — the row's position, in words. */
function positionWords(row: SetTableRow): string {
  if (row.counted) return `Set ${row.label}`;
  if (row.label === 'warm') return 'Warm-up';
  if (row.label === 'drop') return 'Drop';
  if (row.label === 'skip') return 'Skipped';
  return row.label;
}

/**
 * One set as a sentence — used verbatim by VoiceOver and, at accessibility text
 * sizes, on screen. Units are spelled out because the column header that
 * carried them is gone: "100 kg · 10 reps · RIR 1".
 */
function setSentence(table: SetTableData, row: SetTableRow): string {
  const parts: string[] = [];
  if (row.load) parts.push(row.load === 'bw' ? 'bodyweight' : `${row.load} kg`);
  // Distance and duration already carry their unit ("400 m", "1:30"); only a
  // bare rep count needs the word.
  if (row.work) parts.push(table.workHead === 'REPS' ? `${row.work} reps` : row.work);
  if (row.note) parts.push(row.note);
  return parts.join(' · ');
}

export function SetTable({ table }: { table: SetTableData }) {
  // Live, not a module-level snapshot: changing the OS text size re-renders
  // this, so the layout follows the setting without a relaunch.
  const { fontScale } = useWindowDimensions();
  // The in-app choice (You → Display), for the reader who wants larger set
  // readings HERE without enlarging every app on their phone.
  const chosenLarge = useDisplay((s) => s.largeSetReadings);

  if (table.rows.length === 0) return null;

  // A note column costs a third of the width, so a table carrying one runs out
  // of room a Dynamic Type step earlier. The thresholds sit between real iOS
  // steps (xLarge 1.118, xxLarge 1.235) rather than on top of one.
  const stackAt = table.hasNote ? STACK_AT_WITH_NOTE : STACK_AT;
  return chosenLarge || fontScale >= stackAt ? (
    <StackedSets table={table} />
  ) : (
    <ColumnSets table={table} />
  );
}

/** The default: aligned columns, for text at or near the design size. */
function ColumnSets({ table }: { table: SetTableData }) {
  const { fontScale } = useWindowDimensions();
  // The columns hold TYPE, so they grow with it — a fixed width would crop its
  // own label at the Dynamic Type clamp ([[recore-responsive-type]]).
  const grow = Math.min(fontScale, MAX_FONT_SCALE);
  const cells = (table.loadHead ? 1 : 0) + (table.workHead ? 1 : 0);
  const groupStyle = { width: CELL * grow * cells + (cells > 1 ? spacing.sm : 0) };
  const posStyle = { width: POS * grow };

  return (
    <View style={styles.table}>
      {/* The header names the columns for the EYE only — a screen reader gets
          the whole set as one spoken sentence per row instead. */}
      <View
        style={styles.headRow}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants">
        <Text style={[styles.head, posStyle]} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          SET
        </Text>
        <View style={[styles.group, groupStyle]}>
          {table.loadHead ? (
            <Text style={[styles.head, styles.cell]} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              {table.loadHead}
            </Text>
          ) : null}
          {table.workHead ? (
            <Text style={[styles.head, styles.cell]} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              {table.workHead}
            </Text>
          ) : null}
        </View>
      </View>

      {table.rows.map((r, i) => (
        <View
          key={`${i}:${r.label}`}
          style={styles.row}
          accessible
          accessibilityLabel={`${positionWords(r)}, ${setSentence(table, r)}`}>
          <Text
            style={[styles.pos, !r.counted && styles.aside, posStyle]}
            numberOfLines={1}
            maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {r.label}
          </Text>
          <View style={[styles.group, groupStyle]}>
            {table.loadHead ? (
              <Text
                style={[styles.value, !r.counted && styles.aside, styles.cell]}
                numberOfLines={1}
                maxFontSizeMultiplier={MAX_FONT_SCALE}>
                {r.load || '—'}
              </Text>
            ) : null}
            {table.workHead ? (
              <Text
                style={[styles.value, !r.counted && styles.aside, styles.cell]}
                numberOfLines={1}
                maxFontSizeMultiplier={MAX_FONT_SCALE}>
                {r.work || '—'}
              </Text>
            ) : null}
          </View>
          {table.hasNote ? (
            <Text
              style={[styles.note, styles.noteCell]}
              numberOfLines={1}
              maxFontSizeMultiplier={MAX_FONT_SCALE}>
              {r.note}
            </Text>
          ) : null}
        </View>
      ))}
    </View>
  );
}

/**
 * The accessibility-size layout: one spelled-out line per set. Columns are
 * abandoned on purpose — at this text size they would crop the very numbers the
 * table exists to show, and a wrapped sentence never truncates.
 */
function StackedSets({ table }: { table: SetTableData }) {
  return (
    <View style={styles.table}>
      {table.rows.map((r, i) => (
        <View
          key={`${i}:${r.label}`}
          style={styles.stackRow}
          accessible
          accessibilityLabel={`${positionWords(r)}, ${setSentence(table, r)}`}>
          <Text
            style={[styles.stackLabel, !r.counted && styles.aside]}
            maxFontSizeMultiplier={STACK_MAX_SCALE}>
            {positionWords(r)}
          </Text>
          <Text
            style={[styles.stackValue, !r.counted && styles.aside]}
            maxFontSizeMultiplier={STACK_MAX_SCALE}>
            {setSentence(table, r)}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  table: {
    marginTop: spacing.xs,
    alignSelf: 'stretch',
  },
  headRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    paddingBottom: spacing.xs,
    // A rule the eye can actually find. `tableRule` measures 1.11:1 against the
    // canvas — a boundary nobody with low vision will see.
    borderBottomWidth: 1,
    borderBottomColor: color.border,
  },
  head: {
    fontFamily: fonts.reading,
    fontVariant: ['tabular-nums'],
    fontSize: moderateScale(11),
    letterSpacing: 1,
    color: color.textSecondary,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
    // Room between rows so each set reads as its own line without a rule.
    paddingTop: spacing.xs + 2,
  },
  /** Load and work travel together — one short scan, not a full-width grid. */
  group: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  cell: {
    flex: 1,
    textAlign: 'right',
  },
  noteCell: {
    flex: 1,
    textAlign: 'left',
  },
  pos: {
    fontFamily: fonts.reading,
    fontSize: moderateScale(13),
    color: color.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  value: {
    fontFamily: fonts.reading,
    fontSize: moderateScale(15),
    fontWeight: '500',
    color: color.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  note: {
    fontFamily: fonts.reading,
    fontSize: moderateScale(12.5),
    color: color.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  /**
   * Warm-ups, drops and skipped work. `textSecondary` clears AA (4.7:1) where
   * the old `textMuted` did not (2.45:1) — and the WORD in the position column
   * is what actually says "this one is outside the count". Tone alone never
   * carries meaning here.
   */
  aside: {
    color: color.textSecondary,
  },
  stackRow: {
    paddingTop: spacing.sm,
  },
  stackLabel: {
    fontFamily: fonts.reading,
    fontVariant: ['tabular-nums'],
    fontSize: moderateScale(12),
    letterSpacing: 0.6,
    color: color.textSecondary,
  },
  stackValue: {
    marginTop: 1,
    fontFamily: fonts.reading,
    fontSize: moderateScale(16),
    fontWeight: '500',
    // No fixed `lineHeight`: this line is allowed past the app clamp, and a
    // pinned line box would crop the very text that was enlarged to be read.
    color: color.textPrimary,
    fontVariant: ['tabular-nums'],
  },
});
