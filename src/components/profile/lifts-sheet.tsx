import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { BottomSheet } from '@/components/bottom-sheet';
import {
  FALLBACK_START_KG,
  KEY_LIFTS,
  MAX_KEY_LIFTS,
  PLATE_OPTIONS,
  START_KG,
} from '@/components/onboarding-v2/flow';
import { LiftLoadRow } from '@/components/onboarding-v2/LiftLoadRow';
import { OptionRow } from '@/components/onboarding-v2/OptionRow';
import { AppButton, Eyebrow } from '@/components/primitives';
import { Segmented } from '@/components/settings-rows';
import { SheetGrabber } from '@/components/sheet-grabber';
import { getSmallestPlateKg, setSmallestPlateKg } from '@/lib/prefs';
import { getKeyLifts, getLiftLoads, setKeyLifts, setLiftLoad } from '@/lib/profile-answers';
import { color, MAX_FONT_SCALE, radius, spacing, type } from '@/lib/theme';

/**
 * KEY LIFTS, AFTER ONBOARDING — the flow's screen 15, as a sheet.
 *
 * It is the one "About you" answer that is not a single choice: up to three
 * lifts, a working load for each, and the smallest plate the gym stocks. So
 * unlike `AnswerSheet` it cannot close on a tap — a person is mid-edit until
 * they say otherwise, and it closes on Done.
 *
 * Every control below is the flow's own: `OptionRow` in multi mode for the
 * lifts, `LiftLoadRow` for the steppers, the same `START_KG` seeds. The one
 * substitution is the plate control — the flow draws three custom chips inside a
 * full-bleed screen, and inside a settings sheet the app's own `Segmented` is
 * the right object, because that is what every other "pick one of a few" value
 * on this surface already looks like.
 *
 * ## The smallest plate is here and not in Preferences
 *
 * `predict/data.ts` and `db/strip.ts` both round every prescribed load with it,
 * so it cannot simply be dropped when the old You screen's row goes. The flow
 * asks it on the LIFTS screen, for the reason `flow.ts` sets out at length: a
 * target of 82.5 kg is a fiction in a gym whose smallest plate is 2.5. Keeping
 * it next to the loads keeps that argument visible. `null` stays a first-class
 * answer — "Not sure" is an option, not an empty state.
 *
 * ## Writes land immediately
 *
 * There is no draft and no Cancel. Every tap and every stepper press writes
 * through, and Done only dismisses. A sheet with a Cancel implies a transaction,
 * and none of these five values is one — this is the same write-through contract
 * the rest of the app's settings already keep.
 */

/** `Segmented` needs a non-null id for every option; 0 is the "not sure" answer. */
const PLATE_SEG: { id: number; label: string }[] = [
  ...PLATE_OPTIONS.map((p) => ({ id: p.kg, label: p.label })),
  { id: 0, label: 'Not sure' },
];

export function LiftsSheet({
  visible,
  onClose,
  onChange,
}: {
  visible: boolean;
  onClose: () => void;
  /** The row above needs to re-read its label. */
  onChange: () => void;
}) {
  const [lifts, setLifts] = useState<string[]>([]);
  const [loads, setLoads] = useState<Record<string, number>>({});
  const [plate, setPlate] = useState<number | null>(null);

  // Re-read on every open: another surface may have changed the loads since.
  useEffect(() => {
    if (!visible) return;
    setLifts(getKeyLifts());
    setLoads(getLiftLoads());
    setPlate(getSmallestPlateKg());
  }, [visible]);

  const toggle = (id: string) => {
    // Oldest out at the cap, so the last tap always lands — the flow's own rule
    // (`state/onboarding-v2.ts`), and the alternative is a tap that does nothing.
    const next = lifts.includes(id)
      ? lifts.filter((l) => l !== id)
      : [...lifts, id].slice(-MAX_KEY_LIFTS);
    setLifts(next);
    setKeyLifts(next);
    if (next.includes(id) && loads[id] === undefined) {
      const seed = START_KG[id] ?? FALLBACK_START_KG;
      setLiftLoad(id, seed);
      setLoads((cur) => ({ ...cur, [id]: seed }));
    }
    onChange();
  };

  const changeLoad = (lift: string, kg: number) => {
    setLiftLoad(lift, kg);
    setLoads((cur) => ({ ...cur, [lift]: kg }));
  };

  const changePlate = (kg: number) => {
    const next = kg === 0 ? null : kg;
    setSmallestPlateKg(next);
    setPlate(next);
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} sheetStyle={styles.sheet}>
      <SheetGrabber />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        bounces={false}>
        <Text style={styles.headline} accessibilityRole="header" maxFontSizeMultiplier={MAX_FONT_SCALE}>
          Your key lifts
        </Text>
        <Text style={styles.subline} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {`Up to ${MAX_KEY_LIFTS}. Use today's working weight.`}
        </Text>

        <View style={styles.options}>
          {KEY_LIFTS.map((lift) => (
            <OptionRow
              key={lift.id}
              label={lift.label}
              selected={lifts.includes(lift.id)}
              multi
              onPress={() => toggle(lift.id)}
            />
          ))}
        </View>

        {lifts.length > 0 ? (
          <View style={styles.block}>
            <Eyebrow tone="secondary">What you lift now</Eyebrow>
            <View style={styles.loads}>
              {lifts.map((lift) => (
                <LiftLoadRow
                  key={lift}
                  label={lift}
                  kg={loads[lift] ?? START_KG[lift] ?? FALLBACK_START_KG}
                  onChange={(kg) => changeLoad(lift, kg)}
                />
              ))}
            </View>
          </View>
        ) : null}

        <View style={styles.block}>
          <Eyebrow tone="secondary">Smallest plate in your gym</Eyebrow>
          <View style={styles.plates}>
            <Segmented options={PLATE_SEG} selected={plate ?? 0} onSelect={changePlate} reading />
          </View>
          <Text style={styles.note} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            Recore rounds every suggested load to something you can actually rack. Not sure is fine
            — the number still comes, it is just less exact.
          </Text>
        </View>

        <AppButton label="Done" variant="secondary" compact onPress={onClose} style={styles.done} />
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: color.surface,
    borderRadius: radius.xl,
    borderCurve: 'continuous',
    paddingBottom: spacing.lg,
    maxHeight: '88%',
  },
  content: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
  },
  headline: {
    ...type.title2,
    color: color.textPrimary,
  },
  subline: {
    ...type.subhead,
    color: color.textSecondary,
    marginTop: spacing.xs,
  },
  options: {
    marginTop: spacing.xl,
  },
  block: {
    marginTop: spacing.lg,
  },
  loads: {
    marginTop: spacing.sm,
  },
  plates: {
    marginTop: spacing.sm,
  },
  note: {
    ...type.footnote,
    color: color.textMuted,
    marginTop: spacing.sm,
  },
  done: {
    marginTop: spacing.xl,
  },
});
