import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { FadeSlideIn, PressableScale, Stagger } from '@/components/motion';
import { IllustrationSlot } from '@/components/onboarding/IllustrationSlot';
import { PrimaryCta } from '@/components/onboarding/PrimaryCta';
import {
  BLUE,
  CARD_RADIUS,
  INK_CARD,
  SELECT_BORDER,
} from '@/components/onboarding/tokens';
import { Eyebrow } from '@/components/primitives';
import { useAuth } from '@/lib/auth/provider';
import { perMonth, savePct, type Plan } from '@/lib/billing/pricing';
import { purchase, restore } from '@/lib/billing/state';
import {
  fetchOffer,
  isStoreConfigured,
  managementUrl,
  type StoreOffer,
  type StorePlan,
} from '@/lib/billing/store';
import { formatChargeDate } from '@/lib/billing/trial';
import { markPaywallShown, markPlanSelected } from '@/lib/funnel';
import { tap } from '@/lib/haptics';
import { EASE } from '@/lib/motion';
import type { LegalDocId } from '@/lib/legal';
import type { Goal } from '@/lib/onboarding';
import { getGoal, getName, getPrimaryLift } from '@/lib/prefs';
import {
  color,
  fonts,
  HIT,
  lineFor,
  MAX_FONT_SCALE,
  moderateScale,
  radius,
  readingStyle,
  spacing,
  type,
} from '@/lib/theme';

/**
 * /paywall — the LAST pre-account step of the conversion funnel. The user has
 * already personalized their ledger and watched it get built; now the trial is
 * the only thing between them and the app, and the account is created right
 * after (the CTA hands off to sign-in, and the purchase runs when it returns).
 *
 * EVERY PRICE ON THIS SCREEN COMES FROM THE STORE (29 Jul 2026, implementation
 * order step 1). `fetchOffer` reads Apple's own localized `priceString` for
 * this storefront; the constants in `pricing.ts` are a pre-fetch frame and
 * nothing more. Before this change the screen stated "$59.99/year" and a live
 * charge date with no store integration behind either — five separate promises
 * CLAUDE.md §2 rule 5 forbids shipping until something keeps them.
 *
 * BOTH PLANS CARRY THE SAME SEVEN-DAY TRIAL (product-direction §2). The monthly
 * card used to say "no trial", which contradicted the commercial model outright
 * and made the annual preselection look like the only way in. The trial length
 * shown is the store's own introductory offer, so a product configured without
 * one says so instead of promising a trial App Store Connect will not honour.
 *
 * THE PROOF SLOT IS DELIBERATELY EMPTY (§6). A fabricated 4.9 rating and a
 * named testimonial used to sit between the headline and the subline; there are
 * no real reviews, so both were deleted and the space was NOT refilled — no
 * badge, no install count, no "trusted by early lifters". The proof on this
 * screen is the ledger the user has just watched being built.
 *
 * ANNUAL IS PRESELECTED under the four conditions in §6, all of which this
 * screen meets: both cards are equally visible and equally tappable, the annual
 * shows its real total and its true per-month equivalent, the saving is
 * computed from the two live prices (`savePct`) rather than asserted, and
 * switching is one tap with no confirmation.
 */

/** The three concrete outcomes §6 requires. Capabilities, never adjectives. */
const OUTCOMES: string[] = [
  'Write a session in ordinary words and have it read into a structured record.',
  'See what each lift is actually doing, with the sessions behind every point.',
  'Open a brief that knows your own history, your rhythm and your next session.',
];

type TimelineStep = { title: string; body: string; filled: boolean; last?: boolean };

/**
 * The trial timeline, built from the trial the STORE actually offers. A product
 * configured without an introductory offer produces the two-row version, which
 * describes a straight subscription and promises no trial — the alternative is
 * a timeline that contradicts App Store Connect.
 */
function timelineFor(trialDays: number, priceLabel: string | null): TimelineStep[] {
  if (trialDays <= 0) {
    return [
      {
        filled: true,
        title: 'Today — full access',
        body: 'Import your Strong or Hevy history, or write your first session.',
      },
      {
        filled: false,
        title: 'Renews until you cancel',
        body: 'Cancel any time in the App Store. Your data stays yours either way.',
        last: true,
      },
    ];
  }
  const reminderDay = Math.max(1, trialDays - 2);
  return [
    {
      filled: true,
      title: 'Today — full access',
      body: 'Import your Strong or Hevy history, or write your first session.',
    },
    {
      filled: false,
      title: `Day ${reminderDay} — reminder`,
      // There is no mail server and there will not be one. What actually
      // happens is `trial-reminder-sheet.tsx`: on the first open inside the
      // window, Recore shows the date, the amount and how to cancel — no
      // permission needed, so it stays true for a user who denies
      // notifications (§2.2).
      body: 'Recore reminds you in the app — the date, the amount, and how to cancel.',
    },
    {
      filled: false,
      title: `Day ${trialDays} — trial ends`,
      body: priceLabel
        ? `${priceLabel} unless you cancel. Your data stays yours either way.`
        : 'The subscription begins unless you cancel. Your data stays yours either way.',
      last: true,
    },
  ];
}

/** "4 Aug 2026" — the day a trial started now would first charge. A preview of
 * an offer not yet bought, formatted by the same function the reminder uses so
 * one date is never stated two ways. Replaced by the store's own expiry the
 * moment there is a real subscription. */
function trialEndLabel(days: number): string {
  return formatChargeDate(Date.now() + days * 86_400_000);
}

/**
 * The mascot's band on this screen. Half what an onboarding step gives it: the
 * paywall has to fit five outcomes, a trial timeline, two plans and the legal
 * line above the fold, and the picture is the one element here that can shrink
 * without costing the reader a fact.
 */
const MASCOT_HEIGHT = moderateScale(120);

/** The goal's headline, in the option's own words — nothing invented. */
const GOAL_HEADLINES: Record<Goal, string> = {
  strength: 'Built for your\nstrength goal',
  muscle: 'Built for your\nmuscle goal',
  fitness: 'Built for your\nfitness goal',
  both: 'Built for strength\nand muscle',
  sport: 'Built for your\ntraining',
};

/**
 * The headline mirrors an ONBOARDING ANSWER (21-screen rebuild, 11 Aug 2026)
 * — it costs a string interpolation. The key lift wins when it was named,
 * the stated goal otherwise; neither answered falls back to a line that
 * claims nothing.
 *
 * **Never a claim about Recore's quality.** Always a statement about what the
 * user themselves chose. This is not a refill of the proof slot A1 emptied —
 * §12.1 forbids that.
 */
function headlineFor(): string {
  const lift = getPrimaryLift();
  if (lift && lift.trim().length >= 3) {
    return `Built to grow\nyour ${lift.trim().toLowerCase()}`;
  }
  const goal = getGoal();
  if (goal) return GOAL_HEADLINES[goal];
  return 'Built for\nyour record';
}

function CloseGlyph() {
  return (
    <Svg width={moderateScale(13)} height={moderateScale(13)} viewBox="0 0 16 16">
      <Path d="M3.5 3.5l9 9M12.5 3.5l-9 9" stroke={color.textSecondary} strokeWidth={1.7} strokeLinecap="round" fill="none" />
    </Svg>
  );
}

function CheckGlyph() {
  return (
    <Svg width={moderateScale(11)} height={moderateScale(11)} viewBox="0 0 16 16">
      <Path d="M3 8.5L6.5 12 13 4.5" stroke="#FFFFFF" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  );
}

/** The annual card's saving, as a filled blue pill. Rendered only when
 * `savePct` could compute the number from the two live prices — there is no
 * such thing as a decorative saving badge here. */
function SavePill({ label }: { label: string }) {
  return (
    <View style={styles.savePill}>
      <Text style={styles.savePillText} maxFontSizeMultiplier={MAX_FONT_SCALE}>
        {label}
      </Text>
    </View>
  );
}

export default function Paywall() {
  const router = useRouter();
  const { session } = useAuth();
  const [plan, setPlan] = useState<Plan>('annual');
  // The × can only act when a screen is behind it: pushed from onboarding's
  // ready screen, or from You. A signed-out relaunch lands here as the ROOT —
  // the dispatcher redirects, it does not push — and a close with nowhere to
  // go is a dead control, so it is not rendered at all (§6: silence beats a
  // dead control; it was also throwing GO_BACK warnings in development).
  // Read once on mount: what is behind this screen cannot change while it is
  // focused.
  const [canDismiss] = useState(() => router.canGoBack());
  const name = getName();
  // Computed once, on mount: the headline names what the user chose, and it
  // must not change under them while they read it.
  const [headline] = useState(() => headlineFor());

  // The offer, read from the store. `null` while in flight or unreachable —
  // and an unreachable store means NO PRICE IS SHOWN, never a placeholder one.
  const [offer, setOffer] = useState<StoreOffer | null>(null);
  const [offerState, setOfferState] = useState<'loading' | 'ready' | 'unavailable'>(
    isStoreConfigured() ? 'loading' : 'unavailable',
  );
  const [busy, setBusy] = useState<null | 'purchase' | 'restore'>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // Set when the CTA sent an unauthenticated user to sign-in. §6: "the primary
  // action opens account creation or sign-in; after successful authentication,
  // complete the store purchase". The paywall stays mounted underneath the
  // sign-in screen, so it is still here to finish the job when the session
  // lands.
  const [pendingPurchase, setPendingPurchase] = useState(false);

  // Local counter only (in `meta`, never a third-party SDK). Paywall views are
  // the denominator of every conversion number in §13, and they are impossible
  // to backfill once the first installs have happened.
  useEffect(() => {
    markPaywallShown();
  }, []);

  /**
   * The CTA's glow breathes ONCE on arrival (Claude Design canvas, 13 Aug 2026:
   * 1.2 s from 600 ms, "never repeatedly"). It is the last screen of the funnel
   * and the button is what the screen is for, so one swell that says "here" is
   * within §4.3's "motion that makes cause and effect clearer".
   *
   * A LOOP would not be. A pulsing buy button is a countdown by another name —
   * the urgency pressure CLAUDE.md §2 rule 6 rules out — so this fires once per
   * mount and then the button is simply a button. Reduce Motion never fires it.
   */
  const reduce = useReducedMotion();
  const glow = useSharedValue(0);
  useEffect(() => {
    if (reduce) return;
    glow.value = withDelay(
      600,
      withSequence(
        withTiming(1, { duration: 540, easing: EASE.inOut }),
        withTiming(0, { duration: 660, easing: EASE.inOut }),
      ),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const glowStyle = useAnimatedStyle(() => ({
    shadowOpacity: 0.28 + glow.value * 0.27,
    shadowRadius: 18 + glow.value * 12,
  }));

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
  const saving = savePct(monthly?.price ?? null, annual?.price ?? null);
  const canBuy = offerState === 'ready' && selected != null;

  const runPurchase = async () => {
    if (busy) return;
    setBusy('purchase');
    setNotice(null);
    try {
      const outcome = await purchase(plan);
      switch (outcome.status) {
        case 'purchased':
          // The entitlement is already applied; the dispatcher takes it from
          // here. The trial-start sheet greets them on Today.
          router.replace('/');
          return;
        case 'cancelled':
          // A person closing Apple's sheet chose something. It is not an error
          // and it is never phrased as one (§12).
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
  };

  // The account arrived while this screen waited: finish what the CTA started.
  useEffect(() => {
    if (!pendingPurchase || session === null) return;
    setPendingPurchase(false);
    void runPurchase();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingPurchase, session]);

  /**
   * The forward step of the funnel (§2.1, §6): plan first, then the account,
   * then the store's own purchase sheet. An account is required before a trial
   * can start, so a signed-out CTA opens sign-in and remembers why.
   */
  const handleCta = () => {
    tap();
    markPlanSelected(plan);
    if (session === null) {
      setPendingPurchase(true);
      router.push('/sign-in');
      return;
    }
    void runPurchase();
  };

  /** Real Restore. It never charges, and it says exactly what it found (§2). */
  const handleRestore = async () => {
    if (busy) return;
    tap();
    if (session === null) {
      // Restore attaches to an account like everything else here.
      router.push('/sign-in');
      return;
    }
    setBusy('restore');
    setNotice(null);
    try {
      const outcome = await restore();
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

  const handleManage = () => {
    tap();
    void managementUrl()
      .then((url) => Linking.openURL(url))
      .catch(() => {});
  };

  const handleDismiss = () => {
    tap();
    if (router.canGoBack()) router.back();
  };

  const handleSignIn = () => {
    tap();
    router.push('/sign-in');
  };

  /** The two words App Review taps. They open the real documents (PLAN A3). */
  const openLegal = (doc: LegalDocId) => {
    tap();
    router.push({ pathname: '/legal', params: { doc } });
  };

  /**
   * Development entrance (owner, 28 July): skips the paywall SCREEN and
   * nothing else — it lands on sign-in, exactly like the real CTA, because a
   * no-account mode turned out to break the product's spine: `parse-workout`
   * requires a user JWT (§7.3), so nothing ever parsed and Next/Progress
   * stayed empty. A dev goes through the same door as a customer; the only
   * thing skipped is the purchase pretense. `__DEV__` compiles the chip out
   * of release bundles.
   *
   * Session-aware, because sign-in sits behind `guard = session === null`
   * (`_layout.tsx`) and a push to a guard-false screen is silently ignored —
   * "nothing happens" is exactly how that bug reads. Signed in, there is
   * nothing left to skip TO, so the chip enters the app.
   */
  const handleDevSkip = () => {
    tap();
    if (session !== null) {
      router.replace('/');
      return;
    }
    router.push('/sign-in');
  };

  // The label states what the button does, from what the store offers — the
  // day count is the store's own, so "my 7-day free trial" can never promise a
  // trial App Store Connect will not honour (§2, §6). Never a price in the
  // CTA; the price sits in the muted line below it.
  const trialDays = selected?.trialDays ?? 0;
  const ctaLabel = !canBuy
    ? 'Pricing unavailable'
    : trialDays > 0
      ? `Start my ${trialDays}-day free trial`
      : 'Subscribe';
  const timeline = timelineFor(trialDays, selected?.priceLabel ?? null);

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.topRow}>
        {canDismiss ? (
          <PressableScale
            onPress={handleDismiss}
            hitSlop={spacing.sm}
            style={styles.closeButton}
            accessibilityRole="button"
            accessibilityLabel="Close">
            <CloseGlyph />
          </PressableScale>
        ) : (
          // Keeps the row's geometry so Restore stays right-aligned; draws
          // nothing — there is no control here to fake.
          <View style={styles.closeSpacer} />
        )}
        <View style={styles.topRight}>
          {__DEV__ ? (
            <PressableScale
              onPress={handleDevSkip}
              hitSlop={spacing.sm}
              style={styles.devChip}
              accessibilityRole="button"
              accessibilityLabel="Developer: skip paywall">
              <Text style={styles.devChipText} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                DEV · SKIP
              </Text>
            </PressableScale>
          ) : null}
          <Pressable
            onPress={() => void handleRestore()}
            disabled={busy !== null}
            hitSlop={spacing.sm}
            accessibilityRole="button"
            accessibilityLabel="Restore purchases"
            style={({ pressed }) => pressed && styles.quietPressed}>
            <Text style={styles.restore} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              {busy === 'restore' ? 'Restoring…' : 'Restore purchases'}
            </Text>
          </Pressable>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Stagger initialDelay={60} step={70} distance={14}>
          {/* The funnel's mascot, one last time and at half height — this is a
              commercial screen and the picture has to yield to the price. The
              slot reads the same registry as every onboarding step, so the
              character that walked the person through twenty questions is the
              character standing here. */}
          <View style={styles.mascot}>
            <IllustrationSlot slug="paywall" height={MASCOT_HEIGHT} />
          </View>
          <Eyebrow tone="secondary">{name ? `You're all set, ${name}` : 'Recore Pro'}</Eyebrow>
          <Text style={styles.headline} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {headline}
          </Text>

          <Text style={styles.subline} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            Write workouts naturally. Recore keeps a verified record and prepares your next exact
            session.
          </Text>

          {/* The three concrete outcomes §6 asks for, in the record's own
              voice: what the app does, never what it will make of you. */}
          <View style={styles.outcomes}>
            {OUTCOMES.map((line) => (
              <View key={line} style={styles.outcomeRow}>
                <View style={styles.outcomeDot} />
                <Text style={styles.outcomeText} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                  {line}
                </Text>
              </View>
            ))}
          </View>

          <View style={styles.timeline}>
            {timeline.map((step) => (
              <View key={step.title} style={styles.tlRow}>
                <View style={styles.tlRail}>
                  <View style={[styles.tlDot, step.filled ? styles.tlDotFilled : styles.tlDotHollow]} />
                  {!step.last ? <View style={styles.tlLine} /> : null}
                </View>
                <View style={[styles.tlText, !step.last && styles.tlTextPad]}>
                  <Text style={styles.tlTitle} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                    {step.title}
                  </Text>
                  <Text style={styles.tlBody} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                    {step.body}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </Stagger>

        <FadeSlideIn delay={320} style={styles.bottom}>
          <View style={styles.plans}>
            <PlanCard
              title="Annual"
              storePlan={annual}
              loading={offerState === 'loading'}
              selected={plan === 'annual'}
              // Computed from the two live prices, never asserted (§6). Null
              // when the comparison cannot be made honestly — then no badge.
              badge={saving != null ? `SAVE ${saving}%` : null}
              onPress={() => setPlan('annual')}
            />
            <PlanCard
              title="Monthly"
              storePlan={monthly}
              loading={offerState === 'loading'}
              selected={plan === 'monthly'}
              badge={null}
              onPress={() => setPlan('monthly')}
            />
          </View>

          {offerState === 'unavailable' ? (
            <Text style={styles.notice} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              Recore cannot reach the App Store right now, so it will not show you a price it
              cannot stand behind. Try again in a moment.
            </Text>
          ) : null}
          {notice ? (
            <Text style={styles.notice} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              {notice}
            </Text>
          ) : null}

          {/* THE ONE GREEN LINE IN THE APP OUTSIDE A PLANNED PRESCRIPTION
              (owner, 12 Aug 2026). It states a fact about billing — nothing is
              charged today — and it renders ONLY while the selected plan
              actually carries a trial the store will honour. With no trial,
              money IS due today and the line would be a lie, so it is absent
              rather than reworded. */}
          {trialDays > 0 ? (
            <Text style={styles.dueToday} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              Nothing due today
            </Text>
          ) : null}

          <PrimaryCta
            label={ctaLabel}
            onPress={handleCta}
            disabled={!canBuy || busy !== null}
            loading={busy === 'purchase'}
            style={[styles.cta, glowStyle]}
          />

          {/* Every number in this line came from the store. "in Settings" was
              once ambiguous — Recore has a settings tab, and that is not where
              a subscription is cancelled — so it names the real place, and
              cancelling is never harder than subscribing (§2). */}
          {selected ? (
            <Text style={styles.legal} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              {trialDays > 0
                ? `${trialDays}-day free trial, then ${selected.priceLabel} from ${trialEndLabel(trialDays)} · cancel anytime in the App Store.`
                : `${selected.priceLabel}, billed until you cancel · cancel anytime in the App Store.`}
            </Text>
          ) : null}

          {/* Real links, real targets — the exact thing App Review taps on a
              subscription screen. Each row clears 44 pt (`HIT`). Manage is here
              because §6 requires it "when applicable", and it is applicable the
              moment anyone can reach this screen with a subscription. */}
          <View style={styles.links}>
            <LinkButton label="Terms" onPress={() => openLegal('terms')} />
            <Text style={styles.linkSep} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              ·
            </Text>
            <LinkButton label="Privacy" onPress={() => openLegal('privacy')} />
            <Text style={styles.linkSep} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              ·
            </Text>
            <LinkButton label="Manage subscription" onPress={handleManage} />
          </View>
          {session === null ? (
            <View style={styles.links}>
              <LinkButton label="Already use Recore? Sign in" onPress={handleSignIn} />
            </View>
          ) : null}
        </FadeSlideIn>
      </ScrollView>
    </SafeAreaView>
  );
}

/**
 * One plan card, side by side with the other (owner's restyle, 12 Aug 2026 —
 * they were stacked full-width rows). Both cards are the same component, the
 * same size and the same tap target, which is §6's first condition for an
 * honest preselection; the selected one takes a Recore blue 2 pt edge and a
 * blue check, and nothing else about it grows or brightens.
 *
 * A card with no store plan behind it renders its title and a dash where the
 * price goes. That is the honest pre-fetch state: the shape is there, the
 * number is not invented.
 */
function PlanCard({
  title,
  storePlan,
  loading,
  selected,
  badge,
  onPress,
}: {
  title: string;
  storePlan: StorePlan | null;
  loading: boolean;
  selected: boolean;
  badge: string | null;
  onPress: () => void;
}) {
  // Apple's own per-month string when it gives one; our own arithmetic on its
  // price when it does not. Never a hardcoded currency symbol.
  const perMonthValue = storePlan ? perMonth(storePlan.price) : null;
  const perMonthLine = storePlan
    ? (storePlan.pricePerMonthLabel ??
      (storePlan.plan === 'annual' && perMonthValue != null ? `${perMonthValue} / mo` : null))
    : null;

  const trialLine = storePlan
    ? storePlan.trialDays > 0
      ? `${storePlan.trialDays}-day free trial`
      : 'cancel anytime'
    : loading
      ? 'Loading the price'
      : 'Price unavailable';

  // What VoiceOver reads: the whole offer in one sentence, as it always did.
  const spoken = storePlan
    ? storePlan.trialDays > 0
      ? `${title}. ${storePlan.trialDays}-day free trial, then ${storePlan.priceLabel}`
      : `${title}. ${storePlan.priceLabel} · cancel anytime`
    : `${title}. ${trialLine}`;

  return (
    <PressableScale
      onPress={onPress}
      activeScale={0.98}
      style={[styles.plan, selected && styles.planSelected]}
      pressedStyle={styles.planPressed}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={spoken}>
      {/* Reserved on both cards so the two titles sit on one line. */}
      <View style={styles.planBadgeSlot}>{badge ? <SavePill label={badge} /> : null}</View>

      <Text style={styles.planTitle} maxFontSizeMultiplier={MAX_FONT_SCALE}>
        {title}
      </Text>
      <Text style={styles.planPrice} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
        {storePlan ? storePlan.priceLabel : '—'}
      </Text>
      {/* Reserved as well: an annual with a per-month breakdown must not make
          the monthly card shorter than it. */}
      <View style={styles.planPerSlot}>
        {perMonthLine ? (
          <Text style={styles.planPer} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {perMonthLine}
          </Text>
        ) : null}
      </View>
      <Text style={styles.planTrial} numberOfLines={2} maxFontSizeMultiplier={MAX_FONT_SCALE}>
        {trialLine}
      </Text>

      <View style={styles.planMark}>
        {selected ? (
          <View style={styles.radioFilled}>
            <CheckGlyph />
          </View>
        ) : (
          <View style={styles.radioHollow} />
        )}
      </View>
    </PressableScale>
  );
}

/** A quiet underlined link that is still a real 44 pt target. */
function LinkButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="link"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.linkButton, pressed && styles.quietPressed]}>
      <Text style={styles.link} maxFontSizeMultiplier={MAX_FONT_SCALE}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: color.bg,
  },
  topRow: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  closeSpacer: {
    width: moderateScale(38),
    height: moderateScale(38),
  },
  closeButton: {
    width: moderateScale(38),
    height: moderateScale(38),
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quietPressed: {
    opacity: 0.5,
  },
  topRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  devChip: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm + 2,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surfaceHigh,
  },
  devChipText: {
    fontFamily: fonts.reading,
    fontVariant: ['tabular-nums'],
    fontSize: moderateScale(11),
    fontWeight: '600',
    letterSpacing: 0.8,
    color: color.textSecondary,
  },
  restore: {
    ...type.subhead,
    fontWeight: '600',
    color: color.textSecondary,
  },
  scroll: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
  },
  mascot: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  headline: {
    ...type.title,
    color: color.textPrimary,
    marginTop: spacing.sm,
  },
  subline: {
    marginTop: spacing.md,
    ...type.subhead,
    lineHeight: lineFor(23),
    color: color.textSecondary,
  },
  outcomes: {
    marginTop: spacing.xl,
    gap: spacing.sm,
  },
  outcomeRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  outcomeDot: {
    width: 4,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: color.textMuted,
    marginTop: moderateScale(9),
  },
  outcomeText: {
    flex: 1,
    ...type.footnote,
    lineHeight: lineFor(20),
    color: color.textSecondary,
  },
  notice: {
    marginTop: spacing.md,
    ...type.footnote,
    lineHeight: lineFor(18),
    color: color.textSecondary,
    textAlign: 'center',
    paddingHorizontal: spacing.sm,
  },
  timeline: {
    marginTop: spacing.xxl,
  },
  tlRow: {
    flexDirection: 'row',
    gap: spacing.md + 2,
  },
  tlRail: {
    alignItems: 'center',
  },
  tlDot: {
    width: moderateScale(12),
    height: moderateScale(12),
    borderRadius: radius.pill,
    marginTop: 3,
  },
  tlDotFilled: {
    backgroundColor: color.accent,
  },
  tlDotHollow: {
    borderWidth: 1.5,
    borderColor: color.textSecondary,
  },
  tlLine: {
    width: 1.5,
    flex: 1,
    backgroundColor: color.border,
  },
  tlText: {
    flex: 1,
  },
  tlTextPad: {
    paddingBottom: spacing.lg + 2,
  },
  tlTitle: {
    ...type.subhead,
    fontWeight: '600',
    color: color.textPrimary,
  },
  tlBody: {
    marginTop: 2,
    ...type.caption,
    lineHeight: lineFor(20),
    color: color.textSecondary,
  },
  bottom: {
    marginTop: 'auto',
    paddingTop: spacing.xxl,
  },
  plans: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: spacing.md,
  },
  plan: {
    flex: 1,
    backgroundColor: INK_CARD,
    borderRadius: CARD_RADIUS,
    borderWidth: SELECT_BORDER,
    // Invisible until chosen: the same colour as the fill it edges.
    borderColor: INK_CARD,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    gap: 3,
  },
  planSelected: {
    borderColor: BLUE,
  },
  planPressed: {
    backgroundColor: color.surfaceHigh,
  },
  /** Height reserved on both cards so the two titles share a baseline. */
  planBadgeSlot: {
    height: moderateScale(20),
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  savePill: {
    borderRadius: radius.pill,
    backgroundColor: BLUE,
    paddingVertical: 3,
    paddingHorizontal: spacing.sm,
  },
  savePillText: {
    ...readingStyle('700'),
    fontSize: moderateScale(9.5),
    letterSpacing: 0.8,
    color: '#FFFFFF',
  },
  planTitle: {
    ...type.headline,
    color: color.textPrimary,
  },
  planPrice: {
    ...readingStyle('700'),
    fontSize: moderateScale(22),
    letterSpacing: -0.4,
    color: color.textPrimary,
  },
  planPerSlot: {
    height: lineFor(16),
    justifyContent: 'center',
  },
  planPer: {
    ...readingStyle('500'),
    fontSize: moderateScale(11.5),
    color: color.textSecondary,
  },
  planTrial: {
    ...type.footnote,
    lineHeight: lineFor(16),
    color: color.textMuted,
    textAlign: 'center',
  },
  planMark: {
    marginTop: spacing.sm,
  },
  radioFilled: {
    width: moderateScale(22),
    height: moderateScale(22),
    borderRadius: radius.pill,
    backgroundColor: BLUE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioHollow: {
    width: moderateScale(22),
    height: moderateScale(22),
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: color.border,
  },
  /** The single permitted green line — see the note at its call site. */
  dueToday: {
    marginTop: spacing.lg,
    ...type.subhead,
    fontWeight: '600',
    color: color.signal,
    textAlign: 'center',
  },
  cta: {
    marginTop: spacing.md,
  },
  legal: {
    marginTop: spacing.md,
    ...type.footnote,
    lineHeight: lineFor(18),
    color: color.textMuted,
    textAlign: 'center',
    paddingHorizontal: spacing.sm,
  },
  links: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  linkButton: {
    minHeight: HIT,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  link: {
    ...type.footnote,
    color: color.textMuted,
    textDecorationLine: 'underline',
  },
  linkSep: {
    ...type.footnote,
    color: color.textMuted,
  },
});
