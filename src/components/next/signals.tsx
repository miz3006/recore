import { StyleSheet, Text, View } from 'react-native';

import { Sparkline } from '@/components/charts';
import { PressableScale } from '@/components/motion';
import { Eyebrow } from '@/components/primitives';
import type { MovingRow, StandingRow } from '@/lib/next/sections';
import { fmtNumber } from '@/lib/parse/summarize';
import {
  color,
  MAX_FONT_SCALE,
  moderateScale,
  radius,
  readingStyle,
  spacing,
  type,
} from '@/lib/theme';
import { eyebrow as eyebrowToken } from '@/lib/theme/typography';

/**
 * YOUR OTHER LIFTS — what the lifts the coming session does not name are doing.
 *
 * ## Why a list and not a strip of tiles (18 August 2026)
 *
 * The 13 August build made this a horizontally-scrolling strip of cards, with
 * the tile width set so the next one always peeked past the edge. It was a
 * pretty control and it cost the page two things it could not afford:
 *
 * 1. **Content behind a gesture.** With four movers, two of them were off the
 *    right edge of a screen whose every other block is read by scrolling DOWN.
 *    A lift that has stalled is precisely the thing you must not make someone
 *    swipe to discover.
 * 2. **A third card idiom.** The page already had raised cards; the strip added
 *    small tiles with their own padding, their own radius and their own
 *    internal layout. Progression answers the identical question — *"which of
 *    my other lifts is doing something?"* — with the block it gives lifts too
 *    shallow to chart: an eyebrow with a COUNT, plain hairline rows, and one
 *    closing line. That block is now this one, to the token.
 *
 * Every row opens that lift's full history, which is the only thing a reader
 * can usefully do about a signal — and the same tap the cards above it take.
 *
 * ## What each colour is allowed to mean
 *
 * `attention` amber names a plateau and nothing else; `trained` blue names
 * recorded progress, which is exactly what §4.2 permits it for, and it is the
 * sparkline's tint for the same reason. The READINGS stay ink on both — a
 * weight that has not moved is still just a weight, and a gain someone earned
 * is still just a number. The state is a WORD before it is a hue (§14).
 *
 * A flat series returns no values from `sparkSeries` and the row simply has no
 * line: drawing a shape onto data that has none is the chart telling a story
 * the record does not.
 */

const SPARK_W = moderateScale(52);
const SPARK_H = moderateScale(22);
/** Progression's own press bleed, so a row lights up identically on both tabs. */
const PRESS_BLEED = spacing.sm;

export function Signals({
  standing,
  moving,
  onOpen,
}: {
  standing: StandingRow[];
  moving: MovingRow[];
  onOpen: (canonical: string) => void;
}) {
  const count = standing.length + moving.length;
  if (count === 0) return null;

  return (
    <View style={styles.block}>
      <Eyebrow>{`Your other lifts · ${count}`}</Eyebrow>

      {/* Plateaus first: a lift that has stopped is the one that changes what
          the athlete does next. Climbs are the good news and can wait. */}
      {standing.map((row) => (
        <StandingSignal key={`s:${row.key || row.name}`} row={row} onPress={() => onOpen(row.name)} />
      ))}
      {moving.map((row) => (
        <MovingSignal key={`m:${row.key || row.name}`} row={row} onPress={() => onOpen(row.name)} />
      ))}

      <Text style={styles.note} maxFontSizeMultiplier={MAX_FONT_SCALE}>
        These are the lifts your next session does not name.
      </Text>
    </View>
  );
}

function StandingSignal({ row, onPress }: { row: StandingRow; onPress: () => void }) {
  const sessions = `${row.sessions} ${row.sessions === 1 ? 'session' : 'sessions'} at this weight`;
  const sub = row.deloadTo != null ? `${sessions} · backs off to ${fmtNumber(row.deloadTo)}` : sessions;

  return (
    <SignalRow
      name={row.name}
      sub={sub}
      state="STUCK"
      stateStyle={styles.stateStuck}
      reading={`${fmtNumber(row.weight)} kg`}
      spoken={`${row.name}, stuck. ${fmtNumber(row.weight)} kilograms, ${sessions}.`}
      onPress={onPress}
    />
  );
}

function MovingSignal({ row, onPress }: { row: MovingRow; onPress: () => void }) {
  // The reading is whatever `movingReading` handed over — a delta it could
  // stand behind, or the direction alone when it could not. This component
  // renders what it was given and never second-guesses it.
  const climbing =
    row.reading.kind === 'delta'
      ? !row.reading.text.startsWith('−')
      : row.reading.text !== 'falling';

  return (
    <SignalRow
      name={row.name}
      sub={row.subtext}
      state={climbing ? 'CLIMBING' : 'FALLING'}
      stateStyle={styles.stateMoving}
      reading={row.reading.text}
      series={row.series}
      spoken={`${row.name}, ${climbing ? 'climbing' : 'falling'}. ${row.reading.text}, ${row.subtext}.`}
      onPress={onPress}
    />
  );
}

/** One row, two lines: the lift and its supporting fact on the left, its state
 * and its reading on the right, with the line of the record between them. */
function SignalRow({
  name,
  sub,
  state,
  stateStyle,
  reading,
  series,
  spoken,
  onPress,
}: {
  name: string;
  sub: string;
  state: string;
  stateStyle: object;
  reading: string;
  series?: number[];
  spoken: string;
  onPress: () => void;
}) {
  return (
    <PressableScale
      haptic="none"
      activeScale={0.98}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={spoken}
      accessibilityHint="Opens this lift's full history"
      style={styles.row}>
      <View style={styles.rowName}>
        <Text style={styles.name} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {name}
        </Text>
        <Text style={styles.sub} numberOfLines={2} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {sub}
        </Text>
      </View>

      {series && series.length > 0 ? (
        <View style={styles.spark} pointerEvents="none" accessibilityElementsHidden>
          <Sparkline values={series} width={SPARK_W} height={SPARK_H} tint={color.trained} />
        </View>
      ) : null}

      <View style={styles.rowReading}>
        <Text style={[styles.state, stateStyle]} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {state}
        </Text>
        <Text style={styles.reading} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {reading}
        </Text>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  // Progression's "not enough sessions yet" block, to the token.
  block: {
    gap: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    minHeight: moderateScale(52),
    paddingVertical: spacing.sm,
    marginHorizontal: -PRESS_BLEED,
    paddingHorizontal: PRESS_BLEED,
    borderRadius: radius.sm,
    borderCurve: 'continuous',
    borderBottomWidth: 1,
    borderBottomColor: color.tableRule,
  },
  rowName: {
    flexShrink: 1,
    flexGrow: 1,
    gap: 2,
  },
  name: {
    ...type.subhead,
    fontWeight: '600',
    color: color.textPrimary,
  },
  sub: {
    ...type.footnote,
    color: color.textMuted,
  },
  spark: {
    width: SPARK_W,
    height: SPARK_H,
    justifyContent: 'center',
    flexShrink: 0,
  },
  rowReading: {
    alignItems: 'flex-end',
    flexShrink: 0,
    gap: 1,
  },
  state: {
    ...eyebrowToken,
    fontSize: moderateScale(9),
    letterSpacing: 1.3,
  },
  stateStuck: {
    color: color.attention,
  },
  stateMoving: {
    color: color.trained,
  },
  reading: {
    ...readingStyle('700'),
    fontSize: moderateScale(17),
    letterSpacing: -0.3,
    color: color.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  note: {
    ...type.caption,
    marginTop: spacing.xs,
    color: color.textMuted,
  },
});
