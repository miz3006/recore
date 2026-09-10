import * as AppleAuthentication from 'expo-apple-authentication';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { PressableScale } from '@/components/motion';
import {
  CTA_HEIGHT,
  MAX_FONT_SCALE,
  moderateScale,
  provider as brand,
  radius,
  spacing,
  type,
} from '@/lib/theme';

/**
 * THE TWO SIGN-IN BUTTONS, IN THEIR OWNERS' COLOURS — sign-in and nowhere else.
 *
 * Until 28 August 2026 these were `AppButton` in `primary` and `secondary`: a
 * blue brand pill wearing the app's blue glow, and a pale-blue tinted pill
 * under it. Both were wrong in the same way. A sign-in button is not a Recore
 * CTA that happens to say "Apple" — it is a piece of somebody else's identity,
 * and it is the one control on any screen a person recognises before they read
 * it. Recolouring it into the host app's palette costs exactly the recognition
 * it exists for.
 *
 * ## Apple's button is now APPLE'S BUTTON (9 September 2026)
 *
 * The owner asked for a screen that reads as native iOS. The Apple button was
 * the largest thing on it that only *resembled* one: a `PressableScale` with
 * our Ionicons apple glyph, our `type.headline`, and the English string
 * `Sign in with Apple` typed into the call site. It was a faithful copy, and a
 * copy is what it stayed — the glyph is not Apple's mark, the label did not
 * follow the phone's language, and the metrics were ours rather than the
 * system's.
 *
 * `AppleSignInButton` below renders the real `ASAuthorizationAppleIDButton`
 * through `expo-apple-authentication`. What that buys, none of which the copy
 * could have:
 *
 *  · **The mark and the wordmark are Apple's own**, drawn by the OS at the
 *    weight and optical size the HIG specifies, at any Dynamic Type setting.
 *  · **The label is localised by the system.** A phone in Slovenian reads
 *    "Nadaljuj z Apple" without this repository owning a translation — and
 *    Recore's owner runs a Slovenian device, so the old English literal was
 *    wrong on the very device it was being reviewed on.
 *  · **It is Apple-approved by construction** (guideline 4.8 / the Sign in with
 *    Apple branding rules), so no future edit can drift it off-spec.
 *  · VoiceOver, Reduce Transparency and the press appearance come from UIKit.
 *
 * The one thing we still choose is geometry, and it is chosen to MATCH: the
 * app's `CTA_HEIGHT` and `radius.md`, the same two values the Google button
 * uses. `buttonStyle` is BLACK because the HIG allows exactly black, white, or
 * white-outline, and black is the one that reads as a primary action on a cream
 * canvas. `cornerRadius` and `style` are the only appearance props the
 * component accepts — it refuses `backgroundColor` and `borderRadius` on
 * purpose, which is the API saying the same thing this comment does.
 *
 * **The native button has no disabled or loading appearance**, because
 * `ASAuthorizationAppleIDButton` has none. So the wrapper supplies both: the
 * whole control dims and stops taking touches, and a spinner is laid over it in
 * Apple's own white. That is the same treatment the Google button gives itself
 * one level down, so the pair still behaves as one family.
 *
 * **Google** (Sign in with Google branding): the light button is `#FFFFFF`
 * with a `#747775` stroke and `#1F1F1F` text, and the "G" is the four-colour
 * mark — never redrawn in one ink, never tinted. That is why this file carries
 * its own SVG: a monochrome `logo-google` is off-spec by Google's own rules.
 * Google publishes no native iOS view, so this one stays hand-built — and it is
 * built to Google's spec rather than to ours, for the same reason Apple's is
 * now Apple's.
 *
 * The values themselves live in `theme/color.ts` under `provider`, quarantined
 * from the palette: a hex typed into a component is a value nobody re-measures,
 * and `color.test.ts` fails the build over one.
 */

/**
 * Sign in with Apple, drawn by iOS.
 *
 * Renders nothing when the native module is absent — the component's own
 * documented behaviour, and the reason `sign-in.tsx` holds availability as a
 * three-state and prints a line where this would have been rather than letting
 * the screen go quietly short of a control.
 */
export function AppleSignInButton({
  onPress,
  disabled = false,
  loading = false,
}: {
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  const inactive = disabled || loading;

  return (
    <View
      style={[styles.appleHost, inactive && styles.disabled]}
      // UIKit's button has no disabled state, so the wrapper is the disabled
      // state: it stops delivering touches at all rather than letting a second
      // tap start a second authorization while the first is in flight.
      pointerEvents={inactive ? 'none' : 'auto'}>
      <AppleAuthentication.AppleAuthenticationButton
        onPress={onPress}
        // CONTINUE, not SIGN_IN: this screen is the funnel's last step and is
        // reached by returning athletes too, so the label that covers both is
        // the honest one — and it is the exact counterpart of the Google button
        // beside it.
        buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
        buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
        cornerRadius={radius.md}
        style={styles.appleButton}
      />
      {loading ? (
        <View style={styles.appleSpinner} pointerEvents="none">
          <ActivityIndicator color={brand.appleInk} />
        </View>
      ) : null}
    </View>
  );
}

/**
 * Continue with Google. Same height, same radius, same press behaviour as the
 * Apple button above — everything the two brands do not dictate is shared.
 */
export function GoogleSignInButton({
  label,
  onPress,
  disabled = false,
  loading = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  const inactive = disabled || loading;

  return (
    <PressableScale
      onPress={onPress}
      disabled={inactive}
      haptic="medium"
      activeScale={0.98}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inactive }}
      style={[styles.btn, styles.google, inactive && styles.disabled]}
      pressedStyle={styles.googlePressed}>
      {loading ? (
        <ActivityIndicator color={brand.googleInk} />
      ) : (
        <View style={styles.row}>
          <GoogleMark size={moderateScale(18)} />
          <Text
            style={[styles.label, styles.googleLabel]}
            numberOfLines={1}
            maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {label}
          </Text>
        </View>
      )}
    </PressableScale>
  );
}

/**
 * The four-colour "G", at Google's published proportions on their 48-unit grid.
 * Not tintable on purpose: the spec forbids recolouring the mark, and a prop
 * that could do it is a prop somebody will eventually use.
 */
function GoogleMark({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Path
        fill={brand.googleBlue}
        d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"
      />
      <Path
        fill={brand.googleGreen}
        d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"
      />
      <Path
        fill={brand.googleYellow}
        d="M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24s.85 6.91 2.34 9.88l7.35-5.7z"
      />
      <Path
        fill={brand.googleRed}
        d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z"
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  /** The Apple button's box. The native view fills it; the spinner covers it. */
  appleHost: {
    height: CTA_HEIGHT,
    justifyContent: 'center',
  },
  appleButton: {
    width: '100%',
    height: CTA_HEIGHT,
  },
  appleSpinner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btn: {
    // The app's primary-button geometry, unchanged. Only the fill is theirs.
    minHeight: CTA_HEIGHT,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  google: {
    backgroundColor: brand.googleFill,
    borderWidth: 1, // Google's spec is a 1 px stroke, not a hairline
    borderColor: brand.googleStroke,
  },
  googlePressed: {
    // A fill change, never an opacity flash — the app's rule for every filled
    // control (`btnPrimaryPressed` in `primitives.tsx`).
    backgroundColor: brand.googleFillPressed,
  },
  disabled: {
    opacity: 0.4,
  },
  label: {
    fontSize: type.headline.fontSize,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  googleLabel: {
    color: brand.googleInk,
  },
});
