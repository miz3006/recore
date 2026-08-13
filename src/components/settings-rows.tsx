import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { SPRING } from '@/lib/motion';
import {
  alpha,
  color,
  fonts,
  hairline,
  lineFor,
  MAX_FONT_SCALE,
  moderateScale,
  radius,
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
/** How far a pressed row's highlight bleeds past the card's own padding. */
const PRESS_BLEED = spacing.sm;

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
      <View style={styles.card}>{children}</View>
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
          numberOfLines={1}
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
          <Text style={styles.rowValue} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
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
    <PressableScale
      disabled={disabled}
      onPress={onPress}
      haptic="none"
      activeScale={0.99}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      style={styles.row}
      pressedStyle={styles.rowPressed}>
      {body}
    </PressableScale>
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
      <PressableScale
        onPress={onToggle}
        haptic="none"
        activeScale={0.99}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ expanded: open }}
        style={styles.row}
        pressedStyle={styles.rowPressed}>
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
      </PressableScale>
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
}: {
  options: { id: T; label: string }[];
  selected: T | null;
  onSelect: (id: T) => void;
  /** The options are numbers (plate sizes, rest lengths, hours). */
  reading?: boolean;
}) {
  return (
    <View style={styles.segments}>
      {options.map((o) => {
        const isSelected = selected === o.id;
        return (
          <PressableScale
            key={String(o.id)}
            onPress={() => onSelect(o.id)}
            haptic="none"
            activeScale={0.94}
            accessibilityRole="button"
            accessibilityLabel={o.label}
            accessibilityState={{ selected: isSelected }}
            style={[styles.segment, isSelected && styles.segmentSelected]}>
            <Text
              style={[
                styles.segmentLabel,
                reading && styles.segmentReading,
                isSelected && styles.segmentLabelSelected,
              ]}
              numberOfLines={1}
              maxFontSizeMultiplier={MAX_FONT_SCALE}>
              {o.label}
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: spacing.lg,
  },
  sectionLabel: {
    marginBottom: spacing.sm - 1,
    marginLeft: spacing.xs,
  },
  card: {
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.divider,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg + 2,
    // A hair of vertical padding so the first and last row's pressed highlight
    // (PRESS_BLEED) stays inside the card's own rounded corner instead of
    // poking a square grey nub past it.
    paddingVertical: spacing.xs,
    ...shadow.card,
  },
  row: {
    minHeight: moderateScale(48),
    paddingVertical: spacing.md + 1,
    marginHorizontal: -PRESS_BLEED,
    paddingHorizontal: PRESS_BLEED,
    borderRadius: radius.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  rowIcon: {
    width: ROW_ICON,
    alignItems: 'center',
  },
  rowSep: {
    height: hairline,
    marginLeft: ROW_ICON_SLOT,
    backgroundColor: color.divider,
  },
  rowPressed: {
    backgroundColor: color.surfaceHigh,
  },
  rowLeft: {
    flex: 1,
  },
  rowLabel: {
    ...type.subhead,
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
  rowSub: {
    ...type.caption,
    lineHeight: lineFor(16),
    color: color.textMuted,
    marginTop: 2,
  },
  rowRight: {
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
  rowValue: {
    flexShrink: 1,
    ...type.subhead,
    color: color.textSecondary,
    textAlign: 'right',
  },
  rowReading: {
    flexShrink: 1,
    fontFamily: fonts.reading,
    fontSize: type.subhead.fontSize,
    fontVariant: ['tabular-nums'],
    color: color.textSecondary,
    textAlign: 'right',
  },
  rowValueOpen: {
    color: color.textPrimary,
    fontWeight: '600',
  },
  external: {
    fontFamily: fonts.reading,
    fontVariant: ['tabular-nums'],
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
    padding: moderateScale(3),
    gap: moderateScale(3),
  },
  segment: {
    flex: 1,
    paddingVertical: moderateScale(8),
    borderRadius: radius.sm - 3,
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
    fontFamily: fonts.reading,
    letterSpacing: 0.2,
    fontVariant: ['tabular-nums'],
  },
  segmentLabelSelected: {
    color: color.textPrimary,
  },
  footnote: {
    ...type.footnote,
    lineHeight: lineFor(16),
    color: color.textMuted,
    marginTop: spacing.sm,
    marginHorizontal: spacing.xs,
  },
  footnoteActive: {
    color: color.textSecondary,
  },
});
