import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { track } from '@/lib/analytics';
import { Enter, EnterWhen } from '@/lib/motion/index';
import { requestRecapNotificationPermission } from '@/lib/recap';
import { alpha, color, MAX_FONT_SCALE, spacing, type } from '@/lib/theme';
import { useV2 } from '@/state/onboarding-v2';

import { Frame } from '../Frame';
import { GhostRow } from '../GhostRow';
import { LockScreenDemo } from '../LockScreenDemo';
import { OptionRow } from '../OptionRow';
import { RiseIn } from '../RiseIn';
import { v2color } from '../tokens';
import type { ScreenProps } from './types';

/**
 * SCREEN 20 — WEEKLY RECAP. Rebuilt 16 September 2026 (owner's directive)
 * out of the generic question screen it shared with seven others.
 *
 * ## The message is SHOWN before it is asked for
 *
 * A drawn iPhone shows the lock screen with the recap notification sliding
 * in — the words built from their own answers (`LockScreenDemo`), which is
 * the §12.1 rule ("permission is asked in context, on a surface that has
 * just explained what the message is for") made literal. Every reference
 * priming screen that converts does exactly this: preview the message, then
 * ask.
 *
 * ## The ASK MOVED ONTO THE TAP (the directive's own words: "the choice …
 * immediately triggers the native iOS notification permission prompt")
 *
 * It sat on Continue before, on the argument that the tap is a preference
 * and the ask a consequence. The owner ruled the other way: answering
 * "Sunday evening" IS asking for the notification, and a person who just
 * said when it should land is at the peak of knowing why iOS is asking.
 * A denial never blocks — the note below tells the truth about the gap and
 * the flow advances anyway, with the intent kept (`notificationsGranted`
 * records what iOS said; the commit enables the recap only when it is true).
 *
 * The actual scheduling stays where it was: `commitV2Onboarding` writes the
 * day and hour, and the first Today open computes and schedules the real
 * notice from the record as it stands (`lib/recap.ts`).
 */
export function RecapScreen({ def, progress, onAdvance, onBack, echo }: ScreenProps) {
  const win = useWindowDimensions();
  const answers = useV2((s) => s.answers);
  const set = useV2((s) => s.set);
  const [denied, setDenied] = useState(false);
  const [asking, setAsking] = useState(false);

  const chosen = answers.recap;
  const perWeek = Number(answers.frequency);

  const onPick = useCallback(
    (id: string) => {
      set('recap', id);
      track('onboarding_answer', { flow: 'v2', step: def.step, step_id: def.id, value: id });
      track('onboarding_notifications_choice', { flow: 'v2', value: id });
      // THE REAL iOS ASK, on the same tap. Asked once ever (`lib/recap.ts`
      // honours `canAskAgain` and its own asked-flag), so re-picking a row
      // can never nag; a dev-run sandbox cannot un-ask iOS either way — see
      // FINDINGS §17, unchanged by this move.
      if (id !== 'never' && answers.notificationsGranted === null) {
        setAsking(true);
        void requestRecapNotificationPermission().then((granted) => {
          setAsking(false);
          set('notificationsGranted', granted);
          if (!granted) setDenied(true);
        });
      }
    },
    [answers.notificationsGranted, def.id, def.step, set],
  );

  const listed = (def.options ?? []).filter((o) => !o.optOut);
  const optOuts = (def.options ?? []).filter((o) => o.optOut);
  const phoneWidth = Math.min(win.width * 0.5, 200);
  const bandHeight = Math.min(Math.max(win.height * 0.3, 210), 300);

  return (
    <Frame
      headline={def.headline}
      subline={def.subline}
      progress={progress}
      echo={echo}
      onBack={onBack}
      cta={{
        enabled: chosen !== null && !asking,
        onPress: onAdvance,
        label: denied ? 'Continue anyway' : undefined,
      }}
      testID="v2-screen-recap">
      <RiseIn delay={120}>
        <View style={[styles.band, { height: bandHeight }]}>
          <LockScreenDemo
            width={phoneWidth}
            choice={chosen === 'never' ? null : chosen}
            perWeek={Number.isFinite(perWeek) && perWeek > 0 ? perWeek : null}
          />
          <LinearGradient
            colors={[alpha(color.canvas, 0), color.canvas]}
            style={styles.fade}
            pointerEvents="none"
          />
        </View>
      </RiseIn>

      <View>
        {listed.map((option, i) => (
          <Enter key={option.id} index={i + 3}>
            <OptionRow
              label={option.label}
              icon={option.icon}
              sub={option.sub}
              selected={chosen === option.id}
              multi={false}
              onPress={() => onPick(option.id)}
            />
          </Enter>
        ))}
        {optOuts.map((option, i) => (
          <Enter key={option.id} index={listed.length + 3 + i}>
            <GhostRow
              label={option.label}
              sub={option.sub}
              selected={chosen === option.id}
              multi={false}
              onPress={() => onPick(option.id)}
            />
          </Enter>
        ))}
      </View>

      <EnterWhen visible={denied} index={0} style={styles.notice}>
        <Text style={styles.noticeText} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          Notifications are off for Recore, so the weekly recap can&apos;t arrive. You can turn
          them on in Settings whenever you want — your answer is kept either way.
        </Text>
      </EnterWhen>
    </Frame>
  );
}

const styles = StyleSheet.create({
  band: {
    alignItems: 'center',
    overflow: 'hidden',
    marginBottom: spacing.xl,
  },
  fade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 56,
  },
  notice: { marginTop: spacing.lg },
  noticeText: { ...type.subhead, color: v2color.inkSecondary },
});
