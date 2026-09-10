import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { shortDayLabel } from '@/lib/db/dates';
import { type GutterSignal } from '@/lib/parse/types';
import { alpha, color, MAX_FONT_SCALE, moderateScale, readingStyle } from '@/lib/theme';

import { NOTE_LINE_BOX, NOTE_LINE_HEIGHT, READING_FONT_SIZE } from './note-metrics';

/**
 * The interpreted reading in the RIGHT GUTTER of a line (the record contract,
 * design frames 05–07).
 *
 * WRITTEN is the user's white ink; INTERPRETED is a quiet mono reading in
 * `textSecondary` ("80 kg · 5·5·5") — never a checkmark, never celebratory.
 * Comparisons recede a further step to `textMuted`, and a PR is a NEUTRAL
 * outlined mono label — lime belongs exclusively to planned prescriptions,
 * never to the gutter.
 *
 * THE PARSE SWEEP (CLAUDE.md §9): when a parse result lands, values settle in
 * top-to-bottom — each one fades in and slides 4px from the right with a small
 * stagger per line — so the analysis visibly walks down the page. `order` is
 * the value's rank in that cascade and `revision` identifies the parse pass;
 * a new revision replays the sweep. Under reduceMotion the structure appears
 * instantly, no sweep.
 */
const STAGGER_MS = 45;
const SETTLE_MS = 260;
const SETTLE_SHIFT = 4;
// The ONE bouncy moment in the whole app (CLAUDE.md §9): the PR label lands
// with a single small overshoot. Everything else settles without spring.
const PR_OVERSHOOT = 1.12;
const PR_FROM = 0.8;

/** Tag/label geometry from the design brief: radius 4, padding 2×5. */
const TAG_RADIUS = 4;
const TAG_PAD_H = 5;
const TAG_PAD_V = 2;

const KG_DELTA_RE = /^[+-]\d+(?:\.\d+)?$/;

/**
 * THE COMPARISON SUBLINE IS OFF (owner, 6 September 2026).
 *
 * "down 20 kg vs last" arrives under every entry that has a history, it is
 * loudest on exactly the days a load comes down on purpose, and it is the one
 * line on the record that says something about the athlete rather than about
 * what they wrote. The owner pulled it to bring the comparison back in another
 * form later — so the sentence stays COMPOSED here rather than deleted: one
 * switch, and the phrasing (with its "same as last · Fri 8 Aug" rule, which
 * cost a ruling of its own) is intact for whatever replaces it.
 *
 * What is NOT off: anything that states what an entry IS rather than how it
 * measures up — the PR label on the card and in the receipt, and the receipt's
 * "first recorded" — and the gutter's own ↑ / ↓ reading, which is the parse
 * speaking, not a hint.
 *
 * Read by every surface that prints the sentence (`session-receipt.tsx`,
 * `exercise-sheet.tsx`), because two surfaces disagreeing about whether the
 * comparison exists is the same defect as two of them disagreeing about what
 * it says.
 */
export const COMPARISON_SUBLINES_ON = false;

/**
 * The archival comparison subline of a card ("up 2.5 kg vs last"). PR carries a
 * chip instead, so it returns null here.
 *
 * "SAME AS LAST" NAMES THE SESSION IT MEANS (owner, 11 Aug 2026). Unqualified,
 * it was the one comparison the reader could not check: same as which day —
 * Friday, or the identical session three weeks ago? The date comes from the
 * signal itself (`db/history.ts` records the workout it compared against), so
 * a signal cached before that existed simply says less. It never guesses.
 *
 * It lives HERE, beside `signalText` / `signalTint` / `PrLabel`, because this
 * file is where a signal becomes language. It was private to `note-surface`
 * until the ⋯ sheet's header needed the same sentence, and a second copy of a
 * comparison is how two surfaces start disagreeing about the same lift.
 */
export function comparisonOf(signal: GutterSignal | null): string | null {
  if (!signal) return null;
  if (!COMPARISON_SUBLINES_ON) return null;
  switch (signal.kind) {
    case 'up':
    case 'down': {
      // Neutral reference — no bare +/- sign (a leading minus reads as a scold
      // on a deload day). Up and down carry identical muted weight.
      const word = signal.kind === 'up' ? 'up' : 'down';
      const mag = KG_DELTA_RE.test(signal.delta)
        ? `${signal.delta.replace(/^[+-]/, '')} kg`
        : signal.delta.replace(/^[+-]/, '');
      return `${word} ${mag} vs last`;
    }
    case 'equal':
      return signal.at ? `same as last · ${shortDayLabel(signal.at)}` : 'same as last';
    case 'pr':
    case 'set':
      return null;
  }
}

export function signalText(signal: GutterSignal): string {
  switch (signal.kind) {
    case 'up':
      return `↑ ${signal.delta}`;
    case 'down':
      return `↓ ${signal.delta}`;
    case 'equal':
      return '= same';
    case 'pr':
      return 'PR';
    case 'set':
      return signal.text;
  }
}

const ECHO_RE = /^(\d+)×(\d+)(?:\s+(\d+(?:\.\d+)?))?$/;

/** "5·5·5" for up to three sets, the design's "12 ×4" beyond that. */
export function repScheme(count: number, reps: string): string {
  if (count >= 2 && count <= 3) return Array.from({ length: count }, () => reps).join('·');
  return count > 3 ? `${reps} ×${count}` : reps;
}

/**
 * Display transform for the interpreted reading (design frames 05–09):
 * "3×5 80" → "80 kg · 5·5·5", "4×12 10" → "10 kg · 12 ×4", bodyweight
 * "3×10" → "10·10·10". Cardio/hold echoes ("4× 20 m", "60 s") already read
 * as data and pass through untouched. Pure display text — the parse itself
 * is never altered.
 */
export function readingText(echo: string, joiner = ' · '): string {
  const m = ECHO_RE.exec(echo.trim());
  if (!m) return echo;
  const scheme = repScheme(Number(m[1]), m[2]!);
  return m[3] != null ? `${m[3]} kg${joiner}${scheme}` : scheme;
}

/**
 * The reading's ink: interpreted echoes speak in `textSecondary`, comparisons
 * recede to `textMuted`, the PR label carries full `textPrimary`. NO lime —
 * the machine never celebrates here (record contract).
 */
export function signalTint(signal: GutterSignal): string {
  switch (signal.kind) {
    case 'set':
      return color.textSecondary;
    case 'pr':
      return color.textPrimary;
    default:
      return color.textMuted;
  }
}

/**
 * The record-contract tag (design brief): bordered mono ~9px label —
 * PLANNED / RECORDED / LAST SESSION vocabulary. Never lime, never filled.
 */
export function MonoTag({ label }: { label: string }) {
  return (
    <View style={styles.tag}>
      <Text style={styles.tagText} maxFontSizeMultiplier={MAX_FONT_SCALE}>
        {label}
      </Text>
    </View>
  );
}

/**
 * PR as a NEUTRAL outlined label (design frame 09): textPrimary ink and
 * border, radius 4. The achievement is stated, never celebrated with color —
 * no lime, no confetti, readable colorblind.
 *
 * `animate` opts the label into THE one sanctioned overshoot in the app
 * (CLAUDE.md §14): a single small scale bounce as it lands, reduceMotion-gated
 * to an instant appearance. The composer card sets it so a PR is *felt* at the
 * instant of logging; the gutter leaves it off (there the whole row already
 * animates the scale), keeping exactly one overshoot per PR.
 */
export function PrLabel({ animate = false }: { animate?: boolean }) {
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(animate && !reduceMotion ? PR_FROM : 1);

  useEffect(() => {
    if (!animate || reduceMotion) return;
    scale.value = PR_FROM;
    scale.value = withSequence(
      withTiming(PR_OVERSHOOT, { duration: 180, easing: Easing.out(Easing.cubic) }),
      withTiming(1, { duration: 120, easing: Easing.inOut(Easing.ease) }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animate, reduceMotion]);

  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={[styles.prLabel, style]}>
      <Text style={styles.prLabelText} maxFontSizeMultiplier={MAX_FONT_SCALE}>
        PR
      </Text>
    </Animated.View>
  );
}

export function GutterValue({
  signal,
  rowHeight,
  order = 0,
  revision = '',
}: {
  signal: GutterSignal | null;
  rowHeight: number;
  /** Rank within the parse sweep — drives the per-line stagger. */
  order?: number;
  /** Identity of the parse pass — a new revision replays the sweep. */
  revision?: string;
}) {
  const reduceMotion = useReducedMotion();
  const opacity = useSharedValue(0);
  const shift = useSharedValue(0);
  const scale = useSharedValue(1);

  // Replay only when the parse pass or this line's content actually changes —
  // never on unrelated keystrokes.
  const signature = signal ? `${revision}:${signalText(signal)}` : '';

  useEffect(() => {
    if (!signature || !signal) {
      opacity.value = 0;
      return;
    }
    if (reduceMotion) {
      opacity.value = 1;
      shift.value = 0;
      scale.value = 1;
      return;
    }
    const delay = order * STAGGER_MS;
    opacity.value = 0;
    shift.value = SETTLE_SHIFT;
    opacity.value = withDelay(
      delay,
      withTiming(1, { duration: SETTLE_MS, easing: Easing.out(Easing.cubic) }),
    );
    shift.value = withDelay(
      delay,
      withTiming(0, { duration: SETTLE_MS, easing: Easing.out(Easing.cubic) }),
    );
    if (signal.kind === 'pr') {
      scale.value = PR_FROM;
      scale.value = withDelay(
        delay,
        withSequence(
          withTiming(PR_OVERSHOOT, { duration: SETTLE_MS * 0.7, easing: Easing.out(Easing.cubic) }),
          withTiming(1, { duration: SETTLE_MS * 0.45, easing: Easing.inOut(Easing.ease) }),
        ),
      );
    } else {
      scale.value = 1;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, reduceMotion, order]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateX: shift.value }, { scale: scale.value }],
  }));

  // Occupy exactly the FIRST row of the line so the value stays pinned there
  // even when the left text wraps to more rows.
  if (!signal) return <View style={{ height: rowHeight }} />;

  return (
    <Animated.View style={[{ height: rowHeight }, styles.row, animatedStyle]}>
      {signal.kind === 'pr' ? (
        <PrLabel />
      ) : (
        <Text
          style={[styles.signal, { color: signalTint(signal) }]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.75}
          allowFontScaling
          maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {signal.kind === 'set' ? readingText(signal.text) : signalText(signal)}
        </Text>
      )}
    </Animated.View>
  );
}

/**
 * The "LAST TIME" hint — the most-quoted five-star feature in this category:
 * name an exercise (no numbers yet) and the gutter instantly shows last
 * session's top set, straight from local SQLite. It sits a full step quieter
 * than parse output (textMuted, not textSecondary) so it can't be mistaken
 * for a logged result, and vanishes the moment numbers appear on the line.
 */
export function GutterHint({ text, rowHeight }: { text: string; rowHeight: number }) {
  const reduceMotion = useReducedMotion();
  const opacity = useSharedValue(reduceMotion ? 1 : 0);

  useEffect(() => {
    if (reduceMotion) return;
    opacity.value = withTiming(1, { duration: SETTLE_MS, easing: Easing.out(Easing.cubic) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View style={[{ height: rowHeight }, styles.row, animatedStyle]}>
      <Text
        style={styles.hint}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
        allowFontScaling
        maxFontSizeMultiplier={MAX_FONT_SCALE}>
        {readingText(text)}
      </Text>
    </Animated.View>
  );
}

/**
 * The "analyzing" state: while a parse is in flight, each pending line shows a
 * three-dot wave — the universal "thinking" indicator — in the SAME place its
 * result will land. Dots light up one after another (0.25 → 0.8 opacity, in
 * the reading's quiet grey), so the working state is unmistakable without a
 * spinner, a toast, or a word. Under reduceMotion the dots hold still.
 */
const PENDING_DOT = 4.5;
const PENDING_MIN = 0.25;
const PENDING_MAX = 0.8;
export const PENDING_STEP_MS = 160;

export function PendingDot({
  delay,
  tint,
  size,
}: {
  delay: number;
  tint?: string;
  /** Diameter. Defaults to the gutter's own dot; the ⋯ column passes the
   * metrics of the glyph it is standing in for. */
  size?: number;
}) {
  const reduceMotion = useReducedMotion();
  const opacity = useSharedValue(PENDING_MIN);

  useEffect(() => {
    if (reduceMotion) {
      opacity.value = 0.45;
      return;
    }
    opacity.value = PENDING_MIN;
    opacity.value = withDelay(
      delay,
      withRepeat(
        withTiming(PENDING_MAX, { duration: 420, easing: Easing.inOut(Easing.ease) }),
        -1,
        true, // wave back down
      ),
    );
  }, [reduceMotion, delay, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[
        styles.pendingDot,
        tint ? { backgroundColor: tint } : null,
        size ? { width: size, height: size, borderRadius: size / 2 } : null,
        animatedStyle,
      ]}
    />
  );
}

/**
 * THE READ — what stands on a line between pressing return and the reading
 * coming back (owner's pick of four variants, 29 August 2026).
 *
 * TWO MARKS, ONE ROW, AND A DIVISION OF LABOUR:
 *
 * - **`ReadingSweep`** passes a band of the app's one blue across the WHOLE
 *   ROW the athlete just committed — rail to ⋯ column, edge to edge, behind
 *   everything on it. A light travelling the length of a line being read. It
 *   never dims the words, never moves them, and never fills a track: the parse
 *   is one round trip and there is no percentage here to be honest about (§5.1
 *   keeps a filled bar for things that were measured). A beat of stillness
 *   separates one pass from the next, so it reads as a line being read and
 *   then read again rather than as a strobe.
 *
 *   It crossed only the words until the owner saw it on 29 August 2026: a band
 *   the width of the text reads as a highlight ON a word, and what is being
 *   read is the whole entry. Full-row travel is also the only version that is
 *   legible at a glance — the band is now the width of a thumb rather than of
 *   a syllable.
 *
 * - **`ReadingDots`** is the machine's own working mark, and it is the SAME
 *   THREE DOTS the settled card carries as its ⋯ menu. While the line is being
 *   read they wave; when the reading lands they stop and that identical glyph
 *   is the button. Nothing new appears on the row, and nothing moves at the
 *   handover — which is the whole reason the mark is dots and not a spinner.
 *
 * Everything stays on ONE ROW, beside the words. An earlier pass put the
 * working state a line below, in the slot the reading itself would occupy;
 * the geometry was honest and the owner rejected the look on 29 August. The
 * line the athlete wrote is the line the app is working on, and that is where
 * the app says so.
 *
 * ## Reduce Motion
 *
 * Neither mark survives, and the state does. `ReadingSheen` renders its
 * children untouched, `ReadingDots` renders nothing at all — three still dots
 * would read as the ⋯ button, and a control that does nothing is worse than no
 * control — and the caller prints `ReadingWord` at the end of the same row
 * instead. The movement goes, the information does not (§14).
 */
/**
 * ## THE BLUE LINE (9 September 2026, owner: *"animation of processing like a
 * blue line"*)
 *
 * The band above is a light passing under the words, and on a device it is
 * felt more than seen — 16 % of the brand blue over warm paper is deliberately
 * at the edge of noticing, which was right for a mark that crosses the record
 * itself. What it was not is LEGIBLE: asked what the app is doing at that
 * moment, the band does not answer, and the three dots that answer it are the
 * size of a full stop.
 *
 * So the pass gains a second half, and it is one animation rather than two:
 * **the same `t` drives the band and a crisp brand-blue line along the row's
 * bottom edge**, so what crosses the entry is a beam with a bright leading
 * edge, not a band and a bar arguing about the beat. One clock, one direction,
 * one hold.
 *
 * **It is indeterminate, and it never fills.** §5.1 keeps a filled track for
 * things that were measured, and a parse is one round trip with no percentage
 * to be honest about — so the segment TRAVELS and leaves, over and over, the
 * way every indeterminate progress indicator on the platform does. Nothing on
 * this row ever shows a bar growing from the left, because that would be a
 * claim about how far along the reading is.
 *
 * The segment is a gradient with transparent ends for the same reason the band
 * is: the track clips (a crisp line has to, or it would run out into the page
 * gutter), and a hard edge meeting a clip reads as a chip sliding out from
 * under the row rather than as light travelling along it.
 */
/** The line's own thickness. Two points, not a hairline: a hairline in brand
 * blue on warm paper is a rumour, and this mark exists to be seen. */
const LINE_H = 2;
/** How much of the row the bright segment covers. */
const LINE_SEGMENT = 0.42;
const LINE_SEGMENT_MIN = moderateScale(88);
/**
 * The line's stops, PRECOMPUTED at module scope — `alpha()` may never be called
 * inside a worklet (design skill §Colour).
 */
const LINE_STOPS = [alpha(color.brand, 0), color.brand, alpha(color.brand, 0)] as const;
/**
 * The unlit rest of the line — the path the light is taking, and the one value
 * on this mark that was MEASURED rather than picked.
 *
 * It started at 14 %, which reads back off the simulator as `#D4E3F0` against a
 * `#F7F4ED` canvas: a line, plainly, and three pending entries stacked in a
 * receipt-mode dump turned the page into a table with rules — the exact thing
 * §Structure forbids between two records. At 8 % the beam still has something
 * continuous to travel along and the unlit part stops being a rule. It is only
 * ever on screen while a line is being read.
 */
const LINE_TRACK = alpha(color.brand, 0.08);
/** Reduce Motion keeps the line and drops the travel: the state survives, the
 * movement does not (§14). It sits between the track and the lit segment so it
 * is unmistakably ON without anything moving. */
const LINE_STILL = alpha(color.brand, 0.34);

/** Longer than a word-width sweep was: the band now crosses a whole row, and
 * the same duration over three times the distance reads as a flick. */
const SHEEN_MS = 1300;
/** The pause between passes. The band is off the right edge for all of it. */
const SHEEN_HOLD_MS = 400;
/** How far behind the row above a row starts its own pass. Capped at six rows
 * by the caller, like every other stagger in the app. */
const SHEEN_STAGGER_MS = 220;
/** A thumb's width of light, not a syllable's. */
const SHEEN_W = moderateScale(120);
/**
 * The band's stops, PRECOMPUTED at module scope — `alpha()` may never be
 * called inside a worklet (design skill §Colour), and these are props anyway.
 * The transparent ends carry the blue's own hue, so the band fades to nothing
 * rather than through a grey fringe.
 */
const SHEEN_STOPS = [alpha(color.brand, 0), alpha(color.brand, 0.16), alpha(color.brand, 0)] as const;
/**
 * The vertical veil, and the reason the light reads as a beam rather than as a
 * column. A `LinearGradient` fades in one direction only, so the band's top and
 * bottom edges arrive as straight lines the width of a thumb — and two pending
 * lines stacked in a ledger merged into a single tall bar, which was the first
 * thing visible on the device. Laying the canvas back over the band's own top
 * and bottom, fading to nothing across its middle, gives it the second axis:
 * full strength through the line's core, gone by its edges.
 *
 * It is `canvas` rather than a mask because there is nothing to mask with here
 * (no `MaskedView` in this app), and the flat token sits within 1.007:1 of the
 * `PaperField` gradient it is standing in for at any point on the page — a
 * difference no eye resolves, and one the design doc measured before allowing
 * the flat fill anywhere else.
 */
const VEIL_STOPS = [
  color.canvas,
  alpha(color.canvas, 0),
  alpha(color.canvas, 0),
  color.canvas,
] as const;
const VEIL_AT = [0, 0.3, 0.7, 1] as const;

/**
 * The clock both marks run on: one repeating 0 → 1 pass with a beat of
 * stillness after it, plus the row's measured width so the travel is as long as
 * the entry at any Dynamic Type setting and on any device width.
 *
 * Shared rather than duplicated because the band and the line are two halves of
 * ONE pass — two clocks would drift apart within a few repeats and the beam
 * would come apart into a band and a bar.
 */
function useSweepClock(order = 0) {
  const reduceMotion = useReducedMotion();
  const t = useSharedValue(0);
  const w = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    t.value = 0;
    t.value = withDelay(
      Math.min(order, 6) * SHEEN_STAGGER_MS,
      withRepeat(
      withSequence(
        withTiming(1, { duration: SHEEN_MS, easing: Easing.inOut(Easing.cubic) }),
        // Holding AT 1 — the band is already off the right edge, so the jump
        // back to 0 at the top of the next repeat happens out of sight.
        withTiming(1, { duration: SHEEN_HOLD_MS }),
      ),
      -1,
      false,
      ),
    );
  }, [reduceMotion, order, t]);

  const onLayout = (e: LayoutChangeEvent) => {
    w.value = e.nativeEvent.layout.width;
  };

  return { reduceMotion, t, w, onLayout };
}

/**
 * THE LINE ALONE — for a caller that has no words for a band to cross.
 *
 * The composer is that caller: while the line the athlete just typed is being
 * read, the words are still in the field above and §14 rules out moving
 * anything under a cursor mid-sentence. A light along the FOOT of the field is
 * not under the cursor and does not touch the text, so the composer gets the
 * legible half of the pass and none of the half that would break that rule.
 *
 * `inset` pulls the track in from the row's own edges — the composer's line
 * belongs to the field it sits under, not to the page.
 */
export function ReadingLine({ inset = 0 }: { inset?: number }) {
  const { reduceMotion, t, w, onLayout } = useSweepClock();

  const segment = useAnimatedStyle(() => {
    const width = Math.max(LINE_SEGMENT_MIN, w.value * LINE_SEGMENT);
    return {
      width,
      transform: [{ translateX: -width + t.value * (w.value + width) }],
    };
  });

  return (
    <View
      style={[styles.lineTrack, { left: inset, right: inset }]}
      pointerEvents="none"
      onLayout={onLayout}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      {reduceMotion ? (
        <View style={styles.lineStill} />
      ) : (
        <Animated.View style={[styles.lineSegment, segment]}>
          <LinearGradient
            colors={LINE_STOPS}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      )}
    </View>
  );
}

export function ReadingSweep({
  /**
   * This row's rank in the ledger. A dump commits several lines at once and
   * every card mounts on the same frame, so without a stagger three beams
   * travel in lockstep and the page flashes rather than reads — measured on the
   * simulator, 9 September 2026, with three pending entries.
   *
   * A beat per row is the same idea the gutter's own settle cascade already
   * uses one paragraph up: the analysis visibly WALKS DOWN THE PAGE, top to
   * bottom, in the order the athlete wrote it.
   */
  order = 0,
}: { order?: number } = {}) {
  const { reduceMotion, t, w, onLayout } = useSweepClock(order);

  const band = useAnimatedStyle(() => {
    // 0 at both ends, 1 in the middle. WITHOUT it the band meets the row's
    // clipped edge at full strength on the way in and on the way out, and a
    // hard-edged rectangle sliding out from under the ring reads as a chip
    // rather than as light — visible the moment it was screenshotted. With it
    // the light arrives from nothing, peaks over the middle of the entry, and
    // leaves into nothing, and the 400 ms hold sits at zero.
    const breath = Math.sin(t.value * Math.PI);
    return {
      opacity: breath,
      transform: [{ translateX: -SHEEN_W + t.value * (w.value + SHEEN_W) }],
    };
  });

  // The line's own travel: the same `t`, its own width, and a clip — so the
  // beam's bright edge runs the row while the soft band runs the words.
  const segment = useAnimatedStyle(() => {
    const width = Math.max(LINE_SEGMENT_MIN, w.value * LINE_SEGMENT);
    return {
      width,
      transform: [{ translateX: -width + t.value * (w.value + width) }],
    };
  });

  return (
    // BEHIND the row, and taking no touches: it is drawn first so every sibling
    // paints over it, and the words keep their own full ink.
    <View style={styles.sweepTrack} pointerEvents="none" onLayout={onLayout}>
      {reduceMotion ? null : (
        <Animated.View style={[styles.sweepBand, band]}>
          <LinearGradient
            colors={SHEEN_STOPS}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />
          <LinearGradient
            colors={VEIL_STOPS}
            locations={VEIL_AT}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      )}
      {/* The bright edge, on the row's own foot. Under Reduce Motion the band
          above is gone and this is a still blue line: the row still says it is
          being read, and nothing on the page moves. */}
      <View style={styles.lineTrack}>
        {reduceMotion ? (
          <View style={styles.lineStill} />
        ) : (
          <Animated.View style={[styles.lineSegment, segment]}>
            <LinearGradient
              colors={LINE_STOPS}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        )}
      </View>
    </View>
  );
}

/**
 * The ⋯ column's voice while the line is being read — the settled card's own
 * glyph, waving. Nothing under Reduce Motion; the caller prints the word.
 *
 * THE METRICS ARE THE GLYPH'S, measured off the rendered card rather than
 * taken from the gutter's dot: `Icon`'s ellipsis at 17 pt draws three ~3 pt
 * dots on a ~3 pt pitch, and the gutter's own 4.5 pt dot on a 4.5 pt pitch
 * made this mark twice the width of the thing it becomes. Two dots' worth of
 * shift at the handover is exactly the movement this card exists to avoid.
 */
const GLYPH_DOT = moderateScale(3);

export function ReadingDots() {
  const reduceMotion = useReducedMotion();
  if (reduceMotion) return null;
  return (
    <View style={styles.dotsRow}>
      <PendingDot delay={0} tint={color.textMuted} size={GLYPH_DOT} />
      <PendingDot delay={PENDING_STEP_MS} tint={color.textMuted} size={GLYPH_DOT} />
      <PendingDot delay={PENDING_STEP_MS * 2} tint={color.textMuted} size={GLYPH_DOT} />
    </View>
  );
}

/** The state in a word — what the row says when the marks are not allowed to
 * move. Exported for the composer, which has its own column to place it in. */
export function ReadingWord({ label = 'reading' }: { label?: string }) {
  return (
    <Text style={styles.readingWord} maxFontSizeMultiplier={MAX_FONT_SCALE}>
      {label}
    </Text>
  );
}

/**
 * THE ROW'S WHOLE ANSWER TO "what is happening here", and the only thing a
 * caller should mount: the waving dots in the ⋯ column's slot, or the word when
 * motion is off.
 *
 * ONE HOOK DECIDES BOTH. Before this, the marks read `useReducedMotion()`
 * themselves while the card chose the word from a `reduceMotion` prop passed
 * down from its parent. In production those two agree, because the prop comes
 * from the same hook — but the simulator showed what happens when they do not:
 * with Reduce Motion on and the prop still false, the dots vanished, the word
 * never rendered, and the row said NOTHING while the app was working. A
 * silent working state is the one failure this component cannot be allowed,
 * so the decision now lives in exactly one place.
 */
export function ReadingMark() {
  const reduceMotion = useReducedMotion();
  if (reduceMotion) return <ReadingWord />;
  return (
    <View style={styles.markSlot}>
      <ReadingDots />
    </View>
  );
}

export function GutterPending({ rowHeight }: { rowHeight: number }) {
  return (
    <View style={[{ height: rowHeight }, styles.row]}>
      <View style={styles.pendingRow}>
        <PendingDot delay={0} />
        <PendingDot delay={PENDING_STEP_MS} />
        <PendingDot delay={PENDING_STEP_MS * 2} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  signal: {
    ...readingStyle('500'),
    fontSize: READING_FONT_SIZE, // a step below the written ink (frame 06)
    lineHeight: NOTE_LINE_HEIGHT, // shares the note's baseline grid
    letterSpacing: 0.2,
    color: color.textSecondary,
  },
  hint: {
    ...readingStyle('400'),
    fontSize: READING_FONT_SIZE,
    lineHeight: NOTE_LINE_HEIGHT,
    letterSpacing: 0.2,
    color: color.textMuted, // a memory, not a result
  },
  pendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: PENDING_DOT,
    height: NOTE_LINE_BOX, // a VIEW on the note's grid, so it scales itself
  },
  pendingDot: {
    width: PENDING_DOT,
    height: PENDING_DOT,
    borderRadius: PENDING_DOT / 2,
    backgroundColor: color.textSecondary,
  },
  /**
   * The track the band runs along: the whole row, edge to edge, absolutely
   * placed so it costs the layout nothing and the row measures exactly as it
   * would without it.
   *
   * DELIBERATELY NOT CLIPPED. A clip is the obvious thing to reach for and it
   * is what made the first build read as a chip: while any part of the band
   * was outside the row, the clip cut it down the middle and printed a hard
   * vertical edge against the canvas — a rectangle sliding out from under the
   * ring rather than a light crossing a line. Uncut, the band starts a band's
   * width off the row and ends a band's width past it, so its own soft ends
   * are the only edges the eye ever meets. It is one row tall, so it cannot
   * stray onto the record above or below.
   */
  sweepTrack: {
    ...StyleSheet.absoluteFill,
  },
  /** No radius and no clip: the veil above softens all four edges to nothing,
   * so there are no corners left to round. */
  sweepBand: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: SHEEN_W,
  },
  /**
   * The blue line's track: the row's own foot, and the one thing on this
   * component that IS clipped.
   *
   * The band gets away without a clip because its ends fade to nothing before
   * they reach the row's edge; a crisp line has no such ends, so uncut it would
   * run out into the page gutter and under the record above and below. Clipping
   * is safe here for the same reason the band's soft ends were needed there —
   * the segment is a gradient that arrives and leaves as nothing, so the eye
   * never meets the cut.
   *
   * The faint track is the path the light is taking. It carries the brand at
   * 14 %, which is a mark and not a rule: a hairline between two records is
   * exactly what the design skill's §Structure forbids, and this one only
   * exists while a line is being read.
   */
  lineTrack: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: LINE_H,
    borderRadius: LINE_H / 2,
    overflow: 'hidden',
    backgroundColor: LINE_TRACK,
  },
  lineSegment: {
    position: 'absolute',
    top: 0,
    bottom: 0,
  },
  /** Reduce Motion: the line, lit, holding still. */
  lineStill: {
    ...StyleSheet.absoluteFill,
    backgroundColor: LINE_STILL,
  },
  /** The dots as the ⋯ column wears them: no row height of its own, so it
   * centres inside the 36 pt box the menu glyph will occupy. */
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: GLYPH_DOT,
  },
  /**
   * The ⋯ column's own width, so the dots' x is the glyph's x. No height: the
   * row centres the slot on the words' own line.
   *
   * `flex-end` since 9 September 2026, and it is the same change the settled
   * card's `sideBtn` took in the same pass: the glyph is aligned by its INK,
   * not by its box, so the mark and the ⋯ it becomes both end on the page's
   * right margin — where the dateline's session count already ended. Centred in
   * 36 pt they both stopped 10 pt short of it.
   */
  markSlot: {
    width: moderateScale(36),
    alignItems: 'flex-end',
    // The settled ⋯ is an SF glyph and carries a 1 pt side bearing its own box
    // does not; these dots are a plain view and carry none. Without this the
    // mark and the menu it becomes end 1 pt apart, and the whole reason this
    // card is shaped like the settled one is that NOTHING moves at the
    // handover.
    paddingRight: 1,
  },
  /** The state in a word — the reading's face at the comparison line's size,
   * muted, because it reports the app's state and never a value. */
  readingWord: {
    ...readingStyle('400'),
    fontSize: READING_FONT_SIZE,
    letterSpacing: 0.6,
    color: color.textMuted,
  },
  // No alignSelf: the tag centers in row headers and gets a row wrapper in
  // column layouts so the border always hugs the text.
  tag: {
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: TAG_RADIUS,
    borderCurve: 'continuous',
    paddingHorizontal: TAG_PAD_H,
    paddingVertical: TAG_PAD_V,
  },
  tagText: {
    ...readingStyle('500'),
    fontSize: moderateScale(9),
    letterSpacing: 1.2,
    color: color.textSecondary,
  },
  prLabel: {
    borderWidth: 1,
    borderColor: color.textPrimary,
    borderRadius: TAG_RADIUS,
    borderCurve: 'continuous',
    paddingHorizontal: TAG_PAD_H,
    paddingVertical: TAG_PAD_V,
  },
  prLabelText: {
    ...readingStyle('500'),
    fontSize: moderateScale(9),
    letterSpacing: 1,
    color: color.textPrimary,
  },
});
