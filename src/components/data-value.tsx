import { Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

import { formatNumber, groupThousands } from '@/lib/format';
import { makeStyles, MAX_FONT_SCALE, moderateScale, type, useTheme } from '@/lib/theme';

/**
 * `DataValue` — every number in Recore renders through this (CLAUDE.md §20, 1.7).
 *
 * This is how the §6.5 typographic contract gets enforced mechanically rather
 * than by discipline: **words are humanist, numbers are machine.** A load never
 * appears in SF Pro because a load never reaches SF Pro — it comes through here,
 * in JetBrains Mono with tabular figures, or it does not render.
 *
 * `tone` is the §6.2 record contract, not decoration:
 *   · `recorded` — a settled, archival fact. Full ink.
 *   · `read`     — the machine's interpretation. Muted; it is a claim, not a fact.
 *   · `planned`  — a number you have not lifted yet. **The only ember in the app.**
 *   · `faint`    — warm-ups and excluded values, present but out of the way.
 *
 * There is deliberately no `color` prop (§20). Ember is reachable exactly one
 * way — `tone="planned"` — so §6.2's invariant that ember means one thing cannot
 * be broken by a call site in a hurry.
 *
 * **It never truncates.** §6.5 is explicit: a load or a rep count must never be
 * clipped or shrunk below its token size — at large Dynamic Type the row reflows
 * instead. So nothing here sets `numberOfLines`, and the unit wraps with the
 * number rather than being cut off it.
 */

export type DataTone = 'recorded' | 'read' | 'planned' | 'faint';
export type DataSize = 'xl' | 'l' | 'm' | 's';

/**
 * §6.5's four data rungs, straight off the ladder — face, size, line box and
 * tabular figures all arrive together. Nothing is restated here: a size that
 * lived in this file would be a second scale, and two scales is no scale.
 */
const SIZE: Record<DataSize, TextStyle> = {
  xl: type.dataXL,
  l: type.dataL,
  m: type.dataM,
  s: type.dataS,
};

export function DataValue({
  value,
  unit,
  tone = 'recorded',
  size = 'm',
  grouped,
  style,
  accessibilityLabel,
}: {
  /** A number, or a pre-formatted string for values with their own shape (a clock). */
  value: number | string;
  /** `kg`, `reps`, `km`. Rendered a step down and muted — the number is the point. */
  unit?: string;
  tone?: DataTone;
  size?: DataSize;
  /** Thousands grouping. For volumes, never for loads — see `groupThousands`. */
  grouped?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}) {
  const styles = useStyles();
  const t = useTheme();

  const text =
    typeof value === 'string' ? value : grouped ? groupThousands(value) : formatNumber(value);

  const toneColor: Record<DataTone, string> = {
    recorded: t.ink,
    read: t.inkMuted,
    planned: t.ember,
    faint: t.inkFaint,
  };

  const metrics = SIZE[size];

  return (
    <View
      style={[styles.row, style]}
      accessible
      accessibilityRole="text"
      accessibilityLabel={accessibilityLabel ?? (unit ? `${text} ${unit}` : text)}>
      <Text style={[metrics, { color: toneColor[tone] }]} maxFontSizeMultiplier={MAX_FONT_SCALE}>
        {text}
      </Text>
      {unit ? (
        <Text
          style={[
            metrics,
            {
              color: tone === 'planned' ? t.ember : t.inkMuted,
              // The unit is a label on the number, not part of it: a step down
              // in size, never a step down in face.
              fontSize: (metrics.fontSize ?? 0) * 0.62,
            },
          ]}
          maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {unit}
        </Text>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles(() => ({
  row: {
    flexDirection: 'row',
    // `baseline` so the unit sits on the number's feet rather than its middle,
    // and `wrap` so a long value reflows instead of being clipped (§6.5).
    alignItems: 'baseline',
    flexWrap: 'wrap',
    columnGap: moderateScale(3),
  },
}));
