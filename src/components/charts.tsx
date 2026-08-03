import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';

import { groupThousands } from '@/lib/parse/estimate';
import { alpha, color, ink, MAX_FONT_SCALE, moderateScale, spacing, type } from '@/lib/theme';

/**
 * Chart primitives — monochrome by contract (the record is archival, not
 * celebratory). History sits at low-alpha paper; the current week/point is
 * full `accent`. Lime belongs to PLANNED prescription values only and never
 * appears in a chart. No gridlines, no legends, no decoration — a bar, a
 * value, a hairline baseline. Everything is sized in moderateScale so charts
 * stay proportional across devices.
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
}: {
  values: number[];
  width: number;
  height?: number;
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
      <Path d={d} stroke={alpha(color.accent, 0.45)} strokeWidth={1.5} fill="none" />
      <Circle cx={lastX} cy={lastY} r={3} fill={color.accent} />
    </Svg>
  );
}

export interface StepPoint {
  day: string;
  value: number;
}

/**
 * The step path itself — ONE definition, shared by the Progress tab's
 * `StepChart` and the lift sheet's `ProgressionChart`. Two expressions of "how
 * does a weight get from one session to the next" is exactly the divergence
 * §7.7 keeps diagnosing, and the answer is not a matter of taste: the line runs
 * horizontally at the old value until the session that changed it, then
 * vertically. A diagonal would draw loads nobody lifted.
 */
export function stepPathD(
  values: number[],
  xOf: (i: number) => number,
  yOf: (v: number) => number,
): string {
  if (values.length === 0) return '';
  let d = `M ${xOf(0).toFixed(1)} ${yOf(values[0]!).toFixed(1)}`;
  for (let i = 1; i < values.length; i++) {
    d += ` L ${xOf(i).toFixed(1)} ${yOf(values[i - 1]!).toFixed(1)}`;
    d += ` L ${xOf(i).toFixed(1)} ${yOf(values[i]!).toFixed(1)}`;
  }
  return d;
}

/**
 * The progression chart on the Progress tab: a STEP line, not a curve.
 *
 * Strength moves in steps — a weight holds for however many sessions it holds,
 * then jumps. A smooth line between two sessions invents the values in between,
 * which is exactly the kind of quiet fiction the record contract exists to
 * prevent. So the path runs horizontally at the old value until the session
 * that changed it, then vertically.
 *
 * `best` is the all-time reference, drawn as ONE unlabeled neutral hairline and
 * folded into the domain so it can never clip — the same treatment
 * `ProgressionChart` gives it in the exercise sheet, and for the same reason:
 * the outlined mono label owns the word "PR", a line does not get to say it.
 * Never green (§5.1 — a record is not a prescription).
 *
 * `showPrevious` marks the second-to-last session with a hollow dot, so an
 * opened card shows where the latest step came from.
 */
export function StepChart({
  points,
  best,
  height = moderateScale(58),
  showPrevious = false,
}: {
  points: StepPoint[];
  best?: number | null;
  height?: number;
  showPrevious?: boolean;
}) {
  const [w, setW] = useState(0);
  if (points.length < 2) return null;

  const padX = moderateScale(4);
  const padY = moderateScale(6);
  const values = points.map((p) => p.value);
  const domain = best != null ? [...values, best] : values;
  const min = Math.min(...domain);
  const max = Math.max(...domain);
  const span = max - min;
  const plotW = Math.max(1, w - padX * 2);
  const plotH = Math.max(1, height - padY * 2);
  const yOf = (v: number) => padY + (1 - (span > 0 ? (v - min) / span : 0.5)) * plotH;
  const xOf = (i: number) => padX + (i / (points.length - 1)) * plotW;

  // Step-after: hold the value, then jump. The horizontal run IS the record of
  // "this weight stayed put for these sessions".
  const d = stepPathD(values, xOf, yOf);

  const lastX = xOf(points.length - 1);
  const lastY = yOf(values[values.length - 1]!);
  const prevIndex = points.length - 2;

  return (
    <View onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ height }}>
      {w > 0 ? (
        <Svg width={w} height={height}>
          {best != null ? (
            <Line
              x1={padX}
              y1={yOf(best)}
              x2={w - padX}
              y2={yOf(best)}
              stroke={color.border}
              strokeWidth={1}
              strokeDasharray="3 4"
            />
          ) : null}
          <Path d={d} fill="none" stroke={color.accent} strokeWidth={1.6} strokeLinejoin="miter" />
          {showPrevious && prevIndex >= 0 ? (
            <Circle
              cx={xOf(prevIndex)}
              cy={yOf(values[prevIndex]!)}
              r={moderateScale(2.5)}
              fill={color.bg}
              stroke={color.accent}
              strokeWidth={1.4}
            />
          ) : null}
          <Circle cx={lastX} cy={lastY} r={moderateScale(3)} fill={color.accent} />
        </Svg>
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
});
