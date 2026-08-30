import { Image } from 'expo-image';
import { useEffect } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { character as characterSpring, REDUCED_FADE_MS } from '@/lib/motion/index';
import { moderateScale } from '@/lib/theme';

import { ART } from './character-art';
import { characterFor } from './characters';
import { v2color, v2metrics } from './tokens';

/**
 * THE CAP CHARACTER, wherever the table in `characters.ts` says it belongs.
 *
 * A screen renders `<Character screen={def.id} />` unconditionally and this
 * returns null when the table says no — §4 wants the rule in one file, so no screen may
 * ask the question itself.
 *
 * ONE ENTRANCE, EVERYWHERE (§4): "scale from 0.9 + fade, on a spring — so it
 * reads as the same character arriving, not a different asset loading." Every
 * placement below shares it; only the size and the frame around it change.
 */
export function Character({
  screen,
  /** Extra ms before it arrives — the greeting waits for the name to resolve. */
  delay = 0,
}: {
  /** The screen's stable id, never its position. See `characters.ts`. */
  screen: string;
  delay?: number;
}) {
  const reduced = useReducedMotion();
  const { height: windowHeight } = useWindowDimensions();
  const arrival = useSharedValue(0);
  const spin = useSharedValue(0);
  const decl = characterFor(screen);

  useEffect(() => {
    if (!decl) return;
    arrival.value = withDelay(
      delay,
      reduced ? withTiming(1, { duration: REDUCED_FADE_MS }) : withSpring(1, characterSpring),
    );
  }, [arrival, decl, delay, reduced]);

  useEffect(() => {
    if (!decl || decl.placement !== 'ring' || reduced) return;
    // Cal AI's `Circular Mascot Ring` (its screen 27) sits exactly here. The
    // rotation is LINEAR and it is the one linear curve in a flow that §3 says
    // is springs throughout — a loop with easing pulses, and a pulsing ring
    // reads as a heartbeat rather than as work being done. Reduce Motion gets
    // the ring, static.
    spin.value = withRepeat(withTiming(1, { duration: 9000, easing: Easing.linear }), -1, false);
  }, [decl, reduced, spin]);

  const entrance = useAnimatedStyle(() => ({
    opacity: arrival.value,
    transform: [{ scale: 0.9 + arrival.value * 0.1 }],
  }));
  const rotation = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spin.value * 360}deg` }],
  }));

  if (!decl) return null;

  /**
   * THE HEIGHT IS THE CHARACTER'S HEIGHT (owner, 28 August 2026).
   *
   * The drawings are trimmed to the ink now (`character-art.ts`), so this is no
   * longer a box that a mostly-empty square is fitted into — it is how tall the
   * character stands. Hence the bigger numbers: the same 200 pt box used to
   * hold a drawing with three-quarters air around it.
   *
   * The hero is capped against the WINDOW as well, because a fixed 248 pt on a
   * 4.7" screen leaves nothing for the headline it is standing above. Scaled
   * type and a small phone are the same problem, and `moderateScale` only knows
   * about one of them.
   */
  const drawing = ART[decl.art];
  const height =
    decl.placement === 'hero'
      ? Math.min(v2metrics.characterSize, windowHeight * 0.32)
      : decl.placement === 'ring'
        ? moderateScale(150)
        : moderateScale(104);

  const art = (
    <Image
      source={drawing.source}
      style={{ width: height * drawing.aspect, height }}
      contentFit="contain"
      // The record's own words carry the meaning on every screen the character
      // appears on; the drawing is decoration and VoiceOver should skip it.
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      transition={0}
    />
  );

  if (decl.placement === 'ring') {
    const ring = moderateScale(196);
    return (
      <Animated.View style={[styles.centred, entrance]}>
        <Animated.View
          style={[
            styles.ring,
            { width: ring, height: ring, borderRadius: ring / 2 },
            rotation,
          ]}
        />
        <View style={styles.ringInner}>{art}</View>
      </Animated.View>
    );
  }

  return (
    <Animated.View
      style={[
        decl.placement === 'aside' ? styles.aside : styles.centred,
        entrance,
      ]}>
      {art}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  centred: { alignItems: 'center', justifyContent: 'center' },
  aside: { alignItems: 'flex-end' },
  ring: {
    position: 'absolute',
    borderWidth: 3,
    borderColor: v2color.blue,
    // Three of the four edges are nearly transparent, so a full turn reads as
    // one bright arc travelling round rather than as a spinning circle.
    borderTopColor: v2color.blue,
    borderRightColor: 'rgba(0,122,255,0.16)',
    borderBottomColor: 'rgba(0,122,255,0.16)',
    borderLeftColor: 'rgba(0,122,255,0.16)',
  },
  ringInner: { alignItems: 'center', justifyContent: 'center' },
});
