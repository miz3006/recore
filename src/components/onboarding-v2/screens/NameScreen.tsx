import { useCallback, useState } from 'react';
import { View } from 'react-native';

import { track } from '@/lib/analytics';
import { Enter } from '@/lib/motion/index';
import { useV2 } from '@/state/onboarding-v2';

import { Frame } from '../Frame';
import { V2TextField } from '../TextField';
import type { ScreenProps } from './types';

/**
 * SCREEN 7 — KAKO TI JE IME?
 *
 * Gravl asks at position 3 and pays it off at 4; this flow asks at 7 and pays
 * off at 8, for the same reason — a name is only worth taking if the very next
 * thing that happens is the app using it.
 *
 * THE NAME NEVER REACHES ANALYTICS. `analytics.ts` is explicit that a first
 * name may never go in an event, so the completion event carries a length and
 * nothing else.
 */
export function NameScreen({ def, progress, onAdvance, onBack, echo }: ScreenProps) {
  const stored = useV2((s) => s.answers.name);
  const set = useV2((s) => s.set);
  const [name, setName] = useState(stored);
  const [focused, setFocused] = useState(false);

  const advance = useCallback(() => {
    const clean = name.trim();
    set('name', clean);
    track('onboarding_answer', {
      flow: 'v2',
      step: def.step,
      step_id: def.id,
      // The name itself is never sent. Its length says the field was filled.
      value: null,
      length: clean.length,
    });
    onAdvance();
  }, [def.id, def.step, name, onAdvance, set]);

  return (
    <Frame
      headline={def.headline}
      subline={def.subline}
      progress={progress}
      echo={echo}
      onBack={onBack}
      scroll={false}
      avoidKeyboard
      cta={{ enabled: name.trim().length > 0, onPress: advance }}
      testID="v2-screen-name">
      <View>
        <Enter index={2}>
          <V2TextField
            value={name}
            focused={focused}
            onChangeText={setName}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onSubmitEditing={() => {
              if (name.trim().length > 0) advance();
            }}
            placeholder="Ime"
            autoCapitalize="words"
            autoCorrect={false}
            autoComplete="given-name"
            textContentType="givenName"
            returnKeyType="done"
            autoFocus
            accessibilityLabel="First name"
            testID="v2-name-field"
          />
        </Enter>
      </View>
    </Frame>
  );
}
