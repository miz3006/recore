import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { type SetTable as SetTableData, type SetTableRow } from '@/lib/parse/summarize';
import { color, MAX_FONT_SCALE, moderateScale, readingStyle, spacing } from '@/lib/theme';
import { useDisplay } from '@/state/display';

/**
 * The per-set mini table (owner, 4 Aug 2026) — the sets of ONE exercise under
 * its name, a row each.
 *
 * The ledger used to compress an exercise into a single faithful line
 * ("120·100·90 kg × 10·15·8"): exact, and unreadable at a glance the moment the
 * weight moved between sets. Here the same sets stand in columns — position,
 * load, work — in tabular figures, so a session is SCANNED rather than decoded.
 *
 * It is a projection, not a second record: every cell is a set the parser
 * already read (`setTableOf`), nothing is computed, nothing is rounded that the
 * summary does not round. Warm-ups, drops and skipped work stay visible and
 * marked instead of numbered, which is the same contract the totals keep —
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
 * **It stops being a table when a table stops working.** At large Dynamic Type
 * the columns cannot hold their content, and a cropped number is worse than no
 * column. Past `STACK_AT` every set becomes its own spelled-out line ("Set 1 ·
 * 100 kg · 10 reps"), which wraps instead of truncating. The switch is live:
 * `useWindowDimensions().fontScale` re-renders when the OS text size changes,
 * so no relaunch is needed.
 *
 * Deliberately NOT done: zebra striping. On this palette the lightest band that
 * keeps text at AA is 1.04:1 against the canvas — invisible to the person it
 * was meant to help, and noise for everyone else.
 *
 * Structure comes from ALIGNMENT AND AIR, not from lines (v6, 20 Aug 2026).
 * The design skill's §Structure: *"The record has no cards and no dividers."*
 * The table never had rules between its sets — the spacing already did that job
 * — and the one rule it did have, under the column header, is gone with it. The
 * boundary is space, and space does not have a contrast ratio to fail.
 *
 * ---
 *
 * ## ONE CLUSTER, ON THE LEFT, IN WORDS (11 September 2026 — owner)
 *
 * Photographed on Today and ruled on the same day: *"ni tako narazen … sets, kg
 * in število ponavljanj eno ob drugem … malo premakni v levo, da ni čisto ob
 * robu … dovolj vidno tudi za tiste, ki imajo slabšo dioptrijo na blizu."*
 * Three faults in one picture, and they were one fault:
 *
 * 1. **The set was three facts at three addresses.** The position sat on the
 *    left margin, the load and the work were right-anchored against the card's
 *    right edge, and roughly two hundred points of paper ran between them. A
 *    set is ONE reading — "set 2, 25 kg, 12 reps" — and the eye should not have
 *    to travel the page to assemble it.
 * 2. **The numbers themselves were not together either.** Both values were
 *    right-aligned inside a fixed 56 pt cell, so a two-digit load and a
 *    two-digit rep count ended up ~40 pt apart: one set read as two facts.
 * 3. **It was too small to be read by the person it is for.** 15 pt readings,
 *    a 13 pt position, and an 11 pt tracked header two lines above the numbers
 *    it named — the association a header asks for is exactly the work that
 *    presbyopia makes expensive.
 *
 * What replaces it:
 *
 * · **The cluster is left-anchored and indented** `spacing.md` under the
 *   exercise name — a sub-list of the line above it, not a second margin. It is
 *   against neither edge, which is what the ruling asked for.
 * · **The columns are measured, not fixed.** Each column is exactly as wide as
 *   the widest thing in it (`inkWidth` below), so `25` and `12` stand one word
 *   apart instead of one dead cell apart. The grid still holds: every row of an
 *   exercise uses the same widths, so the figures line up down the card.
 * · **The header is gone; every row says its own units.** `1 · 25 kg × 12` is
 *   the notation the app's own compact line already speaks
 *   (`120·100·90 kg × 10·15·8`), and it needs no legend two lines up. A table
 *   with no load column spells the word instead — `1 · 12 reps` — because
 *   nothing else in that row would say what the number counts. Distance and
 *   duration already carry their unit ("400 m", "1:30") and are left alone.
 * · **Everything grew.** Readings 15 → 17 (the size iOS sets Body in), the
 *   position 13 → 15 in full ink, the mark words 12.5 → 14, the qualifier lane
 *   10.5/12.5 → 11.5/14. The room came from the two dead columns, so the card
 *   is no taller for it.
 *
 * The unit is a step lighter and a step smaller than the number beside it
 * (design skill §Structure: *"Number and unit are typographically two
 * things"*), and `kg ×` is drawn right-aligned in its own measured slot so the
 * `×` lands on the same x even on a bodyweight row that has no `kg` to print.
 *
 * **The position column holds POSITIONS; the lane holds WORDS.** `warm-up`,
 * `drop` and `skipped` used to stand in the position column in place of a
 * number, which sized that column to the longest WORD — so a card carrying a
 * warm-up started its figures some 45 pt right of the card above it, and a page
 * of sets had no left edge at all. The marks ride in the qualifier lane now,
 * immediately after the numbers they are about, which is the same
 * short-eye-travel argument from the other side of the figures, and every card
 * on the page starts its readings at the same x. The 9 August ruling is intact:
 * the mark is still a WORD, still whole ("warm-up", never "warm"), still at a
 * size meant to be read, and never a lighter grey doing the work alone.
 *
 * **The chain survived the move.** A drop or a myo set hangs off the set above
 * it and is indented for it. An indent used to be a plain `marginLeft`, which
 * in a left-anchored grid would push that row's numbers out of the column — so
 * the indent is paid INSIDE the position cell instead (`chain` below): the
 * chained row gets a wider cell and no right margin, the others a narrower cell
 * and a right margin, both totalling the same width. The number moves; the grid
 * does not.
 *
 * No motion — the card's own entrance is the only movement a settling record
 * needs.
 */

/** Above this OS text scale the columns give way to one spelled-out line per
 * set. Chosen so it triggers at the accessibility sizes, not at "Large". */
const STACK_AT = 1.2;
/** …one step earlier when the middle lane is competing for the same width. */
const STACK_AT_WITH_NOTE = 1.1;

/**
 * The stacked layout may grow PAST the app-wide 1.3 clamp, because it is the
 * one surface built to take it: nothing here has a fixed height or a column to
 * crop, and the line wraps. The clamp exists so a layout cannot break — where
 * it cannot break, honouring more of the reader's setting is the point. This is
 * local to the set list; raising `MAX_FONT_SCALE` app-wide is a separate pass.
 */
const STACK_MAX_SCALE = 1.6;

/**
 * The sizes the table is measured in. They are constants rather than style
 * literals because `inkWidth` has to know them: a column is as wide as the
 * widest reading it holds, and that cannot be worked out from a style sheet.
 *
 * 17 is the size iOS sets Body in, and the size the exercise name above it is
 * set in — the reading is the point of the card, so it is not smaller than the
 * page it sits on (owner, 11 Sep 2026: readable at arm's length with reading
 * glasses off).
 */
const VALUE_SIZE = moderateScale(17);
/** The position — ink, because it is counted work, one step under the reading
 * it introduces so the two never read as one number. */
const POS_SIZE = moderateScale(15);
/** "warm-up" · "drop" · "skipped" — the word that stands in for a position,
 * printed after the set's figures rather than in place of its number. */
const MARK_SIZE = moderateScale(14);
/** Units and separators: a step lighter and a step smaller than the figure. */
const UNIT_SIZE = moderateScale(14);

/**
 * How wide a string will be, in points, without laying it out.
 *
 * The table sizes its own columns, and it has to do it in the render pass that
 * draws them — `onLayout` would mean one frame of the wrong grid on every card,
 * which on a scrolling page is a visible shudder. So the advance widths are
 * measured ones, in ems, for the face the readings are set in (SF Pro, and
 * `readingStyle` puts every digit on the same advance with `tabular-nums` —
 * which is why a digit is one number here rather than ten).
 *
 * It is an ESTIMATE with a stated failure mode: every cell below is a
 * `minWidth`, never a `width`, and React Native's default `flexShrink` is 0. An
 * under-estimate therefore lets that one cell grow to its content — the row
 * loses the column, nothing is ever cropped — and an over-estimate costs a
 * point of air. Both are survivable; a truncated load is not.
 */
function charEm(c: string): number {
  if (c >= '0' && c <= '9') return 0.64;
  if (c >= 'A' && c <= 'Z') return 0.68;
  switch (c) {
    case '.':
    case ',':
    case ':':
      return 0.3;
    case ' ':
      return 0.28;
    case '-':
    case 'i':
    case 'l':
    case 'j':
    case 't':
    case 'f':
    case 'r':
      return 0.36;
    case 'm':
      return 0.86;
    case 'w':
      return 0.78;
    case '—':
      return 1;
    case '×':
      return 0.62;
    default:
      return 0.56;
  }
}

function inkWidth(text: string, fontSize: number, tracking = 0): number {
  let em = 0;
  for (const c of text) em += charEm(c);
  return em * fontSize + tracking * text.length;
}

/** The widest of a column's contents, rounded up to a whole point. */
function widest(values: string[], fontSize: number, tracking = 0): number {
  let w = 0;
  for (const v of values) w = Math.max(w, inkWidth(v, fontSize, tracking));
  return Math.ceil(w);
}

/**
 * Is this exercise worth a table? Two or more sets always are — that is the
 * case the one-line reading could not carry. A single set earns one when it has
 * something extra to say (an RIR, an AMRAP, a run's duration), which the
 * compact line drops; otherwise "60 s" stays one quiet line rather than a
 * header over one row.
 */
export function worthTable(table: SetTableData): boolean {
  return table.rows.length > 1 || table.hasNote;
}

/** "Set 1" · "Warm-up" · "Drop" · "Skipped" — the row's position, in words. */
function positionWords(row: SetTableRow): string {
  if (row.mark) return row.mark[0].toUpperCase() + row.mark.slice(1);
  return `Set ${row.label}`;
}

/**
 * One set as a sentence — used verbatim by VoiceOver and, at accessibility text
 * sizes, on screen: "100 kg · 10 reps · RIR 1".
 *
 * The kind comes LAST and in words ("to failure", not "FAILURE"): the uppercase
 * on screen is a typographic mark saying *this is a label, not a reading*, and
 * a screen reader that spells out capitals would read it as an initialism.
 */
function setSentence(table: SetTableData, row: SetTableRow): string {
  const parts: string[] = [];
  if (row.load) parts.push(row.load === 'bw' ? 'bodyweight' : `${row.load} kg`);
  // Distance and duration already carry their unit ("400 m", "1:30"); only a
  // bare rep count needs the word.
  if (row.work) parts.push(table.workHead === 'REPS' ? `${row.work} reps` : row.work);
  if (row.rir != null) parts.push(`RIR ${row.rir}`);
  if (row.note) parts.push(row.note);
  if (row.kindTag) parts.push(SPOKEN_KIND[row.kindTag] ?? row.kindTag);
  return parts.join(' · ');
}

/** What the uppercase mark is called out loud. */
const SPOKEN_KIND: Record<string, string> = {
  AMRAP: 'as many reps as possible',
  MYO: 'myo-reps',
  FAILURE: 'to failure',
};

export function SetTable({ table }: { table: SetTableData }) {
  // Live, not a module-level snapshot: changing the OS text size re-renders
  // this, so the layout follows the setting without a relaunch.
  const { fontScale } = useWindowDimensions();
  // The in-app choice (You → Display), for the reader who wants larger set
  // readings HERE without enlarging every app on their phone.
  const chosenLarge = useDisplay((s) => s.largeSetReadings);

  if (table.rows.length === 0) return null;

  // The qualifier lane costs width, so a table carrying one runs out of room a
  // Dynamic Type step earlier. The thresholds sit between real iOS steps
  // (xLarge 1.118, xxLarge 1.235) rather than on top of one.
  const stackAt = table.hasNote ? STACK_AT_WITH_NOTE : STACK_AT;
  return chosenLarge || fontScale >= stackAt ? (
    <StackedSets table={table} />
  ) : (
    <ColumnSets table={table} />
  );
}

/**
 * The qualifier lane — what this set was, beside the numbers it was.
 *
 * Four tokens at most, and each is drawn as what it IS. A MARK is the word that
 * replaces a position, so it keeps the voice a position has — lower case, full
 * size, no tracking — rather than being dressed as a label. The kind is a LABEL,
 * so it takes the app's label treatment (uppercase, tracked, small); the RIR is
 * a MEASUREMENT, so it takes the record's own pattern of a number in the
 * reading face with its unit a step lighter beside it (design skill §Structure:
 * *"Number and unit are typographically two things"*); the ride-along metric is
 * already a formatted reading and is left alone.
 *
 * It follows the numbers now instead of preceding them (11 Sep 2026). While the
 * readings were right-anchored the lane had to be a spacer as much as a lane —
 * it was what pushed them to the margin, so it was drawn even when empty. The
 * cluster anchors itself on the left now, so an empty lane is simply not there,
 * and a full one sits immediately after the set it qualifies. Same argument,
 * other side: a fact about a set belongs against that set's numbers.
 */
function Qualifiers({ row }: { row: SetTableRow }) {
  if (row.mark == null && row.kindTag == null && row.rir == null && !row.note) return null;
  return (
    <View style={styles.lane}>
      {row.mark ? (
        <Text style={styles.mark} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {row.mark}
        </Text>
      ) : null}
      {row.kindTag ? (
        <Text style={styles.kindTag} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {row.kindTag}
        </Text>
      ) : null}
      {row.rir != null ? (
        <Text style={styles.rir} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          <Text style={styles.rirLabel}>RIR </Text>
          {row.rir}
        </Text>
      ) : null}
      {row.note ? (
        <Text style={styles.rideAlong} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {row.note}
        </Text>
      ) : null}
    </View>
  );
}

/** The default: one tight cluster per set, for text at or near the design size. */
function ColumnSets({ table }: { table: SetTableData }) {
  const { fontScale } = useWindowDimensions();
  // The columns hold TYPE, so they grow with it — a fixed width would crop its
  // own content at the Dynamic Type clamp ([[recore-responsive-type]]).
  const grow = Math.min(fontScale, MAX_FONT_SCALE);
  const rows = table.rows;

  // Each column is the widest thing in it, and nothing else. This is what
  // stopped the load and the rep count reading as two separate facts.
  const posW =
    widest(
      rows.map((r) => r.label),
      POS_SIZE,
    ) * grow;
  const loadW = table.loadHead
    ? widest(
        rows.map((r) => r.load || '—'),
        VALUE_SIZE,
      ) * grow
    : 0;
  const workW = table.workHead
    ? widest(
        rows.map((r) => r.work),
        VALUE_SIZE,
      ) * grow
    : 0;
  // "kg ×" right-aligned in a slot of its own width, so the × keeps its x on a
  // row that prints no kg (a bodyweight set inside a loaded exercise).
  const unitW = table.loadHead ? Math.ceil(inkWidth('kg ×', UNIT_SIZE)) * grow : 0;
  // The one work unit with no symbol of its own. It is spelled only where
  // nothing else in the row would say what the number counts — with a load
  // column present, "25 kg × 12" already says it.
  const repsWord = !table.loadHead && table.workHead === 'REPS';
  // The chain indent, paid inside the position cell so it cannot move a number.
  const chain = rows.some((r) => r.chained) ? spacing.md : 0;

  return (
    <View style={styles.table}>
      {rows.map((r, i) => {
        // A skipped set is RECORDED, NOT PERFORMED, and the rule through the
        // figures is what says so — a SHAPE, not a hue (design skill §Colour:
        // colour is never the only carrier), beside the word in the position.
        const struck = r.mark === 'skipped';
        const quiet = !r.counted;
        return (
          <View
            key={`${i}:${r.label}${r.mark ?? ''}`}
            style={styles.row}
            accessible
            accessibilityLabel={`${positionWords(r)}, ${setSentence(table, r)}`}>
            <Text
              style={[
                styles.pos,
                quiet && styles.aside,
                // The indent and the gap always total the same width, so a
                // chained set moves and the columns after it do not.
                r.chained
                  ? { minWidth: posW + chain, marginRight: spacing.md }
                  : { minWidth: posW, marginRight: spacing.md + chain },
              ]}
              numberOfLines={1}
              maxFontSizeMultiplier={MAX_FONT_SCALE}>
              {r.label}
            </Text>
            {table.loadHead ? (
              <>
                <Text
                  style={[
                    styles.value,
                    quiet && styles.aside,
                    struck && styles.struck,
                    { minWidth: loadW },
                  ]}
                  numberOfLines={1}
                  maxFontSizeMultiplier={MAX_FONT_SCALE}>
                  {r.load || '—'}
                </Text>
                <Text
                  style={[styles.unit, quiet && styles.aside, { minWidth: unitW }]}
                  numberOfLines={1}
                  maxFontSizeMultiplier={MAX_FONT_SCALE}>
                  {unitToken(r)}
                </Text>
              </>
            ) : null}
            {table.workHead ? (
              <Text
                style={[
                  styles.value,
                  // Left only when it follows a "×" and finishes that phrase.
                  // On its own — a rep count, a distance — it is the head of a
                  // column and right-aligns like one, so the word after it sits
                  // against the figure instead of a digit's worth of air.
                  table.loadHead ? styles.work : null,
                  quiet && styles.aside,
                  struck && styles.struck,
                  { minWidth: workW },
                ]}
                numberOfLines={1}
                maxFontSizeMultiplier={MAX_FONT_SCALE}>
                {r.work}
              </Text>
            ) : null}
            {repsWord && r.work ? (
              <Text
                style={[styles.unit, styles.repsWord, quiet && styles.aside]}
                numberOfLines={1}
                maxFontSizeMultiplier={MAX_FONT_SCALE}>
                reps
              </Text>
            ) : null}
            <Qualifiers row={r} />
          </View>
        );
      })}
    </View>
  );
}

/**
 * What stands between the load and the work: "kg ×" on a loaded set, "×" alone
 * on a bodyweight one (the load cell already says `bw`), and a bare "kg" on the
 * rare row that carries a load and no work to multiply it by.
 */
function unitToken(row: SetTableRow): string {
  if (row.load === 'bw') return row.work ? '×' : '';
  return row.work ? 'kg ×' : 'kg';
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
          key={`${i}:${r.label}${r.mark ?? ''}`}
          style={[styles.stackRow, r.chained && styles.chained]}
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
  /**
   * THE SETS HANG UNDER THE NAME (11 September 2026).
   *
   * `spacing.md` in from the card body, which is itself in from the page by the
   * rail — so the cluster is against neither margin, and the indent says these
   * rows belong to the line above them. The readings used to be hard against
   * the card's right edge with the position alone on the left; what the eye had
   * to cross to assemble one set was the whole width of the page.
   */
  table: {
    marginTop: spacing.xs,
    marginLeft: spacing.md,
    alignSelf: 'stretch',
  },
  /** One set, one line, read left to right: position · load · unit · work. */
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
    // Room between rows so each set reads as its own line without a rule.
    paddingTop: spacing.sm,
  },
  /** A numbered set. Ink, because it is counted work, and right-aligned so a
   * tenth set does not shift the column its load lives in. */
  pos: {
    ...readingStyle('400'),
    fontSize: POS_SIZE,
    color: color.textPrimary,
    textAlign: 'right',
  },
  /** A marked set — "warm-up", "drop", "skipped". The word IS the distinction
   * (low-vision ruling): never a lighter grey doing the work alone, never an
   * abbreviation, and never smaller than the sentence it qualifies. */
  mark: {
    ...readingStyle('400'),
    fontSize: MARK_SIZE,
    letterSpacing: 0.2,
    color: color.textSecondary,
    flexShrink: 1,
  },
  /** The reading. Right-aligned, so decimals and hundreds line up down the
   * card; ink, because it is the fact the card exists for. */
  value: {
    ...readingStyle('500'),
    fontSize: VALUE_SIZE,
    color: color.textPrimary,
    textAlign: 'right',
  },
  /** …except the work, which is left-aligned: it follows a "×" and reads as the
   * second half of one phrase, not as the head of a second column. */
  work: {
    textAlign: 'left',
  },
  /** Units and the multiplication sign: a step lighter and a step smaller than
   * the number they qualify (design skill §Structure). Right-aligned so "×"
   * keeps its place whether or not a "kg" precedes it. */
  unit: {
    ...readingStyle('400'),
    fontSize: UNIT_SIZE,
    color: color.textSecondary,
    textAlign: 'right',
    marginHorizontal: spacing.xs,
  },
  /** "reps", spelled only where no load column says it for us. */
  repsWord: {
    textAlign: 'left',
  },
  /**
   * The qualifier lane: whatever the set says beyond its numbers, immediately
   * after them. It takes the slack (`flex: 1`) so nothing here can push a
   * reading, and it shrinks before the numbers do — a truncated "AMRAP" is
   * survivable, a truncated load is not.
   */
  lane: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
    paddingLeft: spacing.md,
  },
  /**
   * A set's KIND is a label, so it takes the label treatment the app uses
   * everywhere else — small, uppercase, tracked. It is deliberately not a
   * filled chip: the record is bare rows on paper (§Structure), and the app's
   * one sanctioned filled chip pairs with a semantic ink this has no claim to.
   */
  kindTag: {
    ...readingStyle('600'),
    fontSize: moderateScale(11.5),
    letterSpacing: 0.8,
    color: color.textSecondary,
    flexShrink: 1,
  },
  /** RIR is a MEASUREMENT: the number carries the weight, the unit is a step
   * lighter beside it. Same size, so the two share a baseline exactly. */
  rir: {
    ...readingStyle('600'),
    fontSize: moderateScale(14),
    color: color.textSecondary,
  },
  rirLabel: {
    ...readingStyle('400'),
    letterSpacing: 0.3,
  },
  /** The second metric a work cell could not hold — already a formatted
   * reading ("1:00", "400 m"), so it is left as one. */
  rideAlong: {
    ...readingStyle('400'),
    fontSize: moderateScale(14),
    color: color.textSecondary,
    flexShrink: 1,
  },
  /** A drop or myo set hangs off the set above it, and reads as continuing it
   * rather than starting over at the margin. In the column layout the same
   * indent is paid inside the position cell; here the row may simply move. */
  chained: {
    marginLeft: spacing.md,
  },
  /**
   * Warm-ups, drops and skipped work. `textSecondary` clears AA (4.7:1) where
   * the old `textMuted` did not (2.45:1) — and the WORD in the lane, beside a
   * position column left deliberately blank, is what actually says "this one is
   * outside the count". Tone alone never carries meaning here.
   */
  aside: {
    color: color.textSecondary,
  },
  /** Recorded, not performed. */
  struck: {
    textDecorationLine: 'line-through',
  },
  stackRow: {
    paddingTop: spacing.sm,
  },
  stackLabel: {
    ...readingStyle('400'),
    fontSize: moderateScale(13),
    letterSpacing: 0.6,
    color: color.textSecondary,
  },
  stackValue: {
    marginTop: 1,
    ...readingStyle('500'),
    fontSize: moderateScale(18),
    // No fixed `lineHeight`: this line is allowed past the app clamp, and a
    // pinned line box would crop the very text that was enlarged to be read.
    color: color.textPrimary,
  },
});
