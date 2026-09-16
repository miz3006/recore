import { StyleSheet, Text, View } from 'react-native';

import { Enter, PressScale } from '@/lib/motion/index';
import {
  color,
  CTA_HEIGHT,
  hairline,
  MAX_FONT_SCALE,
  moderateScale,
  radius,
  spacing,
  type,
} from '@/lib/theme';

import { Check } from './Check';
import { BETA_COPY } from './copy';

/**
 * WHAT THE PAYWALL IS IN A BETA BUILD — a statement and one button, where the
 * timeline, the two plan cards, the assurance row, the store CTA and the
 * renewal paragraph normally are.
 *
 * ## Why the screen is shown at all
 *
 * It used to be skipped: `app/index.tsx` sent a beta build straight to sign-in
 * because a build with no store key could only have rendered "Prices
 * unavailable" and a dead button. Skipping it is honest and it also means the
 * one screen a tester should be told something on is the one screen they never
 * see. So the screen stays in the funnel and says the true thing instead
 * (owner, 16 September 2026): it is free right now, and thank you.
 *
 * ## What it may not become
 *
 * Everything CLAUDE.md §2 rule 5 forbids is forbidden harder here, because
 * there is no store to correct a wrong word: no price, no trial clock, no
 * "normally X", no countdown, no Restore. The copy lives in `copy.ts` and its
 * test asserts that none of these strings can carry a digit or a currency
 * mark. This file draws them and nothing else.
 *
 * ## One button, in the body
 *
 * The forward step is a full-width brand pill in the middle of the screen —
 * the same control the paying funnel uses, in the same place — and NOT the
 * quiet `DEV · SKIP` chip in the header, which is a developer's door and reads
 * like one. A tester should not have to find a corner of the screen to get
 * into the app they were sent to test.
 */
export function BetaPass({ onContinue }: { onContinue: () => void }) {
  return (
    <View style={styles.block}>
      <Enter index={2}>
        <View style={styles.card}>
          <View style={styles.badgeRow} accessible accessibilityRole="text">
            <View style={styles.checkSlot}>
              <Check size={CHECK} tint={color.textPrimary} strokeWidth={2.8} />
            </View>
            <Text style={styles.badge} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              {BETA_COPY.badge}
            </Text>
          </View>
          <Text style={styles.body} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {BETA_COPY.body}
          </Text>
        </View>
      </Enter>

      <Enter index={3}>
        <Text style={styles.thanks} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {BETA_COPY.thanks}
        </Text>
      </Enter>

      <Enter index={4} style={styles.ctaWrap}>
        <PressScale
          onPress={onContinue}
          haptic="impact"
          accessibilityLabel={BETA_COPY.cta}
          testID="paywall-v2-beta-continue">
          <View style={styles.cta}>
            <Text style={styles.ctaLabel} maxFontSizeMultiplier={MAX_FONT_SCALE} numberOfLines={1}>
              {BETA_COPY.cta}
            </Text>
          </View>
        </PressScale>
      </Enter>
    </View>
  );
}

/** The check beside the status line, in points, so the slot below can centre it
 * against the label's own line height rather than against the row. */
const CHECK = moderateScale(15);

const styles = StyleSheet.create({
  block: { gap: spacing.lg },
  /**
   * The one surface on the screen. `surface` floats on the canvas the way every
   * other card in the app does; the hairline border is what keeps a 1.06:1
   * lightness difference legible without a shadow doing the work.
   */
  card: {
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.xl,
    borderCurve: 'continuous',
    borderWidth: hairline,
    borderColor: color.border,
    backgroundColor: color.surface,
  },
  /**
   * `flex-start`, not `center`. The label wraps to two lines at the larger
   * Dynamic Type steps, and a centred check then floats in the gap between
   * them instead of marking the line it belongs to. `checkSlot` puts it on the
   * FIRST line's optical centre at every size — `(lineHeight − CHECK) / 2`,
   * measured from the type scale rather than nudged by eye.
   */
  badgeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  checkSlot: { paddingTop: ((type.headline.lineHeight ?? CHECK) - CHECK) / 2 },
  /** Ink, not brand. The accent on this screen is spent on nothing at all in a
   * beta build — there is no selected plan and no timeline to mark, and a blue
   * "free" would read as a badge for an offer that does not exist. */
  badge: { ...type.headline, fontWeight: '700', color: color.textPrimary, flex: 1 },
  body: { ...type.subhead, color: color.textSecondary },
  /** Outside the card, centred: it is addressed to the person rather than being
   * another fact about the build. */
  thanks: {
    ...type.subhead,
    color: color.textSecondary,
    textAlign: 'center',
    paddingHorizontal: spacing.xs,
  },
  ctaWrap: { marginTop: spacing.xs },
  cta: {
    height: CTA_HEIGHT,
    borderRadius: radius.pill,
    backgroundColor: color.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaLabel: { ...type.headline, fontWeight: '700', color: color.onInk },
});
