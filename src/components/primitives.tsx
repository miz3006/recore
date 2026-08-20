import { ActivityIndicator, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

import {
  alpha,
  color,
  CONTROL_HEIGHT,
  CTA_HEIGHT,
  eyebrow,
  MAX_FONT_SCALE,
  moderateScale,
  radius,
  readingStyle,
  shadow,
  spacing,
  type,
} from '@/lib/theme';

import { PressableScale } from './motion';

/**
 * The shared surface + control vocabulary — one Row, one Card, one Eyebrow, one
 * Button, one Divider, one Badge, so every screen draws the same shapes instead
 * of re-rolling them inline.
 *
 * ## What v6 changed here (design skill `recore-design`, migration Phase 2)
 *
 * **`Row` is the new default and `Card` is the exception.** The record is
 * typography on the canvas — a name in ink on the left, the reading on the
 * right — with no card around it and no rule under it. A surface is what you
 * reach for when something is a CONTROL or a SHEET, not when something is a
 * fact. `Card`'s remaining sanctioned homes are listed on the component.
 *
 * **The primary button is a filled brand pill with the app's one coloured
 * shadow** (`shadow.glow`), 56 pt tall. The "ink-fill — restraint IS the brand"
 * ruling of 17 Aug 2026 is retired (skill §Decided-1).
 *
 * **`Badge` has exactly one filled variant** (`tone="wash"`), and it is the only
 * sanctioned filled chip in the app (skill §Decided-4). It pairs with its one
 * ink and the type system enforces the pairing.
 *
 * Still true: no gradients anywhere except the canvas itself, and green is
 * never chrome — `signal` belongs to planned prescription values only.
 */

/** The ink a `Row`'s reading may be set in. `ink` is the answer almost every
 * time — the four others are the record's own semantics and each is only
 * correct where its contract says so (skill §Colour). */
export type RowTone = 'ink' | 'signal' | 'gain' | 'loss' | 'attention';

/**
 * THE BARE ROW — the record's one list primitive (skill §Structure).
 *
 * **A row of the record is typography on the canvas.** No card, no fill, no
 * border, and no rule between it and the next one: the name sits left in ink,
 * the reading sits right in the reading face, and the unit is a step smaller
 * and a step lighter than the number it belongs to, because a number and its
 * unit are typographically two things rather than one string. Row height is
 * 64–72 — the air between rows is what separates them, which is why they need
 * no line.
 *
 * **Use this, not `Card`, whenever the thing on screen is a FACT.** A card is
 * for a control, a sheet or an onboarding choice. If a list of readings feels
 * like it wants a box around it, the answer is more space, not a box.
 *
 * ## Rules it carries
 *
 * - **`minHeight`, never `height`.** The row grows at the Dynamic Type ceiling
 *   instead of cropping its own name; the name may take two lines, the reading
 *   never wraps.
 * - **The reading is ink unless a contract says otherwise.** `tone` reaches the
 *   four semantic inks and nothing else: `signal` ONLY on a load not yet lifted
 *   (never "good", never "done"), `gain`/`loss` only on a RECORDED direction and
 *   red only when truly regressing, `attention` on a plateau or a backoff. All
 *   four clear AA on the canvas, so they may carry a number a person reads.
 * - **Colour is never the only carrier.** Whatever `tone` says, the words in
 *   `name` or `detail` must say it too.
 * - **One row, one utterance.** VoiceOver reads name, detail, value and unit as
 *   a single label rather than as four stops; `spoken` overrides it where the
 *   row knows something the strings do not.
 */
export function Row({
  name,
  detail,
  value,
  unit,
  tone = 'ink',
  leading,
  trailing,
  onPress,
  spoken,
  style,
}: {
  name: string;
  /** A quieter second line under the name — "3 × 12", "last Tuesday". */
  detail?: string;
  /** The reading. Omit it and the row is a name and its accessories. */
  value?: string;
  /** Its unit, drawn as its own smaller, lighter word. */
  unit?: string;
  tone?: RowTone;
  /** A small mark before the name — a dot, a glyph. Never a card. */
  leading?: React.ReactNode;
  /** Anything right of the reading — a chevron, a button. */
  trailing?: React.ReactNode;
  onPress?: () => void;
  /** VoiceOver label, when the row knows more than its strings say. */
  spoken?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const label = spoken ?? [name, detail, value, unit].filter(Boolean).join(', ');
  const body = (
    <>
      {leading}
      <View style={styles.rowText}>
        <Text style={styles.rowName} numberOfLines={2} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {name}
        </Text>
        {detail ? (
          <Text style={styles.rowDetail} numberOfLines={2} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {detail}
          </Text>
        ) : null}
      </View>
      {value ? (
        <Text
          style={[styles.rowValue, tone !== 'ink' && ROW_INK[tone]]}
          numberOfLines={1}
          maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {value}
          {unit ? <Text style={styles.rowUnit}> {unit}</Text> : null}
        </Text>
      ) : null}
      {trailing}
    </>
  );

  if (!onPress) {
    return (
      <View style={[styles.row, style]} accessible accessibilityLabel={label}>
        {body}
      </View>
    );
  }
  return (
    <PressableScale
      onPress={onPress}
      activeScale={0.98}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[styles.row, style]}>
      {body}
    </PressableScale>
  );
}

/**
 * A white surface with a lift. **This is the EXCEPTION, not the default** (skill
 * §Structure): the record draws as `Row` on the canvas, and a card has to be
 * justified against bare rows before it is reached for.
 *
 * Its sanctioned homes are bottom sheets and their inner sections, onboarding
 * option rows and value cards, and the thought-process card. Anywhere else it
 * is a surface pretending a fact is a control.
 */
export function Card({
  children,
  style,
  elevation = 'flat',
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** `flat` = hairline only; `card` = a gentle lift; `raised` = the sheet cast.
   * On the canvas a surface with neither border nor shadow is invisible (a white
   * pill is 1.05:1 by tone), so every level here carries one or the other. */
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
 * The one button.
 *
 * **Primary is a filled brand pill, 56 pt tall, sitting in its own light**
 * (`shadow.glow` — brand at 28 %, the only coloured shadow in the app and this
 * control's alone). The "ink-fill primary — restraint IS the brand" ruling of
 * 17 Aug 2026 is retired: skill §Decided-1 settles it, and §Decided-3 makes 56
 * the height of every primary button app-wide rather than the onboarding
 * funnel's private number.
 *
 * **Secondary is the same blue at 12 %** with a brand label — Apple's
 * second-rank button, so the pair reads as one family. Measured: the label is
 * **4.98:1** on the wash over white and **4.75:1** over the canvas, both past
 * AA for a 17 pt/600 label, which `#007AFF` could not have carried.
 *
 * **Ghost is the quiet one**: no fill, ink label, and it is the only variant
 * that may sit next to a primary without competing. Secondary and ghost stay at
 * `CONTROL_HEIGHT` 50; `compact` is 44 for a sheet action or a row.
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
        variant === 'primary' && [styles.btnPrimary, shadow.glow],
        variant === 'secondary' && styles.btnSecondary,
        variant === 'ghost' && styles.btnGhost,
        // After the variants on purpose: a compact button is 44 whatever it is.
        compact && styles.btnCompact,
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

/** The four wash/ink pairs. A wash pairs with EXACTLY one ink and nothing else,
 * which is why the pair is named once rather than passed as two colours. */
export type BadgeWash = 'signal' | 'attention' | 'gain' | 'loss';

const BADGE_WASH: Record<BadgeWash, { fill: string; ink: string }> = {
  signal: { fill: color.signalWash, ink: color.signal },
  attention: { fill: color.attentionWash, ink: color.attention },
  gain: { fill: color.gainWash, ink: color.gain },
  loss: { fill: color.lossWash, ink: color.loss },
};

/**
 * A small chip — "BEST VALUE", "SAVE 16%", "PLANNED", "UP 12%".
 *
 * `ink` is the filled black outline, `quiet` the bordered grey one, and
 * **`wash` is the app's ONE sanctioned filled colour chip** (skill §Decided-4).
 * Ad-hoc filled chips stay banned: a screen that wants a coloured label reaches
 * for this or for nothing.
 *
 * The wash carries its ink and no other — the union below makes an unpaired
 * combination a type error rather than a review comment. All four pairs are
 * measured past AA for an 11 pt label (`signal` 4.59, `attention` 4.64,
 * `gain`/`loss` 4.69), and because the fills are opaque the canvas under them
 * does not change that.
 *
 * **The chip is never the only carrier.** A `gain` badge saying "UP 12%" is
 * fine; a green chip with no word in it is not.
 */
export function Badge(
  props:
    | { label: string; tone?: 'ink' | 'quiet' }
    | { label: string; tone: 'wash'; wash: BadgeWash },
) {
  const { label, tone = 'ink' } = props;
  const pair = tone === 'wash' ? BADGE_WASH[(props as { wash: BadgeWash }).wash] : null;
  return (
    <View
      style={[
        styles.badge,
        tone === 'ink' && styles.badgeInk,
        pair ? { backgroundColor: pair.fill, borderColor: pair.fill } : null,
      ]}>
      <Text
        style={[
          styles.badgeText,
          tone === 'ink' && styles.badgeTextInk,
          pair ? { color: pair.ink } : null,
        ]}
        maxFontSizeMultiplier={MAX_FONT_SCALE}>
        {label}
      </Text>
    </View>
  );
}

/** The four semantic inks a reading may take. Ink is the fifth and the default,
 * so it is not in the map. */
const ROW_INK = StyleSheet.create({
  signal: { color: color.signal },
  gain: { color: color.gain },
  loss: { color: color.loss },
  attention: { color: color.attention },
});

const styles = StyleSheet.create({
  // Row — no fill, no border, no rule. The air IS the separator.
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    minHeight: moderateScale(68),
    paddingVertical: spacing.md,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowName: {
    ...type.body,
    color: color.textPrimary,
  },
  rowDetail: {
    ...type.caption,
    color: color.textSecondary,
  },
  /** The reading: the record's own face, and it never wraps. */
  rowValue: {
    ...readingStyle('600'),
    fontSize: type.body.fontSize,
    lineHeight: type.body.lineHeight,
    color: color.textPrimary,
    flexShrink: 0,
  },
  /** A step smaller and a step lighter — the unit is not part of the number. */
  rowUnit: {
    ...readingStyle('400'),
    fontSize: type.subhead.fontSize,
    color: color.textSecondary,
  },

  card: {
    backgroundColor: color.surface,
    borderRadius: radius.xl,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: color.border,
    padding: spacing.lg,
  },
  cardLift: {
    borderColor: color.divider, // the shadow carries the edge — soften the rule
  },
  cardRaised: {
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
    // A filled brand pill at the app-wide primary height, wearing the one
    // coloured shadow in the app (`shadow.glow`, spread at the call site so it
    // cannot be inherited by a variant that has not earned it).
    backgroundColor: color.brand,
    minHeight: CTA_HEIGHT,
  },
  btnPrimaryPressed: {
    // A darker blue, never an opacity flash — an opacity dip would take the
    // glow down with the fill and read as the button switching off.
    backgroundColor: color.brandPressed,
  },
  btnSecondary: {
    // The tinted companion: brand label on a brand wash, Apple's second-rank
    // button. It follows the primary so the pair reads as one family.
    backgroundColor: alpha(color.brand, 0.12),
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
    color: color.brand,
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
    ...readingStyle('700'),
    fontSize: moderateScale(9.5),
    letterSpacing: 1,
    color: color.textSecondary,
  },
  badgeTextInk: {
    color: color.onInk,
  },
});
