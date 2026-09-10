import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { tap } from '@/lib/haptics';
import { color, HIT, MAX_FONT_SCALE, moderateScale, spacing, type } from '@/lib/theme';

import { Icon } from './icon';
import { PressableScale } from './motion';
import { PaperField } from './paper-field';

/**
 * Shared scaffold for Progress and Lifts — the two screens that wear a plain
 * header: a quiet header and a muted one-liner. (It read "stub routes
 * (/onboarding, /paywall)" until 29 July; both of those have owned their own
 * chrome for a while. §0.3 — the code wins, and the line is fixed here.)
 *
 * `back` is false on a tab root — a tab is not a push, so there is nothing to go
 * back to, and a chevron that pops to nowhere is a lie about the navigation. In
 * that shape the title also goes left-aligned, which is the §6.5 headline
 * direction anyway; the centred title only exists to balance the chevron.
 *
 * `large` + `subtitle` are the 17 Aug shape (owner, Progression mockup): a
 * standing-large title with one counted line under it, tight, the way iOS sets
 * a large-title header. `subtitle` belongs to the HEADER and hugs the title;
 * `note` stays a body line with the body's own breathing room. A screen that
 * passes a subtitle also loses the body's top padding, because the subtitle has
 * already done that job and doubling it opens a hole under the header.
 */
export function StubScreen({
  title,
  subtitle,
  note,
  back = true,
  large = false,
  trailing,
  children,
}: {
  title: string;
  /** One counted line directly under the title, inside the header. */
  subtitle?: string;
  note?: string;
  /** False on a tab root: no chevron, left-aligned title. */
  back?: boolean;
  /** Tab-root only: set the title at `largeTitle` instead of `title2`. */
  large?: boolean;
  /**
   * ONE control on the header's trailing edge — Next's Edit pill, and the
   * reason this slot exists (28 August 2026). Setgraph puts exactly this
   * there; the alternative was a control floating in the body, which would
   * have been a second thing claiming to be a header.
   *
   * It aligns to the TOP of the title, not its centre: beside a large title
   * with a subtitle under it, a vertically centred pill sits against the
   * subtitle and reads as belonging to it.
   */
  trailing?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const router = useRouter();

  return (
    <View style={styles.root}>
      {/* The canvas. One canvas runs the whole app (skill §Canvas), so the three
          screens this scaffold carries — Next, Progression and Lifts — draw the
          same static diagonal field Today does. `styles.root` keeps the flat
          `color.canvas` beneath it, which is the fill for wherever a gradient
          cannot render rather than an alternative to one.

          It sits OUTSIDE the `SafeAreaView`, which is why the root is a plain
          `View` now. Yoga offsets an absolutely positioned child by its parent's
          padding, and safe-area padding is the whole of what that component
          adds — mounted inside it, the field would have stopped short of the
          status bar and the home indicator and left a flat strip at each end.
          Today has always had this shape (`today.tsx`). */}
      <PaperField />

      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={[styles.header, back ? null : styles.headerRoot]}>
          {back ? (
            <PressableScale
              onPress={() => {
                tap();
                router.back();
              }}
              haptic="none"
              activeScale={0.9}
              hitSlop={spacing.sm}
              style={styles.back}
              accessibilityRole="button"
              accessibilityLabel="Back">
              <Icon name="chevron-back" size={moderateScale(22)} tint={color.textSecondary} />
            </PressableScale>
          ) : null}
          <View style={styles.titleWrap}>
            <Text
              style={[styles.title, back ? null : large ? styles.titleLarge : styles.titleRoot]}
              accessibilityRole="header"
              maxFontSizeMultiplier={MAX_FONT_SCALE}>
              {title}
            </Text>
            {subtitle ? (
              <Text style={styles.subtitle} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                {subtitle}
              </Text>
            ) : null}
          </View>
          {back ? <View style={styles.back} /> : null}
          {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
        </View>

        <View style={[styles.body, subtitle ? styles.bodyTight : null]}>
          {note ? (
            <Text style={styles.note} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              {note}
            </Text>
          ) : null}
          {children}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    // THE PAGE. `PaperField` draws the gradient over it; this is what shows
    // wherever the gradient cannot render.
    backgroundColor: color.canvas,
  },
  /** The safe-area box, carrying no fill of its own — the canvas is behind it
   * and has to reach the screen's true edges. */
  safe: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    // minHeight, never height: at accessibilityLarge a 22pt title is taller than
    // the 44pt tap target and a fixed height would crop its own label.
    minHeight: HIT,
    paddingHorizontal: spacing.lg,
  },
  headerRoot: {
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.sm,
  },
  back: {
    width: HIT,
    justifyContent: 'center',
  },
  /** Top-aligned, so the control sits beside the TITLE rather than drifting
   * down to the subtitle it does not belong to. */
  trailing: {
    alignSelf: 'flex-start',
    flexShrink: 0,
  },
  titleWrap: {
    flex: 1,
  },
  title: {
    textAlign: 'center',
    color: color.textPrimary,
    fontSize: type.headline.fontSize,
    fontWeight: '600',
  },
  titleRoot: {
    ...type.title2,
    textAlign: 'left',
  },
  titleLarge: {
    ...type.largeTitle,
    textAlign: 'left',
  },
  subtitle: {
    ...type.subhead,
    marginTop: 2,
    color: color.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  body: {
    flex: 1,
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.xxl,
    gap: spacing.lg,
  },
  bodyTight: {
    paddingTop: spacing.lg,
  },
  note: {
    ...type.subhead,
    color: color.textMuted,
  },
});
