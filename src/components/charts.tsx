import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

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
