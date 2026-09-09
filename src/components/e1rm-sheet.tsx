import { StyleSheet, Text } from 'react-native';

import { color, MAX_FONT_SCALE, spacing, type } from '@/lib/theme';

import { BottomSheet } from './bottom-sheet';

/**
 * WHAT THAT NUMBER IS (4 September 2026).
 *
 * The Progression list prints an estimated 1RM beside every lift, and until
 * today it printed it bare: somebody who logged 100 kg read "140 kg" against
 * their own bench and reasonably concluded the app had the record wrong. The
 * row now says `est. 1RM` over the figure, and the figure opens this.
 *
 * It is the app's one sheet chrome with nothing in it but a title and a
 * paragraph — the `StreakSheet` shape with the hero and the grid taken out,
 * because there is no second fact here to show. **No number appears in it.**
 * Every figure this sheet could quote is already on the row behind it, and a
 * definition that restates a value is a second place for the two to disagree.
 *
 * The copy is the owner's, verbatim, and it ends by saying what the number is
 * NOT — an estimate is not a test, and the app does not get to imply the
 * athlete has pulled a single they have never pulled (CLAUDE.md §2.2).
 */

/** The word that labels the reading wherever it is printed. Lower case: it is a
 * caption on a number, not a heading, and `est.` is the abbreviation the lift
 * sheet's chip has used since July. */
export const E1RM_LABEL = 'est. 1RM';

/** What the rotor calls the action that opens this. */
export const E1RM_ACTION_LABEL = 'What is est. 1RM?';

export function E1rmSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      sheetStyle={[styles.sheet, { paddingBottom: spacing.xl }]}>
      <Text style={styles.title} maxFontSizeMultiplier={MAX_FONT_SCALE}>
        Estimated 1RM
      </Text>
      <Text style={styles.body} maxFontSizeMultiplier={MAX_FONT_SCALE}>
        The heaviest single rep we estimate you could lift, computed from your logged sets (weight ×
        reps). It lets sessions with different reps be compared on one scale. It is an estimate, not
        a test.
      </Text>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: color.surface,
    paddingHorizontal: spacing.xl,
  },
  title: {
    marginTop: spacing.md,
    ...type.title2,
    color: color.textPrimary,
  },
  body: {
    marginTop: spacing.md,
    ...type.body,
    // A definition is read, not skipped — `textSecondary`, never muted.
    color: color.textSecondary,
  },
});
