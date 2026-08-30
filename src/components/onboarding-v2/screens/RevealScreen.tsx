import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { CountUp, Enter, PressScale } from '@/lib/motion/index';
import { MAX_FONT_SCALE, moderateScale, readingStyle, spacing, type } from '@/lib/theme';
import { useV2 } from '@/state/onboarding-v2';

import { Frame } from '../Frame';
import { kg, PROJECTION_WEEKS, projectionFor, firstSessionTargets } from '../projection';
import { v2color, v2radius, v2shadow } from '../tokens';
import type { ScreenProps } from './types';

const STEP_KG = 2.5;

/**
 * SCREEN 19 — YOUR FIRST SESSION. The reveal.
 *
 * §2: "Not the 12-week projection. Concrete targets, editable … Both reference
 * apps give a number you use today rather than a promise about three months
 * out."
 *
 * ## REBUILT 28 August 2026 — the owner could not tell what it was
 *
 * The first version drew each lift as its own large block with its own steppers
 * and its own "+2.5 kg on what you entered" line. Three problems, and they
 * compounded:
 *
 *   1. **It did not look like a session.** A session is one thing containing
 *      several lifts; three stacked blocks read as three unrelated settings.
 *   2. **The rule was stated three times.** "Plus your step" is one rule about
 *      the whole screen, and repeating it per row turned the explanation into
 *      noise you stop reading by the second one.
 *   3. **The steppers dominated.** Big touchable controls beside every number
 *      make a screen look like a form to fill in, not a plan to read.
 *
 * It is now one card that IS the session: a header naming what it is, one line
 * per lift, a footer that counts the work, and the rule said once underneath.
 * The steppers are still there — §2 requires the targets to be editable — but
 * they are secondary, at the end of their row, sized like an accessory.
 *
 * ## Why the loads are green
 *
 * They are PLANNED values — a load prescribed and not yet lifted — and green is
 * reserved in this app for exactly that (recore-design §Colour; CLAUDE.md §3).
 * The contract is that it never appears without its label and its reason, so
 * the card says both, once, directly under the loads it applies to.
 */
export function RevealScreen({ def, progress, onAdvance, onBack, echo }: ScreenProps) {
  const answers = useV2((s) => s.answers);
  const setLoad = useV2((s) => s.setLoad);

  const targets = useMemo(() => firstSessionTargets(answers), [answers]);
  const projection = useMemo(() => projectionFor(answers), [answers]);

  const totalSets = targets.reduce((sum, t) => sum + t.sets, 0);
  const step = targets[0]?.addedKg ?? STEP_KG;
  const platesKnown = targets[0]?.platesKnown ?? false;
  const anyRounded = targets.some((t) => t.rounded);

  return (
    <Frame
      headline={def.headline}
      subline={def.subline}
      progress={progress}
      echo={echo}
      onBack={onBack}
      cta={{ label: 'This is my plan', enabled: true, onPress: onAdvance }}
      testID="v2-screen-reveal">
      <Enter index={2}>
        <View style={[styles.card, v2shadow]}>
          {/* What this session IS. Without it the numbers are settings. */}
          <View style={styles.head}>
            <Text style={styles.kicker} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              {sessionName(answers.split)}
            </Text>
            <Text style={styles.count} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              {targets.length} {targets.length === 1 ? 'lift' : 'lifts'} · {totalSets} sets
            </Text>
          </View>

          <View style={styles.rule} />

          {targets.map((target, i) => (
            <View key={target.lift} style={styles.row}>
              <Text
                style={styles.lift}
                maxFontSizeMultiplier={MAX_FONT_SCALE}
                numberOfLines={1}>
                {target.lift}
              </Text>

              <View style={styles.value}>
                <CountUp
                  value={target.targetKg}
                  decimals={Number.isInteger(target.targetKg) ? 0 : 1}
                  delay={200 + i * 90}
                  style={styles.load}
                  accessibilityLabel={`${kg(target.targetKg)} kilograms, planned`}
                />
                <Text style={styles.unit} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                  kg
                </Text>
                <Text style={styles.sets} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                  × {target.sets}
                </Text>
              </View>

              <View style={styles.steppers}>
                <Stepper
                  glyph="−"
                  label={`Decrease ${target.lift}`}
                  disabled={target.currentKg <= STEP_KG}
                  onPress={() =>
                    setLoad(target.lift, Math.max(STEP_KG, target.currentKg - STEP_KG))
                  }
                />
                <Stepper
                  glyph="+"
                  label={`Increase ${target.lift}`}
                  disabled={target.currentKg >= 400}
                  onPress={() => setLoad(target.lift, Math.min(400, target.currentKg + STEP_KG))}
                />
              </View>
            </View>
          ))}

          <View style={styles.rule} />

          {/* The rule, once. Green never appears without its label and reason. */}
          <Text style={styles.reason} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            Green is what Recore is asking for — each one is the load you entered plus your{' '}
            {kg(step)} kg step
            {anyRounded ? ', rounded to the plates you have' : ''}.
          </Text>
        </View>
      </Enter>

      {!platesKnown && targets.length > 0 ? (
        <Enter index={3} style={styles.note}>
          <Text style={styles.noteText} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            These assume you can load any weight. Tell Recore your smallest plate and it will only
            ever ask for numbers you can actually build.
          </Text>
        </Enter>
      ) : null}

      {projection ? (
        <Enter index={4} style={styles.projection}>
          <Text style={styles.projectionLabel} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            IF THIS REPEATS
          </Text>
          <Text style={styles.projectionLine} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {projection.lift} in {PROJECTION_WEEKS} weeks: {kg(projection.endKg)} kg
          </Text>
        </Enter>
      ) : null}
    </Frame>
  );
}

/**
 * What to call the session. The split answer already decided how Recore groups
 * lifts, so this is that decision said out loud rather than a new one — and it
 * is the missing piece that turns a list of numbers into a session.
 */
function sessionName(split: string | null): string {
  switch (split) {
    case 'ppl':
      return 'PUSH — YOUR FIRST SESSION';
    case 'upperlower':
      return 'UPPER — YOUR FIRST SESSION';
    case 'fullbody':
      return 'FULL BODY — YOUR FIRST SESSION';
    case 'bro':
      return 'CHEST — YOUR FIRST SESSION';
    default:
      return 'YOUR FIRST SESSION';
  }
}

function Stepper({
  glyph,
  label,
  disabled,
  onPress,
}: {
  glyph: string;
  label: string;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <PressScale onPress={onPress} disabled={disabled} haptic="selection" accessibilityLabel={label}>
      <View style={[styles.step, disabled && styles.stepDisabled]}>
        <Text style={styles.stepGlyph} maxFontSizeMultiplier={1.2}>
          {glyph}
        </Text>
      </View>
    </PressScale>
  );
}

const BUTTON = moderateScale(28);

const styles = StyleSheet.create({
  card: {
    backgroundColor: v2color.surface,
    borderRadius: v2radius.hero,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: v2color.border,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
  },
  head: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: spacing.md },
  kicker: {
    ...type.footnote,
    color: v2color.inkMuted,
    letterSpacing: 1.4,
    fontWeight: '600',
    flexShrink: 1,
  },
  count: { ...type.footnote, color: v2color.inkMuted },
  rule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: v2color.border,
    marginVertical: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  lift: { ...type.body, fontWeight: '600', color: v2color.ink, flex: 1 },
  value: { flexDirection: 'row', alignItems: 'baseline', gap: 3 },
  /** PLANNED green — a load prescribed and not yet lifted, never "success". */
  load: {
    ...readingStyle('700'),
    fontSize: moderateScale(20),
    color: v2color.planned,
  },
  unit: { ...type.caption, color: v2color.planned, fontWeight: '600' },
  sets: { ...type.subhead, color: v2color.inkSecondary, marginLeft: spacing.xs },
  steppers: { flexDirection: 'row', gap: spacing.xs },
  step: {
    width: BUTTON,
    height: BUTTON,
    borderRadius: BUTTON / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(23,25,20,0.05)',
  },
  stepDisabled: { opacity: 0.3 },
  stepGlyph: { ...type.subhead, fontWeight: '600', color: v2color.ink },
  reason: { ...type.caption, color: v2color.inkSecondary },
  note: { marginTop: spacing.md },
  noteText: { ...type.subhead, color: v2color.inkSecondary },
  projection: { marginTop: spacing.xl },
  projectionLabel: {
    ...type.footnote,
    color: v2color.inkMuted,
    letterSpacing: 1.6,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  projectionLine: { ...type.subhead, color: v2color.inkSecondary },
});
