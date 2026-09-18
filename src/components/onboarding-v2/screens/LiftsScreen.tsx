import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { track } from '@/lib/analytics';
import { matchKeyLift } from '@/lib/demo-parse';
import { Enter, EnterWhen, PressScale } from '@/lib/motion/index';
import { MAX_FONT_SCALE, moderateScale, spacing, type } from '@/lib/theme';
import { useV2 } from '@/state/onboarding-v2';

import { Frame } from '../Frame';
import {
  DEFAULT_KEY_LIFTS,
  FALLBACK_START_KG,
  KEY_LIFTS,
  MAX_KEY_LIFTS,
  PLATE_OPTIONS,
  START_KG,
} from '../flow';
import { LiftLoadRow } from '../LiftLoadRow';
import { OptionRow } from '../OptionRow';
import { v2color, v2radius, v2shadow } from '../tokens';
import type { ScreenProps } from './types';

/**
 * SCREEN 15 — YOUR KEY LIFTS, AND WHAT YOU LIFT NOW.
 *
 * RESHAPED 16 September 2026 (owner): the screen no longer opens as a picker.
 * The big three stand on the sheet already, loads editable, because they are
 * the three almost everyone tracks and a screen that makes the common case
 * tap three rows first is a form pretending the answer is unknown. An "Add
 * lift" row beneath opens the same option rows as before — now for adding
 * the rarer barbell lifts or dropping a default that person does not train.
 * Only loaded lifts are offered (`KEY_LIFTS` lost pull-ups with the same
 * directive): every row here feeds the projection and the first-session
 * prescription, which are arithmetic on a bar.
 *
 * WHAT THE PERSON ALREADY TOLD US IS NOT ASKED AGAIN. If their demo line on
 * screen 6 named a lift in this list, its load arrives pre-filled with the
 * weight they wrote — `matchKeyLift` is the same matcher the shipping flow
 * uses. The defaults fill in around it, never over it.
 *
 * ## IT CAN BE DECLINED (owner, 17 September 2026)
 *
 * This is the heaviest screen in the flow and it is the one screen whose
 * answer a person may genuinely not have to hand — nobody remembers their
 * overhead press standing in a queue. So there is a skip under the button, and
 * it is a real skip: `keyLifts` is emptied, so the commit writes no lifts and
 * no loads, and every screen downstream already has an honest shape for that
 * (screen 16 states the rule in words instead of drawing a chart, the reveal
 * leaves the row out, the paywall drops its figure). The lifts are then added
 * in You, where they can be changed anyway.
 *
 * What the skip must NOT do is leave the seed behind. `liftsSkipped` is why
 * the flag exists: without it, stepping back one screen re-seeded the big
 * three and a Continue from there would have written 60/80/100 kg as the
 * person's own numbers.
 */
export function LiftsScreen({ def, progress, onAdvance, onBack, echo }: ScreenProps) {
  const answers = useV2((s) => s.answers);
  const toggle = useV2((s) => s.toggle);
  const setLoad = useV2((s) => s.setLoad);
  const set = useV2((s) => s.set);
  const setPlate = (kg: number | null) => set('smallestPlateKg', kg);
  const [picking, setPicking] = useState(false);

  // Seed once, into empty state only: the demo line first (their own words
  // beat any default), then the big three around whatever it claimed.
  useEffect(() => {
    if (answers.keyLifts.length > 0 || answers.liftsSkipped) return;
    const offered = KEY_LIFTS.map((l) => l.id);
    for (const entry of answers.demoEntries) {
      const matched = matchKeyLift(entry.exerciseName, offered);
      if (!matched) continue;
      toggle('keyLifts', matched, MAX_KEY_LIFTS);
      if (entry.weightKg != null) setLoad(matched, Math.round(entry.weightKg * 2) / 2);
    }
    for (const id of DEFAULT_KEY_LIFTS) {
      const state = useV2.getState().answers;
      if (state.keyLifts.includes(id) || state.keyLifts.length >= MAX_KEY_LIFTS) continue;
      toggle('keyLifts', id, MAX_KEY_LIFTS);
      if (state.liftLoads[id] === undefined) setLoad(id, START_KG[id] ?? FALLBACK_START_KG);
    }
    // Intentionally runs on mount only: re-seeding after a manual deselect
    // would fight the person for control of their own screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const chosen = answers.keyLifts;

  const onToggle = (id: string) => {
    toggle('keyLifts', id, MAX_KEY_LIFTS);
    // A lift back on the sheet is no longer a declined screen.
    if (answers.liftsSkipped) set('liftsSkipped', false);
    if (answers.liftLoads[id] === undefined) setLoad(id, START_KG[id] ?? FALLBACK_START_KG);
    track('onboarding_answer', { flow: 'v2', step: def.step, step_id: def.id, value: id });
  };

  /**
   * DECLINE THE SCREEN. The sheet is emptied rather than left seeded, because
   * the seed is the app's guess and the commit may only ever write the
   * person's own numbers. The loads themselves are kept: nothing downstream
   * reads a load for a lift that is not on the sheet, and a person who comes
   * back and re-adds bench press should find the number they typed.
   */
  const onSkip = () => {
    set('keyLifts', []);
    set('liftsSkipped', true);
    track('onboarding_answer', { flow: 'v2', step: def.step, step_id: 'lifts_skip', value: 'skip' });
    onAdvance();
  };

  // The rows keep the offered order, whatever order the taps came in — the
  // sheet reads as a session, and a session is not sorted by recency of tap.
  const listed = KEY_LIFTS.filter((l) => chosen.includes(l.id));

  return (
    <Frame
      headline={def.headline}
      subline={def.subline}
      progress={progress}
      echo={echo}
      onBack={onBack}
      // A SKIPPED SCREEN IS AN ANSWERED SCREEN. Stepping back onto one that
      // was declined used to find the button dead with an empty sheet under
      // it, which reads as a dead end rather than as a choice already made.
      cta={{ enabled: chosen.length > 0 || answers.liftsSkipped, onPress: onAdvance }}
      footerLink={{ label: "Skip — I'll add these later", onPress: onSkip }}
      testID="v2-screen-lifts">
      <View>
        <Enter index={2}>
          <Text style={styles.label} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            WHAT YOU LIFT NOW
          </Text>
        </Enter>
        {listed.map((lift, i) => (
          <Enter key={lift.id} index={i + 3}>
            <LiftLoadRow
              label={lift.label}
              kg={answers.liftLoads[lift.id] ?? START_KG[lift.id] ?? FALLBACK_START_KG}
              onChange={(kg) => setLoad(lift.id, kg)}
            />
          </Enter>
        ))}

        {/* THE DOOR TO THE REST OF THE LIST. One quiet row rather than five
            permanent ones: the common case never needs them, and the person
            who does gets the exact rows the screen always had. */}
        <Enter index={listed.length + 3}>
          <PressScale
            onPress={() => setPicking((p) => !p)}
            haptic="selection"
            accessibilityRole="button"
            accessibilityLabel={picking ? 'Done choosing lifts' : 'Add or remove lifts'}
            style={styles.addPress}>
            <View style={[styles.addRow, v2shadow]}>
              <Text style={styles.addGlyph} maxFontSizeMultiplier={1.2}>
                {picking ? '−' : '＋'}
              </Text>
              <Text style={styles.addLabel} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                {picking ? 'Done' : 'Add lift'}
              </Text>
            </View>
          </PressScale>
        </Enter>

        <EnterWhen visible={picking} index={0}>
          {picking ? (
            <View style={styles.pickList}>
              {KEY_LIFTS.map((lift) => (
                <OptionRow
                  key={lift.id}
                  label={lift.label}
                  selected={chosen.includes(lift.id)}
                  multi
                  onPress={() => onToggle(lift.id)}
                />
              ))}
            </View>
          ) : null}
        </EnterWhen>
      </View>

      <EnterWhen visible={chosen.length > 0} index={0} style={styles.plates}>
        {/* THE SMALLEST PLATE — asked here because screen 19's prescription is
            not loadable without it, and because the screen list is fixed at
            twenty so it cannot have one of its own. Skippable by design. */}
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
      </EnterWhen>
    </Frame>
  );
}

const styles = StyleSheet.create({
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
  addPress: {},
  /** The same surface as a load row, one step quieter: no bold, muted glyph.
   * It is a door, not a value. */
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: v2color.surface,
    borderRadius: v2radius.card,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: v2color.border,
    paddingHorizontal: spacing.lg,
    minHeight: moderateScale(56),
  },
  addGlyph: { ...type.body, fontWeight: '600', color: v2color.blue },
  addLabel: { ...type.body, fontWeight: '600', color: v2color.blue },
  pickList: { marginTop: spacing.md },
});
