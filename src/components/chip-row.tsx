import { StyleSheet, Text, View } from 'react-native';

import { selection } from '@/lib/haptics';
import {
  alpha,
  color,
  MAX_FONT_SCALE,
  moderateScale,
  radius,
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
 * the label stays INK.** The wash + border carry the blue; those are non-text
 * marks and only owe 3:1, which `trained` blue on white clears at 4.02:1. The
 * LABEL does not go blue, because `#007AFF` on the 10% blue wash measures
 * **3.5:1** and a 13 pt caption owes 4.5:1 (§14.3's AA contract). Ink on that
 * same wash is 15.6:1. This is the one place the shared control corrects what
 * both originals were doing — Progression tinted the label, Next filled the
 * whole chip with ink to dodge the same problem.
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
  },
  chipActive: {
    backgroundColor: alpha(color.trained, 0.1),
    borderColor: alpha(color.trained, 0.5),
  },
  label: {
    ...type.caption,
    fontWeight: '500',
    color: color.textPrimary,
  },
  labelActive: {
    fontWeight: '700',
  },
  /** "This is the one you're due for." The only blue that is not a wash. */
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: DOT,
    borderCurve: 'continuous',
    backgroundColor: color.trained,
  },
  dotActive: {
    backgroundColor: color.trained,
  },
});
