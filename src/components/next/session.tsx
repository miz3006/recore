import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { Icon } from '@/components/icon';
import { FadeSlideIn, PressableScale } from '@/components/motion';
import { Eyebrow } from '@/components/primitives';
import { whenLabel } from '@/lib/brief-prose';
import { todayKey } from '@/lib/db/dates';
import { DUR, EASE, SPRING } from '@/lib/motion';
import type { MoveLabel, SessionRow } from '@/lib/next/sections';
import { fmtNumber } from '@/lib/parse/summarize';
import {
  color,
  fonts,
  lineFor,
  MAX_FONT_SCALE,
  moderateScale,
  radius,
  readingStyle,
  shadow,
  spacing,
  type,
} from '@/lib/theme';

/**
 * ONE CARD PER LIFT — the Next tab in Progression's card grammar (owner,
 * 18 August 2026: *"Next should be the same as Progression, only performing its
 * own function — I want the same consistency"*).
 *
 * ## What changed, and why the old shape had to go
 *
 * The 13 August build gave this page exactly ONE raised surface: the first lift
 * of the session got a whole hero card at `radius.xxl` with its load at 30 pt,
 * and every other lift of the same session followed as a plain hairline row on
 * paper. That solved the problem it was built for — four cards of equal weight
 * and no focal point — by inventing a hierarchy the CONTENT does not have. The
 * second lift of a session is not a lesser fact than the first. It is the same
 * fact about a different lift, and a reader scanning for "what do I put on the
 * bar for rows?" had to read it in a different typographic voice from the one
 * they had just learned two inches above.
 *
 * Progression had already answered this for the other half of the app: **one
 * card per lift, all equal, ranked by an explicit control, and the card opens
 * to show its own evidence.** Next now speaks that language exactly.
 *
 *     Progression                          Next
 *     ─────────────────────────────────    ─────────────────────────────────
 *     name  [up 12%] [PR]      120 kg      name  [ADD A REP]        82.5 kg
 *     3 sessions · last Tue    up 12 kg    3 sessions at this wt      5·5·5
 *     ───────── chart ─────────            was 3×5 80      best 120 kg
 *     Jul 13 · 100    Aug 17 · 120
 *     ── open: the sets behind it ──       ── open: WHY / WATCH ──
 *     Full history               ›         Full history            ›
 *
 * Same card, same slots, same accordion, same closing opener. The FUNCTION of
 * each slot is the only thing that differs, and it differs the way the two tabs
 * do: Progression's big number is what you lifted, Next's is what you have not
 * lifted yet. Progression's evidence is the sets that produced the reading;
 * Next's is the arithmetic that produced the prescription.
 *
 * ## Three things that survived the move intact
 *
 * **The lever is Progression's chip now.** It answers the question every review
 * of this category converges on — *"you don't know whether to add weight or reps
 * this week"* — and it is the one element that changes between sessions, so it
 * sits exactly where Progression puts its delta chip: beside the name, same
 * `radius.sm`, same 6/2 padding, same 11 pt reading face at 700. It was a solid
 * fill with a white label until 18 Aug. That passed contrast and still read as a
 * different object from the chip one tab across, which is the whole complaint.
 * The tokens stay Next's — `signal` on the new `signalWash` (**4.59:1**),
 * `attention` on `attentionWash` (**4.64:1**), both measured against §14.3.
 * Progression's own `gainWash` strength would land these at 4.2:1 and fail,
 * which is why the two washes are paler than the pair they echo; and `gain`
 * itself may never stand in for `signal`, because recorded is not planned.
 *
 * **The load is PLANNED GREEN** (owner, 18 Aug — amended the same day). It drew
 * in ink on the reasoning that a number someone carries to a rack should not be
 * tinted. §4.2 is more specific than that reasoning: planned green is for *"a
 * concrete future prescription only, always with its label and reason"*, and
 * this figure is exactly that — with the lever chip beside it as its label and
 * the WHY one tap under it as its reason. Green here is the app's fourth data
 * state finally visible on the screen that is nothing but planned values.
 *
 * **WHY and WATCH stay one tap down.** The decision is needed every session;
 * the arithmetic behind it is not (progressive disclosure, two levels total).
 * The card is the disclosure, exactly as a Progression card is.
 *
 * The quote is the one thing NOT behind the tap: the athlete's own words are
 * not evidence for a calculation and never were (§8.1 — quote, never infer), so
 * filing them under a control that reveals arithmetic would make them look like
 * the wrong kind of thing.
 */
export function LiftCard({
  row,
  open,
  onToggle,
  onOpenHistory,
}: {
  row: SessionRow;
  open: boolean;
  onToggle: () => void;
  onOpenHistory: () => void;
}) {
  const expandable = Boolean(row.why || row.watch);
  const meta = metaLine(row);
  const ends = endLabels(row);

  const body = (
    <View style={styles.cardBody}>
      <View style={styles.cardTop}>
        <View style={styles.cardName}>
          <View style={styles.nameLine}>
            <Text style={styles.liftName} numberOfLines={2} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              {row.name}
            </Text>
            {row.move ? <Lever move={row.move} /> : null}
          </View>
          {meta ? (
            <Text
              style={[styles.liftMeta, row.watch ? styles.metaWatch : null]}
              maxFontSizeMultiplier={MAX_FONT_SCALE}>
              {meta}
            </Text>
          ) : null}
        </View>
        <Load row={row} />
      </View>

      {ends ? (
        <View style={styles.ends}>
          <Text style={styles.endLabel} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {ends.left ?? ''}
          </Text>
          {ends.right ? (
            <Text
              style={[styles.endLabel, row.beatsBest ? styles.endBest : null]}
              numberOfLines={1}
              maxFontSizeMultiplier={MAX_FONT_SCALE}>
              {ends.right}
            </Text>
          ) : null}
        </View>
      ) : null}

      {expandable ? (
        <View style={styles.chevronRow}>
          <Chevron open={open} />
        </View>
      ) : null}
    </View>
  );

  return (
    <View style={styles.card}>
      {expandable ? (
        <PressableScale
          haptic="none"
          activeScale={0.98}
          onPress={onToggle}
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          accessibilityLabel={spokenLabel(row)}
          accessibilityHint={open ? 'Hides the reason' : 'Shows why this load was set'}>
          {body}
        </PressableScale>
      ) : (
        <View accessible accessibilityLabel={spokenLabel(row)}>
          {body}
        </View>
      )}

      <Quote row={row} />

      {open ? (
        <FadeSlideIn distance={6}>
          <View style={styles.cardRule} />
          <Detail row={row} />
          {row.canonical ? (
            <>
              <View style={styles.cardRule} />
              <PressableScale
                haptic="none"
                activeScale={0.98}
                onPress={onOpenHistory}
                accessibilityRole="button"
                accessibilityLabel={`Full history for ${row.canonical}`}
                style={styles.opener}>
                <Text style={styles.openerLabel} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                  Full history
                </Text>
                <Icon name="chevron-forward" size={moderateScale(13)} tint={color.textMuted} />
              </PressableScale>
            </>
          ) : null}
        </FadeSlideIn>
      ) : null}
    </View>
  );
}

/**
 * The lifts this session names that have nothing to progress from — the same
 * block Progression gives lifts too shallow to chart, doing the same job on
 * this side of the app.
 *
 * §7.3: never extrapolate from nothing. There is no load to print, so the row
 * prints none and says what would change that — rather than dropping a lift the
 * athlete is about to do off the page they opened to find out what they are
 * about to do.
 */
export function UnknownLifts({ rows }: { rows: SessionRow[] }) {
  if (rows.length === 0) return null;
  return (
    <View style={styles.building}>
      <Eyebrow>{`Also in this session · ${rows.length}`}</Eyebrow>
      {rows.map((row) => (
        <View
          key={row.key || row.name}
          style={styles.buildRow}
          accessible
          accessibilityLabel={`${row.name}, no history yet`}>
          <Text style={styles.buildName} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {row.name}
          </Text>
          <Text style={styles.buildMeta} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            no history yet
          </Text>
        </View>
      ))}
      <Text style={styles.buildingNote} maxFontSizeMultiplier={MAX_FONT_SCALE}>
        One logged session each and Recore has something for these to beat.
      </Text>
    </View>
  );
}

/**
 * The card's reading, in Progression's hero slot: the load at 28 pt with its
 * unit, and the rep scheme under it where Progression puts its delta.
 *
 * When the engine handed over no figure — a ghost line, a cardio line, a
 * bodyweight line — the whole prescription goes in one size down rather than
 * being split apart on screen (§7.7). An empty slot is honest; a parsed one is
 * how the multi-set display bug happened.
 */
function Load({ row }: { row: SessionRow }) {
  if (row.loadKg != null) {
    return (
      <View style={styles.heroBox}>
        <Text style={styles.hero} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {fmtNumber(row.loadKg)}
          <Text style={styles.heroUnit}> kg</Text>
        </Text>
        {row.scheme ? (
          <Text style={styles.heroSub} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {row.scheme}
          </Text>
        ) : null}
      </View>
    );
  }
  if (row.prescription) {
    return (
      <View style={styles.heroBox}>
        <Text style={styles.heroCompact} numberOfLines={2} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {row.prescription}
        </Text>
      </View>
    );
  }
  return null;
}

/**
 * The decision, as a filled pill. It SPRINGS in on mount rather than fading:
 * the lever is the one element on the page that changes between sessions, and a
 * thing that arrives with a little weight reads as new information rather than
 * as part of the furniture. Reduce Motion places it.
 */
function Lever({ move }: { move: MoveLabel }) {
  const reduce = useReducedMotion();
  const s = useSharedValue(reduce ? 1 : 0.86);

  useEffect(() => {
    if (!reduce) s.value = withSpring(1, SPRING.press);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: s.value }],
    opacity: Math.min(1, (s.value - 0.7) * 5),
  }));

  return (
    <Animated.View
      style={[
        styles.lever,
        move.tone === 'attention' ? styles.leverAttention : styles.leverSignal,
        animatedStyle,
      ]}>
      <Text
        style={[
          styles.leverText,
          move.tone === 'attention' ? styles.leverInkAttention : styles.leverInkSignal,
        ]}
        numberOfLines={1}
        maxFontSizeMultiplier={MAX_FONT_SCALE}>
        {move.label}
      </Text>
    </Animated.View>
  );
}

/** The disclosure mark. Rotates a half-turn on open; Reduce Motion snaps. */
function Chevron({ open }: { open: boolean }) {
  const reduce = useReducedMotion();
  const p = useSharedValue(open ? 1 : 0);

  useEffect(() => {
    const to = open ? 1 : 0;
    p.value = reduce ? to : withTiming(to, { duration: DUR.base, easing: EASE.standard });
  }, [open, reduce, p]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${p.value * 180}deg` }],
  }));

  return (
    <Animated.View style={animatedStyle}>
      <Icon name="chevron-down" size={moderateScale(14)} tint={color.textMuted} />
    </Animated.View>
  );
}

/** WHY and WATCH — the evidence an open card shows, the way an open Progression
 * card shows the sets behind its latest point. */
function Detail({ row }: { row: SessionRow }) {
  return (
    <View style={styles.detail}>
      {row.why ? (
        <View style={styles.detailLine}>
          <Text style={styles.detailLabel} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            WHY
          </Text>
          <Text style={styles.detailText} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {row.why}
          </Text>
        </View>
      ) : null}
      {row.watch ? (
        <View style={styles.detailLine}>
          <Text
            style={[styles.detailLabel, styles.watchLabel]}
            maxFontSizeMultiplier={MAX_FONT_SCALE}>
            WATCH
          </Text>
          <Text style={styles.detailText} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {'One more flat session and this backs off to '}
            <Text style={styles.backoff}>{`${fmtNumber(row.watch.deloadTo)} kg`}</Text>
            {'.'}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

/** The athlete's own words, quoted and dated — never in the reading voice,
 * because a person wrote them and no number came out of them (§8.1: quote,
 * never infer). */
function Quote({ row }: { row: SessionRow }) {
  if (!row.note) return null;
  return (
    <View style={styles.quote}>
      <Text style={styles.quoteText} maxFontSizeMultiplier={MAX_FONT_SCALE}>
        {`“${row.note.text}”`}
      </Text>
      <Text style={styles.quoteWho} maxFontSizeMultiplier={MAX_FONT_SCALE}>
        {`your note, ${whenLabel(row.note.day, todayKey())}`}
      </Text>
    </View>
  );
}

/**
 * The supporting line under the name — Progression's `stallNote ?? "N sessions
 * · last Tue"` slot, and the same priority order.
 *
 * A plateau outranks everything, because it is the fact that changes what the
 * athlete does. With nothing to report the line is ABSENT rather than filled
 * with a phrase that says nothing (§8.3: no reason, no line).
 */
function metaLine(row: SessionRow): string | null {
  if (row.watch) {
    const n = row.watch.sessions;
    return `${n} ${n === 1 ? 'session' : 'sessions'} at this weight`;
  }
  if (!row.prescription) return 'no history yet';
  return null;
}

/** The card's floor: what you did on the left, what it is measured against on
 * the right — Progression's two chart endpoints, doing the same job. */
function endLabels(row: SessionRow): { left: string | null; right: string | null } | null {
  const left = row.last ? `was ${row.last}` : null;
  const right = row.beatsBest
    ? 'heaviest yet'
    : row.bestKg != null
      ? `best ${fmtNumber(row.bestKg)} kg`
      : null;
  if (!left && !right) return null;
  return { left, right };
}

/** Spelled out in full, so VoiceOver never depends on the fill colour the lever
 * uses to say the same thing (§14). */
function spokenLabel(row: SessionRow): string {
  return [
    row.name,
    row.move?.label.toLowerCase() ?? '',
    row.prescription ? `next ${row.prescription}` : 'no prescription yet',
    row.last ? `was ${row.last}` : '',
    row.beatsBest ? 'would be your heaviest yet' : '',
    row.watch ? `stuck for ${row.watch.sessions} sessions` : '',
  ]
    .filter(Boolean)
    .join(', ');
}

/**
 * How far a pressed row's highlight bleeds past its content, toward the card's
 * edge — the same rule and the same token Progression's card uses, so a press
 * lights up identically on both tabs.
 */
const PRESS_BLEED = spacing.sm;

const styles = StyleSheet.create({
  // The card. Every value here is Progression's, deliberately: surface, one
  // hairline, `radius.lg`, `spacing.lg` of padding, the resting shadow. No
  // marginBottom — the page's own `gap` separates the cards.
  card: {
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.divider,
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    padding: spacing.lg,
    ...shadow.card,
  },
  cardBody: {
    gap: spacing.sm,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  cardName: {
    flexShrink: 1,
  },
  nameLine: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  liftName: {
    ...type.headline,
    flexShrink: 1,
    fontWeight: '700',
    color: color.textPrimary,
  },
  liftMeta: {
    fontFamily: fonts.reading,
    fontSize: moderateScale(11.5),
    marginTop: 3,
    color: color.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  /** A plateau is the one meta line that earns a hue. Amber clears AA on
   * surface at 5.02:1, and the WORDS say "at this weight" beside it (§14). */
  metaWatch: {
    color: color.attention,
  },

  // The reading. Progression's hero box, to the point.
  heroBox: {
    alignItems: 'flex-end',
    flexShrink: 0,
  },
  /**
   * THE LOAD, IN PLANNED GREEN (owner, 18 Aug 2026).
   *
   * product-direction §4.2 has one line for this colour — *"a concrete future
   * prescription only, always with its label and reason"* — and this figure is
   * the most concrete future prescription in the app. It drew in ink until now
   * on the reasoning that "a number someone carries to a rack should not be
   * tinted"; that reasoning kept the app's fourth data state (Planned) invisible
   * on the one screen that is nothing but planned values, which is the state the
   * retired plan strip used to carry on Today.
   *
   * MEASURED: `signal` #547C00 on white is **4.93:1**. At 28 pt bold this is
   * large text under WCAG, which owes 3:1 — so it clears its own floor with room
   * and clears the normal-text 4.5:1 as well. The unit rides the same green at
   * caption size, where 4.93:1 is still AA. The scheme under it stays ink: it is
   * how the load is arranged, not a second load.
   */
  hero: {
    fontFamily: fonts.reading,
    fontSize: moderateScale(28),
    fontWeight: '700',
    letterSpacing: -0.5,
    color: color.signal,
    fontVariant: ['tabular-nums'],
  },
  heroUnit: {
    fontSize: type.caption.fontSize,
    fontWeight: '400',
    color: color.signal,
  },
  heroSub: {
    fontFamily: fonts.reading,
    fontSize: moderateScale(12.5),
    fontWeight: '600',
    marginTop: 2,
    color: color.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  /** The whole prescription, for a line that carries no separate figure. */
  heroCompact: {
    ...readingStyle('700'),
    fontSize: moderateScale(16),
    lineHeight: lineFor(21),
    textAlign: 'right',
    // The same planned value, so the same green — 4.93:1 at 16 pt bold, which
    // is large text (14 pt bold) and owes 3:1.
    color: color.signal,
    maxWidth: moderateScale(150),
  },

  ends: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  endLabel: {
    fontFamily: fonts.reading,
    fontSize: moderateScale(11),
    color: color.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  /** A load that would out-lift the record. `signal` green is exactly this —
   * a value not yet lifted — and it is a WORD, never a digit (4.93:1). */
  endBest: {
    color: color.signal,
    fontWeight: '700',
  },
  chevronRow: {
    alignItems: 'center',
    marginTop: -spacing.xs,
  },

  /**
   * The lever — Progression's `shareChip`, to the pixel: same `radius.sm`, same
   * 6/2 padding, same 11 pt reading face at 700, coloured ink on its own wash.
   *
   * It was a SOLID pill with a white label until 18 Aug, which passed contrast
   * but made the one thing both tabs do — say a state in a small tinted chip
   * beside a lift's name — look like two different objects. The tokens under it
   * are still Next's: `signal` on `signalWash` (4.59:1), `attention` on
   * `attentionWash` (4.64:1). Recorded green never stands in for planned green,
   * so the SHAPE travelled from Progression and the hue did not.
   */
  lever: {
    alignSelf: 'flex-start',
    borderRadius: radius.sm,
    borderCurve: 'continuous',
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  leverSignal: {
    backgroundColor: color.signalWash,
  },
  leverAttention: {
    backgroundColor: color.attentionWash,
  },
  leverText: {
    ...readingStyle('700'),
    fontSize: moderateScale(11),
    lineHeight: lineFor(14),
    letterSpacing: 0.6,
  },
  leverInkSignal: {
    color: color.signal,
  },
  leverInkAttention: {
    color: color.attention,
  },

  // --- the evidence, inside an open card (Progression's own metrics) --------
  cardRule: {
    height: 1,
    backgroundColor: color.tableRule,
    marginVertical: spacing.md,
  },
  detail: {
    gap: spacing.md,
  },
  detailLine: {
    gap: 3,
  },
  detailLabel: {
    ...readingStyle('600'),
    fontSize: moderateScale(9.5),
    letterSpacing: 1.2,
    color: color.textSecondary,
  },
  watchLabel: {
    color: color.attention,
  },
  detailText: {
    ...type.footnote,
    lineHeight: lineFor(17),
    color: color.textSecondary,
  },
  backoff: {
    ...readingStyle('600'),
    fontSize: type.footnote.fontSize,
    color: color.attention,
  },
  opener: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: moderateScale(28),
    marginHorizontal: -PRESS_BLEED,
    paddingHorizontal: PRESS_BLEED,
    borderRadius: radius.sm,
    borderCurve: 'continuous',
  },
  openerLabel: {
    ...type.caption,
    color: color.textSecondary,
  },

  quote: {
    marginTop: spacing.md,
    paddingLeft: spacing.sm,
    borderLeftWidth: 2,
    borderLeftColor: color.divider,
    gap: 1,
  },
  quoteText: {
    ...type.footnote,
    lineHeight: lineFor(17),
    color: color.textSecondary,
  },
  quoteWho: {
    ...type.caption,
    color: color.textMuted,
  },

  // --- lifts with nothing to progress from (Progression's "building" block) --
  building: {
    gap: spacing.xs,
  },
  buildRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    minHeight: moderateScale(40),
    borderBottomWidth: 1,
    borderBottomColor: color.tableRule,
  },
  buildName: {
    ...type.subhead,
    flexShrink: 1,
    color: color.textPrimary,
  },
  buildMeta: {
    fontFamily: fonts.reading,
    fontSize: moderateScale(11),
    color: color.textMuted,
  },
  buildingNote: {
    ...type.caption,
    marginTop: spacing.xs,
    color: color.textMuted,
  },
});
