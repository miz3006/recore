import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { Icon } from '@/components/icon';
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
 * So this is the same deliberate exception `BrandIcon.tsx` makes on the
 * attribution screen, one step further: there, marks are drawn in one ink
 * because a coloured logo among six would be an endorsement; here there are two
 * buttons, each is the endorsement, and each follows its owner's published
 * spec rather than ours.
 *
 * **Apple** (HIG, Sign in with Apple): black, white, or white-with-outline —
 * nothing else — with the Apple mark, a 44 pt minimum height, and a corner
 * radius anywhere from square to half the height. Black on this cream canvas,
 * at the app's `CTA_HEIGHT` and `radius.md`, so it is the same object as every
 * other primary button in the app apart from its fill.
 *
 * **Google** (Sign in with Google branding): the light button is `#FFFFFF`
 * with a `#747775` stroke and `#1F1F1F` text, and the "G" is the four-colour
 * mark — never redrawn in one ink, never tinted. That is why this file carries
 * its own SVG instead of reaching for `Icon`: the monochrome `logo-google` that
 * was here is off-spec by Google's own rules.
 *
 * What Recore keeps: the height, the radius, the label type, the press scale,
 * the spinner, the 0.4 disabled dip. The pair reads as one family in size and
 * weight — which is what the owner asked for — and differs only where the
 * brands require it.
 *
 * The values themselves live in `theme/color.ts` under `provider`, quarantined
 * from the palette: a hex typed into a component is a value nobody re-measures,
 * and `color.test.ts` fails the build over one. Apple's black is PURE black
 * there, not the app's warm ink — the HIG gives three appearances and a
 * near-black of our own is not among them.
 */

type Provider = 'apple' | 'google';

export function ProviderButton({
  provider,
  label,
  onPress,
  disabled = false,
  loading = false,
}: {
  provider: Provider;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  const inactive = disabled || loading;
  const apple = provider === 'apple';

  return (
    <PressableScale
      onPress={onPress}
      disabled={inactive}
      haptic="medium"
      activeScale={0.98}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inactive }}
      style={[styles.btn, apple ? styles.apple : styles.google, inactive && styles.disabled]}
      pressedStyle={apple ? styles.applePressed : styles.googlePressed}>
      {loading ? (
        <ActivityIndicator color={apple ? brand.appleInk : brand.googleInk} />
      ) : (
        <View style={styles.row}>
          {apple ? (
            <Icon name="apple" size={moderateScale(18)} tint={brand.appleInk} />
          ) : (
            <GoogleMark size={moderateScale(18)} />
          )}
          <Text
            style={[styles.label, apple ? styles.appleLabel : styles.googleLabel]}
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
  apple: {
    backgroundColor: brand.appleFill,
  },
  applePressed: {
    // A fill change, never an opacity flash — the app's rule for every filled
    // control (`btnPrimaryPressed` in `primitives.tsx`).
    backgroundColor: brand.appleFillPressed,
  },
  google: {
    backgroundColor: brand.googleFill,
    borderWidth: 1, // Google's spec is a 1 px stroke, not a hairline
    borderColor: brand.googleStroke,
  },
  googlePressed: {
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
  appleLabel: {
    color: brand.appleInk,
  },
  googleLabel: {
    color: brand.googleInk,
  },
});
