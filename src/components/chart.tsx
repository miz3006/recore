import { Text, View } from 'react-native';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';

import { groupThousands } from '@/lib/format';
import { makeStyles, MAX_FONT_SCALE, moderateScale, mono, useTheme } from '@/lib/theme';

/**
 * `Chart` and `Sparkline` (CLAUDE.md §20, PLAN.md 4.3) — hand-drawn on
 * `react-native-svg`. No charting library: §19.3 forbids one, and ours are four
 * shapes. A library would also import a colour opinion that §6.3 forbids.
 *
 * **Monochrome, and that is a constraint with teeth.** `ink` draws the series,
 * `rule` the grid, `inkFaint` the labels. A second series is a DASHED STROKE,
 * never a second hue — the one hue in this app belongs to a number you have not
 * lifted yet, and a chart line is not that. Every reference worth studying
 * (Strava, AllTrails, The Outsiders) separates series with colour; we cannot,
 * so weight and dash do the work instead.
 *
 * Two gridlines, labelled at the right edge, and sparse x-labels — the AllTrails
 * restraint. Four gridlines look like precision and deliver noise; zero leaves
 * the reader estimating. Two give a floor and a ceiling, which is what a glance
 * actually uses.
 */

const GRID_LINES = 2;

export interface BarDatum {
  /** Bar height source. */
  value: number;
  /** Sparse axis label — pass '' to leave a bar unlabelled. */
  label?: string;
  /** Dots drawn beneath the bar (§11.1 — sessions under weekly volume). */
  dots?: number;
}

/**
 * The weekly volume chart (§11.1 zoom 2). Bars carry volume, the dots beneath
 * carry session count, so one glance answers "more work" versus "more sessions"
 * — the distinction the insight lines are built to name.
 */
export function Chart({
  data,
  height = moderateScale(140),
  unit,
}: {
  data: readonly BarDatum[];
  height?: number;
  unit?: string;
}) {
  const styles = useStyles();
  const t = useTheme();

  const max = Math.max(1, ...data.map((d) => d.value));
  const hasDots = data.some((d) => (d.dots ?? 0) > 0);
  const dotBand = hasDots ? moderateScale(14) : 0;
  const labelBand = data.some((d) => d.label) ? moderateScale(16) : 0;
  const plot = Math.max(moderateScale(40), height - dotBand - labelBand);

  // Percentage geometry so the SVG scales to whatever width it is given.
  const slot = 100 / Math.max(1, data.length);
  const barW = Math.min(slot * 0.52, 8);

  return (
    <View style={{ height }}>
      <View style={styles.plotRow}>
        <Svg width="100%" height={plot} viewBox={`0 0 100 ${plot}`} preserveAspectRatio="none">
          {Array.from({ length: GRID_LINES }, (_, i) => {
            const y = (plot / (GRID_LINES + 1)) * (i + 1);
            return (
              <Line key={i} x1={0} y1={y} x2={100} y2={y} stroke={t.rule} strokeWidth={0.5} />
            );
          })}
          {data.map((d, i) => {
            const h = (d.value / max) * (plot - 2);
            const x = slot * i + (slot - barW) / 2;
            return (
              <Rect
                key={i}
                x={x}
                y={plot - h}
                width={barW}
                height={Math.max(d.value > 0 ? 1 : 0, h)}
                rx={1}
                fill={t.ink}
                // The most recent column is the one being asked about; the rest
                // is context, so it recedes rather than competing.
                opacity={i === data.length - 1 ? 1 : 0.32}
              />
            );
          })}
        </Svg>

        {/* Right-edge scale, the AllTrails placement: it labels the gridlines
            without a dedicated axis column stealing width from the bars. */}
        <View style={[styles.scale, { height: plot }]} pointerEvents="none">
          <Text style={styles.scaleLabel} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {groupThousands(max)}
            {unit ? ` ${unit}` : ''}
          </Text>
        </View>
      </View>

      {hasDots ? (
        <View style={[styles.band, { height: dotBand }]}>
          <Svg width="100%" height={dotBand} viewBox={`0 0 100 ${dotBand}`} preserveAspectRatio="none">
            {data.map((d, i) =>
              Array.from({ length: d.dots ?? 0 }, (_, k) => (
                <Circle
                  key={`${i}-${k}`}
                  cx={slot * i + slot / 2}
                  cy={dotBand / 2}
                  r={1.1}
                  fill={t.inkFaint}
                  // Fan the dots horizontally so 4 sessions reads as 4, not a blob.
                  transform={`translate(${(k - ((d.dots ?? 1) - 1) / 2) * 2.6} 0)`}
                />
              )),
            )}
          </Svg>
        </View>
      ) : null}

      {labelBand > 0 ? (
        <View style={[styles.labels, { height: labelBand }]}>
          {data.map((d, i) => (
            <Text
              key={i}
              style={[styles.axisLabel, { width: `${slot}%` }]}
              numberOfLines={1}
              maxFontSizeMultiplier={MAX_FONT_SCALE}>
              {d.label ?? ''}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

/**
 * A 12-week trend with no axes, for list rows (§11.2). It answers one question —
 * which way is this going — so anything that is not the shape of the line has
 * been removed.
 */
export function Sparkline({
  data,
  width = moderateScale(64),
  height = moderateScale(20),
  dashed,
}: {
  data: readonly number[];
  width?: number;
  height?: number;
  /** A second series. Dashed, never a second hue (§6.3). */
  dashed?: boolean;
}) {
  const t = useTheme();
  if (data.length < 2) return <View style={{ width, height }} />;

  const max = Math.max(...data);
  const min = Math.min(...data);
  const span = max - min || 1;
  const step = width / (data.length - 1);
  const y = (v: number) => height - 1 - ((v - min) / span) * (height - 2);

  const d = data.map((v, i) => `${i === 0 ? 'M' : 'L'}${i * step} ${y(v)}`).join(' ');

  return (
    <Svg width={width} height={height}>
      <Path
        d={d}
        stroke={t.ink}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        strokeDasharray={dashed ? '3 2.5' : undefined}
        opacity={dashed ? 0.7 : 1}
      />
    </Svg>
  );
}

const useStyles = makeStyles((t) => ({
  plotRow: {
    position: 'relative',
  },
  scale: {
    position: 'absolute',
    right: 0,
    top: 0,
    justifyContent: 'flex-start',
  },
  scaleLabel: {
    fontFamily: mono.medium,
    fontSize: moderateScale(10),
    color: t.inkFaint,
    fontVariant: ['tabular-nums'],
  },
  band: {
    justifyContent: 'center',
  },
  labels: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  axisLabel: {
    fontFamily: mono.medium,
    fontSize: moderateScale(10),
    color: t.inkFaint,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
}));
