import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { arrive } from '@/lib/motion/index';
import { color, moderateScale, spacing, type } from '@/lib/theme';

import { PhoneFrame, phoneMetrics } from './PhoneFrame';

/**
 * THE LOCK SCREEN, WITH THE RECAP ARRIVING — screen 20's hero (owner,
 * 16 September 2026: *"iPhone frame showing a lock screen where a Recore
 * weekly-recap notification slides in"*).
 *
 * The banner's words are built from THEIR answers, exactly as `lib/recap.ts`
 * will build the real one: the day from the row selected below, the session
 * count from the frequency they gave — never a statistic about anyone else.
 * Asking for a permission is the one moment the app must show its work
 * (research: every winning priming screen previews the actual message), and
 * the preview being their own number is what makes it a promise rather than
 * an ad.
 *
 * The slide-in LOOPS gently — in, read, out — on the same owner's directive
 * that made the hero loop. Reduce Motion pins the banner in place.
 */
export function LockScreenDemo({
  width,
  /** 'sunday' | 'monday' | null — the row currently selected below. */
  choice,
  /** Sessions a week, from screen 12's answer. Null when unanswered. */
  perWeek,
}: {
  width: number;
  choice: string | null;
  perWeek: number | null;
}) {
  const reduced = useReducedMotion();
  const [cycle, setCycle] = useState(0);
  const arrived = useSharedValue(reduced ? 1 : 0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    if (reduced) {
      arrived.value = 1;
      return;
    }
    const scheduled: ReturnType<typeof setTimeout>[] = [];
    timers.current = scheduled;
    const at = (ms: number, fn: () => void) => scheduled.push(setTimeout(fn, ms));

    arrived.value = 0;
    at(700, () => {
      arrived.value = withSpring(1, arrive);
    });
    at(3600, () => {
      arrived.value = withTiming(0, { duration: 380 });
    });
    at(4400, () => setCycle((c) => c + 1));

    return () => {
      scheduled.forEach(clearTimeout);
      timers.current = [];
    };
  }, [arrived, cycle, reduced]);

  const banner = useAnimatedStyle(() => ({
    opacity: arrived.value,
    transform: [{ translateY: (1 - arrived.value) * -46 }, { scale: 0.94 + arrived.value * 0.06 }],
  }));

  const day = choice === 'monday' ? 'Monday' : 'Sunday';
  const period = choice === 'monday' ? 'last week' : 'this week';
  const body =
    perWeek != null && perWeek > 0
      ? `${perWeek} ${perWeek === 1 ? 'session' : 'sessions'} ${period}.`
      : `Your training week, in one short read.`;

  const { screenW } = phoneMetrics(width);
  const scale = screenW / LOGICAL_W;

  return (
    <PhoneFrame width={width} screenColor={color.deviceScreen} statusBar="light" time="">
      {/* THE WALLPAPER (owner, 16 Sep 2026, second pass: "naj bo nek
          background da ni crno") — a dusk-blue gradient in the brand's own
          family, the shape every stock iOS wallpaper takes: deep at the
          clock, lifting towards the bottom. Content, not chrome — the app's
          no-gradient rule governs its own surfaces, and this is a picture of
          somebody's lock screen. */}
      <LinearGradient
        colors={WALLPAPER}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View
        pointerEvents="none"
        style={[styles.page, { width: LOGICAL_W, height: LOGICAL_W * 2.16, transform: [{ scale }] }]}>
        <Text style={styles.date} maxFontSizeMultiplier={1.2}>
          {day} {choice === 'monday' ? 'morning' : 'evening'}
        </Text>
        <Text style={styles.clock} maxFontSizeMultiplier={1.2}>
          {choice === 'monday' ? '7:30' : '19:30'}
        </Text>

        <Animated.View style={[styles.banner, banner]}>
          <Image
            source={require('../../../assets/images/icon.png')}
            style={styles.appIcon}
            contentFit="cover"
            transition={0}
          />
          <View style={styles.bannerBody}>
            <View style={styles.bannerHead}>
              <Text style={styles.bannerTitle} maxFontSizeMultiplier={1.2}>
                Weekly recap
              </Text>
              <Text style={styles.bannerWhen} maxFontSizeMultiplier={1.2}>
                now
              </Text>
            </View>
            <Text style={styles.bannerText} maxFontSizeMultiplier={1.2} numberOfLines={2}>
              {body}
            </Text>
          </View>
        </Animated.View>
      </View>
    </PhoneFrame>
  );
}

const LOGICAL_W = 360;

/** Deep blue at the top, lifting to a hazy blue at the bottom — hex-free on
 * purpose; these belong to the mockup's picture, not to the app's palette. */
const WALLPAPER = [
  'rgba(16,32,74,1)',
  'rgba(38,64,132,1)',
  'rgba(96,132,200,1)',
] as const;

const styles = StyleSheet.create({
  page: {
    position: 'absolute',
    top: 0,
    left: 0,
    transformOrigin: 'top left',
    alignItems: 'center',
    paddingTop: 84,
  },
  date: {
    ...type.subhead,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.75)',
  },
  clock: {
    fontSize: moderateScale(78),
    lineHeight: moderateScale(86),
    fontWeight: '200',
    letterSpacing: -1,
    color: 'rgba(255,255,255,0.96)',
    fontVariant: ['tabular-nums'],
  },
  /** iOS's own banner grammar: icon left, title row with "now", body under. */
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.xxl,
    marginHorizontal: spacing.lg,
    alignSelf: 'stretch',
    backgroundColor: 'rgba(245,245,247,0.95)',
    borderRadius: 24,
    borderCurve: 'continuous',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    // The banner floats over the wallpaper the way iOS's own does — a soft
    // deep cast, cut off with the rest of the phone by the band's fade.
    shadowColor: color.device,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
  },
  appIcon: { width: moderateScale(38), height: moderateScale(38), borderRadius: 9 },
  bannerBody: { flex: 1 },
  bannerHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  bannerTitle: { ...type.subhead, fontWeight: '600', color: color.textPrimary },
  bannerWhen: { ...type.caption, color: 'rgba(60,60,67,0.6)' },
  bannerText: { ...type.subhead, color: color.textSecondary, marginTop: 1 },
});
