import { useEffect, useMemo, useState } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, ClipPath, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import type { SharedValue } from 'react-native-reanimated';

import { monotonePathD, pathUpperBound, pointFractions } from './path';
import { arrive, DRAW_MS, REDUCED_FADE_MS, stagger } from './springs';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedRect = Animated.createAnimatedComponent(Rect);

export interface Point {
  x: number;
  y: number;
}

/**
 * A LINE THAT DRAWS ITSELF LEFT TO RIGHT (§3, "Charts": "Lines draw left to
 * right on mount, ~800ms, end dot landing last on a small spring").
 *
 * The stroke is revealed with `strokeDashoffset` running from the path's own
 * length down to zero. This is the one place in the v2 system driven by a
 * timing curve rather than a spring, and §3's own wording is why: a pen moving
 * along a path is TRAVEL, and a spring would make the nib accelerate into the
 * end of the stroke and then wobble against a line that is supposed to be a
 * measurement. The end dot, which is an arrival rather than travel, does get
 * the spring.
 *
 * The path length is approximated by summing the segment lengths, which is
 * exact for the polyline this flow draws and an over-estimate for a curved one
 * — over-estimating is safe (the line simply starts fully hidden).
 *
 * REDUCE MOTION: the whole line is present on mount and only fades in.
 */
export function DrawnLine({
  points,
  width,
  height,
  stroke,
  strokeWidth = 3,
  /** Fill under the line, drawn without animation behind the stroke. */
  areaFill,
  endDotFill,
  endDotRadius = 6,
  endDotStroke,
  delay = 0,
  style,
}: {
  points: readonly Point[];
  width: number;
  height: number;
  stroke: string;
  strokeWidth?: number;
  areaFill?: string;
  endDotFill?: string;
  endDotRadius?: number;
  endDotStroke?: string;
  delay?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const reduced = useReducedMotion();
  const drawn = useSharedValue(reduced ? 1 : 0);
  const dot = useSharedValue(reduced ? 1 : 0);

  const { d, area, length, last } = useMemo(() => {
    if (points.length === 0) {
      return { d: '', area: '', length: 1, last: { x: 0, y: 0 } };
    }
    let path = `M ${points[0].x} ${points[0].y}`;
    let total = 0;
    for (let i = 1; i < points.length; i += 1) {
      const a = points[i - 1];
      const b = points[i];
      total += Math.hypot(b.x - a.x, b.y - a.y);
      path += ` L ${b.x} ${b.y}`;
    }
    const end = points[points.length - 1];
    const closed = `${path} L ${end.x} ${height} L ${points[0].x} ${height} Z`;
    return { d: path, area: closed, length: Math.max(total, 1), last: end };
  }, [height, points]);

  useEffect(() => {
    if (reduced) {
      drawn.value = 1;
      dot.value = 1;
      return;
    }
    drawn.value = 0;
    dot.value = 0;
    drawn.value = withDelay(
      delay,
      withTiming(1, { duration: DRAW_MS, easing: Easing.out(Easing.cubic) }),
    );
    // The dot lands last — after the pen has reached it, not with it.
    dot.value = withDelay(delay + DRAW_MS, withSpring(1, arrive));
  }, [delay, dot, drawn, reduced]);

  const lineProps = useAnimatedProps(() => ({
    strokeDashoffset: length * (1 - drawn.value),
  }));
  const dotProps = useAnimatedProps(() => ({ r: endDotRadius * dot.value }));
  const fade = useAnimatedStyle(() => ({ opacity: reduced ? drawn.value : 1 }));

  return (
    <Animated.View style={[style, fade]}>
      <Svg width={width} height={height}>
        {areaFill && points.length > 1 ? <Path d={area} fill={areaFill} /> : null}
        <AnimatedPath
          d={d}
          fill="none"
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={length}
          animatedProps={lineProps}
        />
        {endDotFill ? (
          <AnimatedCircle
            cx={last.x}
            cy={last.y}
            fill={endDotFill}
            stroke={endDotStroke}
            strokeWidth={endDotStroke ? 3 : 0}
            animatedProps={dotProps}
          />
        ) : null}
      </Svg>
    </Animated.View>
  );
}

/**
 * BARS GROWING FROM THE BASELINE (§3, "Charts": "Bars grow from baseline,
 * ~40ms stagger").
 *
 * `scaleY` from a bottom origin rather than an animated height, for the same
 * reason `SpringBar` uses `scaleX`: layout never runs. One bar; the caller
 * lays out the row.
 */
export function GrowingBar({
  /** 0…1 of the track height. */
  fraction,
  width,
  height,
  color,
  index = 0,
  radius = 4,
  style,
}: {
  fraction: number;
  width: number;
  height: number;
  color: string;
  index?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const reduced = useReducedMotion();
  const grown = useSharedValue(reduced ? 1 : 0);
  const delay = stagger(index, 40, 12);

  useEffect(() => {
    grown.value = withDelay(
      delay,
      reduced ? withTiming(1, { duration: REDUCED_FADE_MS }) : withSpring(1, arrive),
    );
  }, [delay, grown, reduced]);

  const animated = useAnimatedStyle(() => ({
    transform: [{ scaleY: Math.max(grown.value, 0.0001) }],
    opacity: reduced ? grown.value : 1,
  }));

  const barHeight = Math.max(height * Math.min(Math.max(fraction, 0), 1), 2);

  return (
    <View style={[{ width, height, justifyContent: 'flex-end' }, style]}>
      <Animated.View
        style={[
          {
            width,
            height: barHeight,
            backgroundColor: color,
            borderRadius: radius,
            transformOrigin: 'center bottom',
          },
          animated,
        ]}
      />
    </View>
  );
}

/**
 * A SMOOTHED RECORDED SERIES, with a dot on every session (28 August 2026).
 *
 * `DrawnLine` above draws the v2 onboarding flow's straight polyline and lands a
 * single dot at the end. The Progression tab needs the other shape: a smoothed
 * curve, a dot at every point, and — where a prescription exists — a green tail
 * continuing past the last thing that was actually lifted.
 *
 * Three things it does that a chart library would not:
 *
 * 1. **The curve is monotone** (`./path.ts`), so it cannot draw a load nobody
 *    lifted between two sessions.
 * 2. **Each dot lands as the pen reaches it**, not all at once on completion —
 *    the dot's radius is keyed to the stroke's own progress past that point's
 *    fraction along the path. That is the difference between a line being drawn
 *    and a line appearing with decorations.
 * 3. **The planned tail is a separate stroke in a separate colour**, drawn after
 *    the record finishes and dashed, so a future prescription can never be
 *    mistaken for a session (CLAUDE.md §3: planned green is a load NOT yet
 *    lifted).
 * 4. **The wash is revealed by the pen** (28 August 2026). An optional area
 *    under the curve, in the line's own hue, clipped to the stroke's own x — so
 *    the record gains a body without a second animation arriving late over it.
 *    See `revealRange` below on why the clip is not `width × progress`.
 * 5. **The newest reading lands**, on a spring, knocked out of the line by the
 *    ground colour, with one ring that leaves it and fades. It is the record's
 *    full stop and it fires once — never a loop, never a celebration.
 *
 * REDUCE MOTION: everything is present on mount and only fades. The ring never
 * draws at all.
 */

/** How much of the path's length a dot takes to reach full size once the pen
 * passes it. Short: the dot is an arrival, not a transition. */
const DOT_WINDOW = 0.06;

/** How long the terminal halo takes to expand and fade out, once. It is not a
 * pulse and it never repeats — the skill bans looping celebration, so this is
 * the single ring that says "the pen stopped here". */
const HALO_MS = 620;
/** How far past the dot the ring travels, as a multiple of the dot's radius. */
const HALO_REACH = 2.2;
/** The ring's opacity at the moment it leaves the dot. */
const HALO_OPACITY = 0.32;

function SeriesDot({
  cx,
  cy,
  radius,
  fill,
  progress,
  at,
}: {
  cx: number;
  cy: number;
  radius: number;
  fill: string;
  progress: SharedValue<number>;
  at: number;
}) {
  // `radius`, `at` and DOT_WINDOW are plain numbers closed over by the worklet —
  // nothing here calls back into JS (see `theme/color.ts` on `alpha` in worklets).
  const animated = useAnimatedProps(() => {
    const t = Math.min(Math.max((progress.value - at) / DOT_WINDOW, 0), 1);
    return { r: radius * t };
  });
  return <AnimatedCircle cx={cx} cy={cy} fill={fill} animatedProps={animated} />;
}

/**
 * THE LAST SESSION, ARRIVING (28 August 2026).
 *
 * The pen reaches the end of the record and the newest reading lands under it:
 * a dot on a spring, knocked out of the line by a `ground`-coloured stroke so
 * it reads as the head of the series rather than as one more vertex, and one
 * ring that leaves it and fades. The ring carries no information — it is the
 * full stop — so it is gone in ~600 ms and never comes back.
 *
 * REDUCE MOTION: the dot is at full size on mount and the ring never draws.
 */
function TerminalDot({
  cx,
  cy,
  radius,
  fill,
  ground,
  land,
  halo,
  ring: withRing = true,
}: {
  cx: number;
  cy: number;
  radius: number;
  fill: string;
  ground?: string;
  land: SharedValue<number>;
  halo: SharedValue<number>;
  /** The ring is the record's full stop. A chart whose series continues into a
   * planned tail has not stopped, so it draws the dot without one. */
  ring?: boolean;
}) {
  const dot = useAnimatedProps(() => ({ r: radius * Math.max(land.value, 0) }));
  // Plain numbers only inside the worklet: the ring's colour is `fill`, and its
  // fade rides `strokeOpacity` rather than an `alpha()` call (theme/color.ts).
  const ringProps = useAnimatedProps(() => ({
    r: radius * (1 + HALO_REACH * halo.value),
    strokeOpacity: HALO_OPACITY * (1 - halo.value),
  }));
  return (
    <>
      {withRing ? (
        <AnimatedCircle
          cx={cx}
          cy={cy}
          fill="none"
          stroke={fill}
          strokeWidth={1.5}
          animatedProps={ringProps}
        />
      ) : null}
      <AnimatedCircle
        cx={cx}
        cy={cy}
        fill={fill}
        stroke={ground}
        strokeWidth={ground ? 2 : 0}
        animatedProps={dot}
      />
    </>
  );
}

/** A wash and a reveal need one id each, unique per mounted chart: a screen of
 * six cards draws six of these at once and two `<Defs>` sharing an id is a coin
 * toss over which chart gets which gradient. */
let seriesSeq = 0;

export function MonotoneSeries({
  points,
  width,
  height,
  stroke,
  strokeWidth = 2,
  dotRadius = 3.5,
  /** The prescribed continuation, already projected into chart space. Drawn in
   * `plannedStroke`, dashed, after the record has finished drawing. */
  planned,
  plannedStroke,
  /**
   * The hue of the area under the line. Omit it and the chart is a bare stroke,
   * which is what it was before 28 August 2026; pass the stroke's own colour and
   * the record gains a body. The wash is the SHAPE of the record and never a
   * verdict on it, so it is always the line's own hue and never a direction.
   */
  wash,
  /** Opacity at the TOP of that wash. It always fades to nothing at the floor. */
  washOpacity = 0.2,
  /** The colour the chart SITS ON — it knocks the terminal dot out of its own
   * line, so the newest reading reads as a hole in the series rather than as a
   * mark floating over it. */
  ground,
  delay = 0,
  style,
}: {
  points: readonly Point[];
  width: number;
  height: number;
  stroke: string;
  strokeWidth?: number;
  dotRadius?: number;
  planned?: Point | null;
  plannedStroke?: string;
  wash?: string;
  washOpacity?: number;
  ground?: string;
  delay?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const reduced = useReducedMotion();
  const drawn = useSharedValue(reduced ? 1 : 0);
  const tail = useSharedValue(reduced ? 1 : 0);
  const land = useSharedValue(reduced ? 1 : 0);
  const halo = useSharedValue(1); // 1 = spent, so it is invisible until it fires
  const [ids] = useState(() => {
    seriesSeq += 1;
    return { wash: `seriesWash${seriesSeq}`, reveal: `seriesReveal${seriesSeq}` };
  });

  const { d, length, fractions } = useMemo(
    () => ({
      d: monotonePathD(points),
      length: pathUpperBound(points),
      fractions: pointFractions(points),
    }),
    [points],
  );

  const last = points.length > 0 ? points[points.length - 1]! : null;
  const plannedD =
    planned && last ? `M ${last.x} ${last.y} L ${planned.x} ${planned.y}` : '';
  const plannedLength = useMemo(
    () => (planned && last ? Math.max(Math.hypot(planned.x - last.x, planned.y - last.y), 1) : 1),
    [planned, last],
  );

  /** The wash closes the series' own path down to the floor, so a fill can never
   * disagree with the line sitting on top of it. */
  const areaD = useMemo(() => {
    if (!wash || points.length < 2 || !d) return '';
    const first = points[0]!;
    const end = points[points.length - 1]!;
    return `${d} L ${end.x} ${height} L ${first.x} ${height} Z`;
  }, [d, height, points, wash]);

  /**
   * THE WASH IS REVEALED BY THE PEN, not by a fade.
   *
   * A clip rectangle follows the stroke's own x, so the fill arrives under the
   * line exactly where the line already is. The rect's width cannot simply be
   * `width × progress`: progress is measured along the path's ARC, and a steep
   * segment is longer than a flat one, so a linear mapping would run the fill
   * ahead of the pen on the climbs. Interpolating the point fractions against
   * the points' own x undoes that — `interpolate` is a worklet, and both arrays
   * are plain numbers closed over by it.
   *
   * `interpolate` needs a strictly increasing input range, so coincident points
   * (two identical readings drawn at the same x) are dropped rather than left to
   * divide by zero.
   */
  const revealRange = useMemo(() => {
    const fs: number[] = [];
    const xs: number[] = [];
    points.forEach((p, i) => {
      const f = fractions[i] ?? i / Math.max(points.length - 1, 1);
      if (fs.length === 0 || f > fs[fs.length - 1]! + 1e-4) {
        fs.push(f);
        xs.push(p.x);
      }
    });
    return fs.length >= 2 ? { fs, xs } : null;
  }, [fractions, points]);

  /**
   * `d` IS IN THE DEPENDENCY LIST, and that is the whole behaviour.
   *
   * Without it the line draws once on mount and every later series change snaps
   * into place with no motion at all — which is exactly what happened when this
   * screen's exercise selector was first wired: tapping a different lift
   * silently swapped one static curve for another. The path string changes when
   * the data does, so keying the effect to it means **switching exercises
   * re-draws the chart**, and the redraw is the screen's answer to "what does
   * this lift look like?".
   */
  useEffect(() => {
    if (reduced) {
      drawn.value = 1;
      tail.value = 1;
      land.value = 1;
      halo.value = 1;
      return;
    }
    drawn.value = 0;
    tail.value = 0;
    land.value = 0;
    halo.value = 1;
    drawn.value = withDelay(delay, withTiming(1, { duration: DRAW_MS, easing: Easing.out(Easing.cubic) }));
    // The newest reading lands as the pen stops on it, and the ring leaves it.
    land.value = withDelay(delay + DRAW_MS, withSpring(1, arrive));
    halo.value = withDelay(
      delay + DRAW_MS,
      withTiming(1, { duration: HALO_MS, easing: Easing.out(Easing.cubic) }),
    );
    // The plan is drawn only once the record it continues is complete.
    tail.value = withDelay(delay + DRAW_MS, withSpring(1, arrive));
  }, [d, delay, drawn, halo, land, reduced, tail]);

  const lineProps = useAnimatedProps(() => ({
    strokeDashoffset: length * (1 - drawn.value),
  }));
  const tailProps = useAnimatedProps(() => ({
    strokeDashoffset: plannedLength * (1 - tail.value),
  }));
  const revealProps = useAnimatedProps(() => {
    if (!revealRange) return { width: width };
    return { width: Math.max(interpolate(drawn.value, revealRange.fs, revealRange.xs), 0.01) };
  });
  /**
   * The wash's own opacity ramps over the first fifth of the draw.
   *
   * With the clip working this is a soft entry and nothing more — the fill is
   * already only where the pen has been. It is also the honest fallback: if a
   * platform ever stops propagating an animated prop from inside `<ClipPath>`,
   * the record still gains its body instead of losing it entirely.
   */
  const washProps = useAnimatedProps(() => ({
    fillOpacity: Math.min(drawn.value * 5, 1),
  }));
  const fade = useAnimatedStyle(() => ({ opacity: reduced ? drawn.value : 1 }));

  if (points.length === 0) return null;

  return (
    <Animated.View style={[style, fade]} pointerEvents="none">
      <Svg width={width} height={height}>
        {areaD ? (
          <Defs>
            <LinearGradient id={ids.wash} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={wash} stopOpacity={washOpacity} />
              <Stop offset="1" stopColor={wash} stopOpacity={0.01} />
            </LinearGradient>
            <ClipPath id={ids.reveal}>
              {/* `width` is animated, but it is also declared: a clip whose
                  width arrived only from the animation would render as an empty
                  rect on frame one, which clips the wash away entirely. */}
              <AnimatedRect
                x={0}
                y={0}
                width={0.01}
                height={height}
                animatedProps={revealProps}
              />
            </ClipPath>
          </Defs>
        ) : null}
        {areaD ? (
          <AnimatedPath
            d={areaD}
            fill={`url(#${ids.wash})`}
            clipPath={`url(#${ids.reveal})`}
            animatedProps={washProps}
          />
        ) : null}
        <AnimatedPath
          d={d}
          fill="none"
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={length}
          animatedProps={lineProps}
        />
        {plannedD && plannedStroke ? (
          <AnimatedPath
            d={plannedD}
            fill="none"
            stroke={plannedStroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            // Dashed, and it stays dashed: the tail is a proposal, and it should
            // not be able to read as part of the solid record beside it.
            strokeDasharray={`${strokeWidth * 2},${strokeWidth * 2}`}
            animatedProps={tailProps}
          />
        ) : null}
        {points.slice(0, -1).map((p, i) => (
          <SeriesDot
            key={`${p.x}-${p.y}-${i}`}
            cx={p.x}
            cy={p.y}
            radius={dotRadius}
            fill={stroke}
            progress={drawn}
            at={fractions[i] ?? 1}
          />
        ))}
        {/* The record's head. When a plan continues past it, the plan's own dot
            is the arrival instead and this one stays a vertex. */}
        {last ? (
          <TerminalDot
            cx={last.x}
            cy={last.y}
            radius={dotRadius * (planned && plannedStroke ? 1 : 1.4)}
            fill={stroke}
            ground={planned && plannedStroke ? undefined : ground}
            land={land}
            halo={halo}
            ring={!(planned && plannedStroke)}
          />
        ) : null}
        {planned && plannedStroke ? (
          <SeriesDot
            cx={planned.x}
            cy={planned.y}
            radius={dotRadius}
            fill={plannedStroke}
            progress={tail}
            at={1 - DOT_WINDOW}
          />
        ) : null}
      </Svg>
    </Animated.View>
  );
}
