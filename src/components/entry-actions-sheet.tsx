import { useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { tap } from '@/lib/haptics';
import { type GutterSignal } from '@/lib/parse/types';
import { color, hairline, lineFor, MAX_FONT_SCALE, moderateScale, spacing, type } from '@/lib/theme';

import { BottomSheet } from './bottom-sheet';
import { EntrySheetHeader } from './entry-sheet-header';
import { Icon, type IconName } from './icon';
import { PressableScale } from './motion';

/**
 * The card's own action sheet (owner, 6 August 2026) — opened from the ⋯
 * button on a settled ledger card, and since 11 August the card's ONLY glyph.
 * It surfaces what used to hide behind gestures: edit was a bare tap on the
 * body, history a LONG-PRESS nobody could see, delete lived two levels deep
 * inside the inline editor, and the note had a permanent bubble on every card
 * asking the same question five times a session. One visible
 * button now names all of them (the Mobbin-verified logger pattern — Hevy,
 * Gymshark and Bevel all put a per-exercise ⋯ on the card that opens exactly
 * this list; Ladder spells the actions out as chips instead, which costs every
 * card permanent chrome for actions used rarely).
 *
 * SEQUENCING IS THE WHOLE TRICK: History and Fix reading open OTHER sheets,
 * and UIKit silently refuses a second modal while one is on screen
 * (bottom-sheet.tsx's warning). So a row never acts directly — it remembers
 * the choice, closes this sheet, and the action fires from `onClosed`, the
 * one moment another modal may present. Edit and Delete ride the same path
 * for one rule instead of two.
 *
 * The rows only ever route: nothing here writes the note, and delete is the
 * exact `deleteNoteLine` the inline editor's Delete already performs — in
 * `color.error`, last, below its own rule, per the destructive-row convention.
 */
export type EntryAction = 'fix' | 'note' | 'history' | 'delete';

/**
 * "A", "A and B", "A, B and C" — the ONE voice for naming the entries that
 * share a written line. The delete row's caption and the parent's confirm both
 * speak it, so the warning before the tap and the warning after it are the
 * same sentence about the same lifts.
 */
export function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/** A stable empty default — a fresh `[]` in the signature would be a new prop
 * identity on every parent render. */
const NO_SIBLINGS: string[] = [];

interface ActionRow {
  action: EntryAction;
  icon: IconName;
  label: string;
}

/**
 * FOUR ACTIONS, and no more (owner, 12 August 2026).
 *
 * The list had grown to six by accretion, and two of them were doors to places
 * you could already get to:
 *
 * · **"Edit line"** is gone. Repairing an entry is ONE idea — "this is not what
 *   I did" — and it now has one door: Fix this entry, which offers both halves
 *   inside itself (the numbers, or "Edit my words instead"). A menu that asks
 *   the athlete to know in advance whether their problem is the words or the
 *   reading is asking the wrong question.
 * · **"Show my words"** is gone. It was the visible half of a gesture, and the
 *   card carries that itself now: long-press to flip, tap the quote to flip
 *   back. A menu row for a thing you do BY LOOKING at the card is a detour.
 *
 * What survives is the four things you cannot do from the card: repair it,
 * write about it, look up its history, remove it.
 */
function rowsFor(hasNote: boolean): ActionRow[] {
  return [
    { action: 'fix', icon: 'wrench', label: 'Fix this entry' },
    {
      action: 'note',
      icon: hasNote ? 'note-on' : 'note',
      label: hasNote ? 'Edit note' : 'Add note',
    },
    { action: 'history', icon: 'chart', label: 'History' },
  ];
}

export function EntryActionsSheet({
  visible,
  target,
  note = null,
  signal = null,
  alsoOnLine = NO_SIBLINGS,
  onClose,
  onSelect,
}: {
  visible: boolean;
  /** The card the ⋯ was tapped on; kept by the parent through the exit. */
  target: { exercise: string; setText: string } | null;
  /** That entry already carries the athlete's own remark — the row says "Edit"
   * rather than "Add", and the header quotes it. */
  note?: string | null;
  /** This entry's comparison against the last session, for the header's PR
   * label and its "up 2.5 kg vs last" line. */
  signal?: GutterSignal | null;
  /**
   * The OTHER entries the parser read from the SAME physical line, if any.
   *
   * A run-on — "bench 3x8, rows 3x10" — is one written line and two cards, and
   * delete can only ever remove the LINE: the words are the record (§3) and
   * nothing maps a single card back to its slice of the sentence. The row used
   * to say "Delete entry" and quietly take the neighbour with it. Now it names
   * the neighbour BEFORE the finger commits, and the parent's confirm names it
   * again after.
   */
  alsoOnLine?: string[];
  /** Request close with no action (backdrop, swipe). */
  onClose: () => void;
  /** The chosen action, delivered ONLY after the native modal is fully gone —
   * the parent may open another sheet from inside this callback. */
  onSelect: (action: EntryAction) => void;
}) {
  const pending = useRef<EntryAction | null>(null);
  const rows = rowsFor(note !== null);
  const shared = alsoOnLine.length > 0;

  const choose = (action: EntryAction) => {
    tap();
    pending.current = action;
    onClose();
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      onClosed={() => {
        const action = pending.current;
        pending.current = null;
        if (action) onSelect(action);
      }}
      sheetStyle={[styles.sheet, { paddingBottom: spacing.lg }]}>
      <EntrySheetHeader
        eyebrow="This entry"
        exercise={target?.exercise ?? ''}
        setText={target?.setText}
        signal={signal}
        note={note}
      />

      <View style={styles.rows}>
        {rows.map((row, i) => (
          <View key={row.action}>
            {i > 0 ? <View style={styles.rowRule} /> : null}
            <PressableScale
              onPress={() => choose(row.action)}
              haptic="none"
              activeScale={0.98}
              accessibilityRole="button"
              accessibilityLabel={row.label}
              style={styles.row}>
              <View style={styles.iconCol}>
                <Icon name={row.icon} size={moderateScale(18)} tint={color.textSecondary} />
              </View>
              <View style={styles.rowBody}>
                <Text style={styles.rowLabel} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                  {row.label}
                </Text>
              </View>
            </PressableScale>
          </View>
        ))}

        {/* THE PROMISE, ONCE, INSTEAD OF A CAPTION ON ONE ROW.
            "Fix this entry" carried a line explaining that it does not rewrite
            what you wrote — a real fact, and the only reason anyone hesitates
            over that row. But one captioned row among three bare ones reads as
            one important action among two lesser ones, and there is nothing
            true to say under "History" that would even the rhythm out; copy
            invented to fill a shape is decoration. So the rows are four bare
            labels and the promise is stated once, for both actions it covers,
            in the air that separates them from Delete. */}
        <Text style={styles.promise} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          Fixing and noting never change your written words.
        </Text>

        {/* Destructive last, under a rule that runs the FULL width. The inset
            hairline between the rows above means "another one of these", which
            is the one thing Delete is not — it needs air and a line the eye
            stops at, not the same separator as its safe neighbours. */}
        <View style={styles.dangerRule} />
        <PressableScale
          onPress={() => choose('delete')}
          haptic="none"
          activeScale={0.98}
          accessibilityRole="button"
          accessibilityLabel={
            shared
              ? `Delete ${target?.exercise ?? 'this entry'} — also removes ${joinNames(alsoOnLine)}, written on the same line`
              : `Delete ${target?.exercise ?? 'this entry'} from the note`
          }
          style={styles.row}>
          <View style={styles.iconCol}>
            <Icon name="trash" size={moderateScale(18)} tint={color.error} />
          </View>
          <View style={styles.rowBody}>
            <Text style={[styles.rowLabel, styles.rowLabelDanger]} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              Delete entry
            </Text>
            {shared ? (
              <Text style={styles.rowCaption} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                {`written on one line with ${joinNames(alsoOnLine)} — all of it goes`}
              </Text>
            ) : null}
          </View>
        </PressableScale>
      </View>
    </BottomSheet>
  );
}

const ICON_COL_W = moderateScale(28);

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: color.surface,
    paddingHorizontal: spacing.xl,
  },
  rows: {
    marginTop: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: moderateScale(52),
    paddingVertical: spacing.sm,
  },
  // Inset past the icon column, the sibling-separator rule every list in the
  // app follows — the glyphs stay one clean vertical run.
  rowRule: {
    height: hairline,
    marginLeft: ICON_COL_W + spacing.sm,
    backgroundColor: color.border,
  },
  promise: {
    marginTop: spacing.md,
    ...type.footnote,
    lineHeight: lineFor(16),
    color: color.textSecondary,
  },
  // Full width and preceded by air, unlike `rowRule`: an inset sibling
  // separator says "another one of these", and Delete is not.
  dangerRule: {
    marginTop: spacing.md,
    marginBottom: spacing.xs,
    height: hairline,
    backgroundColor: color.border,
  },
  iconCol: {
    width: ICON_COL_W,
    alignItems: 'center',
  },
  rowBody: {
    flex: 1,
    gap: 2,
  },
  // BODY IS 17 (owner, 18 Aug 2026) — and the ruling's own examples are "list
  // rows, share sheets", which is exactly this. At `subhead`'s 15 the menu sat
  // a notch under every native sheet beside it. `headline` IS 17/600.
  rowLabel: {
    ...type.headline,
    color: color.textPrimary,
  },
  rowLabelDanger: {
    color: color.error,
  },
  // Muted is the 3.3:1 ink, and the measured scale reserves it for what may be
  // skipped. The one caption left is the delete row's warning about the entries
  // that leave with it — the most READ line on the sheet, so secondary.
  rowCaption: {
    ...type.caption,
    color: color.textSecondary,
  },
});
