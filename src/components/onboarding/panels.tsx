import { StyleSheet, Text, View } from 'react-native';

import { Eyebrow } from '@/components/primitives';
import {
  color,
  hairline,
  MAX_FONT_SCALE,
  moderateScale,
  shadow,
  spacing,
  type,
} from '@/lib/theme';

import { BLUE, BLUE_CARD, CARD_RADIUS, INK_CARD } from './tokens';

/**
 * The v3 flow's flat panels — the pieces of the design that are pictures made
 * of type rather than controls (18 Aug 2026). They live together because each
 * one is a handful of Text in a rounded rect, and a file apiece would be five
 * files of imports.
 *
 * None of them takes an animation: their entrance is the screen's own stagger,
 * applied by the renderer.
 */

/** The small caps label over a control or a card ("YOUR NAME"). */
export function SectionLabel({ children }: { children: string }) {
  return (
    <View style={styles.sectionLabel}>
      <Eyebrow tone="muted">{children}</Eyebrow>
    </View>
  );
}

/** The quiet closing line under a content band. */
export function Footnote({ children }: { children: string }) {
  return (
    <Text style={styles.footnote} maxFontSizeMultiplier={MAX_FONT_SCALE}>
      {children}
    </Text>
  );
}

/** A paragraph of a lesson screen. */
export function Paragraph({ children }: { children: string }) {
  return (
    <Text style={styles.paragraph} maxFontSizeMultiplier={MAX_FONT_SCALE}>
      {children}
    </Text>
  );
}

/**
 * The overload lesson's card: the same lift on two weeks, the second one 2.5 kg
 * heavier and drawn in blue.
 *
 * The lift and the loads are the PERSON'S OWN when they typed one two screens
 * earlier — which is the whole reason the key-lift screen comes before this
 * one. With nothing typed it falls back to the named example, and the example
 * is a barbell fact (a 2.5 kg jump on a 60 kg bench), not a claim about
 * anybody's training.
 */
export function OverloadCard({
  lift,
  last,
  next,
  unit,
}: {
  lift: string;
  last: string;
  next: string;
  unit: string;
}) {
  return (
    <View style={styles.card}>
      <Eyebrow tone="muted">LAST WEEK</Eyebrow>
      <Text style={styles.cardLine} maxFontSizeMultiplier={MAX_FONT_SCALE}>
        {`${lift} — 3 × 8 @ ${last} ${unit}`}
      </Text>
      <View style={styles.cardRule} />
      <Eyebrow tone="muted" style={styles.blueLabel}>
        THIS WEEK
      </Eyebrow>
      <Text style={[styles.cardLine, styles.blueLine]} maxFontSizeMultiplier={MAX_FONT_SCALE}>
        {`${lift} — 3 × 8 @ ${next} ${unit}`}
      </Text>
    </View>
  );
}

/**
 * The commitment screen's number card. The count is arithmetic on the person's
 * own week (`committedSessions`) — never a target, and nothing downstream
 * counts a missed one (§11).
 */
export function StatCard({ value, caption }: { value: number; caption: string }) {
  return (
    <View
      style={styles.statCard}
      accessible
      accessibilityRole="text"
      accessibilityLabel={`${value} ${caption}`}>
      <Text style={styles.statNumber} maxFontSizeMultiplier={MAX_FONT_SCALE}>
        {value}
      </Text>
      <Text style={styles.statCaption} maxFontSizeMultiplier={MAX_FONT_SCALE}>
        {caption}
      </Text>
    </View>
  );
}

/**
 * A preview of the weekly recap notification, above the question that asks for
 * it — the design's own device, and a good one: it is far easier to answer
 * "do you want this" when you can see the thing.
 *
 * **Its body describes the recap; it does not fabricate one.** The design's
 * mock read "Bench up 2.5 kg. Squat stalled twice.", which is a record of
 * training that has not happened, shown to somebody who has logged nothing.
 * CLAUDE.md §3 forbids fabricated personalisation "anywhere, including
 * placeholders", so the line below says what the message will contain instead
 * of pretending to be one.
 */
export function RecapPreview({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.notification}>
      <View style={styles.notificationHead}>
        <View style={styles.appMark} />
        <Eyebrow tone="muted">RECORE</Eyebrow>
        <View style={styles.flex} />
        <Text style={styles.stamp} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          now
        </Text>
      </View>
      <Text style={styles.notificationTitle} maxFontSizeMultiplier={MAX_FONT_SCALE}>
        {title}
      </Text>
      <Text style={styles.notificationBody} maxFontSizeMultiplier={MAX_FONT_SCALE}>
        {body}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  sectionLabel: {
    marginBottom: spacing.sm,
  },
  footnote: {
    ...type.subhead,
    color: color.textSecondary,
  },
  paragraph: {
    ...type.body,
    color: color.textSecondary,
  },
  card: {
    backgroundColor: INK_CARD,
    borderRadius: CARD_RADIUS,
    borderCurve: 'continuous',
    padding: spacing.lg,
    gap: spacing.xs,
  },
  cardLine: {
    ...type.headline,
    fontWeight: '600',
    color: color.textPrimary,
  },
  cardRule: {
    height: hairline,
    backgroundColor: color.divider,
    marginVertical: spacing.md,
  },
  blueLabel: {
    color: BLUE,
  },
  blueLine: {
    color: BLUE,
  },
  statCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    backgroundColor: BLUE_CARD,
    borderRadius: CARD_RADIUS,
    borderCurve: 'continuous',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
  },
  statNumber: {
    ...type.heroNumber,
    color: BLUE,
  },
  statCaption: {
    flex: 1,
    ...type.headline,
    fontWeight: '600',
    color: color.textPrimary,
  },
  /**
   * A notification is a white card on a white page, so its edge IS its border
   * and shadow (§14.3, 17 Aug: "nothing can be lighter than white").
   */
  notification: {
    backgroundColor: color.surface,
    borderRadius: CARD_RADIUS,
    borderCurve: 'continuous',
    borderWidth: hairline,
    borderColor: color.border,
    padding: spacing.lg,
    gap: spacing.xs,
    ...shadow.card,
  },
  notificationHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  appMark: {
    width: moderateScale(18),
    height: moderateScale(18),
    borderRadius: moderateScale(5),
    borderCurve: 'continuous',
    backgroundColor: color.accent,
  },
  stamp: {
    ...type.caption,
    color: color.textMuted,
  },
  notificationTitle: {
    ...type.headline,
    fontWeight: '600',
    color: color.textPrimary,
  },
  notificationBody: {
    ...type.subhead,
    color: color.textSecondary,
  },
});
