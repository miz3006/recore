import { useEffect, useState } from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { seriesPathD } from '@/components/charts';
import { EASE } from '@/lib/motion';
import { color, moderateScale } from '@/lib/theme';

/**
 * THE PROJECTION, DRAWN THE WAY THE RECORD IS DRAWN (owner, 23 Aug 2026: "make
 * a real chart, like the one in progression, and animate it").
 *
 * It replaces twelve blue bars of increasing opacity. The bars were honest but
 * they were not the app's own language: every chart in Recore that shows a load
 * over time is a brand-blue line with a soft wash under it (`charts.tsx`,
 * `TrendChart`), and the last screen of the funnel is a promise about exactly
 * that chart — so the promise should be made in the shape it will be kept in.
 *
 * ## Why it is not `TrendChart` itself
 *
 * The path is: `seriesPathD` is imported rather than reimplemented, so there is
 * still ONE definition of how a series gets from one point to the next (that
 * file's own rule, and the divergence §7.7 keeps diagnosing). Everything else
 * differs on purpose:
 *
 *  · `TrendChart` plots RECORDED sessions and marks each one with a dot. Every
 *    point here is arithmetic on two numbers, and a dot per week would claim
 *    twelve sessions that have not happened. Only the two ENDS are marked: the
 *    start, which is a load the person typed, and the target.
 *  · It animates. Nothing in Progress does — a recorded chart is a fact and a
 *    fact does not need an entrance. This one is a projection arriving as the
 *    answer to the screen before it, and the skill sanctions exactly this
 *    ("a chart revealing after its data").
 *
 * ## The animation
 *
 * The line DRAWS, once, left to right: a dash pattern as long as the path
 * itself, with its offset run to zero (`strokeDashoffset`) — the one way to
 * reveal a stroke that costs no layout and no re-render, and the same
 * `useAnimatedProps` on an SVG element the spotlight already uses. The wash
 * comes up behind it and the end dot lands last, so the eye follows the line to
 * the number the card has already printed.
 *
 * It is ONE SHOT (§A.1 — nothing in onboarding loops), and Reduce Motion draws
 * the finished chart with no travel at all: the information is in the shape,
 * never in the movement.
 *
 * ## What it may never become
 *
 * A projection is not history. §5.1 forbids "a fake progression chart before a
 * session is logged", and the thing that keeps this on the right side of that
 * line is not the drawing — it is that the card around it names the two numbers
 * it interpolates, calls itself an estimate, stores nothing, and seeds nothing.
 * Draw this without those and it becomes the exact object the rule bans.
 */

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** How long the line takes to draw itself. */
const DRAW_MS = 900;
/** Where in that window the wash and the end dot arrive. */
const WASH_AT = 0.15;
const DOT_AT = 0.85;

/** Gradient and clip ids have to be unique per mounted chart — two `<Defs>`
 * sharing an id is a coin toss over which wash every chart gets. */
let fillSeq = 0;

export function ProjectionChart({
  series,
  height = moderateScale(96),
  delay = 0,
  strokeWidth = 2,
  wash = 0.2,
}: {
  /** The weekly values, first to last (`projectionSeries`). */
  series: readonly number[];
  height?: number;
  /** Beat to wait before drawing — the screen's own stagger. */
  delay?: number;
  strokeWidth?: number;
  /** Opacity at the TOP of the wash; it always fades to nothing at the floor. */
  wash?: number;
}) {
  const reduce = useReducedMotion();
  const [w, setW] = useState(0);
  const [fillId] = useState(() => `projFill${(fillSeq += 1)}`);
  const draw = useSharedValue(reduce ? 1 : 0);

  useEffect(() => {
    if (reduce) {
      draw.set(1);
      return;
    }
    draw.set(withDelay(delay, withTiming(1, { duration: DRAW_MS, easing: EASE.emphasized })));
    // The chart draws ONCE, when it arrives. Re-running it on a re-render would
    // be the looping decoration §A.1 bans.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const padX = moderateScale(3);
  const padY = moderateScale(6);
  const values = series.length > 1 ? series : [];
  const min = values.length > 0 ? Math.min(...values) : 0;
  const max = values.length > 0 ? Math.max(...values) : 1;
  const span = max - min;
  const plotW = Math.max(1, w - padX * 2);
  const plotH = Math.max(1, height - padY * 2 - strokeWidth);
  const yOf = (v: number) => padY + (1 - (span > 0 ? (v - min) / span : 0.5)) * plotH;
  const xOf = (i: number) => padX + (i / Math.max(1, values.length - 1)) * plotW;

  const d = values.length > 0 ? seriesPathD([...values], xOf, yOf, 'linear') : '';
  // The wash closes that same path down to the floor, so the fill can never
  // disagree with the line sitting on top of it.
  const areaD = d
    ? `${d} L ${xOf(values.length - 1).toFixed(1)} ${height} L ${xOf(0).toFixed(1)} ${height} Z`
    : '';
  const length = pathLength(values, xOf, yOf);

  // Both ends of the reveal are resolved HERE, on the render thread: a worklet
  // may only do arithmetic on what it is handed.
  const washSpan = 1 - WASH_AT;
  const dotSpan = 1 - DOT_AT;

  const lineProps = useAnimatedProps(() => ({
    strokeDashoffset: (1 - draw.get()) * length,
  }));
  const areaProps = useAnimatedProps(() => ({
    opacity: clamp((draw.get() - WASH_AT) / washSpan),
  }));
  const endProps = useAnimatedProps(() => ({
    opacity: clamp((draw.get() - DOT_AT) / dotSpan),
  }));

  return (
    <View
      style={{ height }}
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      {w > 0 && d ? (
        <Svg width={w} height={height}>
          <Defs>
            <LinearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={color.brand} stopOpacity={wash} />
              <Stop offset="1" stopColor={color.brand} stopOpacity={0.01} />
            </LinearGradient>
          </Defs>

          <AnimatedPath animatedProps={areaProps} d={areaD} fill={`url(#${fillId})`} />
          <AnimatedPath
            animatedProps={lineProps}
            d={d}
            fill="none"
            stroke={color.brand}
            strokeWidth={strokeWidth}
            strokeLinejoin="round"
            strokeLinecap="round"
            strokeDasharray={length}
            strokeDashoffset={reduce ? 0 : length}
          />

          {/* WHERE IT STARTS is a load the person typed, so it is marked the way
              the lift sheet marks a session you came from: hollow, knocked out
              of the line rather than sitting on it. */}
          <Circle
            cx={xOf(0)}
            cy={yOf(values[0]!)}
            r={moderateScale(3)}
            fill={color.surface}
            stroke={color.brand}
            strokeWidth={1.6}
          />
          {/* WHERE IT COULD STAND, and the only thing on this chart that is not
              a fact — it arrives last, after the line has been drawn to it. */}
          <AnimatedCircle
            animatedProps={endProps}
            cx={xOf(values.length - 1)}
            cy={yOf(values[values.length - 1]!)}
            r={moderateScale(4)}
            fill={color.brand}
            stroke={color.surface}
            strokeWidth={1.5}
          />
        </Svg>
      ) : null}
    </View>
  );
}

/** The polyline's own length, in points — what the dash pattern is made of. */
function pathLength(
  values: readonly number[],
  xOf: (i: number) => number,
  yOf: (v: number) => number,
): number {
  let total = 0;
  for (let i = 1; i < values.length; i++) {
    total += Math.hypot(xOf(i) - xOf(i - 1), yOf(values[i]!) - yOf(values[i - 1]!));
  }
  // Never zero: a dash pattern of 0 draws nothing at all.
  return Math.max(1, total);
}

function clamp(v: number): number {
  'worklet';
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
