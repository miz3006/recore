import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChecklistRow, Enter, SpringBar, TrackingNumber } from '@/lib/motion/index';
import { MAX_FONT_SCALE, moderateScale, readingStyle, spacing, type } from '@/lib/theme';
import { useV2 } from '@/state/onboarding-v2';

import { Character } from '../Character';
import { Check } from '../Check';
import { v2color, v2metrics } from '../tokens';
import type { ScreenProps } from './types';

/** §3: "2.5–3.5s total. Do not make it faster." Four steps, 720 ms apart, with
 * a beat before the first and a beat after the last. */
const FIRST_MS = 420;
const STEP_MS = 720;
const TAIL_MS = 620;

/**
 * SCREEN 16 — GRADIM TVOJ PLAN.
 *
 * §3: "The one screen that should feel like real work … this is where perceived
 * effort is manufactured."
 *
 * ## The percentage is not a lie, and that is the whole design
 *
 * Cal AI's counter runs on a timer with nothing behind it. This one is
 * `stage / 4` — it moves when a checklist row is actually marked done and at no
 * other time, so the number, the bar and the list are three views of one state
 * rather than three independent animations that happen to finish together. It
 * still takes three seconds, because the pause is the product being taken
 * seriously; it just cannot ever disagree with itself.
 *
 * ## Where the testimonial would have gone
 *
 * §2, screen 16: "Gravl puts a testimonial in this dead time — until there are
 * real reviews, put a factual line instead. Never invented reviews." Gravl's
 * own version of this screen (its position 27) carries "Trusted by 100,000+
 * users" over a quoted five-star review. The line below is a fact about how the
 * app works, it is true today, and it needs nobody's permission.
 *
 * Like screen 8, the schedule is armed ON FOCUS rather than on mount: a native
 * stack keeps this screen alive behind screen 17, and a mount-only timer would
 * strand anyone who swiped back onto a screen with no button on it. Coming back
 * replays the build from zero, which is the honest thing for a screen whose
 * whole subject is work being done.
 *
 * The character sits inside the rotating ring — Cal AI's `Circular Mascot Ring`
 * (its screen 27) sits exactly here, and `characters.ts` gives this screen the
 * highest weight in the flow for that reason.
 */
export function BuildingScreen({ def, onAdvance }: ScreenProps) {
  const insets = useSafeAreaInsets();
  const answers = useV2((s) => s.answers);
  const [stage, setStage] = useState(0);

  const steps = useMemo(
    () => [
      { label: 'Reading your line', delay: FIRST_MS },
      { label: 'Setting your step size', delay: FIRST_MS + STEP_MS },
      {
        label: answers.split === 'flat' ? 'Scheduling by lift' : 'Laying out your week',
        delay: FIRST_MS + STEP_MS * 2,
      },
      { label: 'Building your first session', delay: FIRST_MS + STEP_MS * 3 },
    ],
    [answers.split],
  );

  useFocusEffect(
    useCallback(() => {
      setStage(0);
      const timers = steps.map((step, i) => setTimeout(() => setStage(i + 1), step.delay));
      const finish = setTimeout(
        onAdvance,
        FIRST_MS + STEP_MS * (steps.length - 1) + TAIL_MS,
      );
      return () => {
        timers.forEach(clearTimeout);
        clearTimeout(finish);
      };
    }, [onAdvance, steps]),
  );

  const percent = Math.round((stage / steps.length) * 100);

  return (
    <View
      style={[styles.screen, { paddingTop: insets.top + spacing.huge, paddingBottom: insets.bottom }]}
      testID="v2-screen-building">
      <Enter index={0} from={0}>
        <Character screen={def.id} />
      </Enter>

      <View style={styles.head}>
        <Enter index={1}>
          <View style={styles.percentRow}>
            <TrackingNumber
              value={percent}
              suffix="%"
              style={styles.percent}
              accessibilityLabel={`${percent} odstotkov`}
            />
          </View>
        </Enter>
        <Enter index={2}>
          <Text style={styles.headline} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {def.headline}
          </Text>
        </Enter>
      </View>

      <Enter index={3} style={styles.barWrap}>
        <SpringBar
          progress={stage / steps.length}
          height={6}
          trackColor={v2color.track}
          fillColor={v2color.blue}
          accessibilityLabel="Build progress"
        />
      </Enter>

      <View style={styles.list}>
        {steps.map((step, i) => (
          <ChecklistRow
            key={step.label}
            label={step.label}
            delay={step.delay}
            style={styles.listRow}
            labelStyle={styles.listLabel}
            checkStyle={styles.checkBox}>
            <Check size={moderateScale(13)} color={v2color.onBlue} strokeWidth={2.6} />
          </ChecklistRow>
        ))}
      </View>

      <Enter index={5} extraDelay={600} style={styles.factWrap}>
        <Text style={styles.fact} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          All of this happens on your device. Recore works offline, and your record stays yours.
        </Text>
      </Enter>
    </View>
  );
}

const CHECK = moderateScale(24);

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: v2color.canvas,
    paddingHorizontal: v2metrics.gutter,
    alignItems: 'stretch',
  },
  head: { alignItems: 'center', marginTop: spacing.xxxl },
  percentRow: { alignItems: 'center' },
  percent: {
    ...readingStyle('700'),
    fontSize: moderateScale(56),
    lineHeight: moderateScale(64),
    color: v2color.ink,
    textAlign: 'center',
    minWidth: moderateScale(180),
  },
  headline: {
    ...type.largeTitle,
    fontWeight: '800',
    color: v2color.ink,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  barWrap: { marginTop: spacing.xxl },
  list: { marginTop: spacing.xxxl, gap: spacing.lg },
  listRow: { minHeight: moderateScale(28) },
  listLabel: { ...type.body, color: v2color.ink, flex: 1, paddingRight: spacing.md },
  checkBox: {
    width: CHECK,
    height: CHECK,
    borderRadius: CHECK / 2,
    backgroundColor: v2color.blue,
  },
  factWrap: { marginTop: 'auto', paddingBottom: spacing.xxl },
  fact: { ...type.subhead, color: v2color.inkSecondary, textAlign: 'center' },
});
