import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Enter } from '@/lib/motion/index';
import { alpha, color, MAX_FONT_SCALE, spacing, type } from '@/lib/theme';

import { Frame } from '../Frame';
import { PhoneDemo } from '../PhoneDemo';
import { RiseIn } from '../RiseIn';
import { v2color } from '../tokens';
import type { ScreenProps } from './types';

/**
 * SCREEN 1 — WELCOME. The wow screen.
 *
 * No question, no rail, and the CTA is awake from the first frame: there is
 * nothing to answer, so making someone earn the button here would be theatre.
 *
 * REBUILT 16 September 2026 (owner's directive): the cap character gave this
 * screen to the product itself. A drawn iPhone RISES onto the stage
 * (`RiseIn`) and the real Today page performs a push session inside it —
 * typed, parsed, settled, looping. The claim stands centred beneath it, the
 * hero's own voice: visual on top, two centred lines under it, the CTA at
 * the bottom — the composition every reference wow screen shares. The phone
 * is deliberately CROPPED by its band and faded into the canvas: a whole
 * phone would shrink the page inside it below legibility, and its top
 * two-thirds is where everything it needs to say happens.
 *
 * THE FOOTER LINK IS REAL SINCE 28 AUGUST 2026. "Auth last" is about where
 * the funnel ASKS for an account, not about locking out somebody who already
 * has one. The route owns what it does; in a development run it says it is
 * off rather than pretending.
 */
export function WelcomeScreen({ def, onAdvance, onSignIn }: ScreenProps) {
  const win = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const phoneWidth = Math.min(win.width * 0.62, 258);
  const [bandHeight, setBandHeight] = useState(Math.round(win.height * 0.42));

  return (
    <Frame
      headline=""
      progress={null}
      // NO SCROLL: the hero is one composed screen. Scrolling it put the
      // subline below the fold and washed the headline with the footer's own
      // edge fade — photographed on the first simulator pass, 16 Sep 2026.
      scroll={false}
      cta={{ label: 'Start', enabled: true, onPress: onAdvance }}
      footerLink={{ label: 'I already have an account', onPress: onSignIn }}
      testID="v2-screen-welcome">
      <View style={styles.fill}>
        <View
          style={styles.band}
          onLayout={(e) => setBandHeight(Math.round(e.nativeEvent.layout.height))}>
          <RiseIn delay={140} style={styles.phone}>
            <PhoneDemo width={phoneWidth} height={bandHeight} />
          </RiseIn>
          {/* The paper takes the phone over rather than cutting it — the
              same fade the app uses over every pinned edge. */}
          <LinearGradient
            colors={[alpha(color.canvas, 0), color.canvas]}
            style={styles.fade}
            pointerEvents="none"
          />
        </View>

        {/* The copy owes the PINNED footer its clearance by hand: the
            non-scrolling body runs the full height of the screen, under the
            CTA overlay. ~CTA + link + its paddings, above the home indicator. */}
        <View style={[styles.copy, { paddingBottom: insets.bottom + 140 }]}>
          <Enter index={2}>
            <Text style={styles.headline} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              {def.headline}
            </Text>
          </Enter>
          {def.subline ? (
            <Enter index={3}>
              <Text style={styles.subline} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                {def.subline}
              </Text>
            </Enter>
          ) : null}
        </View>
      </View>
    </Frame>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  /** The stage: whatever height the copy and the CTA leave, the phone fills. */
  band: {
    flex: 1,
    minHeight: 240,
    alignItems: 'center',
    overflow: 'hidden',
  },
  phone: { flex: 1 },
  fade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 72,
  },
  /** The claim, centred under its own evidence. */
  copy: {
    alignItems: 'center',
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  headline: {
    ...type.largeTitle,
    fontWeight: '800',
    color: v2color.ink,
    textAlign: 'center',
  },
  subline: {
    ...type.body,
    color: v2color.inkSecondary,
    textAlign: 'center',
    marginTop: spacing.md,
    maxWidth: 320,
  },
});
