import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { BottomSheet } from '@/components/bottom-sheet';
import { PressableScale } from '@/components/motion';
import { explain, type Group, type GroupKey } from '@/lib/next/groups';
import { reasonLine, type ReasonTone, type SessionRow } from '@/lib/next/sections';
import { fmtNumber } from '@/lib/parse/summarize';
import {
  color,
  lineFor,
  MAX_FONT_SCALE,
  moderateScale,
  radius,
  readingStyle,
  spacing,
  type,
} from '@/lib/theme';

/**
 * WHAT CHANGED SINCE LAST TIME — the session's decisions, counted and tappable
 * (owner, 29 August 2026).
 *
 * Tiimo's planner groups a day into tinted counted pills and the strip tells
 * you the shape of the day before you have read one item in it. Next groups by
 * something better than time: the athlete already knows which lifts are in
 * their push day; what they do not know is **which of them moved.**
 *
 *     GOING UP · 3    HOLDING · 1    BACKING OFF · 1
 *
 * ## Every pill opens its own reason
 *
 * The owner's ask, and the natural completion of this screen's thesis: the row
 * says *what* changed, the pill says *what rule changed it.* Tapping one opens
 * a sheet with the engine's rule in plain language and the lifts it applies to,
 * each with the reason it already carries.
 *
 * The copy is fixed text about the ENGINE (`lib/next/groups.ts`) — what the
 * code does, never a claim about the athlete or their body. No model touches
 * it, so there is nothing here for a guard to validate (§9), and it is the same
 * sentence every time, which is what makes it a rule rather than an opinion.
 *
 * ## It counts, it does not sort
 *
 * The cards below stay in the session's own order. Grouping them under these
 * headings would put progressions before plateaus, and the order somebody
 * trains in is a training opinion the app does not hold (§20).
 */

const TONE: Record<GroupKey, { pill: object; text: object }> = {
  up: {
    pill: { backgroundColor: color.signalWash },
    text: { color: color.signal },
  },
  hold: {
    pill: { backgroundColor: color.attentionWash },
    text: { color: color.attention },
  },
  backoff: {
    pill: { backgroundColor: color.attentionWash },
    text: { color: color.attention },
  },
  // No hue: "no history yet" is not a state of the lift, it is a state of the
  // record. Amber would read as a warning about training that never happened.
  new: {
    pill: { backgroundColor: color.surface, borderWidth: 1, borderColor: color.border },
    text: { color: color.textSecondary },
  },
};

export function GroupPills({
  groups,
  onOpen,
}: {
  groups: Group[];
  onOpen: (key: GroupKey) => void;
}) {
  if (groups.length === 0) return null;
  return (
    <View style={styles.strip}>
      {groups.map((group) => (
        <PressableScale
          key={group.key}
          haptic="none"
          activeScale={0.96}
          onPress={() => onOpen(group.key)}
          accessibilityRole="button"
          accessibilityLabel={`${group.label}, ${group.rows.length} ${
            group.rows.length === 1 ? 'lift' : 'lifts'
          }`}
          accessibilityHint="Explains why"
          // The pill is 30 pt because that is the shape; the TARGET is 44 pt,
          // which is not negotiable (CLAUDE.md §3). `hitSlop` is how a small
          // control keeps a full-size target without growing.
          hitSlop={{ top: spacing.sm, bottom: spacing.sm, left: 0, right: 0 }}
          style={[styles.pill, TONE[group.key].pill]}>
          <Text
            style={[styles.pillLabel, TONE[group.key].text]}
            numberOfLines={1}
            maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {`${group.label.toUpperCase()} · ${group.rows.length}`}
          </Text>
        </PressableScale>
      ))}
    </View>
  );
}

/**
 * The rule behind one group, and the lifts it applies to.
 *
 * The list is not a second copy of the screen: it is the same reason line each
 * card already shows, gathered so the rule and its instances can be read
 * against each other. Somebody who disagrees with the rule can see exactly
 * which numbers it produced.
 */
export function GroupSheet({
  group,
  onClose,
}: {
  group: Group | null;
  onClose: () => void;
}) {
  const copy = group ? explain(group.key, group.rows.length) : null;

  return (
    <BottomSheet visible={group != null} onClose={onClose} sheetStyle={styles.sheet}>
      {group && copy ? (
        <>
          <Text
            style={[styles.eyebrow, TONE[group.key].text]}
            maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {group.label.toUpperCase()}
          </Text>
          <Text style={styles.sheetTitle} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {copy.title}
          </Text>
          <Text style={styles.sheetBody} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {copy.body}
          </Text>

          <View style={styles.rule} />

          <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
            {group.rows.map((row) => (
              <SheetRow key={row.key || row.name} row={row} />
            ))}
          </ScrollView>
        </>
      ) : null}
    </BottomSheet>
  );
}

/** One lift inside the sheet: its name and target, and the reason it carries on
 * the card — never a second, differently-worded explanation of the same fact. */
function SheetRow({ row }: { row: SessionRow }) {
  const reason = reasonLine(row);
  return (
    <View style={styles.sheetRow} accessible>
      <View style={styles.sheetRowLeft}>
        <Text style={styles.sheetName} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {row.name}
        </Text>
        {reason ? (
          <Text style={styles.sheetReason} numberOfLines={2} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {reason.map((seg, i) => (
              <Text key={i} style={REASON_TONE[seg.tone]}>
                {seg.text}
              </Text>
            ))}
          </Text>
        ) : null}
      </View>
      {row.loadKg != null ? (
        <Text style={styles.sheetTarget} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {fmtNumber(row.loadKg)}
          <Text style={styles.sheetUnit}> kg</Text>
        </Text>
      ) : (
        <Text style={[styles.sheetTarget, styles.sheetNone]} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          —
        </Text>
      )}
    </View>
  );
}

const REASON_TONE: Record<ReasonTone, { color: string; fontWeight?: '600' }> = {
  plain: { color: color.textSecondary },
  planned: { color: color.signal, fontWeight: '600' },
  watch: { color: color.attention, fontWeight: '600' },
};

const styles = StyleSheet.create({
  /** Wraps, never scrolls — content behind a horizontal gesture on a page read
   * by scrolling down is content most people never find. */
  strip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  pill: {
    minHeight: moderateScale(30),
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderCurve: 'continuous',
  },
  pillLabel: {
    ...readingStyle('700'),
    fontSize: moderateScale(10.5),
    letterSpacing: 1.2,
  },

  sheet: {
    paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.xl,
    maxHeight: '80%',
  },
  eyebrow: {
    ...readingStyle('700'),
    fontSize: moderateScale(10.5),
    letterSpacing: 1.4,
    marginBottom: spacing.xs,
  },
  sheetTitle: {
    ...type.title2,
    fontWeight: '700',
    color: color.textPrimary,
  },
  sheetBody: {
    ...type.subhead,
    lineHeight: lineFor(21),
    marginTop: spacing.sm,
    color: color.textSecondary,
  },
  rule: {
    height: 1,
    backgroundColor: color.border,
    marginVertical: spacing.lg,
  },
  list: {
    flexGrow: 0,
  },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    minHeight: moderateScale(56),
  },
  sheetRowLeft: {
    flexShrink: 1,
    flexGrow: 1,
    gap: 2,
  },
  sheetName: {
    ...type.subhead,
    fontWeight: '600',
    color: color.textPrimary,
  },
  sheetReason: {
    ...readingStyle('400'),
    fontSize: moderateScale(12),
    color: color.textSecondary,
  },
  sheetTarget: {
    ...readingStyle('700'),
    fontSize: moderateScale(18),
    letterSpacing: -0.3,
    color: color.signal,
    flexShrink: 0,
  },
  sheetUnit: {
    fontSize: type.caption.fontSize,
    fontWeight: '400',
  },
  sheetNone: {
    color: color.textMuted,
  },
});
