import { Enter } from '@/lib/motion/index';

import { Character } from '../Character';
import { Frame } from '../Frame';
import { SelfWritingLedger } from '../SelfWritingLedger';
import type { ScreenProps } from './types';

/**
 * SCREEN 1 — WELCOME.
 *
 * No question, no rail, and the CTA is awake from the first frame: there is
 * nothing to answer, so making someone earn the button here would be theatre.
 *
 * The character settles in (§4: "Settles in with a small spring") and then the
 * ledger writes itself. Two moving things, deliberately sequenced rather than
 * simultaneous — the character arrives first and is still by the time the
 * typing starts, so the eye is only ever asked to watch one of them.
 *
 * THE FOOTER LINK IS REAL SINCE 28 AUGUST 2026. "Auth last" is about where the
 * funnel ASKS for an account, not about making somebody who already has one
 * walk twenty screens to reach it — every reference funnel in §1 carries this
 * link on its first screen for the same reason. The route owns what it does; in
 * a development run it says it is off rather than pretending.
 */
export function WelcomeScreen({ def, onAdvance, onSignIn }: ScreenProps) {
  return (
    <Frame
      headline={def.headline}
      subline={def.subline}
      progress={null}
      cta={{ label: 'Start', enabled: true, onPress: onAdvance }}
      footerLink={{ label: 'I already have an account', onPress: onSignIn }}
      above={
        <Enter index={0}>
          <Character screen={def.id} />
        </Enter>
      }
      testID="v2-screen-welcome">
      <Enter index={2}>
        <SelfWritingLedger />
      </Enter>
    </Frame>
  );
}
