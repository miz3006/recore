import { ActivityIndicator, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

import {
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
      pressedStyle={
        variant === 'primary' ? styles.btnPrimaryPressed : styles.btnQuietPressed
      }>
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? color.bg : color.textPrimary} />
      ) : (
        <View style={styles.btnRow}>
          {leading}
          <Text
            style={[
              styles.btnLabel,
              variant === 'primary' ? styles.btnLabelPrimary : styles.btnLabelQuiet,
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

/** A monochrome star row — social proof stays ink, never gold. `filled` many
 * of `count` solid, the rest hairline-outlined, so a 4.8 reads honestly. */
export function Stars({ score = 5, count = 5, size = moderateScale(13) }: { score?: number; count?: number; size?: number }) {
  const full = Math.round(score);
  return (
    <View style={styles.starRow} accessibilityLabel={`${score} out of ${count} stars`}>
      {Array.from({ length: count }).map((_, i) => (
        <Text
          key={i}
          style={[styles.star, { fontSize: size }, i >= full && styles.starEmpty]}
          maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {i < full ? '★' : '☆'}
        </Text>
      ))}
    </View>
  );
}

/**
 * The social-proof line — stars + a quiet mono score/volume ("4.9 · 1,200+
 * lifters"). The research is unambiguous: every high-converting paywall wears
 * this. Monochrome, serious, no badges. `align` centers it on the paywall.
 */
export function Rating({
  score = 4.9,
  countLabel,
  align = 'center',
}: {
  score?: number;
  countLabel: string;
  align?: 'center' | 'flex-start';
}) {
  return (
    <View style={[styles.rating, { alignItems: align }]}>
      <Stars score={score} />
      <Text style={styles.ratingText} maxFontSizeMultiplier={MAX_FONT_SCALE}>
        {score.toFixed(1)} · {countLabel}
      </Text>
    </View>
  );
}

/** An early-lifter note — quote, stars, attribution. Placeholder copy until
 * real reviews exist (App Store rules: never fabricate on the live paywall). */
export function Testimonial({ quote, who, style }: { quote: string; who: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.testimonial, style]}>
      <Stars size={moderateScale(11)} />
      <Text style={styles.testimonialQuote} maxFontSizeMultiplier={MAX_FONT_SCALE}>
        {`“${quote}”`}
      </Text>
      <Text style={styles.testimonialWho} maxFontSizeMultiplier={MAX_FONT_SCALE}>
        {who}
      </Text>
    </View>
  );
}

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
    borderWidth: 1,
    borderColor: color.border,
    padding: spacing.lg,
  },
  cardLift: {
    borderColor: color.divider, // the shadow carries the edge — soften the rule
  },
  cardRaised: {
    borderRadius: radius.xxl,
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
    height: CONTROL_HEIGHT,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  btnCompact: {
    height: moderateScale(44),
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  btnPrimary: {
    backgroundColor: color.accent,
    ...shadow.card, // the CTA lifts off the page — the one control that should
  },
  btnPrimaryPressed: {
    backgroundColor: color.accentPressed,
  },
  btnSecondary: {
    borderWidth: 1,
    borderColor: color.accent,
  },
  btnGhost: {
    backgroundColor: 'transparent',
  },
  btnQuietPressed: {
    backgroundColor: color.surfaceHigh,
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
    color: color.bg,
  },
  btnLabelQuiet: {
    color: color.textPrimary,
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

  // Social proof
  starRow: {
    flexDirection: 'row',
    gap: moderateScale(2),
  },
  star: {
    color: color.textPrimary,
    letterSpacing: 1,
  },
  starEmpty: {
    color: color.textMuted,
  },
  rating: {
    gap: spacing.xs + 1,
  },
  ratingText: {
    fontFamily: fonts.mono,
    fontSize: moderateScale(12),
    letterSpacing: 0.2,
    color: color.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  testimonial: {
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  testimonialQuote: {
    ...type.subhead,
    color: color.textPrimary,
  },
  testimonialWho: {
    fontFamily: fonts.mono,
    fontSize: moderateScale(11),
    letterSpacing: 0.3,
    color: color.textMuted,
  },
  badge: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.sm,
    paddingVertical: 2,
    paddingHorizontal: spacing.sm,
  },
  badgeInk: {
    backgroundColor: color.accent,
    borderColor: color.accent,
  },
  badgeText: {
    fontFamily: fonts.mono,
    fontSize: moderateScale(9.5),
    fontWeight: '700',
    letterSpacing: 1,
    color: color.textSecondary,
  },
  badgeTextInk: {
    color: color.bg,
  },
});
