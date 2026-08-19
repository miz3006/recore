import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { type StyleProp, type ViewStyle } from 'react-native';
import Animated, { FadeIn, FadeInDown, useReducedMotion } from 'react-native-reanimated';

import { EASE } from '@/lib/motion';

import { ENTER_MS, RISE_PX } from './tokens';

/**
 * ONE entrance for the whole funnel.
 *
 * Every zone of every step arrives through this: the illustration, the
 * headline, each option row, the button. It is a Reanimated LAYOUT ANIMATION
 * (`entering`) rather than a mounted component driving its own shared value,
 * which is the difference between one worklet per zone and — on a five-option
 * screen — six components each holding a shared value, an effect and an
 * animated style for a single 250 ms fade they will never run again.
 *
 * ## The builder is built in `useMemo`, NOT at module scope
 *
 * This looks like the case for one shared builder per preset, and it is not.
 * Reanimated's builder modifiers MUTATE and return the same object —
 * `BaseAnimationBuilder.delay()` is literally `this.delayV = ms; return this` —
 * so a module-scope `RISE` shared by every zone would have one `delayV`, and
 * the last `.delay()` of the render would silently become the delay of the
 * whole screen. The stagger would collapse into a single beat and look like a
 * plain fade with a random offset.
 *
 * Chaining from the STATIC (`FadeInDown.duration(...)`) calls `createInstance()`
 * and hands back a fresh object, so each zone owns its own. `useMemo` on the
 * delay is what keeps a row that re-renders — because an answer changed — from
 * building a new one and re-arming its entrance.
 *
 * The parts that never vary live at module scope below, because those ARE safe
 * to share: they are plain values, not builders.
 *
 * ## Reduce Motion keeps the fade and drops the travel
 *
 * Not "no animation": a zone appearing with no transition at all is the jarring
 * change the setting exists to prevent. Reduced motion means FEWER and GENTLER,
 * so the opacity ramp stays and the 12 pt rise goes.
 *
 * ## The stagger expires
 *
 * A delay is only honest while the page is still arriving. The lifts step
 * mounts a label and a row every time a chip is tapped, and those were
 * inheriting `contentDelay` — a number computed for a page load — so content
 * summoned by a finger did not begin to appear for a fifth of a second and was
 * not fully there for half of one. That is the difference between a screen
 * settling and a screen lagging, and it is the same code either way, so the
 * code has to know which it is doing.
 *
 * `EntranceWindow` answers that. It is open for as long as the arrival takes
 * and shut afterwards; once shut, every `Enter` under it drops its delay to
 * zero and simply fades in. Direct manipulation gets an immediate response, a
 * fresh page still gets its reading order, and no call site has to pass a flag.
 *
 * The flip is ONE re-render per screen, on a timer, never per frame. Changing
 * `entering` after mount does nothing to an element that has already entered,
 * so the zones already on the page are unaffected.
 *
 * ## Never on a virtualized row
 *
 * Everything in this flow is a static `.map()` over a config array — no
 * `FlatList`, no `FlashList` — which is the only reason `entering` is safe here.
 * Recycled rows re-fire their entrance every time they scroll back into view,
 * and the list appears to flicker while the user scrolls. If a screen of this
 * funnel ever becomes virtualized, this component must not follow it in.
 */

/**
 * Where the rise starts. Never `scale(0)` or a long throw — 12 pt is the
 * distance that reads as "this settled into place" rather than as travel.
 */
const FROM = { opacity: 0, transform: [{ translateY: RISE_PX }] } as const;

/** True while the screen is still arriving. Default true so an `Enter` used
 * outside a provider behaves exactly as it always did. */
const EntranceOpen = createContext(true);

/**
 * How long the arrival lasts: the last zone's delay plus its own duration.
 *
 * The last beat is the CTA at 320 ms (or the welcome's footer one step behind
 * it), and every zone runs for `ENTER_MS`, so the page has finished by 610 ms.
 * Because both halves are capped this is a constant rather than something each
 * screen has to compute — and it is deliberately a little long: closing the
 * window early would strip the stagger off a zone that is still arriving, which
 * is a worse failure than leaving a delay on a tap nobody could have made yet.
 */
const ENTRANCE_WINDOW_MS = 650;

/** Wraps a screen so its stagger expires once the page has finished arriving. */
export function EntranceWindow({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setOpen(false), ENTRANCE_WINDOW_MS);
    return () => clearTimeout(t);
  }, []);

  return <EntranceOpen.Provider value={open}>{children}</EntranceOpen.Provider>;
}

export function Enter({
  delay = 0,
  style,
  layout,
  children,
}: {
  /** Milliseconds after mount. Use `slotDelay` / `contentDelay`, never a literal. */
  delay?: number;
  style?: StyleProp<ViewStyle>;
  /**
   * A layout transition for a zone whose NEIGHBOURS move after the entrance is
   * over — the lift rows, which push each other down as lifts are chosen. The
   * caller decides, because most zones never move again and a layout animation
   * they never use still costs a subscription.
   */
  layout?: React.ComponentProps<typeof Animated.View>['layout'];
  children: React.ReactNode;
}) {
  const reduce = useReducedMotion();
  // Past the arrival window this is content responding to a tap, not a page
  // being read top to bottom, so it owes the reader no beat.
  const open = useContext(EntranceOpen);
  const wait = open ? delay : 0;

  const entering = useMemo(
    () =>
      reduce
        ? FadeIn.duration(ENTER_MS).easing(EASE.emphasized).delay(wait)
        : FadeInDown.duration(ENTER_MS)
            .easing(EASE.emphasized)
            .withInitialValues(FROM)
            .delay(wait),
    [wait, reduce],
  );

  return (
    <Animated.View entering={entering} layout={layout} style={style}>
      {children}
    </Animated.View>
  );
}
