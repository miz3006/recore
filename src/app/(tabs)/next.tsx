import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/icon';
import { FadeSlideIn, FadeSwap, PressableScale, Stagger } from '@/components/motion';
import { Eyebrow } from '@/components/primitives';
import { getCachedBriefSummary, refineBriefSummary } from '@/lib/brief-explain';
import { briefDateline, briefProse, splitLede } from '@/lib/brief-prose';
import { buildBrief, type Brief } from '@/lib/db/brief';
import { markBriefShown } from '@/lib/funnel';
import { tap } from '@/lib/haptics';
import { fmtNumber } from '@/lib/parse/summarize';
import {
  color,
  fonts,
  hairline,
  MAX_FONT_SCALE,
  moderateScale,
  monoText,
  radius,
  shadow,
  spacing,
  TAB_BAR_CLEARANCE,
  type,
} from '@/lib/theme';
import { useSession } from '@/state/session-store';

/**
 * Next — "What am I doing next?" (owner, 28 July 2026).
 *
 * §16 names the prediction as the single strongest retention mechanism in the
 * product: *a reason to open the app on a training day that exists before the
 * user has done anything.* It had no door of its own — a thin strip on Today
 * and a card under the composer. This is the door. It took the Lifts tab's
 * place; Lifts is one tap deeper, from Progress, because "how is my bench
 * going" is a question you ask occasionally and "what am I doing next" is one
 * you ask every training day.
 *
 * WHAT THIS IS NOT. The owner's first shape for it was "an AI summary you use
 * as a plan". That is a different product and it breaks three standing rules at
 * once: §1.1 invariant 3 (a model never picks a weight), §20 ("a programme
 * generator — we never tell someone what to train, only what to beat"), and the
 * Terms of Use, which say in as many words that Recore is a calculation and not
 * coaching. It would also destroy the one number no competitor publishes: you
 * cannot measure "followed 7 of the last 9" against a plan that changes its
 * mind.
 *
 * So **every figure on this screen is computed** (`db/brief.ts` + the pure
 * engine), and the only text a model may touch is the headline sentence, which
 * `explain-prediction` is already allowed to REWRITE — never to author (§8.3).
 * Same history, same briefing, every time, offline.
 *
 * THE BRIEFING leads (owner, 28 July; re-formed 30 July to product-direction
 * §9): a dated editorial card — the "YOUR BRIEF" label §9 names, a lede one
 * notch over body, the rest at body, and a provenance foot carrying the REAL
 * session count. The reference pattern is Strava's Athlete Intelligence /
 * Tempo's readiness (Mobbin): label + prose + the data it summarizes. The
 * paragraph is COMPOSED, never generated — `src/lib/brief-prose.ts`, pure and
 * tested, templates over this same Brief in §9's order (week → next → stakes
 * → moving → holding → record → one thing to watch) — and the model's rewrite
 * (§9.1) lands with one FadeSwap dip: the upgrade is visible, never
 * performed. The adherence record and the watch item read as the paragraph's
 * closing sentences rather than extra blocks.
 *
 * Below it, each block disappearing when it has nothing true to say
 * (§1.1 invariant 6):
 *   1. What's next — the declared split day, or the ghost.
 *   2. Standing still — the engine's own deload condition, shown one session
 *      early. The app showing its work before it acts.
 *   3. Moving — e1RM that genuinely climbed.
 *
 * No green anywhere except the prescription VALUES in block 1, which is exactly
 * what `signal` means everywhere else: a number not yet lifted (§5.1).
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

  // The model-written upgrade (§8.5, owner ruling 29 Jul): the composed
  // paragraph renders instantly; a validated rewrite swaps in when it lands —
  // late or never, and never blocking anything. Cached per paragraph, so a
  // stable brief costs one call ever.
  const [summary, setSummary] = useState<string | null>(() =>
    prose ? getCachedBriefSummary(prose) : null,
  );
  useEffect(() => {
    const cached = prose ? getCachedBriefSummary(prose) : null;
    setSummary(cached);
    if (!prose) return;
    // §13's fallback-rate counters (§9.3): which phrasing was actually on
    // screen. An upgrade mid-look counts once in each column, truthfully.
    markBriefShown(cached ? 'model' : 'composed');
    refineBriefSummary(prose, (s) => {
      setSummary(s);
      markBriefShown('model');
    });
  }, [prose]);

  // The lede split and the dateline are display-only: cache and guard always
  // see the whole paragraph, and the date is the device's own clock.
  const lede = splitLede(summary ?? prose);
  const dateline = briefDateline(new Date());
  const provenanceN = brief?.sessions8w ?? 0;
  const provenanceBase =
    provenanceN > 0
      ? `${provenanceN === 1 ? 'one session' : `${provenanceN} sessions`} in the last 8 weeks`
      : null;
  // Both feet are TRUE for the state they describe: the composed paragraph is
  // deterministic; the rewrite is phrasing over the same numbers, guarded so a
  // number the record doesn't hold can never appear (brief-guard). The session
  // count is the record's own, read in buildBrief — never estimated.
  const provenance = summary
    ? provenanceBase
      ? `Phrased from your computed brief — ${provenanceBase}, every number read from your record.`
      : 'Phrased from your computed brief — every number is read from your record.'
    : provenanceBase
      ? `Read from your record — ${provenanceBase}, same history, same brief, offline.`
      : 'Read from your record — same history, same briefing, offline.';

  const hasAnything =
    brief != null &&
    (brief.lines.length > 0 ||
      brief.stalls.length > 0 ||
      brief.movers.length > 0 ||
      brief.adherence != null);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.nav}>
        <Text style={styles.navTitle} accessibilityRole="header" maxFontSizeMultiplier={MAX_FONT_SCALE}>
          Next
        </Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + spacing.xxl + TAB_BAR_CLEARANCE },
        ]}
        showsVerticalScrollIndicator={false}>
        {!hasAnything ? (
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
            {prose ? (
              // The brief — §9's calm editorial card: dated, labelled, a lede
              // over body prose, a provenance foot with the real session
              // count. The label wears Recore blue (§4.2's product accent) and
              // sits INSIDE the card: this is one authored artefact, not a
              // section head over data rows.
              <View style={styles.block}>
                <View style={styles.briefCard}>
                  <View style={styles.briefHead}>
                    <Eyebrow tone="secondary" style={styles.briefLabel}>
                      Your brief
                    </Eyebrow>
                    <Text style={styles.briefDate} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                      {dateline}
                    </Text>
                  </View>
                  <FadeSwap swapKey={summary ? 'model' : 'composed'}>
                    <Text style={styles.briefLede} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                      {lede.lead}
                    </Text>
                    {lede.rest ? (
                      <Text style={styles.briefBody} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                        {lede.rest}
                      </Text>
                    ) : null}
                  </FadeSwap>
                  <Text style={styles.briefFoot} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                    {provenance}
                  </Text>
                </View>
              </View>
            ) : null}

            {brief!.lines.length > 0 ? (
              <View style={styles.block}>
                <Eyebrow tone="secondary">
                  {brief!.forToday ? `Today · ${brief!.dayLabel ?? 'your split'}` : 'Next session'}
                </Eyebrow>
                {brief!.headline ? (
                  <Text style={styles.headline} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                    {brief!.headline}
                  </Text>
                ) : null}
                <View style={styles.card}>
                  {brief!.lines.map((l, i) => (
                    <View key={`${l.name}:${i}`} style={[styles.planRow, i > 0 && styles.rowRule]}>
                      <View style={styles.planTop}>
                        <Text style={styles.rowName} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                          {l.name}
                        </Text>
                        {l.bestKg != null ? (
                          <Text style={styles.planBest} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                            {`best ${fmtNumber(l.bestKg)}`}
                          </Text>
                        ) : null}
                      </View>
                      {/* The proposal, shown as its own arithmetic: what the
                          record holds (§20: what to beat, never what to do),
                          an ink arrow, what the engine set from it. Green
                          stays on the not-yet-lifted number alone (§4.2) —
                          the suggestion is the PAIR, not a colour. */}
                      {l.last || l.value ? (
                        <View style={styles.planLoads}>
                          {l.last ? (
                            <Text style={styles.planLast} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                              {`last ${l.last}`}
                            </Text>
                          ) : null}
                          {l.last && l.value ? (
                            <Text style={styles.planArrow} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                              →
                            </Text>
                          ) : null}
                          {l.value ? (
                            <Text style={styles.rowPlanned} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                              {l.value}
                            </Text>
                          ) : null}
                        </View>
                      ) : null}
                      {/* The engine's own reason — visible, because a reason
                          is what separates a proposal from a bare number, and
                          §4.2 requires planned green to carry one. */}
                      {l.why ? (
                        <Text style={styles.planWhy} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                          {l.why}
                        </Text>
                      ) : null}
                    </View>
                  ))}
                </View>
                <Text style={styles.foot} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                  Not training until you lift it. Write what you actually do.
                </Text>
              </View>
            ) : null}

            {brief!.stalls.length > 0 ? (
              <View style={styles.block}>
                <Eyebrow tone="secondary">Standing still</Eyebrow>
                <View style={styles.card}>
                  {brief!.stalls.map((s, i) => (
                    <View key={s.canonical} style={[styles.row, i > 0 && styles.rowRule]}>
                      <View style={styles.rowText}>
                        <Text style={styles.rowName} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                          {s.canonical}
                        </Text>
                        <Text style={styles.rowWhy} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                          {s.deloadTo != null
                            ? `${s.sessions} sessions at the same weight — next one backs off to ${fmtNumber(s.deloadTo)}`
                            : `${s.sessions} sessions at the same weight`}
                        </Text>
                      </View>
                      <Text style={styles.rowValue} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                        {`${fmtNumber(s.weight)} kg`}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            {brief!.movers.length > 0 ? (
              <View style={styles.block}>
                <Eyebrow tone="secondary">Moving</Eyebrow>
                <View style={styles.card}>
                  {brief!.movers.map((m, i) => (
                    <View key={m.canonical} style={[styles.row, i > 0 && styles.rowRule]}>
                      <View style={styles.rowText}>
                        <Text style={styles.rowName} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                          {m.canonical}
                        </Text>
                        <Text style={styles.rowWhy} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                          {`estimated 1RM, last ${m.weeks} weeks`}
                        </Text>
                      </View>
                      {/* A delta is a WORD plus a number, never a bare + and
                          never a colour (§5.1). */}
                      <Text style={styles.rowValue} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                        {`up ${fmtNumber(m.deltaKg)} kg`}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            {/* The adherence record closes the briefing paragraph above —
                a fourth block would say the same sentence twice. */}

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
      </ScrollView>
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
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  navTitle: {
    ...type.title2,
    color: color.textPrimary,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  block: {
    marginBottom: spacing.xl,
    gap: spacing.sm,
  },
  headline: {
    ...type.subhead,
    lineHeight: moderateScale(22),
    color: color.textPrimary,
  },
  card: {
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.divider,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    ...shadow.card,
  },
  row: {
    minHeight: moderateScale(52),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  rowRule: {
    borderTopWidth: 1,
    borderTopColor: color.divider,
  },
  rowText: {
    flex: 1,
  },
  rowName: {
    ...type.subhead,
    fontWeight: '600',
    color: color.textPrimary,
    flexShrink: 1,
  },
  rowWhy: {
    marginTop: 2,
    ...type.footnote,
    lineHeight: moderateScale(16),
    color: color.textMuted,
  },
  // The prescription rows read top-down as a proposal: lift (and its all-time
  // best), then last → planned, then the reason. A column, unlike the
  // stall/mover rows, because a from → to pair folded into a right gutter
  // stops reading as a pair.
  planRow: {
    minHeight: moderateScale(52),
    justifyContent: 'center',
    gap: moderateScale(3),
    paddingVertical: spacing.md,
  },
  planTop: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  planBest: {
    fontFamily: fonts.mono,
    fontSize: type.footnote.fontSize,
    color: color.textMuted,
    fontVariant: ['tabular-nums'],
  },
  planLoads: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    columnGap: spacing.sm,
    rowGap: 2,
  },
  planLast: {
    fontFamily: fonts.mono,
    fontSize: type.footnote.fontSize,
    color: color.textMuted,
    fontVariant: ['tabular-nums'],
  },
  planArrow: {
    fontFamily: fonts.mono,
    fontSize: type.footnote.fontSize,
    color: color.textSecondary,
  },
  planWhy: {
    ...type.footnote,
    lineHeight: moderateScale(16),
    color: color.textSecondary,
  },
  rowPlanned: {
    ...monoText,
    color: color.signal,
  },
  rowValue: {
    ...monoText,
    color: color.textSecondary,
  },
  foot: {
    ...type.footnote,
    color: color.textMuted,
  },
  // The brief: the one card on this screen whose content is sentences — the
  // app writing, not tabulating — and the one card with hero weight (§9's
  // "calm editorial card"): a larger radius, more air, the raised cast. Every
  // other surface keeps the standard card so the hierarchy is one level deep.
  briefCard: {
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.divider,
    borderRadius: radius.xl,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xl,
    gap: spacing.md,
    ...shadow.raised,
  },
  briefHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  briefLabel: {
    color: color.trained,
  },
  briefDate: {
    ...type.footnote,
    color: color.textMuted,
    fontVariant: ['tabular-nums'],
  },
  briefLede: {
    ...type.lede,
    color: color.textPrimary,
  },
  briefBody: {
    marginTop: spacing.sm,
    ...type.body,
    color: color.textPrimary,
  },
  briefFoot: {
    marginTop: spacing.xs,
    paddingTop: spacing.sm,
    borderTopWidth: hairline,
    borderTopColor: color.divider,
    ...type.footnote,
    color: color.textMuted,
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
    lineHeight: moderateScale(23),
    color: color.textSecondary,
  },
});
