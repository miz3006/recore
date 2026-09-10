import { StyleSheet, Text, View } from 'react-native';

import { PressScale } from '@/lib/motion/index';
import { MAX_FONT_SCALE, moderateScale, spacing, type } from '@/lib/theme';

import { SelectMark } from './SelectMark';
import { v2color, v2radius } from './tokens';

/**
 * THE OPT-OUT ROW — "I don't log anywhere", "Other", "No thanks".
 *
 * One shared pattern, not three one-offs. Which options use it is declared as
 * `optOut: true` in `flow.ts` and nowhere else.
 *
 * ## THE RULE IS "GIVES THE APP NOTHING", NOT "DECLINES THE QUESTION"
 *
 * (Owner, 28 Aug 2026, correcting the day before.) Those are different tests
 * and only the first one is right.
 *
 *   · "Other", "No thanks", "I don't log anywhere" — the app learns that a
 *     thing is absent. Nothing is enabled, nothing is scheduled, a default
 *     stands. **Ghost row.**
 *   · "I don't follow a split" LOOKS like the same shape and is not: it is the
 *     only route into flat clustering mode, so it changes app behaviour more
 *     than any other answer on its screen. **Peer row** — see `drivesBranch` in
 *     `flow.ts`, and the test that forbids the two flags from meeting.
 *
 * The reason the distinction is worth a rule: a branch that is visually demoted
 * gets under-selected, and a branch that is under-selected ships under-tested.
 * Quieting an answer is a claim that the app does less with it, and that claim
 * has to be true.
 *
 * ## Why it comes out of the list at all
 *
 * An opt-out is not one of the things the question enumerates. "Where do you
 * log your training now?" enumerates places a record lives; "nowhere" is not
 * one of them. Keeping it inside forced the list either to give it a glyph it
 * cannot honestly have or to run four glyphs and one bare row — and the second
 * is the worst-looking outcome in the flow. Lifting it out lets the list above
 * carry one complete semantic family.
 *
 * ## What "ghost" means, and what it does not
 *
 * Lower contrast, no fill, no glyph, a rule above it for separation. **It is a
 * full-height, full-width, 44 pt tap target and a first-class answer**: it
 * selects like any other option, it satisfies the CTA, and screen 12's
 * "Ne sledim splitu" — which the spec calls mandatory because it is the only
 * route into flat clustering mode — is still exactly one tap from the top of
 * that screen. Quieter is not smaller and it is not harder to reach.
 *
 * Selected, it fills like any other row, because at that point it IS the
 * answer and understating it would be lying about the state.
 */
export function GhostRow({
  label,
  sub,
  selected,
  onPress,
  multi = false,
}: {
  label: string;
  sub?: string;
  selected: boolean;
  onPress: () => void;
  multi?: boolean;
}) {
  return (
    <View style={styles.wrap}>
      <View style={styles.rule} />
      <PressScale
        onPress={onPress}
        haptic="selection"
        accessibilityRole={multi ? 'checkbox' : 'radio'}
        accessibilityLabel={sub ? `${label}. ${sub}` : label}
        accessibilityState={multi ? { checked: selected } : { selected }}
        style={styles.press}>
        <View style={[styles.row, selected && styles.rowSelected]}>
          <View style={styles.text}>
            <Text
              style={[styles.label, selected && styles.labelSelected]}
              maxFontSizeMultiplier={MAX_FONT_SCALE}>
              {label}
            </Text>
            {sub ? (
              <Text
                style={[styles.sub, selected && styles.subSelected]}
                maxFontSizeMultiplier={MAX_FONT_SCALE}>
                {sub}
              </Text>
            ) : null}
          </View>
          {/* THE SELECTION CONTROL IS NOT PART OF THE QUIETING (9 Sep 2026).
              A ghost row is quieter in contrast and carries no leading mark,
              because it is outside the question's family — but it is a
              first-class answer and it has to look like something that can be
              chosen. Dropping the control here would have been the third time
              this row got quieted for a reason that was really about the
              family, and "quieter is not harder to reach" is the rule the row
              already states about its own tap target. */}
          <SelectMark selected={selected} multi={multi} />
        </View>
      </PressScale>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: spacing.xs },
  rule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: v2color.border,
    marginBottom: spacing.md,
  },
  press: {},
  row: {
    // 44 pt is the floor for a target; the ghost row clears it with room and
    // grows with Dynamic Type like every other row in the flow.
    minHeight: moderateScale(52),
    borderRadius: v2radius.card,
    borderCurve: 'continuous',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  text: { flex: 1, gap: 2 },
  rowSelected: { backgroundColor: v2color.blue },
  label: { ...type.body, fontWeight: '500', color: v2color.inkSecondary },
  labelSelected: { color: v2color.onBlue, fontWeight: '600' },
  sub: { ...type.subhead, color: v2color.inkMuted },
  subSelected: { color: 'rgba(255,255,255,0.82)' },
});
