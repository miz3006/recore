import { useMemo } from 'react';

import { DEMO_EXAMPLE } from '@/lib/demo-parse';
import { Enter } from '@/lib/motion/index';
import { useV2 } from '@/state/onboarding-v2';

import { Frame } from '../Frame';
import { LiveLedger } from '../LiveLedger';
import type { ScreenProps } from './types';

/**
 * SCREEN 6 — HERE'S THE READ.
 *
 * §2: "No question. The parsed table from screen 5 + 'Your words stay exactly
 * as you wrote them.'"
 *
 * The subline is not a slogan; it is the app's contract (CLAUDE.md §3, "Raw
 * workout text is the source of truth") shown being kept. The card above it
 * prints the person's own line unaltered with the reading underneath, which is
 * the only proof that sentence can have.
 *
 * If somebody skipped screen 5 without typing anything, this falls back to the
 * canned example — clearly the app's line, never stored as theirs.
 */
export function ReadingScreen({ def, progress, onAdvance, onBack, echo }: ScreenProps) {
  const answers = useV2((s) => s.answers);

  // Their own line if the demo read it; the canned example only if they got
  // here without one. Never the app's line stored as theirs.
  const rawText = useMemo(
    () =>
      answers.demoText.trim().length > 0 && answers.demoEntries.length > 0
        ? answers.demoText
        : DEMO_EXAMPLE,
    [answers.demoEntries.length, answers.demoText],
  );

  return (
    <Frame
      headline={def.headline}
      subline={def.subline}
      progress={progress}
      echo={echo}
      onBack={onBack}
      cta={{ enabled: true, onPress: onAdvance }}
      testID="v2-screen-reading">
      <Enter index={2}>
        {/* Same component as the demo screen, and therefore the same component
            as Today. The rows do not re-stagger here — the parse was watched
            once already and replaying it would make the reading look like it
            was being decided again. */}
        <LiveLedger text={rawText} stagger={false} />
      </Enter>
    </Frame>
  );
}
