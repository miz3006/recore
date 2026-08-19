import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/icon';
import { FadeSlideIn, PressableScale, Stagger } from '@/components/motion';
import { BriefFooter, BriefLede } from '@/components/next/brief';
import { LiftCard, UnknownLifts } from '@/components/next/session';
import { Signals } from '@/components/next/signals';
import { NextSkeleton } from '@/components/next/skeleton';
import { SplitChips } from '@/components/next/split-chips';
import { AppButton, Eyebrow } from '@/components/primitives';
import { StubScreen } from '@/components/stub-screen';
import { getCachedBriefSummary, refineBriefSummary } from '@/lib/brief-explain';
import { briefDateline, briefProse } from '@/lib/brief-prose';
import { buildBrief, planDayLines, type Brief } from '@/lib/db/brief';
import { todayKey } from '@/lib/db/dates';
import { listPlanDays, resolveTodayPlanDay } from '@/lib/db/plan';
import { markBriefShown } from '@/lib/funnel';
import { tap } from '@/lib/haptics';
import { devWarn } from '@/lib/log';
import { buildSections, sessionRowsOf, type SessionRow } from '@/lib/next/sections';
import {
  color,
  lineFor,
  MAX_FONT_SCALE,
  moderateScale,
  radius,
  spacing,
  TAB_BAR_CLEARANCE,
  type,
} from '@/lib/theme';
import { useSession } from '@/state/session-store';

/**
 * Next — "What am I doing next?" (owner, 28 July 2026; rebuilt 13 August;
 * re-housed in Progression's chrome 18 August).
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
 * ## The 18 August pass: one app, not two
 *
 * The owner's brief was one sentence — *"Next should be the same as
 * Progression, only performing its own function"* — and the diagnosis behind it
 * was that the two tabs had grown into two design systems:
 *
 * | | Progression (13→17 Aug) | Next (13 Aug) |
 * |---|---|---|
 * | Header | large title + one counted line | `title2` + a dateline on the right |
 * | Gutter | `spacing.xxl` | `spacing.lg` |
 * | Control | wrapping pills, blue wash | horizontal scroller, ink fill |
 * | List | one card per lift, all equal | one hero card + plain rows |
 * | Secondary | eyebrow + count + hairline rows | horizontally-scrolling tiles |
 * | Tail | a quiet row + chevron | a bordered card-shaped row |
 *
 * Six differences, none of them carrying a meaning. Every one is now
 * Progression's, and the page reads as the same app one tab across:
 *
 *   1. `StubScreen` large title with ONE counted line under it — the dateline
 *      and the lift count, which is exactly the job Progression's cadence line
 *      does. No scroll-edge hairline: Progression has none.
 *   2. the LEDE — the brief's one or two lines, on bare paper (§9's "short
 *      briefing paragraph", still short). This is Next's own function and has
 *      no Progression counterpart, so it keeps its own block;
 *   3. the CHIPS — `ChipRow`, the control both tabs now share;
 *   4. ONE CARD PER LIFT, staggered in, accordion-opening onto its WHY/WATCH
 *      and a "Full history" opener — Progression's card, its motion and its
 *      accordion rule, to the token;
 *   5. YOUR OTHER LIFTS — eyebrow + count + hairline rows + one closing line;
 *   6. the full brief behind one disclosure, its provenance, and All lifts.
 *
 * ONE open card at a time, as on Progression: an accordion keeps the page
 * short, and two open cards is a list that has stopped being scannable.
 *
 * This file assembles; it decides nothing. Every placement rule lives in the
 * pure module (`lib/next/sections.ts`) or in one section component.
 */
export default function Next() {
  const router = useRouter();
  const userId = useSession((s) => s.userId);
  const openExerciseSheet = useSession((s) => s.openExerciseSheet);
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

  /** The key of the ONE open card — Progression's accordion, same rule. */
  const [openKey, setOpenKey] = useState<string | null>(null);

  // Which list of lifts the cards are drawn from: the previewed day when a chip
  // that is not the due day is selected, otherwise the session actually due.
  const rows: SessionRow[] = preview ? preview.rows : (sections?.sessionRows ?? []);
  // A lift with no prescription has nothing to put in a card's reading slot, so
  // it goes to the counted block below rather than into an empty card (§7.3).
  const carded = rows.filter((r) => r.prescription);
  const unknown = rows.filter((r) => !r.prescription);

  const hasAnything =
    sections != null &&
    brief != null &&
    (sections.sessionRows.length > 0 ||
      sections.standing.length > 0 ||
      sections.moving.length > 0 ||
      brief.notes.length > 0 ||
      sections.adherenceChip != null);

  // Progression's header carries one counted line and no adjectives (§2 rule 6).
  // This one counts the same way: the date, and how many lifts are on the page.
  const counted = countedLine(rows.length);

  if (!sections) {
    // No account resolved yet — the record is still being opened. The one thing
    // this must not do is show the empty state, which is a real claim about an
    // empty record rather than a way to pass the time.
    return (
      <StubScreen title="Next" subtitle={counted} back={false} large>
        <NextSkeleton />
      </StubScreen>
    );
  }

  if (!hasAnything) {
    // §15: an empty screen invites an action, it never reports a lack. Same
    // dashed card, same voice, same one button as Progression's empty state.
    return (
      <StubScreen title="Next" back={false} large>
        <FadeSlideIn>
          <View style={styles.emptyCard}>
            <Eyebrow>Next</Eyebrow>
            <Text style={styles.emptyTitle} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              Write two sessions and this fills itself.
            </Text>
            <Text style={styles.emptyBody} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              A prescription needs prior sets of the same lift. Until there are some, Recore has
              nothing true to put here — so it puts nothing.
            </Text>
            <View style={styles.emptyActions}>
              <AppButton
                label="Write today's session"
                variant="secondary"
                compact
                onPress={() => {
                  tap();
                  router.push('/today');
                }}
              />
            </View>
          </View>
        </FadeSlideIn>
      </StubScreen>
    );
  }

  return (
    <StubScreen title="Next" subtitle={counted} back={false} large>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        {/* The standfirst. Next's own function, and the one block on the page
            Progression has no counterpart for — so it keeps its own voice. */}
        <View style={styles.lede}>
          <BriefLede headline={sections.headline} adherence={sections.adherenceChip} />
        </View>

        <SplitChips
          days={planDays}
          activeId={previewDay?.id ?? dueId}
          dueId={dueId}
          onSelect={(id) => {
            setPreviewId(id === dueId ? null : id);
            setOpenKey(null); // a different day is a different list of cards
          }}
        />

        {/*
          THE PLANNED MARKER (owner, 18 Aug 2026). It names the state of
          everything below it, in the app's fourth data state's own colour —
          product-direction §4.2's "planned green … always with its label and
          reason", and this is the label.

          It replaced a plain muted eyebrow that only appeared when the chips
          did not, which left the commonest case — a lifter with a split — with
          no statement anywhere that the loads on this page have not been lifted
          yet. That statement used to live on Today, in the plan strip's green
          values, and left with it on 18 Aug.

          It says the day too, so it is never a decoration: "PLANNED · TODAY ·
          PUSH DAY" is the marker AND the session's name, which is why the old
          eyebrow can be deleted rather than stacked under this one.
        */}
        <Eyebrow style={styles.planned}>
          {`Planned · ${preview ? preview.title : sections.sessionTitle}`}
        </Eyebrow>

        {!preview && sections.sessionNote ? (
          <Text style={styles.sessionNote} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {sections.sessionNote}
          </Text>
        ) : null}

        {carded.length > 0 ? (
          <Stagger step={55} initialDelay={60}>
            {carded.map((row, i) => {
              const key = row.key || `${row.name}:${i}`;
              return (
                <LiftCard
                  key={key}
                  row={row}
                  open={openKey === key}
                  onToggle={() => {
                    tap();
                    setOpenKey((k) => (k === key ? null : key));
                  }}
                  onOpenHistory={() => {
                    tap();
                    if (row.canonical) openExerciseSheet(row.canonical);
                  }}
                />
              );
            })}
          </Stagger>
        ) : (
          <FadeSlideIn>
            <Text style={styles.thin} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              {preview
                ? `Nothing to progress on ${preview.title} yet. These movements need one logged session each before Recore can say what beats them.`
                : 'One more session of the same lifts and there is something here to beat.'}
            </Text>
          </FadeSlideIn>
        )}

        {unknown.length > 0 ? (
          <FadeSlideIn>
            <UnknownLifts rows={unknown} />
          </FadeSlideIn>
        ) : null}

        {/* The closing line belongs to a session that HAS cards. Under the
            "nothing to progress yet" message it would be a second sentence
            saying less than the first. */}
        {carded.length > 0 ? (
          <Text style={styles.foot} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {preview
              ? dueLabel
                ? `A look ahead. Today reads as ${dueLabel}.`
                : 'A look ahead — not the session you are due for.'
              : 'Nothing counts until you lift it. Write what you actually do.'}
          </Text>
        ) : null}

        {/* The lifts the coming session does not name. Only ever the DUE day's
            signals: a preview is a look at another session, not a claim about
            what the rest of the record is doing that day. */}
        {!preview && (sections.standing.length > 0 || sections.moving.length > 0) ? (
          <FadeSlideIn>
            <Signals
              standing={sections.standing}
              moving={sections.moving}
              onOpen={(canonical) => {
                tap();
                openExerciseSheet(canonical);
              }}
            />
          </FadeSlideIn>
        ) : null}

        <BriefFooter
          prose={summary ?? prose}
          proseKey={summary ? 'model' : 'composed'}
          provenance={sections.provenance}
        />

        {/* Lifts moved out of the tab bar to make room for this screen. It is
            one tap away, not gone — and it is the same quiet row that closes
            Progression, not a card pretending to be one. */}
        <PressableScale
          haptic="none"
          activeScale={0.98}
          onPress={() => {
            tap();
            router.push('/lifts');
          }}
          accessibilityRole="button"
          accessibilityLabel="All lifts"
          style={styles.allLiftsRow}>
          <Text style={styles.allLiftsLabel} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            All lifts
          </Text>
          <Icon name="chevron-forward" size={moderateScale(14)} tint={color.textMuted} />
        </PressableScale>
      </ScrollView>
    </StubScreen>
  );
}

/** The header's one counted line. Two facts, both counted off what is on the
 * page: today's date and how many lifts it names. No adjectives (§2, rule 6). */
function countedLine(lifts: number): string {
  const date = briefDateline(new Date());
  if (lifts === 0) return date;
  return `${date} · ${lifts} ${lifts === 1 ? 'lift' : 'lifts'}`;
}

const styles = StyleSheet.create({
  // Progression's scroll, to the token: the body's gutter is given back so the
  // scroll runs full-bleed, and ONE gap separates every block on the page.
  scroll: {
    flex: 1,
    marginHorizontal: -spacing.xxl,
  },
  content: {
    paddingHorizontal: spacing.xxl,
    // Content scrolls *behind* the tab bar (§5.2 — glass needs something to
    // refract), so the last row is padded clear of it rather than inset.
    paddingBottom: spacing.huge + TAB_BAR_CLEARANCE,
    gap: spacing.lg,
  },
  /** The lede sits closer to the chips than the page gap allows: it is the
   * standfirst for what follows, not a block of its own. */
  lede: {
    marginBottom: -spacing.xs,
  },
  /** The one green on the page that is not a value: the label those values
   * are owed (§4.2). `signal` on white is 4.93:1 — AA, at any size. */
  planned: {
    color: color.signal,
  },
  sessionNote: {
    ...type.footnote,
    lineHeight: lineFor(18),
    marginTop: -spacing.sm,
    color: color.textSecondary,
  },
  foot: {
    ...type.footnote,
    marginTop: -spacing.sm,
    color: color.textMuted,
  },
  thin: {
    ...type.subhead,
    color: color.textMuted,
    paddingVertical: spacing.md,
  },
  allLiftsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: moderateScale(44),
    marginHorizontal: -spacing.sm,
    paddingHorizontal: spacing.sm + spacing.xs,
    borderRadius: radius.sm,
    borderCurve: 'continuous',
  },
  allLiftsLabel: {
    ...type.caption,
    color: color.textSecondary,
  },
  emptyCard: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: color.border,
    borderRadius: radius.md,
    borderCurve: 'continuous',
    padding: spacing.lg,
    gap: spacing.md,
  },
  emptyTitle: {
    ...type.headline,
    fontWeight: '600',
    color: color.textPrimary,
  },
  emptyBody: {
    ...type.subhead,
    color: color.textSecondary,
  },
  emptyActions: {
    flexDirection: 'row',
    marginTop: spacing.xs,
  },
});
