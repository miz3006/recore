import { useEffect, useRef, useState } from 'react';
import { Modal, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { FadeSlideIn } from '@/components/motion';
import { AppButton, Eyebrow } from '@/components/primitives';
import { measureTourTarget } from '@/components/tour-targets';
import { DUR, EASE } from '@/lib/motion';
import { isTourDone, markTourDone } from '@/lib/prefs';
import {
  inflate,
  pageRect,
  placeCard,
  scrimPathD,
  tabBarRect,
  TOUR_STEPS,
  type HoleRect,
} from '@/lib/tour';
import {
  alpha,
  color,
  MAX_FONT_SCALE,
  moderateScale,
  radius,
  shadow,
  spacing,
  TAB_BAR_CLEARANCE,
  type,
} from '@/lib/theme';

const AnimatedPath = Animated.createAnimatedComponent(Path);

/**
 * The first-open walk-through (owner, 29 Jul): an ink scrim with a spotlight
 * hole that walks Next → Next → Done across what the app can do — the page,
 * the day pill, and the three other tabs. The tab-bar precedent applied: an
 * explicit ask, built on the v2 system with nothing new attached (the scrim is
 * one evenodd path in `react-native-svg`, no dependency).
 *
 * It decides its own visibility on mount, the TrialReminderSheet's pattern:
 * shown once per account, and finishing OR skipping retires it for good. It
 * deliberately runs BEFORE the FIRST SESSION ledger's steps are taken — the
 * tour says what exists, the ledger makes the user do it; the two never repeat
 * each other.
 *
 * The hole eases between steps (§5.5's base timing); Reduce Motion jumps it.
 * Steps whose target cannot be measured are dropped, never shown pointing at
 * nothing (§1.1 invariant 6).
 */

type ResolvedStep = { title: string; body: string; hole: HoleRect };

/** The scrim is the ink at half strength — dark enough to spotlight, light
 * enough that the paper stays recognisably the same screen. */
const SCRIM = alpha(color.accent, 0.5);

/** First-render card height until onLayout reports the real one. */
const CARD_ESTIMATE = moderateScale(190);

export function SpotlightTour({ topInset }: { topInset: number }) {
  const insets = useSafeAreaInsets();
  const win = useWindowDimensions();
  const reduce = useReducedMotion();

  const [steps, setSteps] = useState<ResolvedStep[] | null>(null);
  const [index, setIndex] = useState(0);
  const [cardH, setCardH] = useState(0);

  // The nav block measures itself after mount, so the opening effect reads the
  // freshest value through a ref instead of closing over the first render.
  const topInsetRef = useRef(topInset);
  topInsetRef.current = topInset;
  const layoutRef = useRef({ win, bottom: insets.bottom });
  layoutRef.current = { win, bottom: insets.bottom };

  const hx = useSharedValue(0);
  const hy = useSharedValue(0);
  const hw = useSharedValue(0);
  const hh = useSharedValue(0);
  const hr = useSharedValue(0);

  const setHole = (hole: HoleRect, jump: boolean) => {
    if (jump || reduce) {
      hx.value = hole.x;
      hy.value = hole.y;
      hw.value = hole.w;
      hh.value = hole.h;
      hr.value = hole.r;
      return;
    }
    const cfg = { duration: DUR.base, easing: EASE.emphasized };
    hx.value = withTiming(hole.x, cfg);
    hy.value = withTiming(hole.y, cfg);
    hw.value = withTiming(hole.w, cfg);
    hh.value = withTiming(hole.h, cfg);
    hr.value = withTiming(hole.r, cfg);
  };

  useEffect(() => {
    if (isTourDone()) return;
    // Let the screen lay itself out first — the tour points at chrome.
    const t = setTimeout(() => {
      void (async () => {
        const { win: w, bottom } = layoutRef.current;
        const window = { w: w.width, h: w.height };
        const tab = inflate(tabBarRect(window, bottom, TAB_BAR_CLEARANCE, spacing.sm), 0, radius.xl);
        const page = inflate(pageRect(window, topInsetRef.current, tab.y, spacing.sm), 0, radius.lg);
        // Measured only when a step still asks for it. §7's five steps do not,
        // since the day-pill beat became "Finish and check-in" — and awaiting a
        // measurement nothing reads would delay the tour for no one.
        const day = TOUR_STEPS.some((s) => s.target === 'dayPill')
          ? await measureTourTarget('dayPill')
          : null;
        const resolved: ResolvedStep[] = [];
        for (const def of TOUR_STEPS) {
          const hole =
            def.target === 'page'
              ? page
              : def.target === 'tabBar'
                ? tab
                : day
                  ? inflate(day, spacing.xs, radius.pill)
                  : null;
          if (!hole || hole.h <= 0) continue;
          resolved.push({ title: def.title, body: def.body, hole });
        }
        if (resolved.length === 0) {
          markTourDone();
          return;
        }
        setHole(resolved[0].hole, true);
        setIndex(0);
        setSteps(resolved);
      })();
    }, 700);
    return () => clearTimeout(t);
    // Runs once; layout is read through refs at fire time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const finish = () => {
    markTourDone();
    setSteps(null);
  };

  const advance = () => {
    if (!steps) return;
    const next = index + 1;
    if (next >= steps.length) {
      finish();
      return;
    }
    setIndex(next);
    setHole(steps[next].hole, false);
  };

  const scrimProps = useAnimatedProps(() => ({
    d: scrimPathD(win.width, win.height, {
      x: hx.value,
      y: hy.value,
      w: hw.value,
      h: hh.value,
      r: hr.value,
    }),
  }));

  if (!steps) return null;

  const step = steps[index];
  const last = index === steps.length - 1;
  const top = placeCard(
    step.hole,
    { w: win.width, h: win.height },
    cardH || CARD_ESTIMATE,
    spacing.lg,
    topInset + spacing.sm,
  );

  return (
    <Modal visible transparent statusBarTranslucent animationType="fade" onRequestClose={finish}>
      <View style={styles.root} accessibilityViewIsModal>
        <Svg width={win.width} height={win.height} style={StyleSheet.absoluteFill}>
          <AnimatedPath animatedProps={scrimProps} fill={SCRIM} fillRule="evenodd" />
        </Svg>
        {/* Keyed per step so each one arrives with the app's one reveal. */}
        <FadeSlideIn key={index} duration={DUR.base} style={[styles.card, { top }]}>
          <View
            style={styles.cardInner}
            onLayout={(e) => setCardH(Math.round(e.nativeEvent.layout.height))}>
            <Eyebrow>{`${index + 1} of ${steps.length}`}</Eyebrow>
            <Text style={styles.title} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              {step.title}
            </Text>
            <Text style={styles.body} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              {step.body}
            </Text>
            <View style={styles.row}>
              <AppButton label="Skip" variant="ghost" compact onPress={finish} />
              <AppButton label={last ? 'Done' : 'Next'} variant="primary" compact onPress={advance} />
            </View>
          </View>
        </FadeSlideIn>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  card: {
    position: 'absolute',
    left: spacing.xl,
    right: spacing.xl,
    backgroundColor: color.surface,
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: color.border,
    ...shadow.raised,
  },
  cardInner: {
    padding: spacing.lg,
    gap: spacing.sm,
  },
  title: {
    ...type.headline,
    fontWeight: '600',
    color: color.textPrimary,
  },
  body: {
    ...type.subhead,
    color: color.textSecondary,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
});
