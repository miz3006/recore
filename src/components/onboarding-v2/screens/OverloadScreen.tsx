import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { CountUp, DrawnLine, Enter, type Point } from '@/lib/motion/index';
import { MAX_FONT_SCALE, moderateScale, readingStyle, spacing, type } from '@/lib/theme';
import { useV2 } from '@/state/onboarding-v2';

import { Frame } from '../Frame';
import { kg, PROJECTION_WEEKS, projectionFor } from '../projection';
import { v2color, v2radius, v2shadow } from '../tokens';
import type { ScreenProps } from './types';

const CHART_HEIGHT = moderateScale(150);
const PAD = 10;

/**
 * SCREEN 14 — ZAKAJ PROGRESIVNA OBREMENITEV DELUJE.
 *
 * One chart, one sentence, and both are made of the numbers the person typed on
 * screen 13 (§2). Cal AI shows everybody the same rising curve captioned
 * "Based on Cal AI's historical data" (its screen 18); this one cannot show
 * anybody else's, because it is arithmetic on one lift and one load.
 *
 * The line draws left to right and the end dot lands last, on a spring (§3).
 * The end LOAD counts up — it is a result, not an input, so it earns the count
 * that the load on screen 13 deliberately did not get.
 *
 * WHAT IT IS CAREFUL NOT TO SAY. Every sentence on the screen is conditional
 * ("add X and in 12 weeks that is Y"), because the arithmetic is certain and
 * the training is not. No claim is made about the person's body, and no
 * percentage of anybody is cited.
 */
export function OverloadScreen({ def, progress, onAdvance, onBack, echo }: ScreenProps) {
  const answers = useV2((s) => s.answers);
  const [width, setWidth] = useState(0);
  const projection = useMemo(() => projectionFor(answers), [answers]);

  if (!projection) {
    // Nothing was picked on 13, so there is no honest chart to draw. Say the
    // rule in words rather than invent a lift to draw it for.
    return (
      <Frame
        headline={def.headline}
        progress={progress}
      echo={echo}
        onBack={onBack}
        centred
        cta={{ enabled: true, onPress: onAdvance }}
        testID="v2-screen-overload">
        <Enter index={2}>
          <Text style={styles.sentence} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            A small step you repeat beats a big one you don&apos;t. Recore works that step out
            from your own record, not from an average.
          </Text>
        </Enter>
      </Frame>
    );
  }

  const { series, startKg, endKg, incrementKg: step, everyNth, lift } = projection;
  const min = Math.min(...series);
  const max = Math.max(...series);
  const span = Math.max(max - min, 1);
  const innerWidth = Math.max(width - PAD * 2, 1);
  const points: Point[] = series.map((value, i) => ({
    x: PAD + (innerWidth * i) / (series.length - 1),
    y: PAD + (CHART_HEIGHT - PAD * 2) * (1 - (value - min) / span),
  }));

  return (
    <Frame
      headline={def.headline}
      progress={progress}
      echo={echo}
      onBack={onBack}
      cta={{ enabled: true, onPress: onAdvance }}
      testID="v2-screen-overload">
      <Enter index={2}>
        <View style={[styles.card, v2shadow]} onLayout={(e) => setWidth(e.nativeEvent.layout.width - spacing.xl * 2)}>
          <Text style={styles.cardLabel} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {lift.toUpperCase()} · {PROJECTION_WEEKS} WEEKS
          </Text>

          {width > 0 ? (
            <DrawnLine
              points={points}
              width={width}
              height={CHART_HEIGHT}
              stroke={v2color.blue}
              areaFill="rgba(0,122,255,0.08)"
              endDotFill={v2color.blue}
              endDotStroke={v2color.surface}
              delay={240}
              style={styles.chart}
            />
          ) : (
            <View style={[styles.chart, { height: CHART_HEIGHT }]} />
          )}

          <View style={styles.axis}>
            <View>
              <Text style={styles.axisLabel} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                today
              </Text>
              <Text style={styles.axisValue} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                {kg(startKg)} kg
              </Text>
            </View>
            <View style={styles.axisRight}>
              <Text style={styles.axisLabel} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                in {PROJECTION_WEEKS} weeks
              </Text>
              <View style={styles.endRow}>
                <CountUp
                  value={endKg}
                  decimals={Number.isInteger(endKg) ? 0 : 1}
                  delay={240 + 800}
                  style={[styles.axisValue, styles.endValue]}
                  accessibilityLabel={`${kg(endKg)} kilogramov`}
                />
                <Text style={styles.endUnit} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                  kg
                </Text>
              </View>
            </View>
          </View>
        </View>
      </Enter>

      <Enter index={3}>
        <Text style={styles.sentence} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          Add {kg(step)} kg every {everyNth === 1 ? 'session' : `${everyNth} sessions`} and in{' '}
          {PROJECTION_WEEKS} weeks that&apos;s {kg(endKg)} kg. No jumps — one step, repeated.
        </Text>
      </Enter>
    </Frame>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: v2color.surface,
    borderRadius: v2radius.hero,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: v2color.border,
    padding: spacing.xl,
  },
  cardLabel: {
    ...type.footnote,
    color: v2color.inkMuted,
    letterSpacing: 1.4,
    fontWeight: '600',
  },
  chart: { marginTop: spacing.md },
  axis: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: spacing.md,
  },
  axisRight: { alignItems: 'flex-end' },
  axisLabel: { ...type.caption, color: v2color.inkMuted },
  axisValue: { ...readingStyle('600'), fontSize: moderateScale(19), color: v2color.ink },
  endRow: { flexDirection: 'row', alignItems: 'baseline', gap: 3 },
  endValue: { color: v2color.blue },
  endUnit: { ...type.caption, color: v2color.blue, fontWeight: '600' },
  sentence: { ...type.body, color: v2color.ink, marginTop: spacing.xl },
});
