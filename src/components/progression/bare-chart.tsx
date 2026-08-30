import { useMemo, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { GrowingBar, MonotoneSeries, type Point } from '@/lib/motion/index';
import type { ChartKind, MetricPoint } from '@/lib/progression-metrics';
import { alpha, color } from '@/lib/theme';

/**
 * The stripped chart (28 August 2026, from Lyfta's Exercise Progress screens —
 * `research/lyfta/screens.md`).
 *
 * **What is deliberately absent: axes, tick labels, a legend, a y-scale, a
 * tooltip, a grid in both directions.** The card above it already says the
 * metric's name, its latest value and its unit; a chart that repeats those in
 * smaller type is furniture. What is left is the SHAPE of the record, which is
 * the only thing this chart is for.
 *
 * ## The gridlines are texture, not a scale
 *
 * Six evenly spaced hairlines spanning the card's inner width. They do **not**
 * correspond to values, and the series is not fitted to them: it is laid out in
 * a slightly taller band, so a peak sits *above* the top line and a trough
 * *below* the bottom one. That float is what the reference does and it is the
 * honest arrangement — lines that a series appeared to touch would be read as
 * a scale, and there is no scale here.
 *
 * They are therefore drawn with `alpha(textPrimary, …)` rather than with
 * `color.border`. `border` is the app's "hairline that has to be FOUND"; this is
 * the opposite object — a hairline that must *not* be found, or it competes with
 * the data drawn over it.
 *
 * ## The empty state draws the chart anyway
 *
 * With no data the same chart renders a fixed placeholder shape in a lighter
 * ink, and the card above it reads `0` with "No data yet". The screen never
 * looks broken, never looks empty and never explains itself — which is the best
 * idea in the reference and the reason a person with one logged session sees a
 * product rather than a hole. The placeholder is obviously synthetic and the
 * value beside it is zero, so it cannot be mistaken for a record.
 *
 * ## The record draws in the brand blue (owner, 28 August 2026)
 *
 * The first build of this card was monochrome, because the Lyfta screens it was
 * measured from are. The owner ruled otherwise the same day: the Progression tab
 * gets the blue the rest of the app already uses for a recorded line, so the
 * same lift reads the same way here, on the Next tab's tiles and in the lift
 * sheet (skill §Colour — "one brand blue does every job… chart lines"; §Reuse —
 * "`TrendChart` brand"). `#007AFF` measures **3.26:1 on `surfaceHigh`**, past
 * the 3:1 a non-text mark carrying information owes.
 *
 * Three things stay uncoloured, and each for its own reason:
 *
 * - **The placeholder is ink.** An empty card must not be able to read as a
 *   record, and hue is the cheapest way to tell them apart at a glance.
 * - **The gridlines are ink.** They are texture; tinting them would make the
 *   card's background argue with its data.
 * - **The planned tail is `signal` green** and nothing else. A load not yet
 *   lifted is never the recorded hue (CLAUDE.md §3).
 *
 * The wash under the line is the SHAPE of the record, never a verdict on it —
 * it is always the line's own blue, and `gain`/`loss` never touch it.
 */

/** Evenly spaced, and six of them — the reference's own count. */
const GRID_LINES = 6;
/** The gridline band, as a fraction of the chart's height. Inset top and bottom
 * so the series can float past both ends. */
const GRID_TOP = 0.06;
const GRID_BOT = 0.96;

const DOT_R = 4;
const STROKE = 2.5;

// Precomputed: `alpha()` is a plain JS function and must never be reached from a
// worklet (theme/color.ts). These are module constants, so it never is.
const GRIDLINE = alpha(color.textPrimary, 0.09);
/** History bars sit back so the newest one reads as "now" without a second hue.
 * Precomputed for the same reason `GRIDLINE` is: `alpha()` never runs in a
 * worklet, and `GrowingBar` hands its colour straight to one. */
const BAR_PAST = alpha(color.brand, 0.34);
const BAR_NOW = color.brand;
const BAR_PAST_EMPTY = alpha(color.textPrimary, 0.22);
/**
 * THE PLACEHOLDER IS NEARLY AS STRONG AS DATA, and that is the reference's own
 * call rather than an accident of mine.
 *
 * Every Lyfta screen in `research/lyfta/` is an empty state, and all four of its
 * cards draw the placeholder at full data weight — about 2.2:1 against the card.
 * A ghost-faint shape would say "something is broken here"; a solid one says
 * "this is what will be here". The first build of this file drew it at 13 % and
 * looked like a rendering failure.
 *
 * It is one step lighter than `inkData` and not equal to it, because unlike
 * Lyfta our cards MIX — a lift can have an estimated 1RM and no heaviest set —
 * and two charts of identical weight on one screen would need the sub-label to
 * do all the work of telling them apart.
 *
 * The 3:1 floor a meaningful non-text mark owes does not apply: this shape
 * carries no information by construction, and the card says "No data yet" and
 * reads zero directly above it.
 */
const PLACEHOLDER = alpha(color.textPrimary, 0.38);

/** A shape that is clearly not anybody's training. Fixed, so every empty card in
 * the app draws the same one and it reads as furniture rather than as noise. */
const PLACEHOLDER_SHAPE = [0.32, 0.5, 0.42, 0.66, 0.55, 0.8, 0.72];

export function BareChart({
  points,
  kind,
  planned,
  height,
  /** Delays the draw so a card's chart starts after the card itself has arrived. */
  delay = 0,
}: {
  points: MetricPoint[];
  kind: ChartKind;
  planned: number | null;
  height: number;
  delay?: number;
}) {
  const [w, setW] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width);

  const gridTop = height * GRID_TOP;
  const gridBot = height * GRID_BOT;
  const empty = points.length === 0;

  /**
   * Values → chart space.
   *
   * The domain includes the planned point when there is one, so a prescription
   * above every recorded session does not push itself off the top of the card.
   * A flat series (every value identical) has no span to divide by and is drawn
   * down the middle rather than at an arbitrary edge.
   */
  const projected = useMemo(() => {
    if (w <= 0) return null;
    const top = DOT_R + 2;
    const bottom = height - DOT_R - 2;
    const values = empty ? [...PLACEHOLDER_SHAPE] : points.map((p) => p.value);
    const domain = !empty && planned != null ? [...values, planned] : values;
    const min = Math.min(...domain);
    const max = Math.max(...domain);
    const span = max - min;
    const y = (v: number) => (span === 0 ? (top + bottom) / 2 : bottom - ((v - min) / span) * (bottom - top));
    // A planned point occupies one more slot than the record, so the recorded
    // series ends short of the right edge whenever there is a plan to show.
    const slots = values.length + (!empty && planned != null ? 1 : 0);
    const step = slots > 1 ? w / (slots - 1) : 0;
    const line: Point[] = values.map((v, i) => ({ x: slots > 1 ? i * step : w / 2, y: y(v) }));
    return {
      line,
      planned: !empty && planned != null ? { x: (slots - 1) * step, y: y(planned) } : null,
      max,
      values,
    };
  }, [empty, height, planned, points, w]);

  return (
    <View style={[styles.root, { height }]} onLayout={onLayout}>
      {/* The gridlines sit UNDER the series and never move. */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {Array.from({ length: GRID_LINES }, (_, i) => (
          <View
            key={i}
            style={[
              styles.grid,
              { top: gridTop + ((gridBot - gridTop) * i) / (GRID_LINES - 1) },
            ]}
          />
        ))}
      </View>

      {w > 0 && projected ? (
        kind === 'bar' ? (
          <BarRow
            values={projected.values}
            max={projected.max}
            width={w}
            baseline={gridBot}
            // The last bar is the newest session and carries full strength; the
            // weeks behind it sit back at a third of it. One hue, two weights —
            // never two colours, which would read as two kinds of measurement.
            tint={empty ? PLACEHOLDER : BAR_NOW}
            pastTint={empty ? BAR_PAST_EMPTY : BAR_PAST}
          />
        ) : (
          <MonotoneSeries
            points={projected.line}
            width={w}
            height={height}
            stroke={empty ? PLACEHOLDER : color.brand}
            strokeWidth={STROKE}
            dotRadius={DOT_R}
            // No wash under the placeholder: an empty card should read as an
            // outline of what will be here, not as a filled record.
            wash={empty ? undefined : color.brand}
            washOpacity={0.16}
            // The card, not the canvas — this chart sits on the tinted panel, and
            // the terminal dot is knocked out of its own line with it.
            ground={color.surfaceHigh}
            planned={projected.planned}
            plannedStroke={color.signal}
            delay={delay}
            style={StyleSheet.absoluteFill}
          />
        )
      ) : null}
    </View>
  );
}

/** Bars STAND ON the bottom gridline, square-cornered and wide with narrow gaps
 * — the reference's proportions. A rounded bar reads as a UI control; these are
 * measurements. */
function BarRow({
  values,
  max,
  width,
  baseline,
  tint,
  pastTint,
}: {
  values: number[];
  max: number;
  width: number;
  baseline: number;
  /** The newest bar. */
  tint: string;
  /** Every bar behind it. */
  pastTint: string;
}) {
  const gap = 4;
  const barW = Math.max((width - gap * (values.length - 1)) / values.length, 1);
  return (
    <View style={[styles.bars, { height: baseline, gap }]} pointerEvents="none">
      {values.map((v, i) => (
        <GrowingBar
          // The value is in the key so a bar REGROWS when the exercise changes.
          // `GrowingBar` animates on mount only; keyed by index alone it would
          // sit still through every switch, which is the same bug the line had.
          key={`${i}-${v}`}
          fraction={max > 0 ? v / max : 0}
          width={barW}
          height={baseline - 4}
          color={i === values.length - 1 ? tint : pastTint}
          index={i}
          radius={0}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
  },
  grid: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: GRIDLINE,
  },
  bars: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
});
