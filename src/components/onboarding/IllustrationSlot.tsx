import { Image } from 'expo-image';
import { useFocusEffect } from 'expo-router';
import { useVideoPlayer, VideoView, type VideoSource } from 'expo-video';
import { useCallback, useEffect } from 'react';
import { StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { EASE } from '@/lib/motion';
import { alpha, color, moderateScale, readingStyle } from '@/lib/theme';

import { illustrationFor } from './illustrations';
import { CARD_RADIUS, IDLE_CYCLE_MS, IDLE_RISE_PX, IDLE_SCALE } from './tokens';

/**
 * The mascot band of the onboarding flow (owner's restyle, 12 Aug 2026).
 *
 * The illustration is drawn DIRECTLY ON THE PAPER — no card, no border, no
 * tint, no shadow, no rounded clip. The art is flat line-work on the canvas's
 * own colour, so a frame around it only announced "this is an asset in a box";
 * without one the mascot simply stands on the page. Transparent PNGs (or a
 * Lottie, when one lands) are the expected export, and `contain` keeps the
 * whole figure visible whatever the band's aspect ratio.
 *
 * A slug with NO registered asset still renders the faint placeholder — that is
 * the one box left in the flow, and it exists so the layout ships before the
 * art does. Every slug that gains an entry in `illustrations.ts` loses its box
 * automatically.
 *
 * The figure breathes: ±3 pt of drift and a 2 % scale over 3.5 s, starting once
 * the entrance stagger has landed. It is a transform-only loop on the UI thread
 * (no layout property, no JS frame), and Reduce Motion never starts it — the
 * mascot is then simply still.
 */

export function IllustrationSlot({
  slug,
  height,
  /** When the idle loop may begin — after this screen's entrance has finished. */
  idleDelay = 0,
}: {
  slug: string;
  height: number;
  idleDelay?: number;
}) {
  const reduce = useReducedMotion();
  const asset = illustrationFor(slug);

  if (height <= 0) return null;

  return (
    <Idle delay={idleDelay} reduce={reduce}>
      <View style={[styles.wrap, { height }]} pointerEvents="none">
        {asset?.kind === 'video' ? (
          reduce ? (
            <Still source={asset.poster} />
          ) : (
            <LoopingVideo source={asset.source} poster={asset.poster} />
          )
        ) : asset?.kind === 'image' ? (
          <Still source={asset.source} />
        ) : (
          <View style={styles.placeholder}>
            <Text style={styles.slug} maxFontSizeMultiplier={1}>
              {slug}
            </Text>
          </View>
        )}
      </View>
    </Idle>
  );
}

/** The float-and-breathe loop. Transforms only, so it runs on the UI thread and
 * never touches layout — §4.3 forbids animating a layout property, and a JS
 * driver here would stutter against the entrance it follows. */
function Idle({
  children,
  delay,
  reduce,
}: {
  children: React.ReactNode;
  delay: number;
  reduce: boolean;
}) {
  const p = useSharedValue(0.5);

  useEffect(() => {
    if (reduce) return;
    const leg = IDLE_CYCLE_MS / 2;
    p.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: leg, easing: EASE.inOut }),
          withTiming(0, { duration: leg, easing: EASE.inOut }),
        ),
        -1,
        false,
      ),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: (p.value * 2 - 1) * IDLE_RISE_PX },
      { scale: 1 + p.value * IDLE_SCALE },
    ],
  }));

  return <Animated.View style={animatedStyle}>{children}</Animated.View>;
}

/** A still asset, whole and unframed. */
function Still({ source }: { source: ImageSourcePropType }) {
  return (
    <Image
      source={source}
      style={styles.asset}
      contentFit="contain"
      cachePolicy="memory-disk"
      transition={200}
      accessibilityIgnoresInvertColors
    />
  );
}

/**
 * A silent, looping illustration. The poster sits underneath so the band is
 * never empty while the first frame decodes, and the loop is tied to screen
 * focus: stepping forward in the flow pauses it rather than leaving it running
 * behind the stack. Muted and mixed with other audio — the clip must never
 * interrupt whatever the person is listening to on the way to the gym.
 */
function LoopingVideo({
  source,
  poster,
}: {
  source: VideoSource;
  poster: ImageSourcePropType;
}) {
  const player = useVideoPlayer(source, (p) => {
    p.loop = true;
    p.muted = true;
    p.audioMixingMode = 'mixWithOthers';
    p.play();
  });

  useFocusEffect(
    useCallback(() => {
      player.play();
      return () => player.pause();
    }, [player]),
  );

  return (
    <View style={styles.asset}>
      <Image
        source={poster}
        style={StyleSheet.absoluteFill}
        contentFit="contain"
        cachePolicy="memory-disk"
        accessibilityIgnoresInvertColors
      />
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit="contain"
        nativeControls={false}
        allowsFullscreen={false}
        allowsPictureInPicture={false}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
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
