import { Image, StyleSheet, Text, View, type ImageSourcePropType, type StyleProp, type ViewStyle } from 'react-native';

import { color, lineFor, MAX_FONT_SCALE, moderateScale, radius, shadow, spacing, type } from '@/lib/theme';

/**
 * A device frame around a REAL screenshot of the app (owner, 28 July) — the
 * onboarding's only picture, and the only place in the product where a picture
 * stands in for the thing itself.
 *
 * Three rules, and the first is why this component exists rather than an
 * `<Image>` on three screens:
 *
 * 1. **No shot, no frame.** `shot` is null until a real capture is dropped into
 *    `assets/onboarding/` and wired up in `src/lib/onboarding-shots.ts`. Until
 *    then the frame renders its `children` — the live composition the screen
 *    already had — so the funnel never shows an empty box or a placeholder
 *    pretending to be the app. This is what keeps `expo export` green with no
 *    assets committed.
 * 2. **A window, not a whole phone.** A 19.5:9 device shrunk to fit an
 *    onboarding step is a grey smudge: at that scale the type is texture. The
 *    frame is a 9:16 window anchored to the top or the bottom of the capture,
 *    so the part that carries the argument is legible and the shape still reads
 *    as a phone.
 * 3. **The caption is not decoration.** Anything showing a record that is not
 *    the user's own says so, in the words §12.1 settled on ("Example — …"). A
 *    frame full of numbers with no label is the fabricated-proof failure the
 *    paywall just finished closing.
 *
 * The bezel is ink (`accent`) on purpose: the app's own paper is `#F4F5EF` and
 * a paper bezel around a paper screenshot has no edge at all. No notch, no
 * speaker slit, no side buttons — a real capture already carries the status bar
 * and the home indicator, which is what sells it.
 */

const BEZEL = moderateScale(4);

/** Wide enough to read, narrow enough to leave the step's words in charge. */
const DEFAULT_WIDTH = moderateScale(190);

/**
 * The capture's own ratio — iPhone 14 Pro and later are 1179 × 2556, which is
 * this exactly. A 9:19.5 image inside a 9:16 window shows ~82% of the screen;
 * `anchor` picks which end.
 */
const SHOT_ASPECT = 9 / 19.5;
const WINDOW_ASPECT = 9 / 16;

export function DeviceFrame({
  shot,
  label,
  caption,
  width = DEFAULT_WIDTH,
  anchor = 'top',
  offset = 0,
  style,
  children,
}: {
  /** A real capture, or null while there is none — see `onboarding-shots.ts`. */
  shot: ImageSourcePropType | null;
  /** What VoiceOver reads instead of the picture. Required with a shot: a
   * screenshot is content, and an unlabelled image is a hole in the flow. */
  label?: string;
  /** The honest line under the frame. Anything not the user's own record needs
   * one (§12.1). */
  caption?: string;
  width?: number;
  /** Which end of the capture the window sits on — 'bottom' for the composer,
   * where the note and the accessory bar live. */
  anchor?: 'top' | 'bottom';
  /** Fine adjustment in points, applied at the anchored edge. Positive pushes
   * the capture further into view. */
  offset?: number;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}) {
  // No capture yet: the screen keeps exactly what it had. Never a placeholder.
  if (!shot) return <>{children}</>;

  return (
    <View style={[styles.wrap, style]}>
      <View style={[styles.frame, { width }]}>
        <View style={styles.screen}>
          <Image
            source={shot}
            style={[styles.shot, anchor === 'top' ? { top: offset } : { bottom: offset }]}
            resizeMode="cover"
            accessible
            accessibilityRole="image"
            accessibilityLabel={label}
          />
        </View>
      </View>
      {caption ? (
        <Text style={styles.caption} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {caption}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
  },
  frame: {
    padding: BEZEL,
    backgroundColor: color.accent,
    borderRadius: radius.xxl + BEZEL,
    ...shadow.raised,
  },
  screen: {
    aspectRatio: WINDOW_ASPECT,
    borderRadius: radius.xxl,
    overflow: 'hidden',
    backgroundColor: color.bg,
  },
  shot: {
    position: 'absolute',
    left: 0,
    right: 0,
    width: '100%',
    aspectRatio: SHOT_ASPECT,
  },
  caption: {
    marginTop: spacing.sm,
    marginHorizontal: spacing.sm,
    textAlign: 'center',
    ...type.footnote,
    lineHeight: lineFor(16),
    color: color.textMuted,
  },
});
