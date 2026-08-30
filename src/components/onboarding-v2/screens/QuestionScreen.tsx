import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { track } from '@/lib/analytics';
import { Enter, EnterWhen } from '@/lib/motion/index';
import { requestRecapNotificationPermission } from '@/lib/recap';
import { MAX_FONT_SCALE, spacing, type } from '@/lib/theme';
import { useV2 } from '@/state/onboarding-v2';

import { Frame } from '../Frame';
import { GhostRow } from '../GhostRow';
import { InfoBanner } from '../InfoBanner';
import { OptionRow } from '../OptionRow';
import { v2color } from '../tokens';
import type { ScreenProps } from './types';

/**
 * EVERY QUESTION SCREEN — 2, 3, 4, 9, 10, 11, 12 and 18.
 *
 * Eight of the eighteen screens are the same object with different words, and
 * building them eight times is how a flow ends up with eight slightly different
 * option rows. The differences that DO exist are declared in `flow.ts` as data:
 * the option list, whether it is single or multi, the cap, and screen 12's
 * inline banner.
 *
 * WHICH ANSWER A SCREEN WRITES is derived from its `id`, so adding a question
 * means adding an entry to `FLOW` and a field to the store — never a branch
 * here.
 *
 * OPT-OUTS COME OUT OF THE LIST. Any option declared `optOut` in `flow.ts`
 * renders below the list as a `GhostRow` instead of inside it as a peer. That
 * is what lets a screen's option list carry one complete semantic family — the
 * emoji rule is per-screen, and an opt-out is the one member no family can
 * honestly include. Selection, analytics and the CTA gate treat it as an
 * ordinary answer; only its position and its contrast differ.
 *
 * SINGLE-SELECT ADVANCES ON THE CTA, NOT ON THE TAP. Cal AI does the same on
 * every one of its 38 screens, and the reason is visible in its own choreography:
 * the Continue button waking up is the reward for answering, and a screen that
 * auto-advanced would throw that away and take the chance to change your mind
 * with it.
 */
export function QuestionScreen({ def, progress, onAdvance, onBack, echo }: ScreenProps) {
  const answers = useV2((s) => s.answers);
  const set = useV2((s) => s.set);
  const toggle = useV2((s) => s.toggle);
  const [denied, setDenied] = useState(false);
  const [asking, setAsking] = useState(false);

  const multi = def.kind === 'multi';
  const key = fieldFor(def.id);
  const chosen = multi ? (answers[key] as string[]) : ((answers[key] as string | null) ?? null);
  const isChosen = (id: string) => (multi ? (chosen as string[]).includes(id) : chosen === id);

  const onPick = useCallback(
    (id: string) => {
      if (multi) toggle(key as 'obstacles', id, def.max ?? 2);
      else set(key, id as never);
      track('onboarding_answer', { flow: 'v2', step: def.step, step_id: def.id, value: id });
      // Attribution has its own event because it is the one answer that changes
      // nothing in the product and exists only to be counted.
      if (def.id === 'attribution') track('onboarding_attribution', { flow: 'v2', value: id });
      if (def.id === 'recap') track('onboarding_notifications_choice', { flow: 'v2', value: id });
    },
    [def.id, def.max, def.step, key, multi, set, toggle],
  );

  const answered = multi ? (chosen as string[]).length > 0 : chosen !== null;

  /**
   * ASK iOS FOR REAL, on the way out of the screen that needs it.
   *
   * On Continue, not on the tap: the option tap is a preference and the ask is
   * a consequence, and putting the system dialog on top of a row someone just
   * touched makes the two look like the same event. Cal AI and Fitbod both put
   * it on the forward step.
   *
   * A denial is a valid outcome and never blocks — the flow advances either
   * way. What it does do is stop the screen quietly lying: the note below says
   * the recap cannot arrive, because a person who picked "Sunday evening" and
   * tapped Don't Allow is otherwise told nothing.
   *
   * It does NOT call `requestRecapInOnboarding`, which is v1's entry point and
   * also flips the real `recap_enabled` pref. This is a sandbox (§0) and may
   * not switch a real feature on. See FINDINGS §17 for the one part of this
   * that the sandbox genuinely cannot undo.
   */
  const advance = useCallback(async () => {
    const wantsRecap = def.requestsNotifications && chosen !== null && chosen !== 'never';
    if (wantsRecap && answers.notificationsGranted === null) {
      setAsking(true);
      const granted = await requestRecapNotificationPermission();
      setAsking(false);
      set('notificationsGranted', granted);
      if (!granted) {
        // Stay on the screen once, so the note is read rather than flashed.
        setDenied(true);
        return;
      }
    }
    onAdvance();
  }, [answers.notificationsGranted, chosen, def.requestsNotifications, onAdvance, set]);

  // Declared as data, split here. The list keeps source order; the opt-out
  // always lands last regardless of where it sits in `flow.ts`.
  const listed = (def.options ?? []).filter((o) => !o.optOut);
  const optOuts = (def.options ?? []).filter((o) => o.optOut);
  const firstIndex = def.banner ? 3 : 2;

  return (
    <Frame
      headline={def.headline}
      subline={def.subline}
      progress={progress}
      echo={echo}
      onBack={onBack}
      cta={{
        enabled: answered && !asking,
        onPress: () => void advance(),
        label: denied ? 'Continue anyway' : undefined,
      }}
      testID={`v2-screen-${def.id}`}>
      {def.banner ? (
        <Enter index={2}>
          <InfoBanner text={def.banner} />
        </Enter>
      ) : null}
      <View>
        {listed.map((option, i) => (
          <Enter key={option.id} index={i + firstIndex}>
            <OptionRow
              label={option.label}
              icon={option.icon}
              sub={option.sub}
              selected={isChosen(option.id)}
              multi={multi}
              onPress={() => onPick(option.id)}
            />
          </Enter>
        ))}
        {optOuts.map((option, i) => (
          <Enter key={option.id} index={listed.length + firstIndex + i}>
            <GhostRow
              label={option.label}
              sub={option.sub}
              selected={isChosen(option.id)}
              multi={multi}
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
  notice: { marginTop: spacing.lg },
  noticeText: { ...type.subhead, color: v2color.inkSecondary },
});

/** Screen id → store field. One map, so the screens stay data. */
function fieldFor(id: string): 'tracker' | 'obstacles' | 'attribution' | 'goal' | 'experience' | 'frequency' | 'split' | 'recap' {
  switch (id) {
    case 'tracker':
      return 'tracker';
    case 'obstacles':
      return 'obstacles';
    case 'attribution':
      return 'attribution';
    case 'goal':
      return 'goal';
    case 'experience':
      return 'experience';
    case 'frequency':
      return 'frequency';
    case 'split':
      return 'split';
    default:
      return 'recap';
  }
}
