import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Rect } from 'react-native-svg';

import { selection } from '@/lib/haptics';
import { DUR, EASE, stagger } from '@/lib/motion';
import {
  alpha,
  color,
  hairline,
  ink,
  MAX_FONT_SCALE,
  moderateScale,
  spacing,
  type,
} from '@/lib/theme';

/**
 * THE PROGRESS TAB'S HERO — eight weeks of the record, as eight columns
 * (9 September 2026).
 *
 * `charts.tsx`'s `WeekBars` is the same picture at ledger size: a strip inside
 * a card, its own value pinned over the newest bar, no way to ask about any of
 * the others. This one is the thing the screen is FOR, so it is bigger, it has
 * a floor to sit on, and **every column can be asked what it holds**.
 *
 * ## Press a week and the headline becomes that week
 *
 * The interaction is Apple Health's, minus its scrub. A finger down on a column
 * selects it and the screen's own reading above the chart changes to that
 * week's figure and date range; lifting the finger puts the window's total
 * back. It is transient on purpose — a selection that persists needs a way to
 * dismiss it, and every affordance for that is another control on a screen
 * whose whole point is one big honest number.
 *
 * It is columns rather than a scrub gesture for two reasons, and the second is
 * the one that decided it. A `Pan` inside a scroll view either steals the
 * vertical fling (`minDistance(0)`) or cannot select until the finger has
 * already travelled — and a row of real pressables is a row of real
 * accessibility elements, each announcing its own week, where a scrub target is
 * one opaque rectangle VoiceOver can say nothing useful about.
 *
 * ## Ink, not blue
 *
 * The skill is explicit (`charts.tsx`): week bars are ledger furniture and stay
 * monochrome — history at low-alpha ink, the current week at full strength —
 * while the brand blue belongs to a LIFT's own progression line, which is what
 * the sparklines in the rows below this chart are. So the screen carries both
 * and they are not the same statement. The blue on this screen stays on the
 * controls, which is the one accent doing the one job it is locked to.
 *
 * ## A week with no training is a real zero
 *
 * It keeps its slot and draws nothing. A minimum-height stub would turn a week
 * off into a week of light work, which is a lie told by a rounding rule.
 */

const AnimatedRect = Animated.createAnimatedComponent(Rect);

/** How long a column takes to reach its value, and how far apart they start.
 * The whole chart is drawn inside half a second — long enough to read as the
 * record being written, short enough that a returning tab never waits on it. */
const GROW_MS = DUR.slow;
const GROW_STAGGER = 40;

/** How wide a week is allowed to get, and the least air there may ever be
 * between two of them. */
const MAX_BAR = moderateScale(28);
const MIN_GAP = spacing.sm;

export interface PeriodBar {
  value: number;
  /** What VoiceOver says about this column — the week, its figure and its
   * training days, composed by the caller because only it knows the unit. */
  spoken: string;
}

export function PeriodChart({
  bars,
  height = moderateScale(150),
  selected,
  onSelect,
  startLabel,
  endLabel,
}: {
  bars: PeriodBar[];
  height?: number;
  /** The column the reading above the chart is currently showing, or null for
   * the whole window. */
  selected: number | null;
  onSelect: (index: number | null) => void;
  startLabel: string;
  endLabel: string;
}) {
  const [width, setWidth] = useState(0);

  const n = bars.length;
  const labelRoom = moderateScale(20);
  const plotH = height - labelRoom;
  /**
   * THE COLUMN IS CAPPED AND THE AIR TAKES THE REMAINDER.
   *
   * Dividing the width by eight and calling the leftovers a gap gave 37 pt
   * columns with 8 pt between them — eight slabs meeting each other, which
   * reads as a block diagram rather than as a measurement. Capping the column
   * and spending everything else on air inverts it: the same data, drawn as
   * eight marks on a page. It also survives a phone half this wide, where the
   * cap simply never binds and the columns close up again.
   */
  const barW = width > 0 ? Math.min(MAX_BAR, (width - MIN_GAP * (n - 1)) / n) : 0;
  const gap = n > 1 ? (width - barW * n) / (n - 1) : 0;
  const max = Math.max(1, ...bars.map((b) => b.value));
  const radius = Math.min(moderateScale(5), barW / 3);

  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <View style={{ height: plotH }}>
        {width > 0 ? (
          <Svg width={width} height={plotH}>
            {bars.map((b, i) => {
              const x = i * (barW + gap);
              // The selected column gets a wash the full height of the plot, so
              // a short week is as easy to see selected as a tall one.
              const washed = selected === i;
              return washed ? (
                <Rect
                  key={`wash-${i}`}
                  x={x}
                  y={0}
                  width={barW}
                  height={plotH}
                  rx={radius}
                  fill={SELECTED_WASH}
                />
              ) : null;
            })}
            {bars.map((b, i) => (
              <Column
                key={i}
                index={i}
                x={i * (barW + gap)}
                width={barW}
                plotHeight={plotH}
                fraction={b.value / max}
                radius={radius}
                // Nothing selected: the newest week is the one at full strength,
                // because that is the week the reading above is showing.
                strong={selected == null ? i === n - 1 : selected === i}
              />
            ))}
          </Svg>
        ) : null}

        {/* The touch layer. Transparent, exactly over the columns, and one
            element per week so VoiceOver has eight things to read rather than
            one rectangle. */}
        <View style={[StyleSheet.absoluteFill, styles.touchRow, { gap }]} pointerEvents="box-none">
          {bars.map((b, i) => (
            <Pressable
              key={i}
              style={styles.touch}
              onPressIn={() => {
                selection();
                onSelect(i);
              }}
              onPressOut={() => onSelect(null)}
              // The columns are 37 pt wide on a 402 pt screen, so each one
              // reaches half way into the gaps beside it and the row of targets
              // meets edge to edge at 45 pt — past the 44 pt floor, with no
              // overlap and no dead strip between two weeks.
              hitSlop={{ left: gap / 2, right: gap / 2 }}
              accessibilityRole="button"
              accessibilityLabel={b.spoken}
            />
          ))}
        </View>
      </View>

      {/* The floor. Without it the columns hang in the page — a bar chart is a
          set of heights measured from somewhere, and this is the somewhere. */}
      <View style={styles.floor} />

      <View style={styles.labels}>
        <Text style={styles.label} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {startLabel}
        </Text>
        <Text style={styles.label} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {endLabel}
        </Text>
      </View>
    </View>
  );
}

/**
 * One column, growing from the floor.
 *
 * `y` and `height` are SVG geometry, not React Native layout — animating them
 * is on the UI thread and costs no layout pass, which is why the chart is drawn
 * rather than built out of views (§14 bans animating layout properties, and a
 * row of eight `View`s with animated heights is exactly that).
 */
function Column({
  index,
  x,
  width,
  plotHeight,
  fraction,
  radius,
  strong,
}: {
  index: number;
  x: number;
  width: number;
  plotHeight: number;
  fraction: number;
  radius: number;
  strong: boolean;
}) {
  const reduced = useReducedMotion();
  const grow = useSharedValue(reduced ? 1 : 0);
  const full = Math.max(0, fraction) * plotHeight;

  useEffect(() => {
    if (reduced) {
      grow.value = 1;
      return;
    }
    grow.value = 0;
    grow.value = withDelay(
      stagger(index, GROW_STAGGER),
      withTiming(1, { duration: GROW_MS, easing: EASE.emphasized }),
    );
  }, [grow, index, reduced, full]);

  const props = useAnimatedProps(() => ({
    height: full * grow.value,
    y: plotHeight - full * grow.value,
  }));

  // An untrained week draws nothing at all — see the header note.
  if (fraction <= 0) return null;

  return (
    <AnimatedRect
      x={x}
      width={width}
      rx={radius}
      fill={strong ? STRONG : QUIET}
      animatedProps={props}
    />
  );
}

/** Precomputed, because `alpha()` may never be called inside a worklet — and
 * because three constants beat three function calls per column per render. */
const STRONG = color.accent;
const QUIET = alpha(color.accent, ink.rule);
const SELECTED_WASH = alpha(color.accent, ink.divider);

const styles = StyleSheet.create({
  touchRow: {
    flexDirection: 'row',
  },
  touch: {
    flex: 1,
  },
  /**
   * The floor the columns are measured from.
   *
   * `textMuted`, not `border` — the same correction `charts.tsx` made to the
   * all-time-best hairline, for the same reason: #CECFC9 measures **1.40:1** on
   * the canvas, which is not a line anybody can see, and a baseline carries
   * information. 3.45:1 clears the 3:1 a non-text mark owes.
   */
  floor: {
    // A HEIGHT AND A FILL, not a border. A zero-height `View` carrying only
    // `borderTopWidth` painted nothing at all — photographed on the iOS 26.5
    // simulator, 9 September 2026: the canvas ran straight from the last row of
    // bar pixels into the axis labels with no line between them.
    height: hairline,
    backgroundColor: color.textMuted,
  },
  labels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: spacing.xs,
  },
  label: {
    ...type.footnote,
    color: color.textMuted,
    fontVariant: ['tabular-nums'],
  },
});
