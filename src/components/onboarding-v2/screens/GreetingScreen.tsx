import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Enter } from '@/lib/motion/index';
import { MAX_FONT_SCALE, spacing, type } from '@/lib/theme';
import { useV2 } from '@/state/onboarding-v2';

import { Character } from '../Character';
import { v2color, v2metrics } from '../tokens';
import type { ScreenProps } from './types';

/** §2, screen 8: "1.5s, auto-advances." */
const DWELL_MS = 1500;

/**
 * SCREEN 8 — "HELLO, [NAME]."
 *
 * The character's own screen (§4), and the only one with no chrome at all: no
 * rail, no back button, no CTA. Gravl's equivalent (its position 4, "Welcome
 * Confirmation") is the same idea — a full-bleed beat that costs a second and
 * a half and buys the sense that something was received.
 *
 * There is no back button because there is nothing to go back FROM: it is not a
 * decision, and by the time a finger reached the corner it would be gone. The
 * navigator's swipe still works, which is the right level of escape hatch.
 *
 * The character arrives 140 ms after the name, so the name lands first and the
 * character reacts to it rather than sharing the frame with it.
 *
 * THE TIMER IS ARMED ON FOCUS, NOT ON MOUNT, and that is not a detail. A native
 * stack keeps the screens behind it mounted, so a mount-only timer fires once
 * and never again — swipe back onto this screen and you would be stranded on a
 * screen with no button, no back arrow and no way forward. On focus it simply
 * counts to a second and a half again, which is also the right behaviour: the
 * screen means the same thing the second time.
 */
export function GreetingScreen({ def, onAdvance }: ScreenProps) {
  const name = useV2((s) => s.answers.name);
  const insets = useSafeAreaInsets();

  useFocusEffect(
    useCallback(() => {
      const t = setTimeout(onAdvance, DWELL_MS);
      return () => clearTimeout(t);
    }, [onAdvance]),
  );

  return (
    <View
      style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}
      accessible
      accessibilityLabel={`${def.headline} ${name}`}
      testID="v2-screen-greeting">
      <Enter index={0} from={0}>
        <Text style={styles.hello} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {def.headline}
        </Text>
        <Text style={styles.name} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {name || 'there'}.
        </Text>
      </Enter>
      <Character screen={def.id} delay={140} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: v2color.canvas,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xxxl,
    paddingHorizontal: v2metrics.gutter,
  },
  hello: { ...type.largeTitle, fontWeight: '800', color: v2color.ink, textAlign: 'center' },
  name: { ...type.largeTitle, fontWeight: '800', color: v2color.blue, textAlign: 'center' },
});
