import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { FadeSlideIn, PressableScale, Stagger } from '@/components/motion';
import { AppButton, Badge, Eyebrow, Rating, Testimonial } from '@/components/primitives';
import { setDevBypass } from '@/lib/auth/dev-bypass';
import { useAuth } from '@/lib/auth/provider';
import { tap } from '@/lib/haptics';
import { getName } from '@/lib/prefs';
import { color, fonts, MAX_FONT_SCALE, moderateScale, radius, shadow, spacing, type } from '@/lib/theme';

/**
 * /paywall — the LAST pre-account step of the conversion funnel (2026-07-23
 * redesign). The user has already personalized their ledger and watched it get
 * built; now the trial is the only thing between them and the app, and the
 * account is created right after (the CTA hands off to sign-in). It leads with
 * honesty and social proof: a close ×, Restore, the ledger promise, a
 * monochrome rating, then a TRANSPARENT TRIAL TIMELINE (Today → Day 5 reminder
 * → Day 7 charge). Two elevated plan cards feed the selected-plan state; the
 * annual wears a "BEST VALUE" badge + its true per-month math. Billing
 * (RevenueCat) still ships with the App Store build; nothing is charged in
 * beta. No color on marketing — the accent belongs to planned work.
 */
type Plan = 'annual' | 'monthly';

const MONTHLY_PRICE = 8.99;
const ANNUAL_PRICE = 59.99;
const ANNUAL_PER_MONTH = 5.0;
/** Honest anchor: annual vs paying monthly all year. */
const SAVE_PCT = Math.round((1 - ANNUAL_PRICE / (MONTHLY_PRICE * 12)) * 100); // 44

const PLANS: { id: Plan; title: string; perMonth: string; sub: string; badge?: string }[] = [
  {
    id: 'annual',
    title: 'Annual',
    perMonth: `$${ANNUAL_PER_MONTH.toFixed(2)} / mo`,
    sub: `7-day free trial, then $${ANNUAL_PRICE}/year`,
    badge: 'BEST VALUE',
  },
  {
    id: 'monthly',
    title: 'Monthly',
    perMonth: `$${MONTHLY_PRICE.toFixed(2)} / mo`,
    sub: 'no trial · cancel anytime',
  },
];

const TIMELINE: { title: string; body: string; filled: boolean; last?: boolean }[] = [
  {
    filled: true,
    title: 'Today — full access',
    body: 'Import your Strong or Hevy history, or write your first session.',
  },
  {
    filled: false,
    title: 'Day 5 — reminder',
    body: 'We email you before the trial ends. No surprises.',
  },
  {
    filled: false,
    title: 'Day 7 — trial ends',
    body: 'Annual starts unless you cancel. Your data stays yours either way.',
    last: true,
  },
];

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "27 Jul 2026" — the day the 7-day trial would first charge, computed live. */
function trialEndLabel(): string {
  const d = new Date(Date.now() + 7 * 86_400_000);
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
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
      <Path d="M3 8.5L6.5 12 13 4.5" stroke={color.bg} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  );
}

export default function Paywall() {
  const router = useRouter();
  const { session } = useAuth();
  const [plan, setPlan] = useState<Plan>('annual');
  const name = getName();

  // The forward step of the funnel: an account is required to start the trial
  // and back up the ledger, so the CTA opens sign-in (billing itself lands with
  // the App Store build; nothing is charged in beta).
  const handleCta = () => {
    tap();
    if (session === null) {
      router.push('/sign-in');
      return;
    }
    Alert.alert(
      'Recore Pro',
      'Billing arrives with the App Store release — nothing is charged today. Everything is unlocked while Recore is in beta.',
    );
  };

  const handleRestore = () => {
    tap();
    Alert.alert(
      'Restore Purchases',
      'Restore checks your App Store receipts and never charges you. It goes live with billing in the App Store build.',
    );
  };

  const handleDismiss = () => {
    tap();
    router.back();
  };

  const handleSignIn = () => {
    tap();
    router.push('/sign-in');
  };

  /**
   * Development entrance. Skips the hard paywall with NO account, so the app
   * can be worked on without signing in every launch. Sign-in still exists and
   * still works — this only removes the gate, and `dev-bypass.ts` gives the
   * local database a fixed id so Home has something behind it.
   *
   * Not a purchase stub and not an entitlement: it skips the SCREEN, never the
   * account. `__DEV__` compiles the whole path out of release bundles.
   */
  const handleDevSkip = () => {
    tap();
    setDevBypass(true);
    router.replace('/');
  };

  const ctaLabel = plan === 'annual' ? 'Start 7-day free trial' : 'Continue with Monthly';

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.topRow}>
        <PressableScale
          onPress={handleDismiss}
          hitSlop={spacing.sm}
          style={styles.closeButton}
          accessibilityRole="button"
          accessibilityLabel="Close">
          <CloseGlyph />
        </PressableScale>
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
          <Pressable onPress={handleRestore} hitSlop={spacing.sm} style={({ pressed }) => pressed && styles.quietPressed}>
            <Text style={styles.restore} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              Restore purchases
            </Text>
          </Pressable>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Stagger initialDelay={60} step={70} distance={14}>
          <Eyebrow tone="secondary">{name ? `You're all set, ${name}` : 'Recore Pro'}</Eyebrow>
          <Text style={styles.headline} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {'Your words.\nA ledger you can trust.'}
          </Text>

          <View style={styles.ratingWrap}>
            <Rating score={4.9} countLabel="loved by early lifters" align="flex-start" />
          </View>

          <Text style={styles.subline} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            Write workouts naturally. Recore keeps a verified record and prepares your next exact
            session.
          </Text>

          <View style={styles.timeline}>
            {TIMELINE.map((step) => (
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

          <Testimonial
            style={styles.testimonial}
            quote="First tracker I’ve kept past a month. I just write my sets and it reads them."
            who="Marko · powerlifting"
          />
        </Stagger>

        <FadeSlideIn delay={320} style={styles.bottom}>
          <View style={styles.plans}>
            {PLANS.map((p) => {
              const selected = plan === p.id;
              return (
                <PressableScale
                  key={p.id}
                  onPress={() => setPlan(p.id)}
                  activeScale={0.98}
                  style={[styles.plan, selected ? styles.planSelected : styles.planIdle]}
                  pressedStyle={styles.planPressed}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}>
                  <View style={styles.planText}>
                    <View style={styles.planTitleRow}>
                      <Text
                        style={[styles.planTitle, selected ? styles.planTitleOn : styles.planTitleOff]}
                        maxFontSizeMultiplier={MAX_FONT_SCALE}>
                        {p.title}
                      </Text>
                      {p.id === 'annual' ? <Badge label={`SAVE ${SAVE_PCT}%`} tone={selected ? 'ink' : 'quiet'} /> : null}
                    </View>
                    <Text style={[styles.planNote, selected ? styles.planNoteOn : styles.planNoteOff]} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                      {p.sub}
                    </Text>
                  </View>
                  <View style={styles.planRight}>
                    <Text style={[styles.planPrice, selected ? styles.planPriceOn : styles.planPriceOff]} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                      {p.perMonth}
                    </Text>
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
            })}
          </View>

          <AppButton label={ctaLabel} onPress={handleCta} style={styles.cta} />

          <Text style={styles.legal} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {plan === 'annual'
              ? `No charge today. Free until ${trialEndLabel()}, then $${ANNUAL_PRICE}/year · cancel anytime in Settings.`
              : `$${MONTHLY_PRICE}/month, no trial · cancel anytime in Settings.`}
          </Text>

          <Text style={styles.links} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            <Text style={styles.link}>Terms</Text>
            <Text style={styles.linkSep}> · </Text>
            <Text style={styles.link}>Privacy</Text>
            {session === null ? (
              <>
                <Text style={styles.linkSep}> · </Text>
                <Text style={styles.link} onPress={handleSignIn}>
                  Already use Recore? Sign in
                </Text>
              </>
            ) : null}
          </Text>
        </FadeSlideIn>
      </ScrollView>
    </SafeAreaView>
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
    fontFamily: fonts.mono,
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
  headline: {
    ...type.title,
    color: color.textPrimary,
    marginTop: spacing.sm,
  },
  ratingWrap: {
    marginTop: spacing.md,
  },
  subline: {
    marginTop: spacing.md,
    ...type.subhead,
    lineHeight: moderateScale(23),
    color: color.textSecondary,
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
    lineHeight: moderateScale(20),
    color: color.textSecondary,
  },
  testimonial: {
    marginTop: spacing.xl,
  },
  bottom: {
    marginTop: 'auto',
    paddingTop: spacing.xxl,
  },
  plans: {
    gap: spacing.md,
  },
  plan: {
    backgroundColor: color.surface,
    borderRadius: radius.xxl,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg + 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  planIdle: {
    borderWidth: 1,
    borderColor: color.border,
  },
  planSelected: {
    borderWidth: 1.5,
    borderColor: color.accent,
    ...shadow.raised,
  },
  planPressed: {
    backgroundColor: color.surfaceHigh,
  },
  planText: {
    flex: 1,
    gap: 3,
  },
  planTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  planTitle: {
    ...type.headline,
  },
  planTitleOn: {
    color: color.textPrimary,
  },
  planTitleOff: {
    color: color.textSecondary,
  },
  planNote: {
    ...type.footnote,
  },
  planNoteOn: {
    color: color.textSecondary,
  },
  planNoteOff: {
    color: color.textMuted,
  },
  planRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  planPrice: {
    fontFamily: fonts.mono,
    fontSize: moderateScale(15),
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  planPriceOn: {
    color: color.textPrimary,
  },
  planPriceOff: {
    color: color.textMuted,
  },
  radioFilled: {
    width: moderateScale(22),
    height: moderateScale(22),
    borderRadius: radius.pill,
    backgroundColor: color.accent,
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
  cta: {
    marginTop: spacing.lg,
  },
  legal: {
    marginTop: spacing.md,
    ...type.footnote,
    lineHeight: moderateScale(18),
    color: color.textMuted,
    textAlign: 'center',
    paddingHorizontal: spacing.sm,
  },
  links: {
    marginTop: spacing.xs,
    ...type.footnote,
    color: color.textMuted,
    textAlign: 'center',
  },
  link: {
    color: color.textMuted,
    textDecorationLine: 'underline',
  },
  linkSep: {
    color: color.textMuted,
  },
});
