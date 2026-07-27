import {
  ActivityIndicator,
  ScrollView,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import {
  CONTROL_HEIGHT,
  MAX_FONT_SCALE,
  eyebrow,
  hairline,
  makeStyles,
  moderateScale,
  radius,
  space,
  spacing,
  tag,
  type,
  useTheme,
} from '@/lib/theme';

import { PressableScale } from './motion';

/**
 * The §20 vocabulary. **Build these once here and never inline an alternative** —
 * a design system is the absence of alternatives, and a second button drawn in a
 * screen file is how that absence ends.
 *
 * Two rules bind every component in this file:
 *
 * · **No `color` prop.** Colour comes from semantics — `tone="quiet"` — never
 *   from the call site. This is what makes §6.2's invariant (ember means one
 *   thing) enforceable rather than merely agreed.
 * · **No `style` prop that can override a spacing token.** Where a `style` prop
 *   exists it is for *placement* — flex, alignment, where a thing sits in its
 *   parent — not for re-deciding what it is.
 */

// ————————————————————————————————————————————————————————————— §20 · surfaces

/**
 * `Screen` — safe areas, the theme background, and the tab-bar underlap.
 *
 * The underlap is the part worth stating: §5.2 requires content to scroll
 * *behind* the Liquid Glass tab bar, edge to edge. Insetting the scroll view to
 * "clear" the bar is the obvious move and it kills the entire effect — glass
 * needs content underneath it to refract. So the bottom edge is deliberately not
 * a safe-area edge on a scrolling screen; `contentInsetAdjustmentBehavior`
 * hands that to the system, which is the only thing that knows how tall the bar
 * currently is.
 */
export function Screen({
  children,
  scroll = false,
  padded = true,
  edges = ['top'],
  style,
}: {
  children: React.ReactNode;
  /** Wrap the content in a scroll view that runs under the tab bar. */
  scroll?: boolean;
  /** §6.6's screen padding (16). Off for a screen that draws to the edges. */
  padded?: boolean;
  edges?: readonly Edge[];
  /** Placement only — flex and alignment. Not spacing, not colour. */
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useStyles();
  if (scroll) {
    return (
      <SafeAreaView edges={edges} style={[styles.screen, style]}>
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={padded ? styles.screenPadded : undefined}>
          {children}
        </ScrollView>
      </SafeAreaView>
    );
  }
  return (
    <SafeAreaView edges={edges} style={[styles.screen, padded && styles.screenPadded, style]}>
      {children}
    </SafeAreaView>
  );
}

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
  const styles = useStyles();
  const t = useTheme();
  return (
    <View
      style={[
        styles.card,
        elevation === 'card' && [styles.cardLift, t.shadow.card],
        elevation === 'raised' && [styles.cardRaised, t.shadow.raised],
        style,
      ]}>
      {children}
    </View>
  );
}

// ———————————————————————————————————————————————————————— §20 · the tag

/**
 * `Tag` — `micro` uppercase in a hairline capsule. `RECORDED` · `PR` ·
 * `WARM-UP`.
 *
 * §6.3 names this one by hand: *"PR is a shape, not a colour — a hairline
 * capsule outlined in `ink` containing mono uppercase PR."* A shape survives
 * every theme, every colourblind profile and every screenshot, which a hue does
 * not; that is the whole reason the app can afford exactly one colour.
 *
 * `tone="ink"` is the loud one and belongs to a record. `quiet` (the default)
 * is furniture: it names a state the user already knows they are in.
 */
export function Tag({ label, tone = 'quiet' }: { label: string; tone?: 'ink' | 'quiet' }) {
  const styles = useStyles();
  return (
    <View style={[styles.tag, tone === 'ink' && styles.tagInk]}>
      <Text
        style={[styles.tagText, tone === 'ink' && styles.tagTextInk]}
        maxFontSizeMultiplier={MAX_FONT_SCALE}>
        {label.toUpperCase()}
      </Text>
    </View>
  );
}

// ———————————————————————————————————————————————————————— §20 · controls

type ButtonTone = 'primary' | 'secondary' | 'ghost';

/**
 * `PrimaryButton` — §6.7's 52pt ink-fill capsule. **One per screen, maximum.**
 *
 * Ink, not ember: §6.2 spends the one hue on a number you have not lifted yet,
 * and a button is not that. The paywall's CTA is the same ink as everything else
 * on purpose (§14.3) — the app does not shout, including when it wants money.
 */
export function PrimaryButton(props: Omit<ButtonProps, 'tone'>) {
  return <Button {...props} tone="primary" />;
}

type ButtonProps = {
  label: string;
  onPress: () => void;
  tone?: ButtonTone;
  disabled?: boolean;
  loading?: boolean;
  /** Optional leading element (an icon) rendered before the label. */
  leading?: React.ReactNode;
  /** A shorter control for secondary rows and sheet actions. */
  compact?: boolean;
  /** Placement only. */
  style?: StyleProp<ViewStyle>;
};

function Button({
  label,
  onPress,
  tone = 'primary',
  disabled = false,
  loading = false,
  leading,
  compact = false,
  style,
}: ButtonProps) {
  const styles = useStyles();
  const t = useTheme();
  const inactive = disabled || loading;
  return (
    <PressableScale
      onPress={onPress}
      disabled={inactive}
      haptic={tone === 'primary' ? 'medium' : 'light'}
      activeScale={0.98}
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive }}
      style={[
        styles.btn,
        compact && styles.btnCompact,
        tone === 'primary' && styles.btnPrimary,
        tone === 'secondary' && styles.btnSecondary,
        tone === 'ghost' && styles.btnGhost,
        inactive && styles.btnDisabled,
        style,
      ]}
      pressedStyle={tone === 'primary' ? styles.btnPrimaryPressed : styles.btnQuietPressed}>
      {loading ? (
        <ActivityIndicator color={tone === 'primary' ? t.canvas : t.ink} />
      ) : (
        <View style={styles.btnRow}>
          {leading}
          <Text
            style={[styles.btnLabel, tone === 'primary' ? styles.btnLabelPrimary : styles.btnLabelQuiet]}
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
 * `Field` — the one text input.
 *
 * `flush` is the composer (§6.7, §8.2): **no radius, no border, no fill.** The
 * writing surface is a page, not a widget, and that single absence is what keeps
 * Today from reading as a chat app. Everywhere else the field is a bordered
 * capsule-adjacent box, because a form field that does not look tappable is a
 * form field nobody taps.
 */
export function Field({
  flush = false,
  label,
  hint,
  style,
  ...props
}: TextInputProps & {
  flush?: boolean;
  /** A quiet label above the field. */
  label?: string;
  /** One line under it — what the value is for, never an error. */
  hint?: string;
  /** Placement only. */
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useStyles();
  const t = useTheme();
  return (
    <View style={style}>
      {label ? <Eyebrow>{label}</Eyebrow> : null}
      <TextInput
        {...props}
        style={[styles.field, flush ? styles.fieldFlush : styles.fieldBoxed]}
        placeholderTextColor={t.inkFaint}
        maxFontSizeMultiplier={MAX_FONT_SCALE}
      />
      {hint ? (
        <Text style={styles.fieldHint} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * `EmptyState` — a headline and, where there is one, the action that fills it.
 *
 * §12.1: an empty state *states what will fill it* and never reports a lack.
 * "No data available" is not a state, it is an apology for not having designed
 * one. There is no illustration slot and there never will be.
 */
export function EmptyState({
  title,
  body,
  actionLabel,
  onAction,
}: {
  title: string;
  /** One line. If it needs two, the screen is doing two jobs (§4.7). */
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const styles = useStyles();
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle} maxFontSizeMultiplier={MAX_FONT_SCALE}>
        {title}
      </Text>
      {body ? (
        <Text style={styles.emptyBody} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {body}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <PrimaryButton label={actionLabel} onPress={onAction} compact style={styles.emptyAction} />
      ) : null}
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
  const styles = useStyles();
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

/**
 * A hairline rule — the in-card divider, and the one definition of a rule that
 * separates ROWS rather than bounding a surface.
 *
 * It is a real hairline, not `height: 1`. A 1pt line is three device pixels on
 * a modern screen — thick enough to read as drawn furniture — so the trick is
 * to go thinner and one step darker: `hairline` at `border` carries less total
 * ink than 1pt at `divider` while having a crisper edge. Container borders stay
 * at 1pt; an edge that bounds something is allowed to be seen.
 */
export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  const styles = useStyles();
  return <View style={[styles.divider, style]} />;
}

// ————————————————————————————————————————————— pre-§20, awaiting their rewrite
// Everything below belongs to a screen §22 rewrites in a later phase
// (onboarding §13, paywall §14.3, Progress 4.5–4.10). It stays until its last
// consumer is gone, and nothing new should reach for it.

/** Legacy name for {@link Button}. New work calls `PrimaryButton` (§20). */
export function AppButton({
  variant = 'primary',
  ...props
}: Omit<ButtonProps, 'tone'> & { variant?: ButtonTone }) {
  return <Button {...props} tone={variant} />;
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
  const styles = useStyles();
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
  const styles = useStyles();
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
  const styles = useStyles();
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
  const styles = useStyles();
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
  const styles = useStyles();
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

const useStyles = makeStyles((t) => ({
  screen: {
    flex: 1,
    backgroundColor: t.canvas,
  },
  screenPadded: {
    paddingHorizontal: spacing.lg,
  },
  card: {
    backgroundColor: t.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: t.rule,
    padding: spacing.lg,
  },
  cardLift: {
    borderColor: t.rule, // the shadow carries the edge — soften the rule
  },
  cardRaised: {
    borderRadius: radius.xxl,
    borderColor: t.rule,
  },
  eyebrow: {
    ...eyebrow,
    color: t.inkFaint,
  },
  eyebrowSecondary: {
    color: t.inkMuted,
  },
  divider: {
    height: hairline,
    backgroundColor: t.rule,
  },

  // Tag — a capsule, so it reads as a stamp rather than a small button.
  tag: {
    alignSelf: 'flex-start',
    borderWidth: hairline,
    borderColor: t.rule,
    borderRadius: radius.capsule,
    paddingVertical: space[1],
    paddingHorizontal: spacing.sm,
  },
  tagInk: {
    borderColor: t.ink,
  },
  tagText: {
    ...tag,
    color: t.inkMuted,
  },
  tagTextInk: {
    color: t.ink,
  },

  // Field
  field: {
    ...type.body,
    color: t.ink,
    padding: 0,
  },
  fieldFlush: {
    // §6.7: the writing surface has no radius, no border and no fill. Deliberate.
    borderRadius: 0,
  },
  fieldBoxed: {
    minHeight: CONTROL_HEIGHT,
    borderWidth: hairline,
    borderColor: t.rule,
    borderRadius: radius.md,
    backgroundColor: t.surfaceHigh,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  fieldHint: {
    ...type.caption,
    color: t.inkFaint,
    marginTop: spacing.xs,
  },

  // EmptyState
  empty: {
    paddingVertical: space[8],
    gap: spacing.sm,
  },
  emptyTitle: {
    ...type.title2,
    color: t.ink,
  },
  emptyBody: {
    ...type.callout,
    color: t.inkMuted,
  },
  emptyAction: {
    alignSelf: 'flex-start',
    marginTop: spacing.md,
  },

  // Button
  btn: {
    // minHeight, never height: at `accessibilityLarge` the label is nearly twice
    // its base size and a fixed capsule crops it. §6.5 — text reflows, it never
    // shrinks or clips.
    minHeight: CONTROL_HEIGHT,
    paddingVertical: spacing.sm,
    // §6.7 — interactive things are capsules.
    borderRadius: radius.capsule,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  btnCompact: {
    minHeight: moderateScale(44),
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  btnPrimary: {
    backgroundColor: t.ink,
    ...t.shadow.card, // the CTA lifts off the page — the one control that should
  },
  btnPrimaryPressed: {
    backgroundColor: t.inkMuted,
  },
  btnSecondary: {
    borderWidth: 1,
    borderColor: t.ink,
  },
  btnGhost: {
    backgroundColor: 'transparent',
  },
  btnQuietPressed: {
    backgroundColor: t.surfaceHigh,
  },
  btnDisabled: {
    opacity: 0.4,
  },
  btnLabel: {
    ...type.title3,
  },
  btnLabelPrimary: {
    color: t.canvas,
  },
  btnLabelQuiet: {
    color: t.ink,
  },

  // StatTile
  tile: {
    flex: 1,
    gap: spacing.xs,
  },
  tileValue: {
    ...type.dataXL,
    color: t.ink,
    fontVariant: ['tabular-nums'],
  },
  tileUnit: {
    fontSize: type.callout.fontSize,
    fontWeight: '600',
    color: t.inkMuted,
  },
  tileDelta: {
    ...type.caption,
    color: t.inkFaint,
    fontVariant: ['tabular-nums'],
  },
  deltaError: {
    color: t.danger,
  },

  // Social proof
  starRow: {
    flexDirection: 'row',
    gap: moderateScale(2),
  },
  star: {
    color: t.ink,
    letterSpacing: 1,
  },
  starEmpty: {
    color: t.inkFaint,
  },
  rating: {
    gap: spacing.xs + 1,
  },
  ratingText: {
    ...type.dataS,
    color: t.inkMuted,
  },
  testimonial: {
    backgroundColor: t.surface,
    borderWidth: 1,
    borderColor: t.rule,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  testimonialQuote: {
    ...type.callout,
    color: t.ink,
  },
  testimonialWho: {
    ...type.dataS,
    color: t.inkFaint,
  },
  badge: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: t.rule,
    borderRadius: radius.sm,
    paddingVertical: space[1],
    paddingHorizontal: spacing.sm,
  },
  badgeInk: {
    backgroundColor: t.ink,
    borderColor: t.ink,
  },
  badgeText: {
    ...tag,
    color: t.inkMuted,
  },
  badgeTextInk: {
    color: t.canvas,
  },
}));
