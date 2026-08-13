import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { groupThousands } from '@/lib/parse/estimate';
import {
  alpha,
  color,
  fonts,
  ink,
  lineFor,
  MAX_FONT_SCALE,
  moderateScale,
  spacing,
  type,
} from '@/lib/theme';

/**
 * Chart primitives.
 *
 * The bar charts here stay monochrome (they are ledger furniture — history at
 * low-alpha paper, the current week at full `accent`). **`TrendChart` is
 * coloured**: product-direction §10 asks recorded progression to draw as a blue
 * line with a soft fill, and v5.1 §4.2 makes Recore blue the product accent, so
 * a lift's own trend is the one place a hue earns its keep. Green still belongs
 * to PLANNED prescription values only and never appears in a chart, and no
 * chart ever uses red/green to judge a person — direction is carried by the
 * words beside it. No gridlines, no legends, no decoration. Everything is sized
 * in moderateScale so charts stay proportional across devices.
 */

const BAR_RADIUS = 3;

export interface WeekBarDatum {
  /** Short label under the bar (e.g. "12 Jan" or ""). */
  label: string;
  value: number;
  /** Sessions in the week — rendered as dots under the bar (0 = none). */
  sessions?: number;
}

/**
 * The 8-week volume chart: current week in full paper with its value on top,
 * history alpha-dimmed. Zero weeks stay honestly empty (no 3px fake bars).
 */
export function WeekBars({ data, height = moderateScale(120) }: { data: WeekBarDatum[]; height?: number }) {
  const [width, setWidth] = useState(0);
  const max = Math.max(1, ...data.map((d) => d.value));
  const n = data.length;
  const gap = spacing.sm;
  const barW = n > 0 && width > 0 ? (width - gap * (n - 1)) / n : 0;
  const valueRoom = type.caption.lineHeight!;
  const chartH = height - valueRoom;

  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 ? (
        <>
          <Svg width={width} height={height}>
            {data.map((d, i) => {
              const h = d.value > 0 ? Math.max(2, (d.value / max) * (chartH - 2)) : 0;
              const x = i * (barW + gap);
              const current = i === n - 1;
              return d.value > 0 ? (
                <Rect
                  key={i}
                  x={x}
                  y={valueRoom + (chartH - h)}
                  width={barW}
                  height={h}
                  rx={BAR_RADIUS}
                  fill={current ? color.accent : alpha(color.accent, ink.rule)}
                />
              ) : null;
            })}
          </Svg>
          {/* Value label pinned above the current week's bar. */}
          <CurrentValue data={data} width={width} barW={barW} gap={gap} />
          <View style={styles.axis}>
            {data.map((d, i) => (
              <View key={i} style={[styles.axisSlot, { width: barW }]}>
                {typeof d.sessions === 'number' && d.sessions > 0 ? (
                  <View style={styles.dots}>
                    {/* Capped at 4 so the dot row can never outgrow its bar. */}
                    {Array.from({ length: Math.min(d.sessions, 4) }).map((_, j) => (
                      <View key={j} style={[styles.dot, i === n - 1 && styles.dotCurrent]} />
                    ))}
                  </View>
                ) : null}
                {d.label ? (
                  <Text style={styles.axisLabel} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                    {d.label}
                  </Text>
                ) : null}
              </View>
            ))}
          </View>
        </>
      ) : (
        <View style={{ height }} />
      )}
    </View>
  );
}

function CurrentValue({
  data,
  width,
  barW,
  gap,
}: {
  data: WeekBarDatum[];
  width: number;
  barW: number;
  gap: number;
}) {
  const current = data[data.length - 1];
  if (!current || current.value <= 0) return null;
  const x = (data.length - 1) * (barW + gap);
  // Right-align the label with the bar, but never past the chart edge.
  return (
    <Text
      style={[styles.currentValue, { right: Math.max(0, width - x - barW) }]}
      maxFontSizeMultiplier={MAX_FONT_SCALE}>
      {groupThousands(current.value)}
    </Text>
  );
}

/**
 * The insight header's quiet 8-week strip — same data, whisper size. History
 * in low-alpha paper, this week at full strength.
 */
export function MicroBars({
  data,
  width = moderateScale(72),
  height = moderateScale(26),
}: {
  data: number[];
  width?: number;
  height?: number;
}) {
  const max = Math.max(1, ...data);
  const n = data.length;
  const gap = 3;
  const barW = n > 0 ? (width - gap * (n - 1)) / n : 0;
  return (
    <Svg width={width} height={height}>
      {data.map((v, i) => {
        const h = v > 0 ? Math.max(2, (v / max) * height) : 2;
        return (
          <Rect
            key={i}
            x={i * (barW + gap)}
            y={height - h}
            width={barW}
            height={h}
            rx={1.5}
            fill={i === n - 1 && v > 0 ? color.accent : alpha(color.accent, v > 0 ? ink.rule : 0.1)}
          />
        );
      })}
    </Svg>
  );
}

/**
 * A quiet trend line (e1RM over sessions): hairline paper path, the latest
 * point marked at full strength. No axes — the numbers live next to it.
 */
export function Sparkline({
  values,
  width,
  height = moderateScale(44),
  /** Ink by default. The Next tab's climbing tiles pass `color.trained`, which
   * §4.2 permits: a line of recorded progress is exactly what blue is for. */
  tint = color.accent,
}: {
  values: number[];
  width: number;
  height?: number;
  tint?: string;
}) {
  if (values.length < 2 || width <= 0) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pad = 4;
  const stepX = (width - pad * 2) / (values.length - 1);
  const y = (v: number) => pad + (1 - (v - min) / span) * (height - pad * 2);
  const d = values.map((v, i) => `${i === 0 ? 'M' : 'L'} ${pad + i * stepX} ${y(v)}`).join(' ');
  const lastX = pad + (values.length - 1) * stepX;
  const lastY = y(values[values.length - 1]!);

  return (
    <Svg width={width} height={height}>
      <Path d={d} stroke={alpha(tint, 0.45)} strokeWidth={1.5} fill="none" />
      <Circle cx={lastX} cy={lastY} r={3} fill={tint} />
    </Svg>
  );
}

export interface TrendPoint {
  day: string;
  value: number;
}

/** How a series gets from one session to the next. See `seriesPathD`. */
export type SeriesShape = 'linear' | 'step';

/**
 * The series path — ONE definition, shared by the Progress tab's `TrendChart`
 * and the lift sheet's `ProgressionChart`. Two expressions of "how does a
 * weight get from one session to the next" is exactly the divergence §7.7 keeps
 * diagnosing, so the shape is a parameter here and never a second function.
 *
 * **`linear` is the default (owner, 4 Aug 2026):** straight segments between
 * consecutive sessions, up and down. Every VERTEX is a real recorded session —
 * the dots mark them — and the segment between two of them is a connector, the
 * way every training app the owner compared against draws it.
 *
 * **`step` holds the old value until the session that changed it, then jumps.**
 * It is the stricter reading of product-direction §10 ("do not smooth a line
 * between values never lifted"), because a diagonal does imply loads on days
 * nobody trained. It is kept, one prop away, so the ruling can be restored
 * without rebuilding a chart.
 */
export function seriesPathD(
  values: number[],
  xOf: (i: number) => number,
  yOf: (v: number) => number,
  shape: SeriesShape = 'linear',
): string {
  if (values.length === 0) return '';
  let d = `M ${xOf(0).toFixed(1)} ${yOf(values[0]!).toFixed(1)}`;
  for (let i = 1; i < values.length; i++) {
    if (shape === 'step') d += ` L ${xOf(i).toFixed(1)} ${yOf(values[i - 1]!).toFixed(1)}`;
    d += ` L ${xOf(i).toFixed(1)} ${yOf(values[i]!).toFixed(1)}`;
  }
  return d;
}

/** Gradient ids have to be unique per mounted chart — a whole list of cards
 * draws at once, and two `<Defs>` sharing an id is a coin toss over which wash
 * every chart gets. A mount-time counter is enough and needs no React version
 * assumptions. */
let fillSeq = 0;

/**
 * The progression chart on the Progress tab: straight segments between real
 * sessions, up and down (owner, 4 Aug 2026 — "ne stopnice, lepo linearno z
 * ravno linijo gor in dol"). Never a spline: a curve would overshoot past
 * loads nobody lifted, and the vertices have to stay exactly on their sessions.
 * Pass `shape="step"` to restore the held-then-jumped reading of §10.
 *
 * **Recore blue is the default hue** (product-direction §4.2/§10: "a blue
 * primary line or step chart with a soft contextual fill"). The wash under the
 * line is the SHAPE of the record, never a verdict on it: a lift that fell
 * draws in exactly the same blue as one that rose, and the words beside the
 * chart carry the direction. Ember stays reserved for the lift sheet's
 * single-series comparison.
 *
 * `best` is the all-time reference, drawn as ONE unlabeled neutral hairline and
 * folded into the domain so it can never clip — the same treatment
 * `ProgressionChart` gives it in the exercise sheet, and for the same reason:
 * the outlined mono label owns the word "PR", a line does not get to say it.
 *
 * `dots` marks every session, so how OFTEN a lift was trained is visible in the
 * same glance as where it went. `axis` prints the domain's own ends in a right
 * gutter, pinned to the exact y they sit at, so a reading can never drift from
 * the line it labels. `showPrevious` marks the second-to-last session with a
 * hollow dot, so an opened card shows where the latest step came from.
 */
export function TrendChart({
  points,
  best,
  height = moderateScale(58),
  showPrevious = false,
  tint = color.trained,
  fill = true,
  dots = false,
  axis = false,
  shape = 'linear',
  format = (n) => String(Math.round(n)),
}: {
  points: TrendPoint[];
  best?: number | null;
  height?: number;
  showPrevious?: boolean;
  /** `linear` (default) or the older `step`. */
  shape?: SeriesShape;
  /** Line + wash hue. Blue by default; the caller never needs to pass it. */
  tint?: string;
  /** The gradient wash between the line and the baseline. */
  fill?: boolean;
  /** A dot on every session, not only the last. */
  dots?: boolean;
  /** Min/max readings in a right gutter. */
  axis?: boolean;
  format?: (n: number) => string;
}) {
  const [w, setW] = useState(0);
  const [fillId] = useState(() => `stepFill${(fillSeq += 1)}`);
  if (points.length < 2) return null;

  const padX = moderateScale(4);
  const padY = moderateScale(8);
  const gutter = axis ? moderateScale(34) : 0;
  const values = points.map((p) => p.value);
  const domain = best != null ? [...values, best] : values;
  const min = Math.min(...domain);
  const max = Math.max(...domain);
  const span = max - min;
  const plotW = Math.max(1, w - padX * 2 - gutter);
  const plotH = Math.max(1, height - padY * 2);
  const yOf = (v: number) => padY + (1 - (span > 0 ? (v - min) / span : 0.5)) * plotH;
  const xOf = (i: number) => padX + (i / (points.length - 1)) * plotW;

  const d = seriesPathD(values, xOf, yOf, shape);
  // The wash closes that same path down to the floor, so the fill can never
  // disagree with the line sitting on top of it.
  const baseY = height;
  const areaD = `${d} L ${xOf(points.length - 1).toFixed(1)} ${baseY} L ${xOf(0).toFixed(1)} ${baseY} Z`;

  const lastX = xOf(points.length - 1);
  const lastY = yOf(values[values.length - 1]!);
  const prevIndex = points.length - 2;
  const labelHalf = moderateScale(7);

  return (
    <View onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ height }}>
      {w > 0 ? (
        <>
          <Svg width={w} height={height}>
            <Defs>
              <LinearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={tint} stopOpacity={0.22} />
                <Stop offset="1" stopColor={tint} stopOpacity={0.01} />
              </LinearGradient>
            </Defs>
            {best != null ? (
              <Line
                x1={padX}
                y1={yOf(best)}
                x2={w - padX - gutter}
                y2={yOf(best)}
                stroke={color.border}
                strokeWidth={1}
                strokeDasharray="3 4"
              />
            ) : null}
            {fill ? <Path d={areaD} fill={`url(#${fillId})`} /> : null}
            <Path
              d={d}
              fill="none"
              stroke={tint}
              strokeWidth={2}
              // A linear series turns at every session, so its corners get
              // rounded; a step's right angles are the point of it.
              strokeLinejoin={shape === 'step' ? 'miter' : 'round'}
              strokeLinecap="round"
            />
            {dots
              ? points.slice(0, -1).map((p, i) => (
                  <Circle
                    key={`${p.day}-${i}`}
                    cx={xOf(i)}
                    cy={yOf(p.value)}
                    r={moderateScale(1.8)}
                    fill={alpha(tint, 0.45)}
                  />
                ))
              : null}
            {showPrevious && prevIndex >= 0 ? (
              <Circle
                cx={xOf(prevIndex)}
                cy={yOf(values[prevIndex]!)}
                r={moderateScale(3)}
                fill={color.surface}
                stroke={tint}
                strokeWidth={1.6}
              />
            ) : null}
            <Circle
              cx={lastX}
              cy={lastY}
              r={moderateScale(3.5)}
              fill={tint}
              stroke={color.surface}
              strokeWidth={1.5}
            />
          </Svg>
          {axis ? (
            <>
              <Text
                style={[styles.gutterValue, { top: yOf(max) - labelHalf, width: gutter }]}
                numberOfLines={1}
                maxFontSizeMultiplier={MAX_FONT_SCALE}>
                {format(max)}
              </Text>
              {span > 0 ? (
                <Text
                  style={[styles.gutterValue, { top: yOf(min) - labelHalf, width: gutter }]}
                  numberOfLines={1}
                  maxFontSizeMultiplier={MAX_FONT_SCALE}>
                  {format(min)}
                </Text>
              ) : null}
            </>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  currentValue: {
    position: 'absolute',
    top: 0,
    fontSize: type.caption.fontSize,
    lineHeight: type.caption.lineHeight,
    fontWeight: '600',
    color: color.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  axis: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: color.border,
    paddingTop: spacing.xs,
    marginTop: spacing.xs,
  },
  axisSlot: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  dots: {
    flexDirection: 'row',
    gap: 3,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: alpha(color.accent, ink.rule),
  },
  dotCurrent: {
    backgroundColor: color.accent,
  },
  axisLabel: {
    fontSize: moderateScale(10),
    color: color.textMuted,
    fontVariant: ['tabular-nums'],
  },
  /** A `TrendChart` right-gutter reading — muted mono, never the line's hue, so
   * a number stays a number (§4.2: ember/blue never touch a value). */
  gutterValue: {
    position: 'absolute',
    right: 0,
    textAlign: 'right',
    fontFamily: fonts.reading,
    fontSize: moderateScale(9.5),
    lineHeight: lineFor(14),
    color: color.textMuted,
    fontVariant: ['tabular-nums'],
  },
});
