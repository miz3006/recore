import { StyleSheet, Text, View } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle } from 'react-native-reanimated';

import { PressableScale } from '@/components/motion';
import { DAY_LABELS, hasDay } from '@/lib/onboarding';
import {
  color,
  hairline,
  MAX_FONT_SCALE,
  moderateScale,
  radius,
  shadow,
  spacing,
  type,
} from '@/lib/theme';

import { CARD_FILL, INK_TRACK } from './tokens';
import { useSelectFill } from './use-select-fill';

/**
 * UNMOUNTED, SAME DAY IT WAS BUILT (owner, 23 Aug 2026). The days screen keeps
 * the seven discs it had (`DayPicker`); this card was the "better approach" the
 * owner asked for and then ruled against on sight. It stays on disk the way
 * every other rolled-back surface here does — mounting it is one import in
 * `app/onboarding/[step].tsx`, and the copy it needs (`weekReadback`) is live
 * and tested either way.
 *
 * THE WEEK, AS ONE OBJECT.
 *
 * What it replaces: seven separate discs floating on the canvas
 * (`DayPicker.tsx`, still on disk, unmounted), with the count of them printed
 * as loose text underneath and a second question in two full option rows below
 * that. Three unrelated objects for one answer, and on a small phone the whole
 * thing scrolled.
 *
 * Now the week is a single white card — the seven cells, a rule, and the week
 * read straight back inside the same frame. The readback is IN the card
 * because it is the card's own value: what the seven taps add up to. Reading it
 * off a loose line under a row of discs is the arrangement that made the count
 * feel like a score kept somewhere else.
 *
 * ## Cells, not discs
 *
 * A rounded 14 pt cell filling the column beats a 44 pt circle for the two
 * things that matter here: the target is WIDER (the row is tapped seven times
 * in a few seconds and the misses were real), and seven cells edge to edge read
 * as a week the way a calendar row does, where seven separated discs read as
 * seven independent buttons.
 *
 * The face carries ONE letter, which is the 18 Aug ruling unchanged: M T W T F
 * S S is the row every calendar draws, the pairs are told apart by position,
 * and VoiceOver has never read the face — the accessibility label is the whole
 * day name.
 *
 * An EXPECTATION, never a target (§11): nothing here or downstream counts a
 * miss, and the card says so in its own words when a week is empty.
 */
export function WeekPicker({
  mask,
  onToggle,
  /** The readback under the rule — the screen's own sentence about this week,
   * resolved by the caller because the empty case is copy, not arithmetic. */
  title,
  detail,
}: {
  mask: number;
  /** Called with the Monday-first day index (0–6) to flip. */
  onToggle: (day: number) => void;
  title: string;
  detail: string;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        {DAY_LABELS.map((label, day) => (
          <DayCell
            key={label}
            label={label}
            selected={hasDay(mask, day)}
            onPress={() => onToggle(day)}
          />
        ))}
      </View>

      <View style={styles.rule} />

      <View accessible accessibilityRole="text" accessibilityLabel={`${title}. ${detail}`}>
        <Text style={styles.title} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {title}
        </Text>
        <Text style={styles.detail} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {detail}
        </Text>
      </View>
    </View>
  );
}

function DayCell({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const p = useSelectFill(selected);

  const cellStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(p.get(), [0, 1], [IDLE_FILL, SELECTED_FILL]),
  }));
  const labelStyle = useAnimatedStyle(() => ({
    color: interpolateColor(p.get(), [0, 1], [IDLE_INK, SELECTED_INK]),
  }));

  return (
    <PressableScale
      onPress={onPress}
      activeScale={0.94}
      // Seven of these get tapped in a row while somebody sketches their week.
      // A selection tick is the picker-detent feeling that keeps that from
      // sounding like seven separate decisions.
      haptic="selection"
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked: selected }}
      style={[styles.cell, cellStyle]}>
      <Animated.Text style={[styles.cellLabel, labelStyle]} maxFontSizeMultiplier={MAX_FONT_SCALE}>
        {label.slice(0, 1)}
      </Animated.Text>
    </PressableScale>
  );
}

/** Precomputed for the worklets above — a `useAnimatedStyle` may only do
 * arithmetic on what it is handed, and `alpha()` inside one crashes. */
const IDLE_FILL = INK_TRACK;
const SELECTED_FILL = color.brand;
const IDLE_INK = color.textPrimary;
const SELECTED_INK = color.onInk;

const CELL_HEIGHT = moderateScale(52);

const styles = StyleSheet.create({
  card: {
    backgroundColor: CARD_FILL,
    borderRadius: radius.xl,
    borderCurve: 'continuous',
    padding: spacing.md,
    // A white surface on the canvas needs an edge to exist: it is 1.05:1 by
    // tone (skill §Spacing, radii, elevation).
    ...shadow.card,
  },
  row: {
    flexDirection: 'row',
    gap: moderateScale(5),
  },
  cell: {
    flex: 1,
    height: CELL_HEIGHT,
    borderRadius: radius.md,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellLabel: {
    ...type.subhead,
    fontWeight: '700',
  },
  rule: {
    height: hairline,
    backgroundColor: color.border,
    marginVertical: spacing.md,
  },
  /** The week read back — a headline-weight fact, not a caption. */
  title: {
    ...type.headline,
    fontWeight: '600',
    color: color.textPrimary,
  },
  detail: {
    ...type.subhead,
    color: color.textSecondary,
    marginTop: 2,
  },
});
