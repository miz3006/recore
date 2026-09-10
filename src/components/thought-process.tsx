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
const RING_STROKE = moderateScale(4);

/**
 * AIR AROUND THE STROKE — why the ring is drawn on a canvas bigger than itself
 * (9 September 2026, owner: *"včasih sploh ne prikaže celotni krog ampak je
 * odsekan"*).
 *
 * An `<Svg>` root establishes a viewport and CLIPS to it. The stroke straddles
 * the path, so a radius of exactly `(RING - RING_STROKE) / 2` puts its outer
 * edge ON that boundary at the four compass points, with nothing left for the
 * renderer to antialias into. Add `moderateScale`'s fractional results (52 pt
 * lands on 52.33 on a 3x screen) and the rounding of the host view's frame, and
 * the circle comes out visibly flattened — at the top on one device, on the
 * right on another. That is the cut-off ring, and it was never random.
 *
 * The fix is a GUTTER, not a smaller ring: the canvas is one point larger on
 * every side and hangs one point outside the 52 pt slot, so the ring keeps the
 * exact diameter the layout is built around and the stroke has canvas to finish
 * in. Nothing clips it — the slot is a plain View, whose overflow is visible.
 */
const RING_PAD = moderateScale(1);
const RING_CANVAS = RING + RING_PAD * 2;
/** The radius of the PATH. The stroke is centred on it, so the drawn circle is
 * `RING` across, as before. */
const RING_RADIUS = (RING - RING_STROKE) / 2;
/** Clear space inside the stroke — what the count actually has to fit in, and
 * the width the count's box is given so `adjustsFontSizeToFit` has a bound to
 * measure against. */
const RING_INNER = RING - RING_STROKE * 2;

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
  const circumference = 2 * Math.PI * RING_RADIUS;
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
          <Svg width={RING_CANVAS} height={RING_CANVAS} style={styles.ringCanvas}>
            <Circle
              cx={RING_CANVAS / 2}
              cy={RING_CANVAS / 2}
              r={RING_RADIUS}
              stroke={alpha(color.brand, 0.14)}
              strokeWidth={RING_STROKE}
              fill="none"
            />
            {filled > 0 ? (
              <Circle
                cx={RING_CANVAS / 2}
                cy={RING_CANVAS / 2}
                r={RING_RADIUS}
                stroke={color.brand}
                strokeWidth={RING_STROKE}
                strokeLinecap="round"
                fill="none"
                strokeDasharray={`${circumference * filled} ${circumference}`}
                // Start at twelve o'clock rather than at three, so the arc
                // reads as a gauge instead of as a partly drawn circle.
                transform={`rotate(-90 ${RING_CANVAS / 2} ${RING_CANVAS / 2})`}
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
  /**
   * The ring's place in the row. Fixed at `RING` so the text beside it starts
   * at the same x on every device, and `flexShrink: 0` so a long basis line can
   * never squeeze the circle into an ellipse — geometry that has to stay round
   * says so, rather than relying on the platform default.
   */
  ringSlot: {
    width: RING,
    height: RING,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /** The canvas hangs `RING_PAD` outside the slot on every side — see the note
   * on `RING_PAD`. It is out of flow, so the count below it is what the slot
   * centres. */
  ringCanvas: {
    position: 'absolute',
    top: -RING_PAD,
    left: -RING_PAD,
  },
  /**
   * THE COUNT INSIDE THE RING — and it has to FIT the ring (owner, 30 Aug
   * 2026: a two-digit count still deformed) and SIT IN THE MIDDLE OF IT (owner,
   * 9 Sep 2026: the circle and its number are wrongly structured).
   *
   * The ring is a fixed 52 pt circle with a 4 pt stroke, so the number lives
   * in about 44 pt of clear space — the one text box on these screens whose
   * width cannot grow with its content.
   *
   * Three things make it fit instead of hoping:
   *
   *  1. `digitStyle` steps the size down by digit count, so the common cases
   *     are sized right rather than shrunk to fit;
   *  2. `adjustsFontSizeToFit` + `numberOfLines={1}` catch anything the steps
   *     did not anticipate, rather than letting it clip — and `RING_INNER` is
   *     the width they measure against, since a box free to grow with its
   *     content gives the renderer nothing to shrink towards;
   *  3. `allowFontScaling={false}` — this is text locked inside geometry, and
   *     the skill's own rule is that such text does not scale. The LABEL beside
   *     the ring carries the same count in words and does scale, so nothing is
   *     lost to a reader who needs larger type.
   *
   * **It is CENTRED BY THE SLOT, not by a line height.** This was an
   * `absoluteFill` box with `lineHeight: RING`, i.e. a 17 pt glyph asked to
   * float in a 52 pt line box — but iOS puts a line's extra leading ABOVE its
   * glyphs, so the digit sat low in the circle rather than in the middle of it,
   * by an amount that changed with the size `digitStyle` picked and again with
   * whatever `adjustsFontSizeToFit` did on top. The slot already centres its
   * children on both axes; letting it do that puts the digit in the middle at
   * every size, and the canvas above is out of flow so there is nothing for it
   * to be centred against.
   */
  ringValue: {
    ...readingStyle('600'),
    width: RING_INNER,
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
