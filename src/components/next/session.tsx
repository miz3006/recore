import { useCallback, useEffect, useState } from 'react';
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
import { whenLabel } from '@/lib/brief-prose';
import { todayKey } from '@/lib/db/dates';
import { tap } from '@/lib/haptics';
import { DUR, EASE, SPRING } from '@/lib/motion';
import type { MoveLabel, SessionRow } from '@/lib/next/sections';
import { fmtNumber } from '@/lib/parse/summarize';
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

import { SectionEyebrow } from './section';

/**
 * THE SESSION — and, at the top of it, the one thing this whole tab exists to
 * answer: **what goes on the bar.**
 *
 * ## Why this was rebuilt (13 Aug 2026)
 *
 * The 12 August build got the CONTENT right and the hierarchy wrong. Every row
 * of the session lived inside a card that looked exactly like the brief card
 * above it and the two evidence cards below it: four raised surfaces of equal
 * weight, one repeated row shape, and the number a lifter carries to a rack set
 * at 19 pt — smaller than the headline of a paragraph they had already read.
 * Apple's own rule for this is one line long: use order, spacing and contrast so
 * *the most important thing is the most obvious*. Nothing on that page was.
 *
 * So the page now has exactly ONE raised surface and this is it. The first lift
 * of the session gets the whole card, its load set at 30 pt in the reading face,
 * and the engine's decision sits above that load as a filled pill you cannot
 * miss from arm's length — which is the distance this screen is actually read
 * from. The rest of the session follows as plain rows on paper: same
 * information, one level quieter, no second box.
 *
 *     ┌──────────────────────────────┐
 *     │ FIRST UP              best 120│
 *     │ Bench press                   │
 *     │ ┏━━━━━━━━━━┓                  │
 *     │ ┃ ADD A REP┃  ← the decision  │
 *     │ ┗━━━━━━━━━━┛                  │
 *     │ 82.5 kg × 5·5·5   ← the load  │
 *     │ was 3×5 120                ⌄  │
 *     └──────────────────────────────┘
 *       Incline press   ADD 2.5 KG  60 × 8·8·8   ⌄
 *       Row             HOLD        70 × 10·10   ⌄
 *
 * ## The lever is a filled pill now, and the contrast is why
 *
 * It was green TEXT on paper (4.78:1). That reads as a caption, and the whole
 * point of the label is that it answers the question every review of this
 * category converges on — *"you don't know whether to add weight or reps this
 * week"* — from across a gym.
 *
 * A filled pill was rejected in August because the tested version was green
 * text on a green WASH, which measured 4.33:1 and failed §14.3's AA contract.
 * Solid fill with a WHITE label is a different measurement and it passes:
 * **white on `signal` #547C00 is 4.93:1, white on `attention` #B45309 is
 * 5.02:1.** Both clear AA for normal text, and the label is 10.5 pt bold.
 *
 * Green stays what it has always been — a decision about a load not yet lifted
 * — and the load itself stays ink, because a number someone carries to a rack
 * is the last thing that should be tinted.
 *
 * ## What is one tap down
 *
 * The WHY sentence and the WATCH consequence. The decision is needed every
 * session; the arithmetic behind it is not (progressive disclosure, two levels
 * total). The chevron earns its place because it says something no other pixel
 * says: there is more under this.
 */
export function NextSession({
  title,
  rows,
  note,
  footNote,
  onExpand,
}: {
  title: string;
  rows: SessionRow[];
  /** The ghost's sentence when no row claimed it. */
  note: string | null;
  /** Overrides the closing line. The split preview uses it to say, in words,
   * that this is not the day you are due for — a screen showing one session's
   * loads under another session's name has to admit it. */
  footNote?: string;
  onExpand?: (key: string) => void;
}) {
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set());

  const toggle = useCallback(
    (key: string) => {
      tap();
      setOpen((prev) => {
        const next = new Set(prev);
        if (next.has(key)) next.delete(key);
        else {
          next.add(key);
          onExpand?.(key);
        }
        return next;
      });
    },
    [onExpand],
  );

  if (rows.length === 0) return null;

  // The hero is rows[0] and never a "best" row chosen by ranking: plan order is
  // session order, and promoting the third lift because it has a nicer number
  // would misdescribe the session the athlete is about to do.
  const [hero, ...rest] = rows;
  const heroKey = hero!.key || '0';

  return (
    <View>
      <SectionEyebrow>{title}</SectionEyebrow>

      {note ? (
        <Text style={styles.note} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {note}
        </Text>
      ) : null}

      <Hero row={hero!} expanded={open.has(heroKey)} onToggle={() => toggle(heroKey)} />

      {rest.length > 0 ? (
        <View style={styles.rest}>
          {rest.map((row, i) => {
            const key = row.key || String(i + 1);
            return (
              <RestRow
                key={row.key || `${row.name}:${i}`}
                row={row}
                first={i === 0}
                expanded={open.has(key)}
                onToggle={() => toggle(key)}
              />
            );
          })}
        </View>
      ) : null}

      <Text style={styles.foot} maxFontSizeMultiplier={MAX_FONT_SCALE}>
        {footNote ?? 'Nothing counts until you lift it. Write what you actually do.'}
      </Text>
    </View>
  );
}

/**
 * The decision, as a filled pill. It SPRINGS in on mount rather than fading:
 * the lever is the one element on the page that changes between sessions, and a
 * thing that arrives with a little weight reads as new information rather than
 * as part of the furniture. Reduce Motion places it.
 */
function Lever({ move, large }: { move: MoveLabel; large?: boolean }) {
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
        large && styles.leverLarge,
        move.tone === 'attention' ? styles.leverAttention : styles.leverSignal,
        animatedStyle,
      ]}>
      <Text style={styles.leverText} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
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
      <Icon name="chevron-down" size={moderateScale(15)} tint={color.textMuted} />
    </Animated.View>
  );
}

/** WHY and WATCH — the level below the decision, shared by the hero and the
 * plain rows so one lift never explains itself two ways. */
function Detail({ row }: { row: SessionRow }) {
  return (
    <FadeSlideIn distance={4}>
      <View style={styles.panel}>
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
    </FadeSlideIn>
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

function Hero({
  row,
  expanded,
  onToggle,
}: {
  row: SessionRow;
  expanded: boolean;
  onToggle: () => void;
}) {
  const expandable = Boolean(row.why || row.watch);

  const body = (
    <View style={styles.heroBody}>
      <View style={styles.heroTop}>
        <SectionEyebrow style={styles.heroEyebrow}>First up</SectionEyebrow>
        {row.bestKg != null ? (
          <Text style={styles.best} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {`best ${fmtNumber(row.bestKg)}`}
          </Text>
        ) : null}
      </View>

      <Text style={styles.heroName} numberOfLines={2} maxFontSizeMultiplier={MAX_FONT_SCALE}>
        {row.name}
      </Text>

      {row.move ? (
        <View style={styles.leverRow}>
          <Lever move={row.move} large />
        </View>
      ) : null}

      {row.prescription ? (
        // The load, at the top of the type scale. Everything above it is a
        // label for it and everything below it is a comparison against it.
        <Text
          style={styles.heroLoad}
          numberOfLines={2}
          maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {row.prescription}
        </Text>
      ) : null}

      <View style={styles.heroFoot}>
        {row.last ? (
          <Text style={styles.was} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {`was ${row.last}`}
          </Text>
        ) : (
          <View style={styles.flex} />
        )}
        {expandable ? <Chevron open={expanded} /> : null}
      </View>

      {expanded ? <Detail row={row} /> : null}
      <Quote row={row} />
    </View>
  );

  if (!expandable) return <View style={styles.hero}>{body}</View>;

  return (
    <PressableScale
      onPress={onToggle}
      haptic="none"
      activeScale={0.995}
      accessibilityRole="button"
      accessibilityState={{ expanded }}
      accessibilityLabel={`${row.name}${row.prescription ? `, next ${row.prescription}` : ''}`}
      accessibilityHint={expanded ? 'Hides the reason' : 'Shows why this load was set'}
      style={styles.hero}
      pressedStyle={styles.heroPressed}>
      {body}
    </PressableScale>
  );
}

/** A lift after the first: the same three facts on one line of paper. No card —
 * the session already has one, and it is above this. */
function RestRow({
  row,
  first,
  expanded,
  onToggle,
}: {
  row: SessionRow;
  first: boolean;
  expanded: boolean;
  onToggle: () => void;
}) {
  const expandable = Boolean(row.why || row.watch);

  const body = (
    <View style={styles.restBody}>
      <View style={styles.restTop}>
        <Text style={styles.restName} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {row.name}
        </Text>
        {row.prescription ? (
          <Text style={styles.restLoad} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {row.prescription}
          </Text>
        ) : null}
        {expandable ? <Chevron open={expanded} /> : null}
      </View>
      <View style={styles.restMeta}>
        {row.move ? <Lever move={row.move} /> : null}
        {row.last ? (
          <Text style={styles.was} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {`was ${row.last}`}
          </Text>
        ) : null}
      </View>
      {expanded ? <Detail row={row} /> : null}
      <Quote row={row} />
    </View>
  );

  return (
    <>
      {first ? null : <View style={styles.rule} />}
      {expandable ? (
        <PressableScale
          onPress={onToggle}
          haptic="none"
          activeScale={1}
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          accessibilityLabel={`${row.name}${row.prescription ? `, next ${row.prescription}` : ''}`}
          accessibilityHint={expanded ? 'Hides the reason' : 'Shows why this load was set'}
          pressedStyle={styles.restPressed}>
          {body}
        </PressableScale>
      ) : (
        body
      )}
    </>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  // THE one raised surface on the page.
  hero: {
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.divider,
    borderRadius: radius.xxl,
    ...shadow.raised,
  },
  heroPressed: {
    backgroundColor: color.surfaceHigh,
  },
  heroBody: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xl,
    gap: spacing.sm,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  heroEyebrow: {
    marginBottom: 0,
  },
  best: {
    ...readingStyle('400'),
    fontSize: type.footnote.fontSize,
    color: color.textMuted,
  },
  heroName: {
    ...type.title2,
    color: color.textPrimary,
  },
  leverRow: {
    flexDirection: 'row',
    marginTop: spacing.xs,
  },
  /**
   * The load. 30 pt in the reading face with tabular figures — the largest
   * thing on the screen, and deliberately larger than the tab title above it.
   * Ink, never tinted: this is the number that goes on the bar.
   */
  heroLoad: {
    ...readingStyle('700'),
    fontSize: moderateScale(30),
    lineHeight: lineFor(36),
    letterSpacing: -0.5,
    color: color.textPrimary,
  },
  heroFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    minHeight: moderateScale(20),
  },
  was: {
    ...readingStyle('400'),
    fontSize: type.footnote.fontSize,
    color: color.textMuted,
  },
  // The lever. White on a solid fill — 4.93:1 on signal, 5.02:1 on attention.
  lever: {
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 4,
  },
  leverLarge: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  leverSignal: {
    backgroundColor: color.signal,
  },
  leverAttention: {
    backgroundColor: color.attention,
  },
  leverText: {
    ...readingStyle('700'),
    fontSize: moderateScale(10.5),
    lineHeight: lineFor(13),
    letterSpacing: 1.2,
    color: '#FFFFFF',
  },
  // The rest of the session: paper, hairlines, no second card.
  rest: {
    marginTop: spacing.lg,
  },
  rule: {
    height: hairline,
    backgroundColor: color.divider,
  },
  restBody: {
    paddingVertical: spacing.md,
    gap: spacing.xs,
  },
  restPressed: {
    backgroundColor: color.surfaceHigh,
  },
  restTop: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.md,
  },
  restName: {
    ...type.subhead,
    fontWeight: '600',
    color: color.textPrimary,
    flexShrink: 1,
  },
  restLoad: {
    flex: 1,
    textAlign: 'right',
    ...readingStyle('600'),
    fontSize: moderateScale(16),
    color: color.textPrimary,
  },
  restMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  panel: {
    marginTop: spacing.xs,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: color.bg,
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
  // The ghost's sentence when it names no row on the card — a section-level
  // lede, never attributed to a lift it does not mention.
  note: {
    marginBottom: spacing.md,
    ...type.footnote,
    lineHeight: lineFor(18),
    color: color.textSecondary,
  },
  quote: {
    marginTop: spacing.xs,
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
  foot: {
    marginTop: spacing.md,
    ...type.footnote,
    color: color.textMuted,
  },
});
