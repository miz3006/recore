import { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';

import { track } from '@/lib/analytics';
import { Enter } from '@/lib/motion/index';
import { spacing } from '@/lib/theme';
import { useV2 } from '@/state/onboarding-v2';

import { Character } from '../Character';
import { Frame } from '../Frame';
import { HoldToCommit } from '../HoldToCommit';
import type { ScreenProps } from './types';

/** §2, screen 15, verbatim. */
const PLEDGE = "I'll log every session for the next 4 weeks.";

/**
 * SCREEN 15 — ZAVEZA.
 *
 * The CTA stays asleep until the ring closes, which makes the hold the only way
 * forward and the commitment a real gate rather than a decoration over a
 * Continue button.
 *
 * NO CHARACTER HERE, and that is the table's doing, not this file's. §4 marks
 * this screen "Yes — reacts as the hold completes", and also states as a hard
 * rule that the character may never appear on two consecutive screens. Screen
 * 16 is the flow's strongest placement (Cal AI's `Circular Mascot Ring` sits
 * exactly there), so `characters.ts` resolves the conflict in 16's favour and
 * `<Character step={15} />` returns null. The call stays in the tree so that
 * flipping one weight in that table puts it back.
 */
export function CommitScreen({ def, progress, onAdvance, onBack, echo }: ScreenProps) {
  const committed = useV2((s) => s.answers.committed);
  const set = useV2((s) => s.set);

  const onHeld = useCallback(() => {
    set('committed', true);
    track('onboarding_commit_held', { flow: 'v2', weeks: 4 });
  }, [set]);

  return (
    <Frame
      headline={def.headline}
      subline={def.subline}
      progress={progress}
      echo={echo}
      onBack={onBack}
      centred
      cta={{ enabled: committed, onPress: onAdvance, hint: 'Hold the circle first' }}
      testID="v2-screen-commit">
      <View style={styles.body}>
        <Enter index={2}>
          <HoldToCommit label={PLEDGE} done={committed} onDone={onHeld} />
        </Enter>
        <Character screen={def.id} />
      </View>
    </Frame>
  );
}

const styles = StyleSheet.create({
  body: { alignItems: 'center', gap: spacing.xxl, marginTop: spacing.md },
});
