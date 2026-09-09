import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import {
  alpha,
  color,
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
 * THE THOUGHT-PROCESS CARD — the app's reasoning as a designed object (design
 * skill §Reuse; migration Phase 2).
 *
 * The engine prescribes a load and the brief prints it. What the page never
 * had was the sentence in between: *why this load, and how much record is it
 * standing on.* This is that sentence, given a shape — an evidence ring, one
 * paragraph of plain language, where the words came from, and (where there is
 * one) a way to disagree with it.
 *
 * **Two surfaces wear it** and that is why it lives here rather than under
 * `next/`: the Next tab's closing block, and the lift sheet's own summary of a
 * single lift (owner, 20 Aug 2026 — *"summary redizajniraj tako, da bo enak kot
 * v Nextu"*). One paragraph about your record, with its provenance and the
 * count it stands on, should be one object wherever it appears.
 *
 * ## It EXPLAINS a load. It never produces one.
 *
 * CLAUDE.md §4 draws the line and this component sits on the safe side of it by
 * construction: **every string and every number it draws is a prop.** It does
 * no arithmetic on training data, holds no state, and reads nothing. If the
 * caller hands it the deterministic bundle's own words and the bundle's own
 * `sessions8w`, that is what appears; there is no path by which this file can
 * invent a load, a date or a claim, which is what makes it safe to put a model's
 * phrasing through it.
 *
 * ## The ring counts SESSIONS, and it is not a confidence percentage
 *
 * A percentage would be a number nobody computed — the engine has no posterior,
 * and printing "78 % confident" would be exactly the fabricated personalisation
 * CLAUDE.md §3 calls a release blocker. What is real is **how much record the
 * prescription is standing on**, which the brief already computes and already
 * prints in words ("based on N sessions"). So the ring fills against a stated
 * scale of sessions and the number inside it is that count, not a score.
 *
 * `FULL_RECORD` is the ring's scale and nothing else: 8 weeks at about one and
 * a half sessions a week is twelve, which is roughly the point past which the
 * engine has seen every lift in a rotation more than once. A fuller ring means
 * more record, and the label beside it says so in words — **the ring is never
 * the only carrier** (skill §Colour).
 *
 * ## Motion
 *
 * None. The ring is static: it reports a count that is already settled, and a
 * sweep would perform a calculation that did not happen. Nothing here is gated
 * on Reduce Motion because nothing here moves.
 */

/** The ring's full scale, in sessions. See the note above — a scale, not a
 * threshold, and nothing in the app branches on it. */
const FULL_RECORD = 12;

const RING = moderateScale(52);

/**
 * How big the count is drawn, by how many digits it has. The inner circle is
 * ~44 pt across; these are the sizes that sit in it with air on both sides
 * rather than against the stroke.
 */
function digitStyle(n: number): { fontSize: number } {
  const digits = String(Math.max(0, Math.round(n))).length;
  if (digits <= 1) return { fontSize: moderateScale(17) };
  if (digits === 2) return { fontSize: moderateScale(15) };
  return { fontSize: moderateScale(12) };
}
const RING_STROKE = moderateScale(4);

export function ThoughtProcessCard({
  reasoning,
  sessions,
  weeks = 8,
  basisNote = 'what this is based on',
  provenance,
  onAdjust,
  adjustLabel = 'Adjust',
}: {
  /**
   * One paragraph, already composed. It comes from the deterministic bundle —
   * either as the engine wrote it or as the guarded rewrite returned it — and
   * this component neither shortens it nor adds to it.
   */
  reasoning: string;
  /** Sessions the reasoning stands on. The brief's own `sessions8w`. */
  sessions: number;
  /**
   * The window those sessions were counted over. **Pass `null` when the count
   * is not windowed** — the lift sheet counts every session of one lift, and
   * printing "· 8 weeks" beside that would be a claim nobody computed.
   */
  weeks?: number | null;
  /** The line under the count. It says what the count IS, so a surface that
   * counts something else says so. */
  basisNote?: string;
  /**
   * Where the words came from — "Every number read from your record." or its
   * phrased variant. It belongs INSIDE this card because it qualifies this
   * card's paragraph: a claim about provenance printed somewhere else on the
   * page is a claim about nothing in particular (§9.1).
   */
  provenance?: string;
  /** Opens whatever lets the athlete disagree with the load. Omit it and no
   * link is drawn — a control that does nothing is worse than no control. */
  onAdjust?: () => void;
  adjustLabel?: string;
}) {
  const filled = Math.max(0, Math.min(1, sessions / FULL_RECORD));
  const r = (RING - RING_STROKE) / 2;
  const circumference = 2 * Math.PI * r;
  const basis =
    weeks == null
      ? `${sessions} ${sessions === 1 ? 'session' : 'sessions'}`
      : `${sessions} ${sessions === 1 ? 'session' : 'sessions'} · ${weeks} weeks`;

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <View
          style={styles.ringSlot}
          accessible
          accessibilityLabel={`Based on ${basis}`}>
          <Svg width={RING} height={RING}>
            <Circle
              cx={RING / 2}
              cy={RING / 2}
              r={r}
              stroke={alpha(color.brand, 0.14)}
              strokeWidth={RING_STROKE}
              fill="none"
            />
            {filled > 0 ? (
              <Circle
                cx={RING / 2}
                cy={RING / 2}
                r={r}
                stroke={color.brand}
                strokeWidth={RING_STROKE}
                strokeLinecap="round"
                fill="none"
                strokeDasharray={`${circumference * filled} ${circumference}`}
                // Start at twelve o'clock rather than at three, so the arc
                // reads as a gauge instead of as a partly drawn circle.
                transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
              />
            ) : null}
          </Svg>
          <Text
            style={[styles.ringValue, digitStyle(sessions)]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.6}
            allowFontScaling={false}
            maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {sessions}
          </Text>
        </View>
        <View style={styles.headText}>
          <Text style={styles.basis} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {basis}
          </Text>
          <Text style={styles.basisNote} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {basisNote}
          </Text>
        </View>
      </View>

      <Text style={styles.reasoning} maxFontSizeMultiplier={MAX_FONT_SCALE}>
        {reasoning}
      </Text>

      {provenance ? (
        <Text style={styles.provenance} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {provenance}
        </Text>
      ) : null}

      {onAdjust ? (
        <PressableScale
          onPress={onAdjust}
          activeScale={0.98}
          hitSlop={spacing.sm}
          accessibilityRole="button"
          accessibilityLabel={adjustLabel}
          style={styles.adjustHit}>
          <Text style={styles.adjust} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {adjustLabel}
          </Text>
        </PressableScale>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  /** One of the four sanctioned cards (skill §Structure) — it is an OBJECT
   * laid on the page rather than a row of the record, which is the whole
   * reason it is allowed a surface. */
  card: {
    backgroundColor: color.surface,
    borderRadius: radius.xl,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: color.divider,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadow.card,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  ringSlot: {
    width: RING,
    height: RING,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /**
   * THE COUNT INSIDE THE RING — and it has to FIT the ring (owner, 30 Aug
   * 2026: a two-digit count still deformed).
   *
   * The ring is a fixed 52 pt circle with a 4 pt stroke, so the number lives
   * in about 44 pt of clear space — the one text box on these screens whose
   * width cannot grow with its content. It was set at a flat `subhead` 15 and
   * left to hope: "3" sat comfortably, "14" crowded the stroke, and at the
   * Dynamic Type ceiling (×1.5 → 22.5 pt) two digits touched it.
   *
   * Three things make it fit instead of hoping:
   *
   *  1. `digitStyle` steps the size down by digit count, so the common cases
   *     are sized right rather than shrunk to fit;
   *  2. `adjustsFontSizeToFit` + `numberOfLines={1}` catch anything the steps
   *     did not anticipate, rather than letting it clip;
   *  3. `allowFontScaling={false}` — this is text locked inside geometry, and
   *     the skill's own rule is that such text does not scale. The LABEL beside
   *     the ring carries the same count in words and does scale, so nothing is
   *     lost to a reader who needs larger type.
   */
  ringValue: {
    ...StyleSheet.absoluteFill,
    ...readingStyle('600'),
    fontSize: type.subhead.fontSize,
    lineHeight: RING,
    textAlign: 'center',
    color: color.textPrimary,
  },
  headText: {
    flex: 1,
    gap: 2,
  },
  basis: {
    ...readingStyle('500'),
    fontSize: type.subhead.fontSize,
    color: color.textPrimary,
  },
  basisNote: {
    ...type.footnote,
    color: color.textSecondary,
  },
  reasoning: {
    ...type.body,
    color: color.textPrimary,
  },
  provenance: {
    ...type.caption,
    fontSize: moderateScale(11),
    color: color.textMuted,
  },
  /** A 44 pt target around a link that is only as tall as its own line. */
  adjustHit: {
    alignSelf: 'flex-start',
    minHeight: moderateScale(28),
    justifyContent: 'center',
  },
  adjust: {
    ...type.subhead,
    fontWeight: '600',
    color: color.brand,
  },
});
