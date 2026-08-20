import { StyleSheet, Text, View } from 'react-native';

import { selection } from '@/lib/haptics';
import {
  alpha,
  color,
  MAX_FONT_SCALE,
  moderateScale,
  radius,
  shadow,
  spacing,
  type,
} from '@/lib/theme';

import { PressableScale } from './motion';

/**
 * THE ONE PILL ROW — the switch that sits directly under a tab's large title,
 * on Progression and on Next (owner, 18 August 2026: *"Next should be the same
 * as Progression, only performing its own function"*).
 *
 * Both screens had grown one of these independently and they had drifted into
 * two different controls doing one job: Progression wrapped four ordering chips
 * with a blue-wash selected state; Next scrolled its split days horizontally
 * with an ink-FILLED selected state. Read side by side, that is two design
 * systems in one app — the reader has to re-learn what "selected" looks like
 * one tab across. So there is one component now, and the two screens differ
 * only in what they put in it.
 *
 * ## Three rules it carries over from the Progression original
 *
 * **It wraps, it never scrolls.** At the Dynamic Type ceiling four chips do not
 * fit a 320 pt screen, and an option a person cannot see is an option they do
 * not have. A second row is cheaper than a hidden control — and it is why the
 * split days no longer hide off the right edge either.
 *
 * **`minHeight`, never `height`.** The label has to grow at the type ceiling
 * rather than be cropped by its own chip (§5.3).
 *
 * **The selected chip is a WASH, a stronger border, and a heavier label — and
 * the label stays INK.** Re-measured against Volt `#0B5CD6` (20 Aug 2026): the
 * wash is brand at 10 % (`#E7EFFB` over the chip's white), the border is brand
 * at 70 %, which lands at **3.34:1 on white and 3.18:1 on the canvas** — past
 * the 3:1 a non-text mark owes, where the old `#007AFF` at 50 % sat at 2.3 and
 * asked the eye to find a state it could barely see. Ink on the wash is
 * **14.70:1**.
 *
 * The label stays ink by CHOICE now rather than by force. It was ink because
 * `#007AFF` on that wash measured 3.5:1 against a 13 pt caption's 4.5:1 —
 * Volt clears it at **5.16:1**, so tinting the label is available if the owner
 * ever wants it. It is not taken, because the wash, the border and the weight
 * already say "this one" three times, and a blue label would make the row of
 * chips read as four links.
 *
 * ## v6: the chip is a floating pill (skill §Structure)
 *
 * Every chip carries `shadow.card`. On the warm canvas a white pill is
 * **1.05:1 by tone** and its `#D5D5D5` hairline is 1.40:1 — neither is an edge,
 * so without the shadow the row reads as loose text rather than as four
 * controls. The shadow is what makes it a thing you can press.
 */
export interface ChipItem {
  key: string;
  label: string;
  /**
   * A small blue dot before the label. Next marks the split day the rotation
   * says is DUE, wherever it sits and whichever chip is selected — without it
   * a preview is indistinguishable from the real thing after two taps.
   * Progression has nothing to mark and never passes it.
   */
  marked?: boolean;
  /** Spoken in place of `label` when the chip knows something the label does
   * not ("Pull, due next"). */
  spoken?: string;
}

export function ChipRow({
  items,
  activeKey,
  onSelect,
  hint,
}: {
  items: ChipItem[];
  activeKey: string | null;
  onSelect: (key: string) => void;
  /** What choosing one does, for VoiceOver. */
  hint?: string;
}) {
  if (items.length === 0) return null;

  return (
    <View style={styles.row}>
      {items.map((item) => {
        const active = item.key === activeKey;
        return (
          <PressableScale
            key={item.key}
            haptic="none"
            activeScale={0.96}
            onPress={() => {
              selection();
              onSelect(item.key);
            }}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={item.spoken ?? item.label}
            accessibilityHint={hint}
            style={[styles.chip, active && styles.chipActive]}>
            {item.marked ? (
              <View style={[styles.dot, active && styles.dotActive]} />
            ) : null}
            <Text
              style={[styles.label, active && styles.labelActive]}
              maxFontSizeMultiplier={MAX_FONT_SCALE}>
              {item.label}
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

const DOT = moderateScale(5);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm - 2,
    paddingVertical: spacing.sm - 1,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surface,
    minHeight: moderateScale(34),
    justifyContent: 'center',
    ...shadow.card,
  },
  chipActive: {
    backgroundColor: alpha(color.brand, 0.1),
    borderColor: alpha(color.brand, 0.7),
  },
  label: {
    ...type.caption,
    fontWeight: '500',
    color: color.textPrimary,
  },
  labelActive: {
    fontWeight: '700',
  },
  /** "This is the one you're due for." The only brand fill that is not a wash. */
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: DOT,
    borderCurve: 'continuous',
    backgroundColor: color.brand,
  },
  dotActive: {
    backgroundColor: color.brand,
  },
});
