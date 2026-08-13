import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { PressableScale } from '@/components/motion';
import type { PlanDayRow } from '@/lib/db/plan';
import {
  color,
  hairline,
  MAX_FONT_SCALE,
  moderateScale,
  radius,
  spacing,
  type,
} from '@/lib/theme';

/**
 * The split-day switcher above the session (13 Aug 2026 — the chips
 * `lib/next/sections.ts` has been designed around since it was written).
 *
 * Next has only ever shown the ONE day the athlete is due for. That is the
 * right default and it stays the default — but a lifter on a push/pull/legs
 * rotation also wants to know what Pull is going to ask of them on Thursday,
 * and the app already knows: `planStripFor` will progress any day-template on
 * demand. These chips are the door to that.
 *
 * ## Two rules that keep it honest
 *
 * **Selecting a chip is a PREVIEW and nothing else.** It writes nothing, and it
 * does not change which day is due — `setPlanDayChoice` is the only thing that
 * does that and lives on the session-start card (§8.2), where answering the
 * question is the point. Looking is not answering.
 *
 * **The due day is always marked**, whichever chip is selected, by a small dot
 * before its label. Without it a preview would be indistinguishable from the
 * real thing after two taps, and a screen that quietly changes what it is
 * claiming is worse than one that never offered the preview.
 *
 * The selected chip is INK-filled with a paper label (16:1), not the blue wash
 * the Progress tab's chips use — that pairing measures 3.15:1 and does not
 * clear AA for a label this size. The dot is the only blue here, and a
 * non-text mark only owes 3:1 (blue on paper is 3.66:1).
 */
export function SplitChips({
  days,
  activeId,
  dueId,
  onSelect,
}: {
  days: PlanDayRow[];
  /** The chip currently shown — the due day unless the athlete picked another. */
  activeId: string | null;
  /** The day the rotation says is next. Marked wherever it sits. */
  dueId: string | null;
  onSelect: (id: string) => void;
}) {
  if (days.length < 2) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      accessibilityRole="tablist">
      {days.map((day) => {
        const selected = day.id === activeId;
        const due = day.id === dueId;
        return (
          <PressableScale
            key={day.id}
            onPress={() => onSelect(day.id)}
            activeScale={0.96}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={due ? `${day.label}, due next` : day.label}
            style={[styles.chip, selected ? styles.chipOn : styles.chipOff]}>
            {due ? (
              <View style={[styles.dot, selected ? styles.dotOn : styles.dotOff]} />
            ) : null}
            <Text
              style={[styles.label, selected ? styles.labelOn : styles.labelOff]}
              numberOfLines={1}
              maxFontSizeMultiplier={MAX_FONT_SCALE}>
              {day.label}
            </Text>
          </PressableScale>
        );
      })}
    </ScrollView>
  );
}

const DOT = moderateScale(5);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingRight: spacing.xs,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm - 2,
    minHeight: moderateScale(34),
    paddingHorizontal: spacing.md + 2,
    borderRadius: radius.pill,
  },
  chipOn: {
    backgroundColor: color.accent,
  },
  chipOff: {
    backgroundColor: color.surface,
    borderWidth: hairline,
    borderColor: color.border,
  },
  label: {
    ...type.footnote,
    fontWeight: '600',
  },
  labelOn: {
    color: color.bg,
  },
  labelOff: {
    color: color.textSecondary,
  },
  /** "This is the one you're due for." The only blue on the row. */
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: DOT,
  },
  dotOff: {
    backgroundColor: color.trained,
  },
  dotOn: {
    backgroundColor: color.bg,
  },
});
