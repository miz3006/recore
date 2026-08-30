import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { track } from '@/lib/analytics';
import { matchKeyLift } from '@/lib/demo-parse';
import { Enter, EnterWhen, PressScale } from '@/lib/motion/index';
import { MAX_FONT_SCALE, moderateScale, spacing, type } from '@/lib/theme';
import { useV2 } from '@/state/onboarding-v2';

import { Frame } from '../Frame';
import { FALLBACK_START_KG, KEY_LIFTS, MAX_KEY_LIFTS, PLATE_OPTIONS, START_KG } from '../flow';
import { LiftLoadRow } from '../LiftLoadRow';
import { OptionRow } from '../OptionRow';
import { v2color, v2radius, v2shadow } from '../tokens';
import type { ScreenProps } from './types';

/**
 * SCREEN 13 — YOUR KEY LIFTS, AND WHAT YOU LIFT NOW.
 *
 * §2: "A heavy screen late in the funnel is fine when it visibly improves the
 * result — Gravl's equipment picker is the same bet." The bet is only paid if
 * the weight typed here comes straight back on screen 17, which it does.
 *
 * WHAT THE PERSON ALREADY TOLD US IS NOT ASKED AGAIN. If their demo line on
 * screen 5 named a lift in this list, it is pre-selected and pre-filled with
 * the load they wrote — `matchKeyLift` is the same matcher the shipping flow
 * uses. Eight screens later, the app remembering their own sentence is worth
 * more than the two taps it saves.
 */
export function LiftsScreen({ def, progress, onAdvance, onBack, echo }: ScreenProps) {
  const answers = useV2((s) => s.answers);
  const toggle = useV2((s) => s.toggle);
  const setLoad = useV2((s) => s.setLoad);
  const set = useV2((s) => s.set);
  const setPlate = (kg: number | null) => set('smallestPlateKg', kg);

  // Seed from the demo line, once, and only into empty state.
  useEffect(() => {
    if (answers.keyLifts.length > 0) return;
    const offered = KEY_LIFTS.map((l) => l.id);
    for (const entry of answers.demoEntries) {
      const matched = matchKeyLift(entry.exerciseName, offered);
      if (!matched) continue;
      toggle('keyLifts', matched, MAX_KEY_LIFTS);
      if (entry.weightKg != null) setLoad(matched, Math.round(entry.weightKg * 2) / 2);
    }
    // Intentionally runs on mount only: re-seeding after a manual deselect
    // would fight the person for control of their own screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const chosen = answers.keyLifts;

  const onToggle = (id: string) => {
    toggle('keyLifts', id, MAX_KEY_LIFTS);
    if (answers.liftLoads[id] === undefined) setLoad(id, START_KG[id] ?? FALLBACK_START_KG);
    track('onboarding_answer', { flow: 'v2', step: def.step, step_id: def.id, value: id });
  };

  return (
    <Frame
      headline={def.headline}
      subline={def.subline}
      progress={progress}
      echo={echo}
      onBack={onBack}
      cta={{ enabled: chosen.length > 0, onPress: onAdvance }}
      testID="v2-screen-lifts">
      <View>
        {KEY_LIFTS.map((lift, i) => (
          <Enter key={lift.id} index={i + 2}>
            <OptionRow
              label={lift.label}
              selected={chosen.includes(lift.id)}
              multi
              onPress={() => onToggle(lift.id)}
            />
          </Enter>
        ))}
      </View>

      <EnterWhen visible={chosen.length > 0} index={0} style={styles.loads}>
        <Text style={styles.label} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          WHAT YOU LIFT NOW
        </Text>
        {chosen.map((id) => {
          const lift = KEY_LIFTS.find((l) => l.id === id);
          if (!lift) return null;
          return (
            <LiftLoadRow
              key={id}
              label={lift.label}
              kg={answers.liftLoads[id] ?? START_KG[id] ?? FALLBACK_START_KG}
              onChange={(kg) => setLoad(id, kg)}
            />
          );
        })}

        {/* THE SMALLEST PLATE — asked here because screen 17's prescription is
            not loadable without it, and because the screen list is fixed at
            eighteen so it cannot have one of its own. Skippable by design. */}
        <View style={styles.plates}>
          <Text style={styles.label} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            SMALLEST PLATE IN YOUR GYM
          </Text>
          <View style={styles.plateRow}>
            {PLATE_OPTIONS.map((plate) => {
              const on = answers.smallestPlateKg === plate.kg;
              return (
                <PressScale
                  key={plate.id}
                  onPress={() => {
                    setPlate(on ? null : plate.kg);
                    track('onboarding_answer', {
                      flow: 'v2',
                      step: def.step,
                      step_id: 'smallest_plate',
                      value: on ? null : plate.id,
                    });
                  }}
                  haptic="selection"
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={`Smallest plate ${plate.label}`}
                  style={styles.platePress}>
                  <View style={[styles.plateChip, v2shadow, on && styles.plateChipOn]}>
                    <Text
                      style={[styles.plateLabel, on && styles.plateLabelOn]}
                      maxFontSizeMultiplier={MAX_FONT_SCALE}>
                      {plate.label}
                    </Text>
                  </View>
                </PressScale>
              );
            })}
          </View>
          <Text style={styles.plateNote} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            Not sure? Skip it — Recore will still give you a number, and you can add this later in
            You for a more exact record.
          </Text>
          {answers.smallestPlateKg !== null ? (
            <PressScale
              onPress={() => setPlate(null)}
              haptic="selection"
              accessibilityLabel="Clear smallest plate"
              style={styles.skipPress}>
              <Text style={styles.skip} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                Skip this
              </Text>
            </PressScale>
          ) : null}
        </View>
      </EnterWhen>
    </Frame>
  );
}

const styles = StyleSheet.create({
  loads: { marginTop: spacing.xxl },
  plates: { marginTop: spacing.xxl },
  plateRow: { flexDirection: 'row', gap: spacing.md },
  platePress: { flex: 1 },
  plateChip: {
    height: moderateScale(52),
    borderRadius: v2radius.card,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: v2color.border,
    backgroundColor: v2color.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plateChipOn: { backgroundColor: v2color.blue, borderColor: v2color.blue },
  plateLabel: { ...type.body, fontWeight: '600', color: v2color.ink },
  plateLabelOn: { color: v2color.onBlue },
  plateNote: { ...type.subhead, color: v2color.inkSecondary, marginTop: spacing.md },
  skipPress: { alignSelf: 'flex-start', marginTop: spacing.sm },
  skip: { ...type.subhead, color: v2color.blue, fontWeight: '600', paddingVertical: spacing.sm },
  label: {
    ...type.footnote,
    color: v2color.inkMuted,
    letterSpacing: 1.6,
    fontWeight: '600',
    marginBottom: spacing.md,
  },
});
