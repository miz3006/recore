import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { FadeSlideIn, FadeSwap, PressableScale } from '@/components/motion';
import { tap } from '@/lib/haptics';
import {
  color,
  hairline,
  lineFor,
  MAX_FONT_SCALE,
  moderateScale,
  readingStyle,
  spacing,
  type,
} from '@/lib/theme';

/**
 * The brief, split into the two jobs it was doing badly as one card
 * (13 Aug 2026 redesign).
 *
 * It used to be a raised card at the top of the page carrying a headline, a
 * bordered chip, a More link, an expanded paragraph and a provenance rule —
 * five elements, all competing with the loads underneath, all wrapped in the
 * same surface as everything else on the page. The result was a screen with no
 * focal point: four cards of equal weight and the one number a lifter came for
 * sitting third from the top at 19 pt.
 *
 * So the brief is no longer a card at all.
 *
 * · `BriefLede` is the STANDFIRST — one or two lines on bare paper, directly
 *   under the title, setting up the session card below it. This is
 *   product-direction §9's "one short, well-designed briefing paragraph",
 *   finally short.
 * · `BriefFooter` is the READ-MORE — the full composed (or model-rewritten)
 *   paragraph and its provenance, at the bottom of the page where a reader who
 *   wants the long version goes looking. Nothing was deleted: the paragraph is
 *   still composed, still guarded, still upgraded when a rewrite lands (§9.1).
 *
 * The page now has exactly one raised surface, and it is the bar.
 */

export function BriefLede({
  headline,
  adherence,
}: {
  headline: string;
  /** "3 of 5 prescriptions followed", or null. Never "0 of N" — see
   * `adherenceChip` in `lib/next/sections.ts`. */
  adherence: string | null;
}) {
  return (
    <View>
      {/* Two lines, hard. A third would be the paragraph coming back. */}
      <Text style={styles.lede} numberOfLines={2} maxFontSizeMultiplier={MAX_FONT_SCALE}>
        {headline}
      </Text>
      {adherence ? (
        // A plain line, not a bordered chip. The predictor's record is
        // evidence; boxing it made it look like a badge, and a badge is a
        // reward (§6).
        <Text style={styles.adherence} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {adherence}
        </Text>
      ) : null}
    </View>
  );
}

export function BriefFooter({
  prose,
  proseKey,
  provenance,
  onExpand,
}: {
  /** The full phrased brief, revealed by the disclosure. */
  prose: string;
  /** Changes when the model's rewrite lands, so the swap can be seen. */
  proseKey: string;
  provenance: string;
  onExpand?: () => void;
}) {
  const [open, setOpen] = useState(false);
  if (!prose) return null;

  return (
    <View style={styles.footer}>
      <PressableScale
        onPress={() => {
          tap();
          if (!open) onExpand?.();
          setOpen((v) => !v);
        }}
        haptic="none"
        activeScale={1}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={open ? 'Hide the full brief' : 'Read the full brief'}
        style={styles.disclosure}>
        <Text style={styles.disclosureLabel} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {open ? 'Hide the full brief' : 'Read the full brief'}
        </Text>
      </PressableScale>

      {open ? (
        <FadeSlideIn distance={6}>
          {/* The model's rewrite swaps in with one dip, so the upgrade stays
              visible (§9.1) even now that the prose is one tap down. */}
          <FadeSwap swapKey={proseKey}>
            <Text style={styles.prose} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              {prose}
            </Text>
          </FadeSwap>
        </FadeSlideIn>
      ) : null}

      <Text style={styles.provenance} maxFontSizeMultiplier={MAX_FONT_SCALE}>
        {provenance}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  lede: {
    ...type.lede,
    color: color.textPrimary,
  },
  adherence: {
    marginTop: spacing.sm,
    ...readingStyle('400'),
    fontSize: type.footnote.fontSize,
    lineHeight: lineFor(16),
    color: color.textSecondary,
  },
  footer: {
    paddingTop: spacing.lg,
    borderTopWidth: hairline,
    borderTopColor: color.divider,
  },
  disclosure: {
    alignSelf: 'flex-start',
    paddingVertical: spacing.sm,
    paddingRight: spacing.md,
    minHeight: moderateScale(32),
    justifyContent: 'center',
  },
  disclosureLabel: {
    ...type.footnote,
    fontWeight: '600',
    color: color.trained,
  },
  prose: {
    marginTop: spacing.xs,
    ...type.body,
    color: color.textPrimary,
  },
  provenance: {
    marginTop: spacing.md,
    ...type.caption,
    fontSize: moderateScale(11),
    lineHeight: lineFor(15),
    color: color.textMuted,
  },
});
