import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Card, CaptionLabel } from '@/components/primitives';
import { StubScreen } from '@/components/stub-screen';
import { tap, tapMedium } from '@/lib/haptics';
import { alpha, color, CONTROL_HEIGHT, ink, MAX_FONT_SCALE, moderateScale, radius, spacing, type } from '@/lib/theme';

/**
 * /paywall — Recore Pro (CLAUDE.md §11). The shape the research supports:
 * logging stays free forever (the growth engine), Pro is the memory and the
 * coach. Pricing sits in the tracker cluster (Hevy-lane), annual is the
 * default, lifetime exists for the subscription-averse lifter. Billing itself
 * (RevenueCat) arrives with the App Store build — the CTA says so honestly.
 * No signal volt on this screen: the accent belongs to the AI's output, not
 * to marketing.
 */
type Plan = 'monthly' | 'annual' | 'lifetime';

const PLANS: { id: Plan; title: string; price: string; note: string }[] = [
  { id: 'monthly', title: 'Monthly', price: '$3.99', note: 'per month' },
  { id: 'annual', title: 'Annual', price: '$29.99', note: '$2.49 a month, billed yearly' },
  { id: 'lifetime', title: 'Lifetime', price: '$79.99', note: 'one payment, yours forever' },
];

const PRO_FEATURES: { title: string; body: string; soon?: boolean }[] = [
  {
    title: 'Next-session predictions',
    body: 'Written for you, with the reason, from your own notes.',
  },
  { title: 'All-time history', body: 'e1RM trends and every session, forever.' },
  { title: 'Record book', body: 'Every PR, dated.' },
  { title: 'Weekly recap', body: 'One quiet summary a week.', soon: true },
];

const FREE_FOREVER = [
  'Unlimited note logging and AI parsing',
  'Your raw text, always',
  'PR detection',
  'CSV export',
];

/** The BEST VALUE pill's micro type — one step under caption, still scaled. */
const BEST_PILL_FONT = moderateScale(11);

export default function Paywall() {
  const [plan, setPlan] = useState<Plan>('annual');

  const handleCta = () => {
    tapMedium();
    Alert.alert(
      'Recore Pro',
      'Billing arrives with the App Store release. Everything is unlocked while Recore is in beta.',
    );
  };

  return (
    <StubScreen title="Recore Pro">
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        <Text style={styles.pitch} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          The predictor writes your next session, with reasons, and keeps your whole record
          book. Pro is the memory and the coach.
        </Text>

        <Card>
          <CaptionLabel>What Pro is</CaptionLabel>
          <View style={styles.rows}>
            {PRO_FEATURES.map((f) => (
              <View key={f.title} style={styles.featureRow}>
                <View style={styles.featureText}>
                  <Text style={styles.featureTitle} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                    {f.title}
                  </Text>
                  <Text style={styles.featureBody} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                    {f.body}
                  </Text>
                </View>
                {f.soon ? (
                  <Text style={styles.soon} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                    soon
                  </Text>
                ) : null}
              </View>
            ))}
          </View>
        </Card>

        <Card>
          <CaptionLabel>Free forever</CaptionLabel>
          <View style={styles.rows}>
            {FREE_FOREVER.map((line) => (
              <Text key={line} style={styles.freeLine} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                {line}
              </Text>
            ))}
          </View>
          <Text style={styles.freeNote} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            These never move behind the paywall.
          </Text>
        </Card>

        <View style={styles.plans}>
          {PLANS.map((p) => {
            const selected = plan === p.id;
            return (
              <Pressable
                key={p.id}
                onPress={() => {
                  tap();
                  setPlan(p.id);
                }}
                style={[styles.plan, selected && styles.planSelected]}>
                <View style={styles.planText}>
                  <View style={styles.planTitleRow}>
                    <Text style={styles.planTitle} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                      {p.title}
                    </Text>
                    {p.id === 'annual' ? (
                      <View style={styles.bestPill}>
                        <Text style={styles.bestPillText} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                          BEST VALUE
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.planNote} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                    {p.note}
                  </Text>
                </View>
                <Text style={styles.planPrice} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                  {p.price}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Pressable
          onPress={handleCta}
          style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}>
          <Text style={styles.ctaLabel} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {plan === 'lifetime' ? 'Get lifetime' : 'Start 30-day free trial'}
          </Text>
        </Pressable>

        <Text style={styles.footer} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          Prices may change at launch. Logging is free forever.
        </Text>
      </ScrollView>
    </StubScreen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    marginHorizontal: -spacing.xxl, // StubScreen pads the body; the scroll owns it
  },
  content: {
    paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.huge,
    gap: spacing.md,
  },
  pitch: {
    ...type.subhead,
    color: color.textSecondary,
    marginBottom: spacing.sm,
  },
  rows: {
    marginTop: spacing.sm,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingVertical: spacing.sm + 1,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: alpha(color.accent, ink.divider),
  },
  featureText: {
    flex: 1,
    gap: 2,
  },
  featureTitle: {
    fontSize: type.subhead.fontSize,
    fontWeight: '600',
    color: color.textPrimary,
  },
  featureBody: {
    ...type.caption,
    color: color.textSecondary,
  },
  soon: {
    fontSize: type.caption.fontSize,
    color: color.textMuted,
    letterSpacing: 0.5,
  },
  freeLine: {
    fontSize: type.subhead.fontSize,
    color: color.textPrimary,
    paddingVertical: spacing.xs,
  },
  freeNote: {
    marginTop: spacing.sm,
    ...type.caption,
    color: color.textMuted,
  },
  plans: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  plan: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    backgroundColor: color.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: alpha(color.accent, ink.hairline),
    padding: spacing.lg,
  },
  planSelected: {
    backgroundColor: color.surfaceHigh,
    borderColor: alpha(color.accent, 0.5),
  },
  planText: {
    flex: 1,
    gap: 2,
  },
  planTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  planTitle: {
    fontSize: type.subhead.fontSize,
    fontWeight: '600',
    color: color.textPrimary,
  },
  bestPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 1.5,
    borderRadius: radius.pill,
    backgroundColor: color.accent,
  },
  bestPillText: {
    fontSize: BEST_PILL_FONT,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: color.bg,
  },
  planNote: {
    ...type.caption,
    color: color.textSecondary,
  },
  planPrice: {
    fontSize: type.headline.fontSize,
    fontWeight: '700',
    color: color.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  cta: {
    height: CONTROL_HEIGHT,
    borderRadius: radius.pill,
    backgroundColor: color.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  ctaPressed: {
    backgroundColor: color.accentPressed,
  },
  ctaLabel: {
    color: color.bg,
    fontSize: type.subhead.fontSize,
    fontWeight: '600',
  },
  footer: {
    ...type.caption,
    color: color.textMuted,
    textAlign: 'center',
  },
});
