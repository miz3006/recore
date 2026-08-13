import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { Sparkline } from '@/components/charts';
import type { MovingRow, StandingRow } from '@/lib/next/sections';
import { fmtNumber } from '@/lib/parse/summarize';
import {
  color,
  hairline,
  lineFor,
  MAX_FONT_SCALE,
  moderateScale,
  radius,
  readingStyle,
  shadow,
  spacing,
  type,
} from '@/lib/theme';
import { eyebrow as eyebrowToken } from '@/lib/theme/typography';

import { SectionEyebrow } from './section';

/**
 * SIGNALS — what the lifts the coming session does not name are doing.
 *
 * ## Why one strip instead of two sections (13 Aug 2026)
 *
 * "Standing still" and "Moving" were two cards with the identical row shape —
 * name left, reading right, hairline between — differing only in the colour of
 * a header. Read at a glance that is one table split in half for editorial
 * reasons the reader cannot see, and it doubled the page's vertical cost for no
 * added meaning.
 *
 * They are one question: *which of my other lifts is doing something?* So they
 * are one strip of tiles, each tile stating its own state, and the state is the
 * tile's first line rather than a header three inches above it.
 *
 * The strip scrolls horizontally with the tile width set so the NEXT tile
 * always peeks past the edge — the affordance that tells a finger there is more
 * without a scrollbar or an arrow. Two tiles or fewer never overflow, so the
 * gesture is only ever offered when it leads somewhere.
 *
 * ## What each colour is allowed to mean
 *
 * `attention` amber names a plateau and nothing else; `trained` blue names
 * recorded progress, which is exactly what §4.2 permits it for, and it is the
 * sparkline's tint for the same reason. The READINGS stay ink on both — a
 * weight that has not moved is still just a weight, and a gain someone earned
 * is still just a number.
 *
 * A flat series returns no values from `sparkSeries` and the tile simply has no
 * line: drawing a shape onto data that has none is the chart telling a story
 * the record does not.
 */

/** Tile width as a share of the screen, so the next one always peeks. */
const TILE_RATIO = 0.42;
const TILE_MIN = moderateScale(150);
const TILE_MAX = moderateScale(190);
const SPARK_HEIGHT = moderateScale(26);

export function Signals({
  standing,
  moving,
}: {
  standing: StandingRow[];
  moving: MovingRow[];
}) {
  const { width } = useWindowDimensions();
  const tileWidth = Math.min(TILE_MAX, Math.max(TILE_MIN, Math.round(width * TILE_RATIO)));

  if (standing.length === 0 && moving.length === 0) return null;

  // Plateaus first: a lift that has stopped is the one that changes what the
  // athlete does next. Climbs are the good news and can wait one swipe.
  const tiles = [
    ...standing.map((row) => ({ kind: 'standing' as const, row })),
    ...moving.map((row) => ({ kind: 'moving' as const, row })),
  ];

  return (
    <View>
      <SectionEyebrow>Your other lifts</SectionEyebrow>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={tileWidth + spacing.md}
        snapToAlignment="start"
        // `stretch` rather than a fixed height: at Dynamic Type 1.5x a pinned
        // height clips the name, and every tile still ends up the height of the
        // tallest one, which is the only thing the row needed.
        contentContainerStyle={styles.strip}>
        {tiles.map(({ kind, row }) =>
          kind === 'standing' ? (
            <StandingTile key={`s:${row.key || row.name}`} row={row} width={tileWidth} />
          ) : (
            <MovingTile key={`m:${row.key || row.name}`} row={row} width={tileWidth} />
          ),
        )}
      </ScrollView>
    </View>
  );
}

function StandingTile({ row, width }: { row: StandingRow; width: number }) {
  const sessions = `${row.sessions} ${row.sessions === 1 ? 'session' : 'sessions'} at this weight`;
  return (
    <View
      style={[styles.tile, { width }]}
      accessible
      accessibilityLabel={`${row.name}, stuck. ${fmtNumber(row.weight)} kilograms, ${sessions}.`}>
      <Text style={[styles.state, styles.stateStuck]} maxFontSizeMultiplier={MAX_FONT_SCALE}>
        STUCK
      </Text>
      <Text style={styles.name} numberOfLines={2} maxFontSizeMultiplier={MAX_FONT_SCALE}>
        {row.name}
      </Text>
      <View style={styles.bottom}>
        <Text style={styles.reading} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {`${fmtNumber(row.weight)} kg`}
        </Text>
        <Text style={styles.sub} numberOfLines={2} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {row.deloadTo != null
            ? `${sessions} · backs off to ${fmtNumber(row.deloadTo)}`
            : sessions}
        </Text>
      </View>
    </View>
  );
}

function MovingTile({ row, width }: { row: MovingRow; width: number }) {
  // The reading is whatever `movingReading` handed over — a delta it could
  // stand behind, or the direction alone when it could not. This component
  // renders what it was given and never second-guesses it.
  const climbing = row.reading.kind === 'delta'
    ? !row.reading.text.startsWith('−')
    : row.reading.text !== 'falling';

  return (
    <View
      style={[styles.tile, { width }]}
      accessible
      accessibilityLabel={`${row.name}, ${climbing ? 'climbing' : 'falling'}. ${row.reading.text}, ${row.subtext}.`}>
      <Text style={[styles.state, styles.stateMoving]} maxFontSizeMultiplier={MAX_FONT_SCALE}>
        {climbing ? 'CLIMBING' : 'FALLING'}
      </Text>
      <Text style={styles.name} numberOfLines={2} maxFontSizeMultiplier={MAX_FONT_SCALE}>
        {row.name}
      </Text>
      {row.series.length > 0 ? (
        <View style={styles.spark} pointerEvents="none" accessibilityElementsHidden>
          <Sparkline
            values={row.series}
            width={width - spacing.lg * 2}
            height={SPARK_HEIGHT}
            tint={color.trained}
          />
        </View>
      ) : null}
      <View style={styles.bottom}>
        <Text style={styles.reading} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {row.reading.text}
        </Text>
        <Text style={styles.sub} numberOfLines={2} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {row.subtext}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    gap: spacing.md,
    alignItems: 'stretch',
    // The last tile clears the page's own gutter when it scrolls to the end.
    paddingRight: spacing.xs,
  },
  tile: {
    backgroundColor: color.surface,
    borderWidth: hairline,
    borderColor: color.divider,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    gap: spacing.sm,
    ...shadow.card,
  },
  state: {
    ...eyebrowToken,
    fontSize: moderateScale(9.5),
    letterSpacing: 1.3,
  },
  stateStuck: {
    color: color.attention,
  },
  stateMoving: {
    color: color.trained,
  },
  name: {
    ...type.subhead,
    fontWeight: '600',
    lineHeight: lineFor(20),
    color: color.textPrimary,
  },
  spark: {
    height: SPARK_HEIGHT,
    justifyContent: 'center',
  },
  // Pushed to the floor of the tile so every reading in the row sits on one
  // line, whatever the name above it did.
  bottom: {
    marginTop: 'auto',
    gap: 2,
  },
  reading: {
    ...readingStyle('700'),
    fontSize: moderateScale(20),
    letterSpacing: -0.3,
    color: color.textPrimary,
  },
  sub: {
    ...type.footnote,
    lineHeight: lineFor(15),
    color: color.textMuted,
  },
});
