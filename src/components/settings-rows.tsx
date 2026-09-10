import { useEffect, useRef, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { selection } from '@/lib/haptics';
import { PRESS, SPRING } from '@/lib/motion';
import {
  alpha,
  color,
  hairline,
  ink,
  lineFor,
  MAX_FONT_SCALE,
  moderateScale,
  radius,
  readingStyle,
  shadow,
  spacing,
  type,
} from '@/lib/theme';

import { Icon, type IconName } from './icon';
import { PressableScale } from './motion';
import { Eyebrow } from './primitives';

/**
 * The settings vocabulary — grouped rounded cards, a small-caps section label
 * above each, rows with a leading glyph and a trailing chevron, destructive
 * work alone at the bottom. It is the shape every iOS settings screen worth
 * copying uses, and Recore's own skin: warm paper, one hairline between rows,
 * no coloured icon tiles.
 *
 * EXTRACTED FROM `you.tsx` ON 12 AUGUST 2026, unchanged in behaviour. It was
 * private to that file, so the moment a second settings surface existed
 * (learned shorthands, the integrations stub) the choice was to duplicate a
 * hundred lines of chrome or to share it. Every settings-shaped screen imports
 * from here now, which is what keeps them looking like one app.
 */

/**
 * A settings glyph's colour — INK AT 60%, monochrome, one per row (owner,
 * 12 Aug 2026).
 *
 * This overrides the per-glyph hues `icon.tsx` still hands out (`glyphTint`,
 * owner 28 July) for THIS surface only. A settings list is scanned by label;
 * eleven different hues down the left edge read as eleven categories that do
 * not exist, and the two colours that carry meaning here — red for
 * destructive, amber for heavy-but-reversible — cannot be seen against them.
 * At 60% the glyph is present without competing with the word beside it.
 * Elsewhere (You's old rows, the ⋯ sheet) `glyphTint` is untouched.
 */
const GLYPH_OPACITY = 0.6;

function rowGlyphTint({ danger, warn }: { danger?: boolean; warn?: boolean }): string {
  if (danger) return color.error;
  if (warn) return color.warning;
  return alpha(color.textPrimary, GLYPH_OPACITY);
}

/** The leading glyph column, and the inset a separator starts at. */
export const ROW_ICON = moderateScale(19);
const ROW_ICON_SLOT = ROW_ICON + spacing.md;

/**
 * THE GROUP'S HORIZONTAL INSET — owned by the ROW, not by the card.
 *
 * It sat on the card until 9 September 2026, which was fine while a press was a
 * scale. It is not fine now that a press is a fill: a highlight that stops 18 pt
 * short of the group's own edge is a grey stripe floating inside a white card,
 * and no list on the phone draws that. UIKit fills the whole cell. So the row
 * takes the inset, paints edge to edge, and the card clips it at the corners.
 */
const ROW_PAD = spacing.lg;

/**
 * A ROW'S PRESS FEEDBACK IS A HIGHLIGHT, NOT A DIP (9 September 2026).
 *
 * Every row here used `PressableScale`, which shrinks the pressed element by
 * 2–3%. That is the right feedback for a button, a chip or a card — an object
 * with its own edges, which you can watch move. **A list row has no edges of
 * its own**: it is one band in a stack of identical bands, so shrinking it
 * pulls its neighbours' baselines toward it and the whole group appears to flex
 * under the thumb. iOS has never done this to a table cell in eighteen years;
 * it fills the cell with a grey and fades it out on release, and that is what a
 * hand expects from a settings list before the eye has read a word of it.
 *
 * The highlight is `opacity` on a fill layer — no layout property animates —
 * and it keeps `PressableScale`'s own timing contract exactly: `PRESS.in` down,
 * `PRESS.minVisibleMs` held so a tap too fast to see still flashes, `PRESS.out`
 * back. Reduce Motion removes the FADE, never the feedback: the fill still
 * appears and disappears, it simply does not travel.
 */
function RowSurface({
  children,
  onPress,
  disabled = false,
  accessibilityLabel,
  accessibilityState,
  style,
}: {
  children: ReactNode;
  onPress: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  accessibilityState?: { expanded?: boolean; selected?: boolean };
  style?: StyleProp<ViewStyle>;
}) {
  const reduce = useReducedMotion();
  const p = useSharedValue(0);
  const downAt = useRef(0);
  const fill = useAnimatedStyle(() => ({ opacity: p.get() }));

  return (
    <Pressable
      disabled={disabled}
      onPressIn={() => {
        downAt.current = Date.now();
        p.set(reduce ? 1 : withTiming(1, PRESS.in));
      }}
      onPressOut={() => {
        const wait = Math.max(0, PRESS.minVisibleMs - (Date.now() - downAt.current));
        p.set(withDelay(wait, withTiming(0, reduce ? { duration: 0 } : PRESS.out)));
      }}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled, ...accessibilityState }}
      style={[style, disabled && styles.rowDisabled]}>
      <Animated.View style={[styles.rowHighlight, fill]} pointerEvents="none" />
      {children}
    </Pressable>
  );
}
export function Section({
  label,
  footnote,
  footnoteActive = false,
  children,
}: {
  label?: string;
  footnote?: string;
  /** The footnote is carrying a live result ("Imported 12 days"), not chrome. */
  footnoteActive?: boolean;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      {label ? (
        <Eyebrow tone="secondary" style={styles.sectionLabel}>
          {label}
        </Eyebrow>
      ) : null}
      {/* Two shells, one card. The outer casts the shadow; the inner clips.
          They cannot be one view: `overflow: 'hidden'` sets `masksToBounds` on
          the layer, which cuts the shadow off at the same edge it cuts the
          pressed row's fill — and both have to survive. */}
      <View style={styles.card}>
        <View style={styles.cardClip}>{children}</View>
      </View>
      {footnote ? (
        <Text
          style={[styles.footnote, footnoteActive && styles.footnoteActive]}
          maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {footnote}
        </Text>
      ) : null}
    </View>
  );
}

export function Row({
  icon,
  label,
  sub,
  value,
  reading = false,
  labelBold = false,
  danger = false,
  warn = false,
  chevron = true,
  external = false,
  divider = false,
  disabled = false,
  accessibilityLabel,
  onPress,
}: {
  icon?: IconName;
  label: string;
  sub?: string;
  value?: string;
  /** The value is a number the app will act on (a rest length, a bar weight, an
   * hour), not a word — set it in the reading face so it lines up with every
   * other reading on the screen. Same prop, same meaning as `AccordionRow`'s. */
  reading?: boolean;
  labelBold?: boolean;
  /** Destructive — the label goes red and the glyph loses its tint. */
  danger?: boolean;
  /** Reversible but heavy (clearing a cache) — amber, one step below danger. */
  warn?: boolean;
  chevron?: boolean;
  external?: boolean;
  divider?: boolean;
  disabled?: boolean;
  accessibilityLabel?: string;
  onPress?: () => void;
}) {
  const body = (
    <>
      {icon ? (
        <View style={styles.rowIcon}>
          <Icon name={icon} size={ROW_ICON} tint={rowGlyphTint({ danger, warn })} />
        </View>
      ) : null}
      <View style={styles.rowLeft}>
        <Text
          style={[
            styles.rowLabel,
            labelBold && styles.rowLabelBold,
            warn && styles.rowLabelWarn,
            danger && styles.rowLabelDanger,
          ]}
          // Two lines, because the label grew to 17 pt and "What gets in the
          // way" stopped fitting on one — and because Dynamic Type can make
          // almost any of them the long one. iOS wraps a cell's label before it
          // truncates it, for the same reason: the label is what the row IS.
          numberOfLines={2}
          maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {label}
        </Text>
        {sub ? (
          <Text style={styles.rowSub} numberOfLines={2} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {sub}
          </Text>
        ) : null}
      </View>
      <View style={styles.rowRight}>
        {value != null ? (
          <Text
            style={reading ? styles.rowReading : styles.rowValue}
            numberOfLines={1}
            maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {value}
          </Text>
        ) : null}
        {external ? (
          <Text style={styles.external} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            ↗
          </Text>
        ) : null}
        {chevron ? (
          <Icon name="chevron-forward" size={moderateScale(14)} tint={color.textMuted} />
        ) : null}
      </View>
    </>
  );

  const row = !onPress ? (
    <View style={styles.row}>{body}</View>
  ) : (
    <RowSurface
      disabled={disabled}
      onPress={onPress}
      accessibilityLabel={accessibilityLabel ?? label}
      style={styles.row}>
      {body}
    </RowSurface>
  );

  // The separator is a sibling, not a border on the row, so it can start at the
  // LABEL rather than under the glyph (Mobbin — Granola). A border cannot be
  // inset; this can, and the inset is what keeps the icons reading as one column.
  if (!divider) return row;
  return (
    <>
      <View style={styles.rowSep} />
      {row}
    </>
  );
}

/**
 * A READING on a settings row — a number the record produced (a total, a
 * count, a rest length), set in the reading face with tabular figures like
 * every other number in the app. Prose values stay in `value`.
 */
export function RowReading({ children }: { children: string }) {
  return (
    <Text style={styles.rowReading} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
      {children}
    </Text>
  );
}

/** A value row (label · current value · chevron) that expands inline to reveal
 * its segmented editor — the calm "settings" read, with the control on demand. */
export function AccordionRow({
  icon,
  label,
  value,
  open,
  onToggle,
  divider = false,
  reading = false,
  children,
}: {
  icon?: IconName;
  label: string;
  value: string;
  open: boolean;
  onToggle: () => void;
  divider?: boolean;
  /** The value is a number from the record, not a word — set it in the
   * reading face so it lines up with every other reading on the screen. */
  reading?: boolean;
  children: React.ReactNode;
}) {
  return (
    <>
      {divider ? <View style={styles.rowSep} /> : null}
      <RowSurface
        onPress={onToggle}
        accessibilityLabel={label}
        accessibilityState={{ expanded: open }}
        style={styles.row}>
        {icon ? (
          <View style={styles.rowIcon}>
            <Icon name={icon} size={ROW_ICON} tint={rowGlyphTint({})} />
          </View>
        ) : null}
        <View style={styles.rowLeft}>
          <Text style={styles.rowLabel} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {label}
          </Text>
        </View>
        <View style={styles.rowRight}>
          <Text
            style={[
              styles.rowValue,
              reading && styles.rowReading,
              open && styles.rowValueOpen,
            ]}
            numberOfLines={1}
            maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {value}
          </Text>
          <Chevron open={open} />
        </View>
      </RowSurface>
      {open ? <View style={styles.editor}>{children}</View> : null}
    </>
  );
}

/** The accordion's disclosure chevron — springs 0°→180° on open (reduceMotion-safe).
 * The row height still animates via LayoutAnimation; this just spins the caret. */
export function Chevron({ open }: { open: boolean }) {
  const reduce = useReducedMotion();
  const t = useSharedValue(open ? 1 : 0);
  useEffect(() => {
    t.value = reduce ? (open ? 1 : 0) : withSpring(open ? 1 : 0, SPRING.snappy);
  }, [open, reduce, t]);
  const spin = useAnimatedStyle(() => ({ transform: [{ rotate: `${t.value * 180}deg` }] }));
  return (
    <Animated.View style={spin}>
      <Icon name="chevron-down" size={moderateScale(14)} tint={color.textMuted} />
    </Animated.View>
  );
}

/** The inline segmented editor revealed by an AccordionRow. */
export function Segmented<T extends string | number>({
  options,
  selected,
  onSelect,
  reading = false,
  labelFor,
}: {
  options: { id: T; label: string }[];
  selected: T | null;
  onSelect: (id: T) => void;
  /** The options are numbers (plate sizes, rest lengths, hours). */
  reading?: boolean;
  /**
   * What VoiceOver says for a segment, when the printed label is not enough on
   * its own. A settings control lives under a row that has already named the
   * thing, so the label IS enough there and this stays unset. The check-in
   * sheet stacks one of these per lift with nothing between them, so a segment
   * has to say WHICH lift it belongs to and what the answer means — the rotor
   * arrives at "Just right" with no idea it is about the bench press.
   */
  labelFor?: (id: T) => string;
}) {
  return (
    <View style={styles.segments}>
      {options.map((o) => {
        const isSelected = selected === o.id;
        return (
          <PressableScale
            key={String(o.id)}
            onPress={() => {
              selection();
              onSelect(o.id);
            }}
            haptic="none"
            activeScale={0.94}
            accessibilityRole="button"
            accessibilityLabel={labelFor ? labelFor(o.id) : o.label}
            accessibilityState={{ selected: isSelected }}
            style={[styles.segment, isSelected && styles.segmentSelected]}>
            <Text
              style={[
                styles.segmentLabel,
                reading && styles.segmentReading,
                isSelected && styles.segmentLabelSelected,
              ]}
              numberOfLines={1}
              // A SEGMENT SHRINKS ITS LABEL RATHER THAN CUTTING IT (9 September
              // 2026). Three segments split one row, so the longest label sets
              // what fits — and at a larger text size "Could do more" on the
              // check-in sheet came out "Could do…", which is not an answer
              // anybody can pick between. Truncating the words is the one
              // failure a control offering a choice cannot afford; a label
              // 15% smaller is legible and still says the whole thing.
              adjustsFontSizeToFit
              minimumFontScale={0.85}
              maxFontSizeMultiplier={MAX_FONT_SCALE}>
              {o.label}
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

/**
 * ONE GUTTER (28 August 2026, from Numify's Profile Settings — `6474290049/
 * oth_9q00o`).
 *
 * The label and the footnote each carried a `spacing.xs` nudge that the card did
 * not, so a settings page had two left edges four points apart — small enough to
 * read as a rendering artefact, large enough to see. The reference has one edge
 * and hangs the card, its rows' text and everything between off it. So do we
 * now: **nothing in this file adds to the page's own horizontal padding.**
 *
 * ONE GROUP RHYTHM. `section` used to leave 16 pt, which meant a group WITH a
 * footnote sat 24 pt from the next label and a group without one sat 16 — the
 * distance between two groups depended on whether the first had something to
 * say. The footnote is part of its group, so the trailing gap belongs to the
 * section and is one number.
 */
const styles = StyleSheet.create({
  section: {
    marginBottom: spacing.xxl,
  },
  sectionLabel: {
    marginBottom: spacing.sm,
  },
  card: {
    backgroundColor: color.surface,
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    ...shadow.card,
  },
  cardClip: {
    borderWidth: 1,
    borderColor: color.divider,
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  // The group's vertical padding is gone with the card's: a pressed FIRST row
  // has to reach the group's own top edge, and 4 pt of white above the fill is
  // exactly the tell that a list was drawn rather than laid out. The rows' own
  // padding is what keeps the first label off the corner.
  row: {
    minHeight: moderateScale(44),
    paddingVertical: spacing.md - 1,
    paddingHorizontal: ROW_PAD,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  /** The pressed fill — the app's recessed tone, the one `surfaceHigh` names. */
  rowHighlight: {
    // Spelled out rather than `StyleSheet.absoluteFillObject`, which this RN
    // version does not carry on the type (only `absoluteFill`, whose type is a
    // registered style ID and cannot be spread into an object literal).
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: color.surfaceHigh,
  },
  /** A row the screen has taken away (an import already running, a delete in
   * flight). It says so rather than silently swallowing the tap. */
  rowDisabled: {
    opacity: ink.disabled,
  },
  rowIcon: {
    width: ROW_ICON,
    alignItems: 'center',
  },
  // It starts at the LABEL and runs to the group's trailing edge, which is
  // where UIKit puts a separator in a cell that has an image view.
  rowSep: {
    height: hairline,
    marginLeft: ROW_PAD + ROW_ICON_SLOT,
    backgroundColor: color.border,
  },
  rowLeft: {
    flex: 1,
  },
  // 17 pt, not 15. Every grouped list on the phone — Settings, Mail, Health,
  // the share sheet — sets its row label at body size, and a 15 pt list beside
  // them reads as a web page in a wrapper before it reads as anything else.
  rowLabel: {
    ...type.body,
    color: color.textPrimary,
  },
  rowLabelBold: {
    fontWeight: '600',
  },
  rowLabelDanger: {
    color: color.error,
  },
  rowLabelWarn: {
    color: color.warning,
  },
  // A sub carries INFORMATION — what a row will do, what it will not touch —
  // so it is `textSecondary`. `textMuted` is for what the eye may skip.
  rowSub: {
    ...type.caption,
    lineHeight: lineFor(16),
    color: color.textSecondary,
    marginTop: 1,
  },
  rowRight: {
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
  // The value sits at the label's size, as it does in Settings — a detail text
  // one step smaller reads as a caption about the row rather than as its answer.
  rowValue: {
    flexShrink: 1,
    ...type.body,
    color: color.textSecondary,
    textAlign: 'right',
  },
  rowReading: {
    flexShrink: 1,
    ...readingStyle('400'),
    fontSize: type.body.fontSize,
    color: color.textSecondary,
    textAlign: 'right',
  },
  rowValueOpen: {
    color: color.textPrimary,
    fontWeight: '600',
  },
  external: {
    ...readingStyle('400'),
    fontSize: moderateScale(14),
    color: color.textMuted,
  },
  editor: {
    paddingBottom: spacing.md,
  },
  segments: {
    flexDirection: 'row',
    backgroundColor: color.surfaceHigh,
    borderRadius: radius.sm,
    borderCurve: 'continuous',
    padding: moderateScale(3),
    gap: moderateScale(3),
  },
  segment: {
    flex: 1,
    paddingVertical: moderateScale(8),
    borderRadius: radius.sm - 3,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: hairline,
    borderColor: 'transparent',
  },
  segmentSelected: {
    backgroundColor: color.surface,
    borderColor: color.border,
  },
  segmentLabel: {
    ...type.caption,
    fontWeight: '600',
    color: color.textSecondary,
  },
  segmentReading: {
    ...readingStyle('400'),
    letterSpacing: 0.2,
  },
  segmentLabelSelected: {
    color: color.textPrimary,
  },
  footnote: {
    ...type.footnote,
    lineHeight: lineFor(16),
    color: color.textMuted,
    marginTop: spacing.sm,
  },
  footnoteActive: {
    color: color.textSecondary,
  },
});
