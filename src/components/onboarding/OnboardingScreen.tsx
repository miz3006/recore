import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, { useAnimatedKeyboard, useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/icon';
import { PressableScale } from '@/components/motion';
import { Eyebrow } from '@/components/primitives';
import { alpha, color, HIT, ink, lineFor, MAX_FONT_SCALE, spacing, type } from '@/lib/theme';

import {
  bandHeightAt,
  bandMarginAt,
  ctaLiftAt,
  illustrationHeight,
  illustrationHeightCompact,
  keyboardProgress,
} from './band';
import { Enter, EntranceWindow } from './Enter';
import { IllustrationSlot } from './IllustrationSlot';
import { PrimaryCta } from './PrimaryCta';
import { ProgressRail } from './ProgressRail';
import {
  BACK_DIAMETER,
  BLUE,
  INK_CHROME,
  SLOT,
  slotDelay,
  STAGGER_CAP,
  STAGGER_MS,
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
 * ## Entrance (rewritten 19 August 2026)
 *
 * One staggered arrival per screen, in reading order: mascot, headline,
 * subtext, content, CTA — 250 ms of fade and a 12 pt rise each, 40 ms apart,
 * through `Enter`. The slots are fixed (see `SLOT`), so a step with no subtext
 * still starts its content on the same beat as one that has it.
 *
 * **The step-to-step transition is no longer here.** Each zone used to also
 * slide HORIZONTALLY, from the right going forward and from the left going
 * back, off a module global that remembered the flow's direction. Every step of
 * this funnel is a real push on the native stack, so that was a second slide
 * drawn in JavaScript on top of the platform's own — which already knows its
 * direction, already reverses under the back-swipe, and already runs off the
 * main thread. The page now arrives once; only its contents settle in.
 *
 * The two overlap on purpose. The push is 350 ms and the last content item
 * lands around 530 ms, so the screen is assembling as it travels rather than
 * arriving blank and filling afterwards.
 *
 * The CTA's delay is capped (`STAGGER_CAP`) instead of counting every content
 * item. It used to be `SLOT.content + contentCount`, which on the five-option
 * screens put the primary action 730 ms out — the button you need was the last
 * thing on the page to exist, and the longest questions waited longest.
 *
 * ## The keyboard (owner's spec §B, 13 Aug 2026; CTA rewritten 19 Aug 2026)
 *
 * On the typed steps the mascot band SHRINKS while the keyboard is up — it does
 * not disappear (owner, 12 Aug 2026). The slot fits with `contain`, so the
 * whole figure is still there, just smaller; it returns to full size the moment
 * the field is dismissed.
 *
 * It used to do that in ONE STEP, on a `setState` from `keyboardWillShow`: a
 * React re-render, an instant jump, and the rest of the page reflowing under a
 * keyboard that was still rising. Now the band's height is a worklet reading
 * `useAnimatedKeyboard()` — the keyboard's own height, frame by frame, through
 * `band.ts`'s interpolation. That is the one shape of this animation that
 * cannot drift from the system's duration or easing, because it does not have
 * its own: it IS the keyboard's curve, sampled. Dismissing runs the identical
 * interpolation backwards, an interactive swipe-down drags it by hand, and
 * nothing on the page re-renders while any of it happens.
 *
 * Yes, a height is a layout property, which §4.3 would otherwise ban. It is
 * animated here because the alternative the ban exists to protect — a step
 * change in layout — is precisely the defect being fixed, and because ONE view
 * whose height follows the keyboard costs one measure pass on a screen that is
 * doing nothing else while a person types.
 *
 * **The CTA rides the same shared value** (`ctaLiftAt`), as a translate. It used
 * to be a `KeyboardAvoidingView` with `behavior="padding"` around the whole
 * page: a JS-thread re-render on a `keyboardWillShow` event that arrives after
 * the keyboard has already started moving, animating a padding for every frame
 * of a transition it could only ever lag. Two things were reading the same
 * keyboard and only one of them was reading it correctly; now there is one
 * source, one curve, and no re-render for either.
 */

export type OnboardingScreenProps = {
  /** Illustration registry key — always the step's own slug. */
  slug: string;
  /** Small mono section label above the headline. */
  eyebrow?: string;
  /** Recore blue on the three screens that hand something back (the design's
   * WHY WE ASKED / YOUR COMMITMENT / YOUR PROJECTION). */
  eyebrowTone?: 'muted' | 'accent';
  /** A sentence-case line above the headline — the welcome only, where an
   * uppercase eyebrow would read as a section marker in a flow that has not
   * started yet. */
  kicker?: string;
  headline: string;
  subtext?: string;
  /** The welcome screen's marketing register. */
  hero?: boolean;
  /** Centre the kicker, headline and subtext — the welcome only. */
  centered?: boolean;
  /** `null` on the welcome — that screen has no position to report. */
  progress?: { total: number; completed: number } | null;
  /** `null` where there is nothing to go back to (welcome, building). */
  onBack?: (() => void) | null;
  /** `null` on the auto-advancing question screens; the band stays reserved. */
  cta?: { label: string; onPress: () => void; disabled?: boolean; loading?: boolean } | null;
  /** A control drawn INSTEAD of the primary CTA — the commitment screen's
   * hold button. It gets the CTA's slot, beat and bottom padding. */
  ctaSlot?: React.ReactNode;
  /** One line under the CTA — the welcome's Sign in link. */
  footer?: React.ReactNode;
  /** How many staggered items the content band renders — sets the CTA's beat. */
  contentCount?: number;
  children?: React.ReactNode;
};

export function OnboardingScreen({
  slug,
  eyebrow,
  eyebrowTone = 'muted',
  kicker,
  headline,
  subtext,
  hero = false,
  centered = false,
  progress,
  onBack,
  cta,
  ctaSlot,
  footer,
  contentCount = 1,
  children,
}: OnboardingScreenProps) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const keyboard = useAnimatedKeyboard();

  // One beat after the last content item the stagger actually counts. Capped,
  // so a step with twelve rows does not hold its own button hostage: 200 ms on
  // the shortest screen, 320 ms on every screen from five items up.
  const ctaDelay = contentDelay(Math.min(contentCount, STAGGER_CAP)) + STAGGER_MS;
  /** See the CTA band below — the home indicator is not free space. */
  const ctaBottom = Math.max(insets.bottom, spacing.lg) + spacing.md;

  // The two ends of the transition are decided here, on the render thread: a
  // worklet may only do arithmetic on what it is handed (see `band.ts`).
  //
  // EVERY screen reserves the band, including the one with no drawing in it.
  // The v3 board keeps the parse demo's headline on exactly the baseline every
  // other question uses, with the space above it simply empty — and that is the
  // fixed-zone promise doing its job rather than an exception to it. (Until 18
  // Aug three typographic screens collapsed the band to zero; all three have
  // left the flow, and the one screen that inherited their "no artwork" flag is
  // a screen whose page still has to line up with its neighbours.)
  const full = illustrationHeight(height);
  const compact = illustrationHeightCompact(height);
  const topGap = spacing.md;
  const bottomGap = spacing.lg;

  // ONE animated style, ONE shared value: the band's height and the whitespace
  // around it collapse together, on the keyboard's own progress.
  const band = useAnimatedStyle(() => {
    const progress = keyboardProgress(keyboard.height.get(), height);
    return {
      height: bandHeightAt(progress, full, compact),
      marginTop: bandMarginAt(progress, topGap),
      marginBottom: bandMarginAt(progress, bottomGap),
    };
  });

  // The button rides the keyboard as a TRANSLATE — no layout, no re-render, and
  // no duration of its own to fall out of step with the system's.
  const ctaBand = useAnimatedStyle(() => ({
    transform: [{ translateY: ctaLiftAt(keyboard.height.get(), insets.bottom) }],
  }));

  return (
    <EntranceWindow>
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

        <View style={styles.page}>
          <Animated.View style={[styles.band, band]}>
            {/* The mascot leads — it is the element the eye is holding while
                the page changes underneath it. */}
            <Enter delay={slotDelay(SLOT.illustration)} style={styles.flex}>
              <IllustrationSlot slug={slug} />
            </Enter>
          </Animated.View>

          <Enter delay={slotDelay(SLOT.eyebrow)}>
            {/* Reserved even when empty, so the headline baseline is the same
                on the welcome as on every question. */}
            <View style={[styles.eyebrowLine, centered && styles.center]}>
              {eyebrow ? (
                <Eyebrow tone="muted" style={eyebrowTone === 'accent' ? styles.eyebrowAccent : undefined}>
                  {eyebrow}
                </Eyebrow>
              ) : null}
              {kicker ? (
                <Text
                  style={[styles.kicker, centered && styles.centerText]}
                  maxFontSizeMultiplier={MAX_FONT_SCALE}>
                  {kicker}
                </Text>
              ) : null}
            </View>
          </Enter>

          <Enter delay={slotDelay(SLOT.headline)}>
            <Text
              style={[hero ? styles.hero : styles.headline, centered && styles.centerText]}
              accessibilityRole="header"
              maxFontSizeMultiplier={MAX_FONT_SCALE}>
              {headline}
            </Text>
          </Enter>

          {subtext ? (
            <Enter delay={slotDelay(SLOT.subtext)}>
              <Text
                style={[styles.subtext, centered && styles.centerText]}
                maxFontSizeMultiplier={MAX_FONT_SCALE}>
                {subtext}
              </Text>
            </Enter>
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
              height on every screen that has one.

              THE BOTTOM INSET IS PART OF THE PADDING (owner, 18 Aug 2026: "a
              little further from the bottom so it is easier to press"). It was
              a flat 16 pt, which on any phone with a home indicator put the
              button's bottom edge INSIDE the system's own gesture strip — the
              one band of the screen where a tap is most likely to be eaten by
              the swipe-up. The design board leaves 5.4 % of the screen under
              its button, which on a 852 pt window is 46 pt: the 34 pt inset
              plus a gap. That is exactly what this computes, and on an older
              phone with no indicator the `max` keeps a real margin instead of
              collapsing to nothing. */}
          <Animated.View style={[styles.ctaBand, { paddingBottom: ctaBottom }, ctaBand]}>
            {ctaSlot ? (
              <Enter delay={ctaDelay}>{ctaSlot}</Enter>
            ) : cta ? (
              <Enter delay={ctaDelay}>
                <PrimaryCta
                  label={cta.label}
                  onPress={cta.onPress}
                  disabled={cta.disabled}
                  loading={cta.loading}
                />
              </Enter>
            ) : null}
            {footer ? (
              <Enter delay={ctaDelay + STAGGER_MS} style={styles.footer}>
                {footer}
              </Enter>
            ) : null}
          </Animated.View>
        </View>
      </View>
    </EntranceWindow>
  );
}

/**
 * The delay of the i-th item inside the content band — exported so a step's own
 * rows join the same stagger instead of inventing a second cadence.
 *
 * CAPPED at `STAGGER_CAP`. Past that every remaining item shares the last beat:
 * a stagger is meant to lead the eye down a page, and once it is long enough
 * that the reader has arrived before the content has, it is just latency.
 */
export function contentDelay(i: number): number {
  return slotDelay(SLOT.content) + Math.min(i, STAGGER_CAP) * STAGGER_MS;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: color.surface,
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
    borderCurve: 'continuous',
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
    /**
     * No `marginTop`/`marginBottom` here on purpose: the band's height AND its
     * whitespace are one animated style (see the component), so a static margin
     * would be the one part of the zone that still jumps.
     */
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
  eyebrowLine: {
    minHeight: lineFor(14),
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  eyebrowAccent: {
    color: BLUE,
  },
  /** The welcome's sentence-case line — `textSecondary`, because it is read. */
  kicker: {
    ...type.subhead,
    color: color.textSecondary,
  },
  center: {
    alignItems: 'center',
  },
  centerText: {
    textAlign: 'center',
  },
  footer: {
    marginTop: spacing.md,
    alignItems: 'center',
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
