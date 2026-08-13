import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/icon';
import { FadeSlideIn, PressableScale, Stagger } from '@/components/motion';
import { BriefFooter, BriefLede } from '@/components/next/brief';
import { SECTION_GAP } from '@/components/next/section';
import { NextSession } from '@/components/next/session';
import { Signals } from '@/components/next/signals';
import { NextSkeleton } from '@/components/next/skeleton';
import { SplitChips } from '@/components/next/split-chips';
import { getCachedBriefSummary, refineBriefSummary } from '@/lib/brief-explain';
import { briefDateline, briefProse } from '@/lib/brief-prose';
import { buildBrief, planDayLines, type Brief } from '@/lib/db/brief';
import { todayKey } from '@/lib/db/dates';
import { listPlanDays, resolveTodayPlanDay } from '@/lib/db/plan';
import { markBriefShown } from '@/lib/funnel';
import { tap } from '@/lib/haptics';
import { devWarn } from '@/lib/log';
import { buildSections, sessionRowsOf } from '@/lib/next/sections';
import {
  color,
  hairline,
  lineFor,
  MAX_FONT_SCALE,
  moderateScale,
  radius,
  readingStyle,
  spacing,
  TAB_BAR_CLEARANCE,
  type,
} from '@/lib/theme';
import { useSession } from '@/state/session-store';

/**
 * Next — "What am I doing next?" (owner, 28 July 2026; rebuilt 13 August).
 *
 * §16 names the prediction as the single strongest retention mechanism in the
 * product: *a reason to open the app on a training day that exists before the
 * user has done anything.*
 *
 * WHAT THIS IS NOT. The owner's first shape for it was "an AI summary you use
 * as a plan". That breaks three standing rules at once: §1.1 invariant 3 (a
 * model never picks a weight), §20 ("we never tell someone what to train, only
 * what to beat"), and the Terms, which say in as many words that Recore is a
 * calculation and not coaching. So **every figure on this screen is computed**
 * (`db/brief.ts` + the pure engine), and the only text a model may touch is the
 * prose that `explain-brief` is already allowed to REWRITE — never to author
 * (§9.1). Same history, same briefing, every time, offline.
 *
 * ## The 13 August rebuild
 *
 * The August 12 pass fixed what the page SAID. This one fixes what it looked
 * like, and the diagnosis was one sentence: **four raised cards of equal weight
 * and no focal point.** The brief was a card, the session was a card, the two
 * evidence blocks were cards with the identical row shape, and the number a
 * lifter actually opens this tab for — the load — was 19 pt, three cards down,
 * smaller than the headline of a paragraph they had already read.
 *
 * The page is now one editorial column on paper with exactly ONE raised
 * surface:
 *
 *   1. title + dateline, with a scroll-edge hairline that fades in only once
 *      content is actually under it (never a permanent divider);
 *   2. the LEDE — the brief's one or two lines, on bare paper (§9's "short
 *      briefing paragraph", finally short);
 *   3. the SESSION — the first lift on the one raised card, its load at 30 pt
 *      and the engine's decision above it as a filled pill; the rest of the
 *      session as plain rows underneath;
 *   4. SIGNALS — the old "standing still" and "moving" cards, which were one
 *      table split in two, as a single horizontally-scrolling strip of tiles;
 *   5. the full brief behind one disclosure, its provenance, and All lifts.
 *
 * Vertical rhythm carries the hierarchy now, so a section with nothing true to
 * say is still ABSENT rather than an empty header (§1.1 invariant 6) and the
 * page above it does not move.
 *
 * This file assembles; it decides nothing. Every placement rule lives in the
 * pure module (`lib/next/sections.ts`) or in one section component.
 */
export default function Next() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const userId = useSession((s) => s.userId);
  const [refresh, setRefresh] = useState(0);

  // Re-read on focus: a session finished on Today changes every block here.
  useFocusEffect(
    useCallback(() => {
      setRefresh((n) => n + 1);
    }, []),
  );

  /* eslint-disable react-hooks/exhaustive-deps */
  const brief: Brief | null = useMemo(() => (userId ? buildBrief(userId) : null), [userId, refresh]);
  /* eslint-enable react-hooks/exhaustive-deps */

  const prose = brief ? briefProse(brief) : '';

  // The model-written upgrade (§9.1): the composed paragraph is ready
  // instantly; a validated rewrite swaps in when it lands — late or never, and
  // never blocking anything. Cached per paragraph, so a stable brief costs one
  // call ever.
  const [summary, setSummary] = useState<string | null>(() =>
    prose ? getCachedBriefSummary(prose) : null,
  );
  useEffect(() => {
    const cached = prose ? getCachedBriefSummary(prose) : null;
    setSummary(cached);
    if (!prose) return;
    // §9.3's fallback-rate counters: which phrasing was actually on screen. An
    // upgrade mid-look counts once in each column, truthfully.
    markBriefShown(cached ? 'model' : 'composed');
    refineBriefSummary(prose, (s) => {
      setSummary(s);
      markBriefShown('model');
    });
  }, [prose]);

  // Where every placement rule on this page lives. `devWarn` is how a refused
  // e1RM delta reaches a developer without reaching the athlete.
  const sections = useMemo(
    () => (brief ? buildSections(brief, { phrased: summary != null, warn: devWarn }) : null),
    [brief, summary],
  );

  /**
   * THE SPLIT PREVIEW (13 Aug). Next has only ever shown the day the athlete is
   * due for; the chips let them look at another day of their own split and see
   * what it would ask of them, computed by the same `planStripFor` the real
   * strip runs on.
   *
   * Looking is not answering: selecting a chip writes nothing and does not move
   * which day is due. That stays the session-start card's job (§8.2).
   */
  /* eslint-disable react-hooks/exhaustive-deps */
  const planDays = useMemo(() => (userId ? listPlanDays(userId) : []), [userId, refresh]);
  const dueId = useMemo(
    () => (userId ? (resolveTodayPlanDay(userId, todayKey())?.id ?? null) : null),
    [userId, refresh],
  );
  /* eslint-enable react-hooks/exhaustive-deps */

  const [previewId, setPreviewId] = useState<string | null>(null);
  // A day deleted in /split while this screen was open must not leave a chip
  // selected that no longer exists.
  const previewDay =
    previewId && previewId !== dueId ? (planDays.find((d) => d.id === previewId) ?? null) : null;
  const dueLabel = planDays.find((d) => d.id === dueId)?.label ?? null;

  const preview = useMemo(() => {
    if (!userId || !previewDay || !brief) return null;
    // The same stalls the due day folds in, so a plateau reads identically
    // whichever day names the lift. No ghost sentence: it belongs to the
    // session actually due, and attaching it here would be a fabrication.
    const { rows } = sessionRowsOf(planDayLines(userId, previewDay), brief.stalls, null);
    return { title: previewDay.label, rows };
  }, [userId, previewDay, brief]);

  const hasAnything =
    sections != null &&
    brief != null &&
    (sections.sessionRows.length > 0 ||
      sections.standing.length > 0 ||
      sections.moving.length > 0 ||
      brief.notes.length > 0 ||
      sections.adherenceChip != null);

  /**
   * The scroll-edge rule. Apple's own guidance for floating chrome is to fade a
   * separator in where content actually meets it rather than to draw a
   * permanent divider — so the header is a clean title until something is
   * underneath it, and the line arrives over the first 12 pt of travel.
   *
   * Opacity only, on the UI thread. Nothing here moves, so there is nothing for
   * Reduce Motion to take away.
   */
  const y = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    y.value = e.contentOffset.y;
  });
  const edgeStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, Math.max(0, y.value / 12)),
  }));

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.nav}>
        <Text
          style={styles.navTitle}
          accessibilityRole="header"
          maxFontSizeMultiplier={MAX_FONT_SCALE}>
          Next
        </Text>
        <Text style={styles.dateline} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {briefDateline(new Date())}
        </Text>
        <Animated.View style={[styles.edge, edgeStyle]} pointerEvents="none" />
      </View>

      <Animated.ScrollView
        style={styles.scroll}
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={[
          styles.content,
          // The All lifts row is the last thing on the page and has to sit
          // ENTIRELY above the floating tab bar, not under its glass.
          { paddingBottom: insets.bottom + TAB_BAR_CLEARANCE + spacing.xxxl },
        ]}
        showsVerticalScrollIndicator={false}>
        {!sections ? (
          // No account resolved yet — the record is still being opened. The one
          // thing this must not do is show the empty state, which is a real
          // claim about an empty record rather than a way to pass the time.
          <NextSkeleton />
        ) : !hasAnything ? (
          // §15: an empty screen invites an action, it never reports a lack.
          <FadeSlideIn>
            <Text style={styles.emptyTitle} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              Write two sessions and this fills itself.
            </Text>
            <Text style={styles.emptyBody} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              A prescription needs prior sets of the same lift. Until there are some, Recore has
              nothing true to put here — so it puts nothing.
            </Text>
          </FadeSlideIn>
        ) : (
          <Stagger initialDelay={60} step={70} distance={12}>
            <View style={styles.lede}>
              <BriefLede headline={sections.headline} adherence={sections.adherenceChip} />
            </View>

            {planDays.length >= 2 ? (
              <View style={styles.chips}>
                <SplitChips
                  days={planDays}
                  activeId={previewDay?.id ?? dueId}
                  dueId={dueId}
                  onSelect={(id) => {
                    tap();
                    setPreviewId(id === dueId ? null : id);
                  }}
                />
              </View>
            ) : null}

            {/* Keyed on the day so switching replays the lever's spring — the
                one element on the card that actually changed. */}
            {preview ? (
              preview.rows.length > 0 ? (
                <View style={styles.section}>
                  <NextSession
                    key={previewDay?.id}
                    title={preview.title}
                    rows={preview.rows}
                    note={null}
                    footNote={
                      dueLabel
                        ? `A look ahead. Today reads as ${dueLabel}.`
                        : 'A look ahead — not the session you are due for.'
                    }
                  />
                </View>
              ) : (
                <View style={styles.section}>
                  <Text style={styles.previewEmpty} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                    {`Nothing to progress on ${preview.title} yet. These movements need one logged session each before Recore can say what beats them.`}
                  </Text>
                </View>
              )
            ) : sections.sessionRows.length > 0 ? (
              <View style={styles.section}>
                <NextSession
                  key={dueId ?? 'due'}
                  title={sections.sessionTitle}
                  rows={sections.sessionRows}
                  note={sections.sessionNote}
                />
              </View>
            ) : null}

            {sections.standing.length > 0 || sections.moving.length > 0 ? (
              <View style={styles.section}>
                <Signals standing={sections.standing} moving={sections.moving} />
              </View>
            ) : null}

            <View style={styles.section}>
              <BriefFooter
                prose={summary ?? prose}
                proseKey={summary ? 'model' : 'composed'}
                provenance={sections.provenance}
              />
            </View>

            {/* Lifts moved out of the tab bar to make room for this screen. It
                is one tap away, not gone. */}
            <PressableScale
              onPress={() => {
                tap();
                router.push('/lifts');
              }}
              haptic="none"
              activeScale={0.99}
              accessibilityRole="button"
              accessibilityLabel="All lifts"
              style={styles.liftsRow}
              pressedStyle={styles.pressed}>
              <Text style={styles.liftsLabel} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                All lifts
              </Text>
              <Icon name="chevron-forward" size={moderateScale(14)} tint={color.textMuted} />
            </PressableScale>
          </Stagger>
        )}
      </Animated.ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: color.bg,
  },
  nav: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  navTitle: {
    ...type.title2,
    color: color.textPrimary,
  },
  dateline: {
    ...readingStyle('400'),
    fontSize: type.footnote.fontSize,
    color: color.textMuted,
  },
  /** The scroll edge — absent at rest, faded in once content is under it. */
  edge: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: hairline,
    backgroundColor: color.divider,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  /** The lede sits closer to the session than sections do to each other: it is
   * the standfirst OF that card, not a block of its own. */
  lede: {
    marginBottom: spacing.xl,
    paddingHorizontal: spacing.xs,
  },
  /** ONE gap between sections, everywhere on the page. Sections that render
   * nothing are not wrapped at all, so a hidden block never leaves a double gap
   * behind it. */
  section: {
    marginBottom: SECTION_GAP,
  },
  /** The chips belong TO the card under them, so they sit closer than a
   * section gap — proximity is what says "this switches that". */
  chips: {
    marginBottom: spacing.md,
  },
  previewEmpty: {
    ...type.subhead,
    lineHeight: lineFor(22),
    color: color.textSecondary,
  },
  liftsRow: {
    minHeight: moderateScale(52),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.divider,
    backgroundColor: color.surface,
  },
  pressed: {
    backgroundColor: color.surfaceHigh,
  },
  liftsLabel: {
    ...type.subhead,
    fontWeight: '600',
    color: color.textPrimary,
  },
  emptyTitle: {
    marginTop: spacing.xxl,
    ...type.title2,
    color: color.textPrimary,
  },
  emptyBody: {
    marginTop: spacing.md,
    ...type.subhead,
    lineHeight: lineFor(23),
    color: color.textSecondary,
  },
});
