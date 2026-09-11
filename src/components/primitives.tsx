import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
  type AccessibilityActionEvent,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import {
  alpha,
  color,
  CONTROL_HEIGHT,
  CTA_HEIGHT,
  eyebrow,
  lineFor,
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
 * - **A reading may say what it IS.** `valueLabel` prints a quiet word over the
 *   number ("est. 1RM") for the one class of reading a person cannot name by
 *   looking at it — a derived figure, where the row's own name is the lift and
 *   not the measurement. It is `footnote`/`textSecondary`: small enough that the
 *   number keeps the hierarchy, dark enough that it is not something the eye may
 *   skip (skill: `textMuted` is for what carries nothing).
 * - **A second tap on the reading is reached twice.** `onValuePress` gives the
 *   value its own target for a finger, AND — because a `Row` with an `onPress`
 *   is one accessible element, which merges any nested button away — the same
 *   action as a VoiceOver rotor action on the row. A control a finger can reach
 *   and a screen reader cannot is not shipped (CLAUDE.md §3).
 */
export function Row({
  name,
  detail,
  value,
  valueLabel,
  unit,
  tone = 'ink',
  leading,
  trailing,
  onPress,
  onValuePress,
  valueActionLabel,
  spoken,
  style,
}: {
  name: string;
  /** A quieter second line under the name — "3 × 12", "last Tuesday". */
  detail?: string;
  /** The reading. Omit it and the row is a name and its accessories. */
  value?: string;
  /**
   * What the reading IS, printed small and quiet above it — "est. 1RM".
   *
   * Only for a reading whose meaning is not in the row's name. A logged top set
   * beside a lift's name needs none; an estimate does, or it is read as a load
   * somebody actually lifted.
   */
  valueLabel?: string;
  /** Its unit, drawn as its own smaller, lighter word. */
  unit?: string;
  tone?: RowTone;
  /** A small mark before the name — a dot, a glyph. Never a card. */
  leading?: React.ReactNode;
  /** Anything right of the reading — a chevron, a button. */
  trailing?: React.ReactNode;
  onPress?: () => void;
  /**
   * A second action, on the READING rather than on the row — today, the
   * explainer behind `valueLabel`. Reached by a finger through the value's own
   * target and by VoiceOver through a rotor action, never by a nested button.
   */
  onValuePress?: () => void;
  /** What the rotor calls `onValuePress`. Defaults to a question about the
   * label, which is the only thing the action is ever for. */
  valueActionLabel?: string;
  /** VoiceOver label, when the row knows more than its strings say. */
  spoken?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const label = spoken ?? [name, valueLabel, detail, value, unit].filter(Boolean).join(', ');
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
        <Reading
          value={value}
          label={valueLabel}
          unit={unit}
          tone={tone}
          onPress={onValuePress}
        />
      ) : null}
      {trailing}
    </>
  );

  // The rotor action exists only when there is a second action to reach, and it
  // is named after what the reading means rather than after the gesture: "What
  // is est. 1RM?" is the question the sheet answers. It rides the row whether or
  // not the row itself presses — the reading is swallowed by an `accessible`
  // container either way.
  const actions =
    onValuePress && value
      ? [{ name: VALUE_ACTION, label: valueActionLabel ?? `What is ${valueLabel ?? 'this reading'}?` }]
      : undefined;
  const onAction = actions
    ? (e: AccessibilityActionEvent) => {
        if (e.nativeEvent.actionName === VALUE_ACTION) onValuePress?.();
      }
    : undefined;

  if (!onPress) {
    return (
      <View
        style={[styles.row, style]}
        accessible
        accessibilityLabel={label}
        accessibilityActions={actions}
        onAccessibilityAction={onAction}>
        {body}
      </View>
    );
  }

  return (
    <PressableScale
      onPress={onPress}
      /**
       * A LIST ROW HIGHLIGHTS. IT DOES NOT SHRINK (10 September 2026).
       *
       * It shrank to 0.98 for a year, and a shrinking row is one of the
       * clearest tells that a list was not built by the platform: no row in any
       * app iOS ships changes size under a finger. They fill. The motion law
       * says the same thing in one line — *"a background highlight (never
       * scale) on list rows"* — and `PressableScale` has had the highlight
       * built into it, unused, the whole time (`motion.tsx`, the `wash` prop:
       * `surfaceHigh`, `radius.md`, continuous corners, opacity on the same
       * timing the dip used).
       *
       * `activeScale={1}` is how the dip is turned off rather than deleted: the
       * component computes `1 - activeScale`, so one means no movement, and the
       * press timing, the retention offset and the minimum-visible hold all
       * still run for the wash.
       */
      activeScale={1}
      wash
      washStyle={styles.rowWash}
      /**
       * AND THE ROW OWNS ITS HAPTIC. `PressableScale` ticks on press-OUT for a
       * commit, which is what opening a lift is — so a caller that also called
       * `tap()` in its own handler was firing two, on the same finger, one
       * frame apart. Both call sites were doing exactly that (Progress and the
       * lift library) and both have stopped.
       */
      haptic="light"
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityActions={actions}
      onAccessibilityAction={onAction}
      style={[styles.row, style]}>
      {body}
    </PressableScale>
  );
}

/** The rotor's name for `Row`'s second action. Internal — the caller names it
 * with `valueActionLabel`, never with this. */
const VALUE_ACTION = 'recore.value';

/**
 * The right-hand reading: an optional quiet label, the number, its unit.
 *
 * Without a label or a press it is exactly the single `Text` the row has always
 * drawn — one text node, no wrapper — so every existing caller keeps its layout
 * to the pixel. With either, the reading becomes a right-aligned block, because
 * a word ABOVE the number is the only place it can go that does not steal width
 * from the lift's name at the Dynamic Type ceiling.
 */
function Reading({
  value,
  label,
  unit,
  tone,
  onPress,
}: {
  value: string;
  label?: string;
  unit?: string;
  tone: RowTone;
  onPress?: () => void;
}) {
  const number = (
    <Text
      style={[styles.rowValue, tone !== 'ink' && ROW_INK[tone]]}
      numberOfLines={1}
      maxFontSizeMultiplier={MAX_FONT_SCALE}>
      {value}
      {unit ? <Text style={styles.rowUnit}> {unit}</Text> : null}
    </Text>
  );

  if (!label && !onPress) return number;

  const block = (
    <>
      {label ? (
        <Text style={styles.rowValueLabel} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {label}
        </Text>
      ) : null}
      {number}
    </>
  );

  if (!onPress) return <View style={styles.rowReading}>{block}</View>;

  return (
    // `accessible={false}`: an enclosing pressable `Row` is one accessible
    // element, so a nested button would be silently unreachable and only
    // fragment the row's utterance on the way. VoiceOver reaches this through
    // the row's rotor action instead. `selection` fires on press-in — this is a
    // choice being made, not a commit.
    <PressableScale
      onPress={onPress}
      haptic="selection"
      activeScale={0.94}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      hitSlop={READING_HIT_SLOP}
      style={styles.rowReading}>
      {block}
    </PressableScale>
  );
}

/** The reading block is ~44 pt tall with its label and short of it without one;
 * the slop makes the target 44 either way (CLAUDE.md §3) without widening the
 * block itself into the lift's name. */
const READING_HIT_SLOP = { top: spacing.sm, bottom: spacing.sm, left: spacing.md, right: spacing.sm };

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
  /**
   * THE PRESSED FILL, and it reaches past the words. The row carries no
   * horizontal padding — it sits flush in the body's gutter — so a wash at the
   * row's own bounds would stop against the first and last glyph and read as a
   * highlighted sentence rather than a pressed row. Eight points either side is
   * what an inset iOS list leaves, and it keeps the fill inside the gutter.
   */
  rowWash: {
    left: -spacing.sm,
    right: -spacing.sm,
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
  /** The reading as a right-aligned block, once it carries a label or a press.
   * `gap: 2` is `rowText`'s, so the two columns stack on the same rhythm. */
  rowReading: {
    alignItems: 'flex-end',
    flexShrink: 0,
    gap: 2,
  },
  /** What the reading is. Two steps under the number so size alone carries the
   * hierarchy, `textSecondary` because it carries information — the skill bars
   * `textMuted` from anything a person needs to read. */
  rowValueLabel: {
    ...type.footnote,
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
    backgroundColor: color.border,
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
    paddingHorizontal: 6,
  },
  badgeInk: {
    backgroundColor: color.accent,
    borderColor: color.accent,
  },
  /**
   * ONE CHIP SIZE, and it is the one two screens already drew (20 Aug 2026):
   * 11 pt at 700 in the reading face. Next's lever and Progression's share chip
   * were built to the same 11/700 with 6/2 padding at `radius.sm`, and the
   * wash ratios in `color.ts` were measured against an 11 pt label. This badge
   * was 9.5 — a third size for the same object — so it moved to theirs rather
   * than shrinking both of them to it.
   */
  badgeText: {
    ...readingStyle('700'),
    fontSize: moderateScale(11),
    lineHeight: lineFor(14),
    letterSpacing: 0.6,
    color: color.textSecondary,
  },
  badgeTextInk: {
    color: color.onInk,
  },
});
