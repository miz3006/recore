import { ActivityIndicator, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

import {
  alpha,
  color,
  CONTROL_HEIGHT,
  eyebrow,
  fonts,
  MAX_FONT_SCALE,
  moderateScale,
  radius,
  shadow,
  spacing,
  type,
} from '@/lib/theme';

import { PressableScale } from './motion';

/**
 * The shared surface + control vocabulary (record-contract card contract, now
 * elevated). One Card, one Eyebrow label, one Button, one Divider — so every
 * screen draws the same shapes instead of re-rolling them inline. Still no
 * gradients and never green — the signal ink belongs to planned prescription
 * values only. Premium here is spacing, hairlines, tight type, the tactile
 * press-scale, and — new in the 2026-07-23 redesign — ONE restrained warm
 * shadow (`elevation`) so hero surfaces lift off the paper.
 */

export function Card({
  children,
  style,
  elevation = 'flat',
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** `flat` = hairline only (default, keeps in-app density calm); `card` = a
   * gentle lift; `raised` = the hero cast + a larger radius. */
  elevation?: 'flat' | 'card' | 'raised';
}) {
  return (
    <View
      style={[
        styles.card,
        elevation === 'card' && [styles.cardLift, shadow.card],
        elevation === 'raised' && [styles.cardRaised, shadow.raised],
        style,
      ]}>
      {children}
    </View>
  );
}

/** A mono small-caps section label — the archival voice that names a block
 * ("RECORD BOOK", "THIS WEEK"). One treatment everywhere via the `eyebrow`
 * token. `tone` lifts it from muted to secondary. */
export function Eyebrow({
  children,
  tone = 'muted',
  style,
}: {
  children: string;
  tone?: 'muted' | 'secondary';
  style?: StyleProp<TextStyle>;
}) {
  return (
    <Text
      style={[styles.eyebrow, tone === 'secondary' && styles.eyebrowSecondary, style]}
      maxFontSizeMultiplier={MAX_FONT_SCALE}>
      {children.toUpperCase()}
    </Text>
  );
}

/** Back-compat alias — older screens call this `CaptionLabel`. */
export function CaptionLabel({ children, tone = 'muted' }: { children: string; tone?: 'muted' | 'signal' }) {
  return <Eyebrow tone={tone === 'signal' ? 'secondary' : 'muted'}>{children}</Eyebrow>;
}

/** A hairline rule — the in-card divider. */
export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.divider, style]} />;
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost';

/**
 * The one button. Ink-fill primary (restraint is the brand), bordered
 * secondary, quiet ghost — all one height, one radius, one press-scale. This
 * replaces the primary/secondary blocks duplicated across sign-in, onboarding,
 * and the paywall.
 */
export function AppButton({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  leading,
  compact = false,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  /** Optional leading element (an icon) rendered before the label. */
  leading?: React.ReactNode;
  /** A shorter control (secondary rows, sheet actions). */
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const inactive = disabled || loading;
  return (
    <PressableScale
      onPress={onPress}
      disabled={inactive}
      haptic={variant === 'primary' ? 'medium' : 'light'}
      activeScale={0.98}
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive }}
      style={[
        styles.btn,
        compact && styles.btnCompact,
        variant === 'primary' && styles.btnPrimary,
        variant === 'secondary' && styles.btnSecondary,
        variant === 'ghost' && styles.btnGhost,
        inactive && styles.btnDisabled,
        style,
      ]}
      pressedStyle={variant === 'primary' ? styles.btnPrimaryPressed : undefined}>
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? color.onInk : color.textPrimary} />
      ) : (
        <View style={styles.btnRow}>
          {leading}
          <Text
            style={[
              styles.btnLabel,
              variant === 'primary' && styles.btnLabelPrimary,
              variant === 'secondary' && styles.btnLabelTinted,
              variant === 'ghost' && styles.btnLabelQuiet,
            ]}
            numberOfLines={1}
            maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {label}
          </Text>
        </View>
      )}
    </PressableScale>
  );
}

/**
 * A big-number stat tile: eyebrow label, tabular numeral, optional delta line.
 * Deltas are archival — muted by default, error red only when the tile warns.
 */
export function StatTile({
  label,
  value,
  unit,
  delta,
  deltaTone = 'muted',
  style,
}: {
  label: string;
  value: string;
  unit?: string;
  delta?: string;
  deltaTone?: 'muted' | 'error' | 'signal';
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Card elevation="card" style={[styles.tile, style]}>
      <Eyebrow>{label}</Eyebrow>
      <Text style={styles.tileValue} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
        {value}
        {unit ? <Text style={styles.tileUnit}> {unit}</Text> : null}
      </Text>
      {delta ? (
        <Text
          style={[styles.tileDelta, deltaTone === 'error' && styles.deltaError]}
          numberOfLines={1}
          maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {delta}
        </Text>
      ) : null}
    </Card>
  );
}

// Stars / Rating / Testimonial were DELETED on 11 Aug 2026 (blocker B4).
// They fabricated a 4.9 score and a five-star quote card with no reviews
// behind them — CLAUDE.md §3: no fabricated reviews anywhere, including
// placeholders. Real App Store reviews, when they exist, come back as data,
// not as a default prop.

/** A small bordered mono label — "BEST VALUE", "SAVE 16%". Ink outline, never
 * a filled color chip (that would break the monochrome contract). */
export function Badge({ label, tone = 'ink' }: { label: string; tone?: 'ink' | 'quiet' }) {
  return (
    <View style={[styles.badge, tone === 'ink' && styles.badgeInk]}>
      <Text
        style={[styles.badgeText, tone === 'ink' && styles.badgeTextInk]}
        maxFontSizeMultiplier={MAX_FONT_SCALE}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: color.surface,
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: color.border,
    padding: spacing.lg,
  },
  cardLift: {
    borderColor: color.divider, // the shadow carries the edge — soften the rule
  },
  cardRaised: {
    borderRadius: radius.xxl,
    borderCurve: 'continuous',
    borderColor: color.divider,
  },
  eyebrow: {
    ...eyebrow,
    color: color.textMuted,
  },
  eyebrowSecondary: {
    color: color.textSecondary,
  },
  divider: {
    height: 1,
    backgroundColor: color.divider,
  },

  // Button
  btn: {
    minHeight: CONTROL_HEIGHT,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  btnCompact: {
    minHeight: moderateScale(44),
    paddingVertical: spacing.sm,
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  btnPrimary: {
    // TINTED, NOT INKED (owner, 18 Aug 2026). Apple's prominent button wears the
    // app's tint — an ink-black fill is an Android/web habit. `ctaFill` is the
    // same blue as `trained`, so "the colour of the product" and "the colour of
    // the thing you press" are one answer.
    backgroundColor: color.ctaFill,
    ...shadow.card, // the CTA lifts off the page — the one control that should
  },
  btnPrimaryPressed: {
    backgroundColor: color.ctaFillPressed,
  },
  btnSecondary: {
    // The tinted companion: blue text on a blue wash, Apple's second-rank
    // button. It follows the primary so the pair reads as one family.
    backgroundColor: alpha(color.ctaFill, 0.12),
  },
  btnGhost: {
    backgroundColor: 'transparent',
  },
  btnDisabled: {
    opacity: 0.4,
  },
  btnLabel: {
    fontSize: type.headline.fontSize,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  btnLabelPrimary: {
    color: color.onInk,
  },
  btnLabelQuiet: {
    color: color.textPrimary,
  },
  btnLabelTinted: {
    color: color.ctaFill,
  },

  // StatTile
  tile: {
    flex: 1,
    gap: spacing.xs,
  },
  tileValue: {
    ...type.statNumber,
    color: color.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  tileUnit: {
    fontSize: type.subhead.fontSize,
    fontWeight: '600',
    color: color.textSecondary,
  },
  tileDelta: {
    ...type.caption,
    color: color.textMuted,
    fontVariant: ['tabular-nums'],
  },
  deltaError: {
    color: color.error,
  },

  badge: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.sm,
    borderCurve: 'continuous',
    paddingVertical: 2,
    paddingHorizontal: spacing.sm,
  },
  badgeInk: {
    backgroundColor: color.accent,
    borderColor: color.accent,
  },
  badgeText: {
    fontFamily: fonts.reading,
    fontVariant: ['tabular-nums'],
    fontSize: moderateScale(9.5),
    fontWeight: '700',
    letterSpacing: 1,
    color: color.textSecondary,
  },
  badgeTextInk: {
    color: color.onInk,
  },
});
