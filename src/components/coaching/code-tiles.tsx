import { StyleSheet, Text, View } from 'react-native';

import {
  color,
  lineFor,
  MAX_FONT_SCALE,
  moderateScale,
  radius,
  readingStyle,
  shadow,
  spacing,
} from '@/lib/theme';

/** The invite code's length, and the number of cells that draw it. */
export const CODE_LENGTH = 6;

/**
 * THE CODE, AS SIX CELLS — the one drawing of an invite code, used on BOTH
 * sides of the link.
 *
 * Researched before it was drawn (Appllama, 10 September 2026). Cozy Couples
 * (`6463766369/oth_t8mhk`, "Invite partner") shows a redeemable code as six
 * separate character tiles with a quiet "Tap to copy" under them; Focustown
 * (`6758457625/onb_xbchg`, "Referral Code Entry") asks for one as six
 * underscores on a cream canvas, with the CTA dead until all six are filled.
 * Two apps, opposite ends of the same handshake, and the SAME grammar — which
 * is the borrowed idea here: a person who was shown a code in six boxes and is
 * then asked to type it into six boxes is doing one task, not two.
 *
 * A single `TextInput` would have been less code and it would have been worse:
 * six characters in one run of text is where "was that an O or a zero" happens,
 * and it happens after the keyboard is closed. Split cells make the count
 * visible before the first keystroke and make one wrong character visible at a
 * glance — which is also why `create_coach_invite` builds the code out of an
 * alphabet with no 0/O/1/I/L in it.
 *
 * Recore's own materials throughout: white `surface` cells floating on
 * `shadow.card` (design skill §Structure — everything interactive floats as a
 * white pill), the reading face for the characters because a code is a value
 * the app reports rather than a word it speaks, and ink for the glyph. No new
 * token, and no colour: a code is not a status.
 */
export function CodeTiles({
  code,
  /** Cells past the end of `code` draw a muted rule instead of a character —
   * the "waiting for input" state on the join screen. */
  placeholder = true,
}: {
  code: string;
  placeholder?: boolean;
}) {
  const chars = Array.from({ length: CODE_LENGTH }, (_, i) => code[i] ?? null);
  return (
    <View
      style={styles.row}
      accessible
      accessibilityRole="text"
      // Spelled out, because VoiceOver reading "C9MEQK" as a word is unusable
      // for the one job this element has.
      accessibilityLabel={
        code.length
          ? `Code: ${Array.from(code).join(', ')}`
          : `Empty code, ${CODE_LENGTH} characters`
      }>
      {chars.map((ch, i) => (
        <View key={i} style={styles.cell}>
          {ch ? (
            <Text style={styles.char} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              {ch}
            </Text>
          ) : placeholder ? (
            <View style={styles.blank} />
          ) : null}
        </View>
      ))}
    </View>
  );
}

const CELL = moderateScale(46);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  cell: {
    width: CELL,
    height: moderateScale(58),
    borderRadius: radius.md,
    borderCurve: 'continuous',
    backgroundColor: color.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.card,
  },
  char: {
    ...readingStyle('600'),
    fontSize: moderateScale(24),
    lineHeight: lineFor(moderateScale(24)),
    color: color.textPrimary,
  },
  /** The empty cell's mark. A rule, not a character: it says "something goes
   * here" without pretending a character already does. */
  blank: {
    width: moderateScale(16),
    height: 2,
    borderRadius: 1,
    backgroundColor: color.border,
  },
});
