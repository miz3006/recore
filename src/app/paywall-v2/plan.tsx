import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/icon';
import { Check } from '@/components/paywall-v2/Check';
import { paywallCopy } from '@/components/paywall-v2/copy';
import { PlanCard } from '@/components/paywall-v2/PlanCard';
import { trialTimeline } from '@/components/paywall-v2/timeline';
import { TrialTimeline } from '@/components/paywall-v2/TrialTimeline';
import { track } from '@/lib/analytics';
import { useAuth } from '@/lib/auth/provider';
import { savePct, type Plan } from '@/lib/billing/pricing';
import { purchase, restore } from '@/lib/billing/state';
import {
  fetchOffer,
  isStoreConfigured,
  isTestStore,
  type StoreOffer,
  type StorePlan,
} from '@/lib/billing/store';
import { markPaywallShown, markPlanSelected } from '@/lib/funnel';
import { tap } from '@/lib/haptics';
import type { LegalDocId } from '@/lib/legal';
import { EASE } from '@/lib/motion';
import { Enter, PressScale } from '@/lib/motion/index';
import {
  color,
  CTA_HEIGHT,
  HIT,
  MAX_FONT_SCALE,
  moderateScale,
  radius,
  shadow,
  spacing,
  type,
} from '@/lib/theme';
import { useV2 } from '@/state/onboarding-v2';

/**
 * /paywall-v2/plan — THE MONEY SCREEN, and the funnel's paywall since 28
 * August 2026 (owner's ruling). The illustrated screen it replaced still lives
 * at `src/app/paywall.tsx` and is reachable from the You tab's development
 * rows; everything commercial is shared code — one `fetchOffer`, one
 * `purchase`, one entitlement — so the swap changed the picture and none of the
 * promises.
 *
 * Screen 3 of three (trial offer → trial reminder → plan selection), and the
 * one built first because it decides the other two: the trial length, the
 * price, the plan and the legal sentence all resolve here, and the two screens
 * in front of it can only restate what this one establishes.
 *
 * ## The layout is not this repository's invention
 *
 * Cal AI's `Trial Plan Selection` (`6480417616/pay_8ixcs`) scores 0.86–0.91
 * against plan screens in five unrelated categories — a Mandarin tutor, an
 * outfit planner, a Quran widget, an antiques identifier, a homework app. Five
 * products with nothing in common converged on one anatomy, so it is an
 * industry pattern rather than one company's taste, and there is no upside in
 * being novel about it:
 *
 *   back chevron → bold headline → vertical trial timeline → two plan cards,
 *   annual preselected → "no payment due now" with a check → full-width pill
 *   CTA → legal fine print, smallest type on the screen.
 *
 * What is Recore's is everything inside that skeleton: the warm canvas, the
 * one blue, the reading face on the numbers, and copy built out of what the
 * person answered rather than out of adjectives.
 *
 * ## One accent, spent twice
 *
 * Brand blue appears on the timeline's three nodes and on the selected card's
 * border and check. Nowhere else — the "7 days free" tab is ink, the CTA is
 * the brand fill it is app-wide, the saving is plain grey text. PLANNED green
 * never appears on this screen: nothing here is a prescribed load.
 *
 * ## Nothing on it is fabricated
 *
 * No reviews, no ratings, no user counts, no testimonials, no countdown, no
 * "limited time". CLAUDE.md §3, and the reason `sim_relic_plan`'s "$50M+ in
 * value scanned · 4.9 star rating" band is the one element of the reference
 * that was studied and deliberately not built. There is no real social proof
 * yet, so the space stays empty rather than being filled with a placeholder.
 *
 * EVERY PRICE COMES FROM THE STORE. `fetchOffer` reads Apple's own localized
 * `priceString`; an unreachable store shows no amount at all and a CTA that
 * says so. §2 rule 5.
 */

/** Annual is preselected, and the four conditions that makes legitimate all
 * hold here: both cards are equally visible and equally tappable, the annual
 * shows its real total and its true per-month equivalent, the saving is
 * computed from the two live prices rather than asserted, and switching is one
 * tap with no confirmation. */
const DEFAULT_PLAN: Plan = 'annual';

export default function PaywallV2Plan() {
  const router = useRouter();
  const { session } = useAuth();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();

  const answers = useV2((s) => s.answers);
  // Frozen on mount. The headline names what the person chose and the load is
  // the one the reveal printed; neither may change under them while they read.
  const [copy] = useState(() => paywallCopy(answers));

  const [plan, setPlan] = useState<Plan>(DEFAULT_PLAN);
  const [offer, setOffer] = useState<StoreOffer | null>(null);
  const [offerState, setOfferState] = useState<'loading' | 'ready' | 'unavailable'>(
    isStoreConfigured() ? 'loading' : 'unavailable',
  );
  const [busy, setBusy] = useState<null | 'purchase' | 'restore'>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingPurchase, setPendingPurchase] = useState(false);

  useEffect(() => {
    // THE DENOMINATOR of every conversion number in the funnel (§13), and it
    // is counted here because this screen became the funnel's paywall on 28
    // August 2026. It is a local counter in `meta`, never a third-party SDK,
    // and it is impossible to backfill once the first installs have happened.
    markPaywallShown();
    track('paywall_view', {
      variant: 'v2',
      screen: 'plan',
      has_number: copy.hasNumber,
      has_name: copy.hasName,
    });
  }, [copy.hasName, copy.hasNumber]);

  useEffect(() => {
    let alive = true;
    if (!isStoreConfigured()) return;
    void fetchOffer().then((next) => {
      if (!alive) return;
      setOffer(next);
      setOfferState(next?.annual || next?.monthly ? 'ready' : 'unavailable');
    });
    return () => {
      alive = false;
    };
  }, []);

  const annual = offer?.annual ?? null;
  const monthly = offer?.monthly ?? null;
  const selected: StorePlan | null = plan === 'annual' ? annual : monthly;
  const canBuy = offerState === 'ready' && selected != null;

  /** The trial the STORE offers on the selected plan — never a constant. Both
   * products carry the same seven days today; if App Store Connect ever
   * disagrees, the timeline follows the store rather than this file. */
  const trialDays = selected?.trialDays ?? 0;

  const steps = useMemo(
    () =>
      trialTimeline(
        trialDays,
        { body: copy.today, strong: copy.todayStrong },
        selected?.priceLabel ?? null,
      ),
    [copy.today, copy.todayStrong, selected?.priceLabel, trialDays],
  );

  /**
   * THE ONE MOTION MOMENT. The CTA's glow swells once on arrival and then the
   * button is simply a button. A LOOP would be a countdown by another name —
   * the urgency pressure CLAUDE.md §2 rule 6 rules out. Reduce Motion never
   * fires it.
   *
   * It crossfades a pre-shadowed layer rather than animating `shadowRadius`,
   * which is not a composited property and re-renders the shadow every frame.
   */
  const glow = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    glow.set(
      withDelay(
        600,
        withSequence(
          withTiming(1, { duration: 540, easing: EASE.inOut }),
          withTiming(0, { duration: 660, easing: EASE.inOut }),
        ),
      ),
    );
  }, [glow, reduced]);
  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.get() }));

  const runPurchase = useCallback(async () => {
    if (busy) return;
    setBusy('purchase');
    setNotice(null);
    try {
      const outcome = await purchase(plan, session?.user.id);
      switch (outcome.status) {
        case 'purchased':
          router.replace('/');
          return;
        case 'cancelled':
          // Closing Apple's sheet is a choice, not an error, and is never
          // phrased as one.
          return;
        case 'pending':
          setNotice(
            'Apple is waiting for approval. Nothing is charged yet, and Recore opens as soon as it goes through.',
          );
          return;
        case 'already-owned':
          setNotice(
            'This Apple Account already has Recore. Tap Restore below — you will not be charged twice.',
          );
          return;
        case 'offline':
          setNotice('Recore could not reach the App Store. Nothing was charged.');
          return;
        case 'not-allowed':
          setNotice('Purchases are turned off on this device. Nothing was charged.');
          return;
        case 'unavailable':
          setNotice('That plan is not available on your App Store account right now.');
          return;
        default:
          setNotice('The purchase did not go through. Nothing was charged.');
      }
    } finally {
      setBusy(null);
    }
  }, [busy, plan, router, session?.user.id]);

  // The account arrived while this screen waited: finish what the CTA started.
  useEffect(() => {
    if (!pendingPurchase || session === null) return;
    setPendingPurchase(false);
    void runPurchase();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingPurchase, session]);

  /** Plan first, then the account, then the store's own sheet. An account is
   * required before a trial can start, so a signed-out CTA opens sign-in and
   * remembers why. */
  const onCta = () => {
    tap();
    markPlanSelected(plan);
    track('paywall_cta_tap', { variant: 'v2', plan, trial_days: trialDays, signed_in: session !== null });
    if (session === null) {
      setPendingPurchase(true);
      router.push('/sign-in');
      return;
    }
    void runPurchase();
  };

  const onRestore = async () => {
    if (busy) return;
    tap();
    if (session === null) {
      router.push('/sign-in');
      return;
    }
    setBusy('restore');
    setNotice(null);
    try {
      const outcome = await restore(session?.user.id);
      if (outcome.status === 'restored') {
        router.replace('/');
        return;
      }
      setNotice(
        outcome.status === 'nothing'
          ? 'No Recore subscription is attached to this Apple Account.'
          : 'Restore could not reach the App Store. Try again in a moment.',
      );
    } finally {
      setBusy(null);
    }
  };

  const onBack = () => {
    tap();
    if (router.canGoBack()) router.back();
  };

  /**
   * DEVELOPMENT ENTRANCE (`paywall.tsx` carries the identical one). It jumps
   * the purchase and nothing else: a signed-out tap lands on sign-in, exactly
   * where the real CTA sends it, because the app itself needs a Supabase user
   * in development too. Signed in, there is nothing left to skip TO, so it
   * enters the app.
   *
   * Session-aware because sign-in sits behind `guard = session === null`
   * (`_layout.tsx`), and a push to a guard-false screen is silently ignored —
   * "nothing happens" is exactly how that bug reads.
   */
  const onDevSkip = () => {
    tap();
    if (session !== null) {
      router.replace('/');
      return;
    }
    router.push('/sign-in');
  };

  const openLegal = (doc: LegalDocId) => {
    tap();
    router.push({ pathname: '/legal', params: { doc } });
  };

  const saving = savePct(monthly?.price ?? null, annual?.price ?? null);

  /**
   * Computed from the STORE'S OWN introductory offer and handed to BOTH cards —
   * the annual draws it, the monthly reserves its footprint so the two measure
   * the same (`PlanCard`). Null when App Store Connect offers no trial on the
   * annual product, and then neither card carries or reserves a badge: a badge
   * that promises seven free days the store will not honour is the exact copy
   * §2 rule 5 exists to stop.
   */
  const annualBadge = annual && annual.trialDays > 0 ? `${annual.trialDays} DAYS FREE` : null;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]} testID="paywall-v2-plan">
      <View style={styles.header}>
        <Pressable
          onPress={onBack}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={styles.back}
          testID="paywall-v2-back">
          <Icon name="chevron-back" size={moderateScale(24)} tint={color.textPrimary} />
        </Pressable>
        {/* DEVELOPMENT ENTRANCE, and it skips the paywall SCREEN and nothing
            else — it lands on sign-in, exactly like the real CTA, because the
            app itself needs a Supabase user (`parse-workout` requires a JWT).
            The only thing skipped is the purchase. `__DEV__` compiles it out
            of release bundles; `paywall.tsx` carries the identical chip. */}
        {__DEV__ ? (
          <Pressable
            onPress={onDevSkip}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Developer: skip paywall"
            style={styles.devChip}
            testID="paywall-v2-dev-skip">
            <Text style={styles.devChipText} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              DEV · SKIP
            </Text>
          </Pressable>
        ) : null}
      </View>

      <ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + spacing.md }]}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="automatic">
        {/* GROUP 1 — the headline block. Centred, and the only centred thing
            above the cards. */}
        <View style={styles.headBlock}>
          <Enter index={0}>
            <Text style={styles.headline} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              {copy.headline}
            </Text>
          </Enter>
          <Enter index={1}>
            <Text style={styles.support} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              {copy.support}
            </Text>
          </Enter>
        </View>

        {/* GROUP 2 — the timeline. Left-aligned, two axes, no exceptions. */}
        <View style={styles.group}>
          <TrialTimeline steps={steps} startIndex={2} />
        </View>

        {/* GROUP 3 — the cards, and the sentence that compares them. One group
            gap above it like every other group: the spare space on a tall
            phone is NOT collected here (see `body`). */}
        <View style={styles.group}>
          <View style={styles.plans}>
            <Enter index={5}>
              <PlanCard
                title="Annual"
                sub={annualSub(annual)}
                price={annualPrice(annual).price}
                unit={annualPrice(annual).unit}
                badge={annualBadge}
                selected={plan === 'annual'}
                onPress={() => setPlan('annual')}
                testID="paywall-v2-plan-annual"
              />
            </Enter>
            <Enter index={6}>
              <PlanCard
                title="Monthly"
                sub="Billed every month"
                price={monthly?.priceLabel ?? null}
                unit="/mo"
                reserve={annualBadge}
                selected={plan === 'monthly'}
                onPress={() => setPlan('monthly')}
                testID="paywall-v2-plan-monthly"
              />
            </Enter>
          </View>

          {savingLine(saving) ? (
            <Enter index={7}>
              <Text style={styles.saving} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                {savingLine(saving)}
              </Text>
            </Enter>
          ) : null}
        </View>

        {/* GROUP 4 — the assurance, the button and the small print. Centred,
            and the CTA carries the same horizontal inset as everything above
            it: it is a child of the same padded column, not a wider slab. */}
        <View style={styles.group}>
          <Enter index={7}>
            <View style={styles.assurance} accessible accessibilityRole="text">
              <Check size={moderateScale(15)} tint={color.textPrimary} strokeWidth={2.8} />
              <Text style={styles.assuranceText} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                {trialDays > 0 ? 'No payment due now' : 'Cancel any time in the App Store'}
              </Text>
            </View>
          </Enter>

          <Enter index={8} style={styles.ctaWrap}>
            <Animated.View style={[styles.ctaGlow, shadow.glow, glowStyle]} pointerEvents="none" />
            <PressScale
              onPress={onCta}
              disabled={!canBuy || busy !== null}
              haptic="impact"
              accessibilityLabel={ctaLabel(trialDays, offerState)}
              accessibilityState={{ disabled: !canBuy || busy !== null }}
              testID="paywall-v2-cta">
              <View style={[styles.cta, (!canBuy || busy !== null) && styles.ctaOff]}>
                <Text
                  style={styles.ctaLabel}
                  maxFontSizeMultiplier={MAX_FONT_SCALE}
                  numberOfLines={1}>
                  {busy === 'purchase' ? 'One moment…' : ctaLabel(trialDays, offerState)}
                </Text>
              </View>
            </PressScale>
          </Enter>

          {notice ? (
            <Text style={styles.notice} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              {notice}
            </Text>
          ) : null}

          {/* DEVELOPMENT ONLY, and it must stay that way. A RevenueCat Test
              Store key prices real packages from the dashboard but SIMULATES
              the purchase — no App Store sheet, no receipt, no money. Without
              this line a simulated buy is indistinguishable from a real one on
              screen, which is precisely the confusion CLAUDE.md §2 rule 5 is
              written against. `env.ts` blanks a test_ key outside __DEV__, so
              neither the key nor this label can reach a release build. */}
          {__DEV__ && isTestStore() ? (
            <Text style={styles.testStore} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              Test Store · purchases are simulated, nothing is charged
            </Text>
          ) : null}

          {/* The smallest type on the screen, and the last thing on it. */}
          <Enter index={9} style={styles.legal}>
            <Text style={styles.fineprint} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              {finePrint(selected, plan, trialDays, offerState)}
            </Text>
            <View style={styles.legalRow}>
              <LegalLink label="Terms" onPress={() => openLegal('terms')} />
              <Text style={styles.legalDot}>·</Text>
              <LegalLink label="Privacy" onPress={() => openLegal('privacy')} />
              <Text style={styles.legalDot}>·</Text>
              <LegalLink
                label={busy === 'restore' ? 'Restoring…' : 'Restore'}
                onPress={() => void onRestore()}
              />
            </View>
          </Enter>
        </View>
      </ScrollView>
    </View>
  );
}

function LegalLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={10} accessibilityRole="link" style={styles.legalHit}>
      <Text style={styles.legalLink} maxFontSizeMultiplier={MAX_FONT_SCALE}>
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * THE ANNUAL CARD'S BIG NUMBER.
 *
 * Apple's own per-month string when App Store Connect supplies one, and the
 * plain annual price otherwise. **Never a currency string this app assembled.**
 * The obvious shortcut — divide by twelve and splice the result back into
 * `priceLabel` — has to guess the decimal separator, the symbol's side and the
 * grouping, and it guesses wrong in most storefronts Recore is sold in. A
 * truthful "39,99 € /yr" beats an invented "3.33 € /mo" every time.
 *
 * §6 still wants the annual plan's per-month equivalent visible, and it is:
 * `annualSub` prints the honest saving instead, which is the same comparison
 * made with arithmetic that cannot be wrong about a currency.
 */
function annualPrice(annual: StorePlan | null): { price: string | null; unit: string } {
  if (!annual) return { price: null, unit: '/yr' };
  if (annual.pricePerMonthLabel) return { price: annual.pricePerMonthLabel, unit: '/mo' };
  return { price: annual.priceLabel, unit: '/yr' };
}

/**
 * The annual card's sub-line: what is really charged, and how much that saves
 * against paying monthly. The saving is `pricing.savePct` on the two live
 * prices, and it is simply absent when the arithmetic cannot be done honestly —
 * there is no such thing as a decorative saving badge here.
 */
function annualSub(annual: StorePlan | null): string {
  if (!annual) return '12 months, billed once';
  // When the big number is already the per-month figure the sub-line carries
  // the total; when it IS the total, the sub-line does not repeat it.
  return annual.pricePerMonthLabel
    ? `12 months · ${annual.priceLabel}`
    : '12 months, billed once';
}

/**
 * THE SAVING, AS A SENTENCE — one quiet line under the two cards.
 *
 * It was on the annual card's sub-line and it wrapped to a second line there,
 * which pushed the check mark and the price out of each other's baseline. It
 * is better off here anyway:
 *
 *   · **It is a comparison, so it belongs under both cards**, not inside the
 *     one it flatters.
 *   · **It is not a discount.** Every reference screen renders this as a
 *     "56% OFF" flash on the card, which implies a price that was struck. The
 *     annual plan was never 79,99 a month; it is simply cheaper per month than
 *     the monthly one, and saying so in words is the only version of that
 *     sentence that is true.
 *   · No pill, no fill, no colour — recore-design §Colour, "colour marks, ink
 *     speaks", and the accent is already spent twice on this screen.
 *
 * Absent entirely when `savePct` could not do the arithmetic honestly.
 */
function savingLine(saving: number | null): string | null {
  return saving == null ? null : `Annual works out ${saving}% cheaper than paying monthly.`;
}

/** One label per intent, and it never promises a trial the store is not
 * offering. */
function ctaLabel(trialDays: number, state: 'loading' | 'ready' | 'unavailable'): string {
  if (state === 'unavailable') return 'Prices unavailable';
  if (state === 'loading') return 'Loading…';
  return trialDays > 0 ? `Start my ${trialDays} days free` : 'Subscribe';
}

/** The legal sentence, assembled from the store's own numbers. Says nothing
 * about a trial when there is none, and no amount at all when there is no
 * price. */
function finePrint(
  selected: StorePlan | null,
  plan: Plan,
  trialDays: number,
  state: 'loading' | 'ready' | 'unavailable',
): string {
  const period = plan === 'annual' ? 'year' : 'month';
  if (state !== 'ready' || !selected) {
    return 'Recore could not reach the App Store, so no price is shown. Nothing can be charged until it can.';
  }
  const head =
    trialDays > 0
      ? `${trialDays} days free, then ${selected.priceLabel} per ${period}.`
      : `${selected.priceLabel} per ${period}.`;
  // "Cancel any time in the App Store" was here as well as on the timeline's
  // last row. Once is enough, and this paragraph is the one place on the screen
  // where a spare line costs the CTA its place above the fold.
  return `${head} Renews unless you cancel at least 24 hours before the period ends. Your record stays exportable whether you subscribe or not.`;
}

/**
 * ONE GAP BETWEEN THE FOUR GROUPS, and it is the only vertical value on this
 * screen that appears more than once (owner's brief: "the headline block,
 * timeline, cards and CTA are four groups with equal gaps between them and
 * tighter gaps inside them").
 *
 * `spacing.xxl`. Inside a group the gaps are `sm` and `md`, which is what makes
 * a group read as one object rather than as three loose ones — the rhythm is
 * carried by the CONTRAST between the two, so there is no third value in
 * between and no `marginTop` written anywhere except on a group.
 */
const GROUP = spacing.xxl;

/**
 * THE HEADLINE'S MEASURE.
 *
 * Both lines of every headline are authored and balanced (`copy.ts`), and this
 * is what stops the longer of the two from ever reaching for the full column
 * width on a large phone and un-balancing itself. It is a ceiling, not a width:
 * on a 393 pt phone the column is already narrower than this, so the measure
 * changes nothing there and only bites on a Pro Max.
 */
const HEADLINE_MEASURE = moderateScale(330);

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.canvas },
  flex: { flex: 1 },
  header: {
    height: HIT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
  },
  back: { width: HIT, height: HIT, alignItems: 'flex-start', justifyContent: 'center' },
  /** `__DEV__` only, and it is drawn as quietly as it can be while still being
   * a 44 pt target: this is a door out of the funnel, not a control the screen
   * is about. */
  devChip: {
    height: HIT,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  devChipText: {
    ...type.caption,
    fontWeight: '600',
    letterSpacing: 0.8,
    color: color.textMuted,
  },
  /**
   * ONE horizontal inset for the whole screen. The cards and the CTA are
   * children of this column and neither adds nor removes a point of it, so
   * nothing on the screen is a few points wider than anything else.
   *
   * ## Where the spare space goes (28 August 2026, owner: "spread it over the
   * whole screen")
   *
   * `justifyContent: 'space-between'`, and the four groups are its four items.
   * On a tall phone the content is short of the screen and that surplus has to
   * land somewhere. It has been three things in one day, and the difference is
   * measured on an iPhone 17 Pro Max at default type, not judged by eye:
   *
   *   · **All of it in one elastic gap** between the timeline and the cards —
   *     69 pt against the other three at 24. Two halves that had drifted apart,
   *     and everything under the hole read as displaced.
   *   · **All of it split above and below the block** (`center`) — every gap
   *     equal at 26, and the screen sat as one tight object in the middle with
   *     bare canvas at both ends. Correct, and not what the screen wants.
   *   · **All of it divided between the groups**, which is this. The headline
   *     starts under the chevron, the legal row finishes above the home
   *     indicator, and the three gaps between them are equal — each one
   *     `GROUP` plus an identical share of whatever is left. The page is used
   *     rather than filled or centred.
   *
   * The gaps are therefore NOT `GROUP` on a big phone; they are `GROUP` plus a
   * third of the surplus, all three the same. `GROUP` remains the floor and the
   * only value that is written down — a screen with nothing spare (a small
   * phone, or accessibility type) gets exactly it, `space-between` has nothing
   * to distribute, and the screen scrolls as it always did.
   */
  body: {
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.md,
    flexGrow: 1,
    justifyContent: 'space-between',
  },
  /** Group 1. The inner gap is `sm` against the group gap's `xxl`. */
  headBlock: { gap: spacing.sm },
  /**
   * Centred, like every reference screen in the set — and like Recore's own
   * statement screens (`Frame`'s `centred`). A paywall makes a statement; it
   * does not ask a question, and the flow's left-aligned question voice would
   * read as a nineteenth onboarding step.
   *
   * OPTICALLY, not by bounding box. `textAlign: 'center'` centres each line
   * inside the column; what makes a two-line headline read as centred is the
   * two lines being close to the same length, and that is done in `copy.ts`
   * with authored breaks the test measures. The measure below keeps them from
   * drifting apart on a wide screen. See `copy.ts` for why hanging the final
   * full stop is not attempted.
   */
  headline: {
    ...type.largeTitle,
    fontWeight: '800',
    color: color.textPrimary,
    textAlign: 'center',
    alignSelf: 'center',
    maxWidth: HEADLINE_MEASURE,
  },
  /** The supporting line — their name, goal and frequency. Centred with the
   * headline, because the two are one block and a left-aligned subtitle under a
   * centred title reads as a mistake. */
  support: {
    ...type.subhead,
    color: color.textSecondary,
    textAlign: 'center',
    alignSelf: 'center',
    maxWidth: HEADLINE_MEASURE,
  },
  /** Every group after the first. Nothing else on this screen carries a
   * `marginTop`. */
  group: { marginTop: GROUP },
  /** Group 3. The cards' own gap is `sm`; the sentence under them is `md`. */
  plans: { gap: spacing.sm },
  saving: {
    ...type.caption,
    color: color.textSecondary,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  assurance: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  assuranceText: { ...type.subhead, fontWeight: '700', color: color.textPrimary },
  ctaWrap: { marginTop: spacing.md },
  ctaGlow: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: CTA_HEIGHT,
    borderRadius: radius.pill,
    backgroundColor: color.brand,
  },
  cta: {
    height: CTA_HEIGHT,
    borderRadius: radius.pill,
    backgroundColor: color.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaOff: { backgroundColor: color.disabled },
  ctaLabel: { ...type.headline, fontWeight: '700', color: color.onInk },
  notice: {
    ...type.subhead,
    color: color.textSecondary,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  /** The simulated-store marker. `__DEV__` only — see its call site, and set
   * one step under the fine print: it is a note about the BUILD, not about the
   * offer, and it must not outweigh the renewal terms beneath it. */
  testStore: {
    ...type.footnote,
    color: color.textMuted,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: spacing.sm,
  },
  legal: { marginTop: spacing.md, alignItems: 'center', gap: spacing.xs },
  /** `textSecondary`, NOT `textMuted`. The brief calls this "the smallest type
   * on the screen" and it is — smallest SIZE. Muted measures 3.45:1 and is
   * reserved for what the eye may skip (recore-design §Colour); a subscription's
   * renewal terms are the last thing on this screen that may be unreadable. */
  fineprint: {
    ...type.footnote,
    color: color.textSecondary,
    textAlign: 'center',
    lineHeight: moderateScale(15),
  },
  legalRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  legalHit: { paddingVertical: spacing.xs },
  legalDot: { ...type.footnote, color: color.textMuted },
  legalLink: { ...type.footnote, color: color.textSecondary, fontWeight: '600' },
});
