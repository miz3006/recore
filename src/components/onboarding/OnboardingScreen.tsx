import { useEffect, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/icon';
import { FadeSlideIn, FadeSlideX, PressableScale } from '@/components/motion';
import { Eyebrow } from '@/components/primitives';
import { alpha, color, HIT, ink, lineFor, MAX_FONT_SCALE, spacing, type } from '@/lib/theme';

import { flowDirection } from './direction';
import { IllustrationSlot } from './IllustrationSlot';
import { PrimaryCta } from './PrimaryCta';
import { ProgressRail } from './ProgressRail';
import {
  BACK_DIAMETER,
  ENTER_MS,
  INK_CHROME,
  RISE_PX,
  SLIDE_PX,
  SLOT,
  slotDelay,
  STAGGER_MS,
  illustrationHeight,
  illustrationHeightCompact,
} from './tokens';

/**
 * THE onboarding screen template (owner's mascot-led restyle, 12 Aug 2026).
 * Every step of the flow is this component with different content in one band;
 * the renderer (`app/onboarding/[step].tsx`) decides what goes in that band and
 * nothing else about the page.
 *
 * ## Fixed zones, top to bottom
 *
 *   1. chrome row — round back button + the progress bar
 *   2. ILLUSTRATION — the mascot, on bare paper
 *   3. eyebrow + headline + subtext
 *   4. content — options, inputs, lists
 *   5. the primary CTA, pinned to the bottom
 *
 * **Every zone's height comes from the WINDOW, never from the step.** The
 * illustration band is a share of the screen height (`illustrationHeight`), the
 * chrome row and the eyebrow line are always drawn even when a step has neither
 * a back button nor a label, and the CTA band is reserved even on the
 * auto-advancing question screens. Swiping the whole flow, the mascot, the
 * headline baseline and the button do not move by a pixel — which is the point:
 * the person's eye stays still and only the answer changes.
 *
 * The price of that promise is paid by the content band, which SCROLLS when it
 * has to (four long options at Dynamic Type 1.5×, say). A band that scrolls is
 * a far smaller cost than a headline that jumps between two questions.
 *
 * ## Entrance
 *
 * One staggered arrival per screen, in reading order: mascot, headline,
 * subtext, content, CTA — 250 ms of fade and a short HORIZONTAL slide each,
 * 60 ms apart. The slots are fixed (see `SLOT`), so a step with no subtext
 * still starts its content on the third beat and the flow keeps one rhythm. The
 * idle float of the illustration starts after the whole entrance has landed.
 *
 * The slide runs on the axis the flow itself moves on and in the direction it
 * moved (`direction.ts`): forward the zones come from the right, Back from the
 * left. Because the page underneath is sliding too, the zones arriving a beat
 * later read as parallax — the mascot and the question trail the paper they are
 * printed on, which is what gives a flat two-colour flow any depth at all. It
 * is also the only thing on screen that says which way you just went.
 *
 * The zone that does NOT slide is the CTA: it is pinned under the thumb and a
 * button that arrives sideways is a button that gets mis-tapped. It fades and
 * rises the way it always did.
 *
 * ## The keyboard
 *
 * On the typed steps the mascot band SHRINKS while the keyboard is up — it does
 * not disappear (owner, 12 Aug 2026). The slot fits with `contain`, so the
 * whole figure is still there, just smaller; it returns to full size the moment
 * the field is dismissed. The change is instant rather than animated: §4.3 bans
 * animating a layout property, and a height is one.
 */

export type OnboardingScreenProps = {
  /** Illustration registry key — always the step's own slug. */
  slug: string;
  /** Small mono section label above the headline. */
  eyebrow?: string;
  headline: string;
  subtext?: string;
  /** The welcome screen's marketing register. */
  hero?: boolean;
  /** `null` on the welcome — that screen has no position to report. */
  progress?: { total: number; completed: number } | null;
  /** `null` where there is nothing to go back to (welcome, building). */
  onBack?: (() => void) | null;
  /** `null` on the auto-advancing question screens; the band stays reserved. */
  cta?: { label: string; onPress: () => void; disabled?: boolean; loading?: boolean } | null;
  /** How many staggered items the content band renders — sets the CTA's beat. */
  contentCount?: number;
  children?: React.ReactNode;
};

export function OnboardingScreen({
  slug,
  eyebrow,
  headline,
  subtext,
  hero = false,
  progress,
  onBack,
  cta,
  contentCount = 1,
  children,
}: OnboardingScreenProps) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const keyboardUp = useKeyboardShown();

  const bandHeight = keyboardUp ? illustrationHeightCompact(height) : illustrationHeight(height);
  const ctaDelay = slotDelay(SLOT.content + contentCount);
  // The mascot may start breathing once the last zone has finished arriving.
  const idleDelay = ctaDelay + ENTER_MS;
  // Read once, at mount: the direction belongs to the navigation that brought
  // this screen in, not to whatever the flow does next.
  const [dir] = useState(flowDirection);

  return (
    <View style={styles.root}>
      {/* Chrome: one row, always the same height — a step with no back button
          draws the spacer so the bar below it never moves. */}
      <View style={[styles.chrome, { marginTop: insets.top + spacing.sm }]}>
        {onBack ? (
          <PressableScale
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel="Back"
            style={styles.back}>
            <Icon name="chevron-back" size={20} tint={color.textPrimary} />
          </PressableScale>
        ) : (
          <View style={styles.backSpacer} />
        )}
        {progress ? (
          <ProgressRail
            total={progress.total}
            completed={progress.completed}
            style={styles.rail}
          />
        ) : (
          <View style={styles.rail} />
        )}
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}>
        <View style={styles.page}>
          <View style={[styles.band, keyboardUp && styles.bandCompact, { height: bandHeight }]}>
            {/* The mascot leads, and it travels furthest — it is the element the
                eye is holding while the page changes underneath it. */}
            <FadeSlideX
              direction={dir}
              delay={slotDelay(SLOT.illustration)}
              distance={SLIDE_PX * 1.5}
              duration={ENTER_MS}>
              <IllustrationSlot slug={slug} height={bandHeight} idleDelay={idleDelay} />
            </FadeSlideX>
          </View>

          <FadeSlideX
            direction={dir}
            delay={slotDelay(SLOT.eyebrow)}
            distance={SLIDE_PX}
            duration={ENTER_MS}>
            {/* Reserved even when empty, so the headline baseline is the same
                on the welcome as on every question. */}
            <View style={styles.eyebrowLine}>
              {eyebrow ? <Eyebrow tone="muted">{eyebrow}</Eyebrow> : null}
            </View>
          </FadeSlideX>

          <FadeSlideX
            direction={dir}
            delay={slotDelay(SLOT.headline)}
            distance={SLIDE_PX}
            duration={ENTER_MS}>
            <Text
              style={hero ? styles.hero : styles.headline}
              accessibilityRole="header"
              maxFontSizeMultiplier={MAX_FONT_SCALE}>
              {headline}
            </Text>
          </FadeSlideX>

          {subtext ? (
            <FadeSlideX
              direction={dir}
              delay={slotDelay(SLOT.subtext)}
              distance={SLIDE_PX}
              duration={ENTER_MS}>
              <Text style={styles.subtext} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                {subtext}
              </Text>
            </FadeSlideX>
          ) : null}

          <ScrollView
            style={styles.content}
            contentContainerStyle={styles.contentInner}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive">
            {children}
          </ScrollView>

          {/* Always the last thing on the page, so the button sits at the same
              height on every screen that has one. An auto-advancing question
              draws nothing here and gives the room to its options. */}
          <View style={[styles.ctaBand, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
            {cta ? (
              <FadeSlideIn delay={ctaDelay} distance={RISE_PX} duration={ENTER_MS}>
                <PrimaryCta
                  label={cta.label}
                  onPress={cta.onPress}
                  disabled={cta.disabled}
                  loading={cta.loading}
                />
              </FadeSlideIn>
            ) : null}
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

/** The delay of the i-th item inside the content band — exported so a step's
 * own rows join the same stagger instead of inventing a second cadence. */
export function contentDelay(i: number): number {
  return slotDelay(SLOT.content) + i * STAGGER_MS;
}

/**
 * Whether the software keyboard is up. `keyboardWillShow` on iOS so the mascot
 * band is already gone by the time the keyboard finishes rising, rather than
 * collapsing a beat late under the field.
 */
function useKeyboardShown(): boolean {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const ios = Platform.OS === 'ios';
    const show = Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', () =>
      setShown(true),
    );
    const hide = Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', () =>
      setShown(false),
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return shown;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: color.bg,
  },
  flex: {
    flex: 1,
  },
  chrome: {
    flexDirection: 'row',
    alignItems: 'center',
    height: HIT,
    paddingHorizontal: spacing.xxl,
    gap: spacing.lg,
  },
  back: {
    width: BACK_DIAMETER,
    height: BACK_DIAMETER,
    borderRadius: BACK_DIAMETER,
    backgroundColor: INK_CHROME,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backSpacer: {
    width: BACK_DIAMETER,
    height: BACK_DIAMETER,
  },
  rail: {
    flex: 1,
    // Optically centred against the round button beside it.
    marginRight: spacing.xs,
  },
  page: {
    flex: 1,
    paddingHorizontal: spacing.xxl,
  },
  band: {
    justifyContent: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.lg,
    /**
     * The last-resort valve. It never fires in the ordinary case — the content
     * band below is `flex: 1` on a zero basis, so it absorbs every spare pixel
     * and the page does not overflow — but at Dynamic Type 1.5x on a small
     * phone with the keyboard up, the headline alone can outgrow the screen.
     * Then the mascot gives up the difference instead of pushing the field the
     * person is typing in off the bottom of the page.
     */
    flexShrink: 1,
  },
  /** Keyboard up: tighter margins around the smaller band. */
  bandCompact: {
    marginTop: 0,
    marginBottom: spacing.md,
  },
  eyebrowLine: {
    height: lineFor(14),
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  headline: {
    ...type.question,
    color: color.textPrimary,
  },
  /** The welcome headline — the marketing register, one notch up. */
  hero: {
    ...type.display,
    color: color.textPrimary,
  },
  subtext: {
    ...type.body,
    color: alpha(color.textPrimary, ink.echo),
    marginTop: spacing.sm,
  },
  content: {
    flex: 1,
    marginTop: spacing.xl,
  },
  contentInner: {
    gap: spacing.md,
    paddingBottom: spacing.md,
  },
  ctaBand: {
    paddingTop: spacing.md,
  },
});
