import { Image } from 'expo-image';
import {
  StyleSheet,
  Text,
  View,
  type ImageSourcePropType,
  type ImageStyle,
  type StyleProp,
} from 'react-native';

import { alpha, color, moderateScale, readingStyle } from '@/lib/theme';

import { hasArtwork, layoutFor } from './illustration-layout';
import { illustrationFor } from './illustrations';
import { CARD_RADIUS } from './tokens';

/**
 * The mascot band of the onboarding flow.
 *
 * The illustration is drawn DIRECTLY ON THE PAPER — no card, no border, no
 * tint, no shadow, no rounded clip. The art is flat line-work on the canvas's
 * own colour, so a frame around it only announced "this is an asset in a box";
 * without one the mascot simply stands on the page. Transparent PNGs are the
 * expected export, and `contain` keeps the whole figure visible whatever the
 * band's aspect ratio.
 *
 * A slug that is WAITING for an asset still renders the faint placeholder —
 * that is the one box left in the flow, and it exists so the layout ships
 * before the art does. Every slug that gains an entry in `illustrations.ts`
 * loses its box automatically.
 *
 * A slug that will never have one renders NOTHING (`hasArtwork`). Until 14 Aug
 * 2026 it did not, and the three typographic screens each carried a large empty
 * box with their own slug printed in the middle — `building` and `founder-note`
 * are in the owner's recording exactly like that. "No illustration" and "the
 * illustration has not landed yet" look identical on screen unless the code
 * knows the difference, so now it does.
 *
 * ## The mascot is STILL (owner's spec §A, 13 Aug 2026)
 *
 * It used to float and breathe on an endless reanimated loop. It no
 * longer moves at all: a drawing that never stops moving is a drawing the eye
 * never stops watching, and the question underneath it is what the screen is
 * for. The ONE motion left is the flow's own staggered entrance (the parent's
 * `Enter`, the first beat of it), which plays once per screen and then it is
 * over. That is also why a `video` entry renders its POSTER here — an animated
 * asset would be a loop by another name.
 *
 * The band it sits in also follows the keyboard on the typed step, but that is
 * the BAND's height, not the drawing's own motion — see `band.ts`.
 *
 * ## Placement
 *
 * The band sizes the slot; `illustration-layout.ts` says how the artwork sits
 * inside it. `contain` is the fit, and the manifest's `scale`/`offsetX/Y` are a
 * static transform on top of it — the correction for artwork whose own bounding
 * box does not read at the same visual size as the drawing beside it in the
 * flow. A transform, never a layout property, so the correction costs no
 * measurement pass and cannot move anything else on the page.
 */
export function IllustrationSlot({ slug }: { slug: string }) {
  const asset = illustrationFor(slug);
  const { scale, offsetX, offsetY } = layoutFor(slug);

  if (!hasArtwork(slug)) return null;

  const placement: StyleProp<ImageStyle> = {
    transform: [{ translateX: offsetX }, { translateY: offsetY }, { scale }],
  };

  return (
    <View style={styles.wrap} pointerEvents="none">
      {asset?.kind === 'video' ? (
        <Still source={asset.poster} style={placement} />
      ) : asset?.kind === 'image' ? (
        <Still source={asset.source} style={placement} />
      ) : (
        <View style={styles.placeholder}>
          <Text style={styles.slug} maxFontSizeMultiplier={1}>
            {slug}
          </Text>
        </View>
      )}
    </View>
  );
}

/** A still asset, whole and unframed. */
function Still({
  source,
  style,
}: {
  source: ImageSourcePropType;
  style?: StyleProp<ImageStyle>;
}) {
  return (
    <Image
      source={source}
      style={[styles.asset, style]}
      contentFit="contain"
      cachePolicy="memory-disk"
      accessibilityIgnoresInvertColors
    />
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  asset: {
    width: '100%',
    height: '100%',
  },
  /** The ONE box left in the flow: where an illustration will go. It disappears
   * the moment its slug gets an entry in the registry. */
  placeholder: {
    width: '100%',
    height: '100%',
    borderWidth: 1,
    borderColor: alpha(color.accent, 0.08),
    borderRadius: CARD_RADIUS,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  slug: {
    ...readingStyle('500'),
    fontSize: moderateScale(12),
    letterSpacing: 0.4,
    color: color.textMuted,
  },
});
