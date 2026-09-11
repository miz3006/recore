import { StyleSheet, Text, View } from 'react-native';

import { groupThousands } from '@/lib/parse/estimate';
import { weekIsComplete, type LoadTrend } from '@/lib/session-effort';
import {
  color,
  lineFor,
  MAX_FONT_SCALE,
  readingStyle,
  spacing,
  type,
} from '@/lib/theme';

import { Eyebrow } from './primitives';

/**
 * THIS WEEK'S TRAINING LOAD, on Progress (owner, 10 September 2026).
 *
 * The check-in asks one question about the whole session — how hard it was —
 * and stores it on Foster's CR-10 (`lib/session-effort.ts`). Multiplied by the
 * session's duration that is internal training load, and summed over a week it
 * is the one number that sees what tonnage cannot: an hour and a half at RPE 8
 * costs more than forty minutes at RPE 8, and neither shows up as more
 * kilograms lifted.
 *
 * ## Why it is here and not on Next
 *
 * This is the tab for "am I training, and is it adding up?" — it already
 * buckets the record into rolling seven-day weeks and prints volume, sessions
 * and lifts against them. Load is a fourth answer to the same question and
 * reads against the other three. Next is a briefing about the coming session;
 * a number about the last seven days is not that, and every sentence added
 * there has to clear the §9.4 evaluation before it can ship.
 *
 * ## What it may say, and what it may not
 *
 * It states a number and compares it to the athlete's own recent average. It
 * does **not** advise a deload, a rest week or a lighter session, and that is
 * a rule rather than a scope cut: the load a lift is given comes from
 * `predict/engine.ts` reading `sets.rir`, and a global feeling that starts
 * prescribing is a session rating quietly becoming an input to the engine.
 * `session-effort.ts` is explicit that it never is. Neither is there a colour
 * on the number, a threshold, or a word like "high" — §Colour, and §2 rule 6:
 * a reading is a reading, and a verdict is not ours to give.
 *
 * ## The incomplete week is the interesting state
 *
 * `weekIsComplete` refuses to total a week holding an unrated session, because
 * a sum over four of six sessions is smaller than the week was, and a smaller
 * number is not a partial truth — it is a lighter week that never happened.
 * So a partial week prints no figure and prints what is missing instead, which
 * is a state somebody can finish. Volume never needs this: volume is computed
 * from the record, and this is computed from something the athlete chooses to
 * give.
 *
 * The section is ABSENT until at least one session anywhere carries a rating.
 * A person who has never met the question should not find a row on Progress
 * telling them to answer it.
 */
export function WeekLoad({ trend, everRated }: { trend: LoadTrend; everRated: boolean }) {
  const week = trend.current;
  if (!everRated || !week) return null;

  // Nothing was trained in the last seven days: a section with nothing true to
  // say is absent, not empty (§1.1 invariant 6).
  if (week.days === 0) return null;

  const complete = weekIsComplete(week);

  /**
   * The second line. With an average it is the comparison, in the athlete's
   * own numbers; without one it says what the figure stands on, so a total is
   * never printed without its denominator anywhere on this surface.
   *
   * `percent` is null whenever the comparison would be dishonest — an
   * incomplete week, or an average with too little behind it — so this reads
   * it rather than re-deciding it.
   */
  const support =
    trend.percent != null && trend.average != null
      ? `${Math.abs(trend.percent)}% ${trend.percent >= 0 ? 'above' : 'below'} your average of ${groupThousands(trend.average)}`
      : `across ${week.days} training ${week.days === 1 ? 'day' : 'days'}`;

  return (
    <View style={styles.section}>
      <Eyebrow>This week&apos;s load</Eyebrow>

      {complete ? (
        <>
          {/* A READING, in the app's number face — the same voice every other
              figure on this tab reports in. No unit: the number means nothing
              on its own scale and everything against the line under it, and
              printing "AU" would put a piece of sports-science notation on a
              record screen to say exactly that. */}
          <Text
            style={styles.reading}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.6}
            maxFontSizeMultiplier={MAX_FONT_SCALE}
            accessibilityLabel={`This week's training load, ${groupThousands(week.load)}. ${support}.`}>
            {groupThousands(week.load)}
          </Text>
          <Text style={styles.support} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {support}
          </Text>
        </>
      ) : (
        <Text style={styles.pending} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {`${week.ratedDays} of ${week.days} training ${week.days === 1 ? 'day' : 'days'} rated. Rate them all and the week gets a load.`}
        </Text>
      )}

      {/* Where the number comes from, in one line, the way the split section
          says where its grouping came from. A figure a person cannot account
          for is a figure they are being asked to take on trust. */}
      <Text style={styles.note} maxFontSizeMultiplier={MAX_FONT_SCALE}>
        {trend.average != null
          ? `How hard you said each session was, times how long it took. Your average covers ${trend.averageWeeks} weeks where every session was rated.`
          : 'How hard you said each session was, times how long it took.'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.sm,
  },
  /** `statNumber` (32), deliberately under the hero's own reading: this is a
   * fourth fact about the week, not the headline the tab opens on. */
  reading: {
    ...readingStyle('600'),
    fontSize: type.statNumber.fontSize,
    lineHeight: lineFor(38),
    color: color.textPrimary,
  },
  support: {
    ...type.subhead,
    color: color.textSecondary,
  },
  /** The unfinished week. `textSecondary`, not `textMuted` — it carries the
   * only information this section has today, and muted is for what the eye may
   * skip (§Colour). */
  pending: {
    ...type.subhead,
    lineHeight: lineFor(22),
    color: color.textSecondary,
  },
  note: {
    ...type.footnote,
    lineHeight: lineFor(16),
    color: color.textMuted,
    marginTop: spacing.xs,
  },
});
