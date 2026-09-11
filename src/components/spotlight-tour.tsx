import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Modal,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { Icon } from '@/components/icon';
import { FadeSlideIn, PressableScale } from '@/components/motion';
import { AppButton } from '@/components/primitives';
import { measureTourTarget } from '@/components/tour-targets';
import { selection } from '@/lib/haptics';
import { DUR, EASE } from '@/lib/motion';
import { isTourOwed, markTourDone } from '@/lib/prefs';
import {
  caretOffset,
  inflate,
  pageRect,
  placeCard,
  scrimPathD,
  tabBarRect,
  tabSlotRect,
  TAB_COUNT,
  TOUR_STEPS,
  type HoleRect,
  type TourGlyph,
} from '@/lib/tour';
import {
  alpha,
  color,
  hairline,
  HIT,
  MAX_FONT_SCALE,
  moderateScale,
  radius,
  shadow,
  spacing,
  TAB_BAR_HEIGHT,
  TAB_BAR_MARGIN,
  TAB_BAR_SLOT_PAD,
  type,
} from '@/lib/theme';

const AnimatedPath = Animated.createAnimatedComponent(Path);

/**
 * The first-open walk-through (owner, 29 Jul): an ink scrim with a spotlight
 * hole that walks the writing page and then the three tabs a new person has not
 * opened. The tab-bar precedent applied: an explicit ask, built on the v2
 * system with nothing new attached (the scrim is one evenodd path in
 * `react-native-svg`, no dependency).
 *
 * It decides its own visibility on mount, the TrialReminderSheet's pattern:
 * shown once per account, and finishing OR skipping retires it for good. It
 * deliberately runs BEFORE the FIRST SESSION ledger's steps are taken — the
 * tour says what exists, the ledger makes the user do it; the two never repeat
 * each other.
 *
 * ## WHY IT LOOKS LIKE THIS (9 September 2026)
 *
 * The card is a **popover**, because that is what iOS uses to say a sentence
 * about a control: a leading system glyph, a title, a body, and a caret growing
 * out of the edge nearest the thing being talked about. The caret is the whole
 * argument — without it a card floating over a dimmed screen is a dialog that
 * happens to have a hole somewhere else on the page, and the eye has to guess
 * which of the two it is meant to read first.
 *
 * What that pass changed, and why each one:
 *
 * - **One tab at a time.** Three beats used to light the entire bar. See
 *   `lib/tour.ts`; the hole is now the named tab's own slot.
 * - **A caret, and card placement that earns it.** `placeCard` returns which
 *   edge it left from, and drops the caret entirely on the page steps, where
 *   the card rests inside the lit area.
 * - **Dots, not "3 of 5".** A page control is what iOS counts a sequence with.
 * - **An ✕ instead of a Skip button.** Leaving and continuing are not peers,
 *   and iOS never sets them side by side at the same weight. The dismissal is
 *   the quiet mark in the corner; the primary keeps the card's one filled pill.
 * - **Tap anywhere, or swipe.** A tour you can only advance by hitting a
 *   56 pt target is a form. The scrim takes a tap, a horizontal drag moves
 *   either way, and both give the same selection haptic a choice gives.
 * - **It opens when the header has been measured**, not 700 ms after mount. The
 *   page hole starts under the nav block, so a blind timer was a bet that
 *   layout had landed — and on a cold start it sometimes had not.
 *
 * The hole eases between steps (§5.5's base timing); Reduce Motion jumps it.
 * Steps whose target cannot be measured are dropped, never shown pointing at
 * nothing (§1.1 invariant 6).
 */

type ResolvedStep = {
  glyph: TourGlyph;
  title: string;
  body: string;
  hole: HoleRect;
};

/** The scrim is the ink at half strength — dark enough to spotlight, light
 * enough that the paper stays recognisably the same screen. Heavier than a
 * sheet's 0.3 backdrop on purpose: a sheet dims what it covers, a spotlight has
 * to make the one lit thing read as lit. */
const SCRIM = alpha(color.accent, 0.5);

/** First-render card height until onLayout reports the real one. */
const CARD_ESTIMATE = moderateScale(190);

/** The popover's pointer: a square stood on its corner, half-buried under the
 * card body so only the outer V shows. 16 pt across the diagonal is UIKit's
 * own popover arrow, near enough. */
const CARET = moderateScale(16);

/** How long after the nav block reports its height the tour opens. Long enough
 * that the screen's own entrance has finished and the tour is not competing
 * with it; short enough that it still reads as part of arriving. */
const OPEN_DELAY = DUR.xslow;

/** How far a horizontal drag has to travel before it counts as a page turn. */
const SWIPE = 48;

export function SpotlightTour({ topInset }: { topInset: number }) {
  const win = useWindowDimensions();
  const reduce = useReducedMotion();

  const [steps, setSteps] = useState<ResolvedStep[] | null>(null);
  const [index, setIndex] = useState(0);
  const [cardH, setCardH] = useState(0);
  const opened = useRef(false);

  // The opening timer fires half a second after the render that started it, so
  // it must read the freshest window and header height rather than the ones the
  // effect closed over. Written in an effect, not during render: a ref updated
  // mid-render is the one way this pattern can tear.
  const layoutRef = useRef({ win, topInset });
  useEffect(() => {
    layoutRef.current = { win, topInset };
  });

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

  /**
   * Opens once, and only after the nav block has reported a height — the page
   * hole starts under it, so `topInset === 0` would spotlight the header.
   *
   * THE GATE IS "OWED", NOT "NOT YET DONE" (11 September 2026). It used to be
   * `!isTourDone()`, i.e. the absence of a device-local flag, which is also the
   * state of a returning athlete's brand-new phone. `isTourOwed` answers the
   * question the owner actually asked — did this person just make a profile —
   * and `prefs.ts` has the three ways the old reading got it wrong.
   */
  useEffect(() => {
    if (opened.current || topInset <= 0 || !isTourOwed()) return;
    const t = setTimeout(() => {
      void (async () => {
        if (opened.current) return;
        const { win: w, topInset: top } = layoutRef.current;
        const window = { w: w.width, h: w.height };
        const bar = tabBarRect(window, TAB_BAR_MARGIN, TAB_BAR_HEIGHT);
        const page = inflate(pageRect(window, top, bar.y, spacing.sm), 0, radius.xl);
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
                ? inflate(
                    tabSlotRect(bar, def.tab ?? 0, TAB_COUNT, TAB_BAR_SLOT_PAD),
                    0,
                    radius.pill,
                  )
                : day
                  ? inflate(day, spacing.xs, radius.pill)
                  : null;
          if (!hole || hole.h <= 0 || hole.w <= 0) continue;
          resolved.push({ glyph: def.glyph, title: def.title, body: def.body, hole });
        }
        if (resolved.length === 0) {
          markTourDone();
          return;
        }
        opened.current = true;
        /**
         * SPENT ON SIGHT, not on completion. `finish` also calls this, and
         * that used to be the ONLY caller — so force-quitting on step two, or
         * anything else that took the app away mid-tour, left the flag unwritten
         * and the whole walk-through replayed on the next launch. Being shown is
         * what "shown once" means; `markTourDone` is idempotent, so the call in
         * `finish` costs nothing and keeps that path honest on its own.
         */
        markTourDone();
        setHole(resolved[0].hole, true);
        setIndex(0);
        setSteps(resolved);
      })();
    }, OPEN_DELAY);
    return () => clearTimeout(t);
    // Layout is read through the ref at fire time; `topInset` is here only
    // because it is the gate.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topInset]);

  const finish = () => {
    markTourDone();
    setSteps(null);
  };

  /** Move by one beat. `-1` walks back; running off either end is a no-op
   * backwards and the finish forwards. */
  const go = (delta: number) => {
    if (!steps) return;
    const next = index + delta;
    if (next < 0) return;
    if (next >= steps.length) {
      finish();
      return;
    }
    selection();
    setIndex(next);
    setHole(steps[next].hole, false);
    AccessibilityInfo.announceForAccessibility(
      `${steps[next].title}. Step ${next + 1} of ${steps.length}.`,
    );
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

  /**
   * The two ways past the buttons — and they are attached at DIFFERENT depths
   * on purpose.
   *
   * The drag wraps everything, because a swipe should work wherever the thumb
   * happens to be resting, and it cannot be confused with a press: it needs
   * half the page-turn distance before it activates, by which point the
   * `Pressable` under it has already cancelled itself.
   *
   * The tap goes on a catcher BEHIND the card, not around it. A tap gesture on
   * the parent fires for taps on its children too, so wrapping the card would
   * make one press of Continue advance twice — and one press of the ✕ finish
   * and then advance. Hit-testing hands a touch to the topmost view under it,
   * so a card rendered after the catcher takes its own taps and the scrim takes
   * the rest.
   */
  const tap = Gesture.Tap().onEnd((_e, ok) => {
    if (ok) runOnJS(go)(1);
  });
  const pan = Gesture.Pan()
    .minDistance(SWIPE / 2)
    .onEnd((e) => {
      if (e.translationX <= -SWIPE) runOnJS(go)(1);
      else if (e.translationX >= SWIPE) runOnJS(go)(-1);
    });

  if (!steps) return null;

  const step = steps[index];
  const last = index === steps.length - 1;
  const gutter = spacing.xl;
  const cardW = win.width - gutter * 2;
  const { top, caret } = placeCard(
    step.hole,
    { w: win.width, h: win.height },
    cardH || CARD_ESTIMATE,
    spacing.lg,
    topInset + spacing.sm,
  );
  const caretLeft = caretOffset(step.hole, gutter, cardW, CARET, radius.xl);

  return (
    <Modal visible transparent statusBarTranslucent animationType="fade" onRequestClose={finish}>
      <GestureHandlerRootView style={styles.root}>
        <GestureDetector gesture={pan}>
          <View style={styles.root} accessibilityViewIsModal>
            <Svg width={win.width} height={win.height} style={StyleSheet.absoluteFill}>
              <AnimatedPath animatedProps={scrimProps} fill={SCRIM} fillRule="evenodd" />
            </Svg>
            {/* Tap anywhere that is not the card. Behind it, so the card's own
                buttons are never pressed twice — see the gesture note above. */}
            <GestureDetector gesture={tap}>
              <View style={StyleSheet.absoluteFill} />
            </GestureDetector>
            {/* Keyed per step so each one arrives with the app's one reveal. */}
            <FadeSlideIn
              key={index}
              duration={DUR.base}
              style={[styles.card, { top, left: gutter, right: gutter }]}>
              {/* Painted before the body so the body's own fill buries the two
                  inner edges of the rotated square and leaves the outer V. */}
              {caret !== 'none' ? (
                <View
                  style={[
                    styles.caret,
                    { left: caretLeft },
                    caret === 'up' ? styles.caretUp : styles.caretDown,
                  ]}
                />
              ) : null}
              <View
                style={styles.cardInner}
                onLayout={(e) => setCardH(Math.round(e.nativeEvent.layout.height))}>
                <View style={styles.head}>
                  <Icon name={step.glyph} size={20} tint={color.brand} />
                  <Text style={styles.title} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                    {step.title}
                  </Text>
                  <PressableScale
                    onPress={finish}
                    style={styles.close}
                    hitSlop={spacing.sm}
                    accessibilityRole="button"
                    accessibilityLabel="Skip the tour">
                    <Icon name="close" size={22} tint={color.textMuted} />
                  </PressableScale>
                </View>
                <Text style={styles.body} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                  {step.body}
                </Text>
                <View style={styles.row}>
                  <View
                    style={styles.dots}
                    accessibilityRole="progressbar"
                    accessibilityLabel={`Step ${index + 1} of ${steps.length}`}>
                    {steps.map((s, i) => (
                      <View
                        key={s.title}
                        style={[styles.dot, i === index ? styles.dotOn : styles.dotOff]}
                      />
                    ))}
                  </View>
                  <AppButton
                    label={last ? 'Start writing' : 'Continue'}
                    variant="primary"
                    compact
                    onPress={() => go(1)}
                  />
                </View>
              </View>
            </FadeSlideIn>
          </View>
        </GestureDetector>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  card: {
    position: 'absolute',
  },
  cardInner: {
    backgroundColor: color.surface,
    borderRadius: radius.xl,
    borderCurve: 'continuous',
    borderWidth: hairline,
    borderColor: color.border,
    padding: spacing.xl,
    gap: spacing.md,
    ...shadow.raised,
  },
  caret: {
    position: 'absolute',
    width: CARET,
    height: CARET,
    backgroundColor: color.surface,
    borderWidth: hairline,
    borderColor: color.border,
    transform: [{ rotate: '45deg' }],
  },
  // Half of the square pokes past the card's edge; the buried half is what the
  // body paints over.
  caretUp: {
    top: -CARET / 2,
  },
  caretDown: {
    bottom: -CARET / 2,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: {
    ...type.headline,
    fontWeight: '600',
    color: color.textPrimary,
    flex: 1,
  },
  close: {
    width: HIT,
    height: HIT,
    alignItems: 'flex-end',
    justifyContent: 'center',
    // Pulled back into the padding so the glyph lines up with the card's right
    // edge while the target it sits in stays 44 pt.
    marginRight: -spacing.md,
    marginVertical: -spacing.md,
  },
  body: {
    ...type.subhead,
    color: color.textSecondary,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm - 2,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: radius.pill,
  },
  // Ink, not brand: the funnel's progress rail settled this — a counter states
  // where you are, it does not offer itself as a control.
  dotOn: {
    backgroundColor: color.accent,
  },
  dotOff: {
    backgroundColor: color.border,
  },
});
