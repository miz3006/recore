import { Image, StyleSheet, Text, View } from 'react-native';

import { Eyebrow } from '@/components/primitives';
import {
  color,
  hairline,
  lineFor,
  MAX_FONT_SCALE,
  moderateScale,
  radius,
  readingStyle,
  shadow,
  spacing,
  type,
} from '@/lib/theme';

import { BRAND_CARD, CARD_FILL } from './tokens';

/** The app's own icon, as shipped (`app.json`). */
const APP_ICON = require('../../../assets/images/icon.png');

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

/**
 * A paragraph of a lesson screen.
 *
 * `lede` sets the FIRST one a step higher (`type.lede`, 19/600, in full ink):
 * the two lesson screens are the only prose in the funnel, and a wall of three
 * identical grey paragraphs under a headline reads as terms and conditions. One
 * step of contrast on the opening line is what makes it read as written rather
 * than as filler — the same device the brief and the check-in already use, and
 * the token was already in the scale for it.
 */
export function Paragraph({ children, lede = false }: { children: string; lede?: boolean }) {
  return (
    <Text
      style={lede ? styles.lede : styles.paragraph}
      maxFontSizeMultiplier={MAX_FONT_SCALE}>
      {children}
    </Text>
  );
}

/**
 * The overload lesson's card: the same lift on two weeks, the second one 2.5 kg
 * heavier and drawn in blue.
 *
 * The lift, the loads AND the shape of the session are the PERSON'S OWN when
 * they have given them — the key-lift load they set two screens earlier, or
 * else the line they wrote on the demo screen (`overloadExample`). With nothing
 * written it falls back to the named example, and the example is a barbell fact
 * (a 2.5 kg jump on a 60 kg bench), not a claim about anybody's training.
 */
export function OverloadCard({
  lift,
  sets,
  reps,
  last,
  next,
  unit,
}: {
  lift: string;
  /** The shape of the session — the demo line's own when there was one. */
  sets: number;
  reps: number;
  last: string;
  next: string;
  unit: string;
}) {
  const shape = `${sets} × ${reps}`;
  return (
    <View
      style={styles.card}
      accessible
      accessibilityRole="text"
      accessibilityLabel={`${lift}. Last week ${shape} at ${last} ${unit}. This week ${shape} at ${next} ${unit}.`}>
      {/* The lift is named ONCE, at the top, because it is the card's subject
          and not part of either reading. It was printed on both lines, which
          made two rows of near-identical prose out of a comparison whose whole
          point is the one number that differs. */}
      <Eyebrow tone="muted">{lift.toUpperCase()}</Eyebrow>

      <View style={styles.compareRow}>
        <Text style={styles.compareLabel} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          Last week
        </Text>
        <Text style={styles.compareValue} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {`${shape} · ${last} `}
          <Text style={styles.compareUnit}>{unit}</Text>
        </Text>
      </View>

      <View style={styles.cardRule} />

      <View style={styles.compareRow}>
        <Text style={[styles.compareLabel, styles.blueLabel]} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          This week
        </Text>
        <Text style={[styles.compareValue, styles.blueValue]} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {`${shape} · ${next} `}
          <Text style={[styles.compareUnit, styles.blueValue]}>{unit}</Text>
        </Text>
      </View>
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
        {/* THE REAL ICON, not a coloured square. This card is a picture of a
            thing the person will meet outside the app, and the one detail that
            decides whether it reads as that thing or as a mock-up is the app
            mark being the app's own. It is the file `app.json` ships as the
            icon, so the preview cannot drift from the real notification. */}
        <Image source={APP_ICON} style={styles.appIcon} accessibilityIgnoresInvertColors />
        <Eyebrow tone="muted">RECORE</Eyebrow>
        <View style={styles.flex} />
        {/* "Sunday", not "now": the recap is weekly, and a preview that says
            now is describing a notification this app will never send. */}
        <Text style={styles.stamp} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          Sunday
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
  lede: {
    ...type.lede,
    color: color.textPrimary,
  },
  card: {
    backgroundColor: CARD_FILL,
    borderRadius: radius.xl,
    borderCurve: 'continuous',
    padding: spacing.lg,
    // A white surface on the canvas needs an edge to exist: it is 1.05:1 by
    // tone (skill §Spacing, radii, elevation).
    ...shadow.card,
  },
  /** One comparison row: what it is on the left, what it reads on the right —
   * the record's own shape (skill §Structure), so the funnel's cards and the
   * app's rows speak the same way. */
  compareRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.md,
    // One even beat all the way down the card: eyebrow → row → rule → row.
    marginTop: spacing.md,
  },
  compareLabel: {
    ...type.subhead,
    fontWeight: '500',
    color: color.textSecondary,
  },
  /** A load is a reading, so it is set in the reading face — never the sans
   * (skill §Decided-5). */
  compareValue: {
    ...readingStyle('600'),
    fontSize: moderateScale(17),
    lineHeight: lineFor(22),
    color: color.textPrimary,
  },
  /** The unit is a step down and a weight lighter: a number and its unit are
   * typographically two things. */
  compareUnit: {
    ...readingStyle('500'),
    fontSize: moderateScale(13),
    color: color.textSecondary,
  },
  cardRule: {
    height: hairline,
    backgroundColor: color.border,
    marginTop: spacing.md,
  },
  blueLabel: {
    color: color.brand,
  },
  blueValue: {
    color: color.brand,
  },
  statCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    backgroundColor: BRAND_CARD,
    borderRadius: radius.xl,
    borderCurve: 'continuous',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
  },
  statNumber: {
    ...type.heroNumber,
    color: color.brand,
  },
  statCaption: {
    flex: 1,
    ...type.headline,
    fontWeight: '600',
    color: color.textPrimary,
  },
  /**
   * A notification preview is a white card, and on the cream canvas it is one of
   * the few things in the funnel that genuinely FLOATS — which is what a
   * notification does. Its border and shadow are still its edge; the page just
   * stopped being the same colour as it.
   */
  notification: {
    backgroundColor: color.surface,
    borderRadius: radius.xl,
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
  appIcon: {
    width: moderateScale(20),
    height: moderateScale(20),
    borderRadius: moderateScale(5),
    borderCurve: 'continuous',
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
