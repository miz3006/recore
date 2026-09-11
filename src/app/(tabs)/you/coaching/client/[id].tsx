import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/icon';
import { PressableScale } from '@/components/motion';
import { useAuth } from '@/lib/auth/provider';
import { clientFeed, FEED_PAGE_SIZE, revokeLink, type FeedDay } from '@/lib/coaching';
import { factsLine, previewOf } from '@/lib/coaching/facts';
import { tap } from '@/lib/haptics';
import { PAPER_FIELD_CSS } from '@/lib/paper-field';
import {
  color,
  hairline,
  MAX_FONT_SCALE,
  moderateScale,
  readingStyle,
  spacing,
  TAB_BAR_CLEARANCE,
  type,
} from '@/lib/theme';

import { sessionDate } from '@/lib/coaching/relative';

/**
 * ONE PERSON'S TRAINING DAYS — the coach's feed, newest first, and the same
 * screen a client uses to find what their coach has said.
 *
 * ## What was wrong with it, in the owner's own screenshot (10 September 2026)
 *
 * Three rows reading "Thursday, 10. September / benchpress 120kgx12x3", for
 * ONE session, over an empty two-thirds of a screen. Two separate defects, and
 * this file is where both of them show:
 *
 *  1. **A row was a stored row, not a day.** Fixed underneath — `clientFeed`
 *     groups by day now, `day-id.ts` stops the split happening, and
 *     `merge_duplicate_workout_days()` folds the ones already made.
 *  2. **A row said almost nothing.** Date, then two lines of raw text. Every
 *     session in a month looked the same size, so the only way to find the
 *     heavy one was to open all of them.
 *
 * ## The pattern, and where it comes from
 *
 * Studied on Appllama, 10 September 2026: STNDRD's "Workout Summary"
 * (`1573298047/oth_tckah`), Symmetry's "Workout Completed"
 * (`6474446718/oth_sa9ac`) and Lyfta's "Program Workout Detail"
 * (`6443740936/oth_yw15g`). Every one of them leads a session with a short
 * count of what it WAS — exercises, sets, volume — and puts the detail below.
 * Lyfta's exercise rows are the tightest version of it: a name, then one grey
 * line of "4 Sets 3-9 reps", nothing else.
 *
 * The library has **no trainer-side roster or client feed** — searched again
 * today, semantically, and the nearest neighbours were team-discovery and
 * social-feed screens. So the SKELETON is borrowed from a finished-workout
 * summary and the material is entirely Recore's: bare rows on canvas, one
 * hairline, the reading face for every number (design skill §Structure).
 *
 * A row now carries three things in falling weight: the date in ink, the day's
 * facts in the reading face, and the person's own first lines under them. The
 * dead space is not a defect — *"a screen that is 70% canvas is finished"* —
 * but a row that says nothing is.
 *
 * ## It serves both ends of the link
 *
 * The client's "Comments from your coach" opens this same route with their own
 * id, because RLS lets an owner read their own rows and one implementation is
 * one set of behaviours to keep right. What must NOT be shared is the voice:
 * "this client has not logged a session yet" is nonsense read by the person
 * who did the logging. `self` below is the whole of that difference.
 *
 * ## The link can end while this screen is open
 *
 * Revoking cuts the SELECT at the database, so the next fetch simply returns
 * nothing. An empty answer for a client the coach navigated INTO is reported
 * as what it most likely is — access ended — rather than as "no sessions".
 */
export default function ClientFeed() {
  const router = useRouter();
  const { session } = useAuth();
  const { id, name, linkId } = useLocalSearchParams<{
    id: string;
    name?: string;
    linkId?: string;
  }>();
  /** Reading your own record — the client's way into their coach's comments. */
  const self = !!session?.user.id && session.user.id === id;

  const [days, setDays] = useState<FeedDay[]>([]);
  const [page, setPage] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [exhausted, setExhausted] = useState(false);

  const load = useCallback(
    async (nextPage: number) => {
      const batch = await clientFeed(id, nextPage);
      setDays((prev) => (nextPage === 0 ? batch : [...prev, ...batch]));
      // Exhaustion is judged on the PAGE, which is still counted in rows —
      // a full page that grouped into three days is not the end of the record.
      setExhausted(batch.length < FEED_PAGE_SIZE);
      setPage(nextPage);
      setLoaded(true);
    },
    [id],
  );

  useFocusEffect(
    useCallback(() => {
      void load(0);
    }, [load]),
  );

  const refresh = async () => {
    setRefreshing(true);
    await load(0);
    setRefreshing(false);
  };

  return (
    <>
      {/* THE COACH'S OWN WAY OUT.
          The spec says "both can revoke" and the RPC has always allowed it —
          `revoke_coach_link` accepts either party — but until this button
          existed only the client had a control for it, which made a two-sided
          rule a one-sided feature.

          It is a VISIBLE header button, not a long-press context menu, and that
          is the house ruling rather than a preference: `entry-actions-sheet.tsx`
          records the app moving actions OFF a long-press precisely because it
          was "a gesture nobody could see". Ending a coaching relationship is
          the last thing that should be hidden behind one.

          `headerRight` is the native navigation item, so it gets the system's
          own placement, its own hit target and swipe-back beside it for free. */}
      <Stack.Screen
        options={{
          title: self ? 'Your sessions' : (name ?? 'Client'),
          headerLargeTitle: true,
          headerRight: () =>
            linkId ? (
              <PressableScale
                onPress={() => {
                  tap();
                  Alert.alert(
                    `Stop coaching ${name ?? 'this client'}?`,
                    'You will immediately stop being able to read their sessions. The comments you have written stay in their record, and they can invite you again later.',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Stop',
                        style: 'destructive',
                        onPress: () => {
                          void (async () => {
                            if (await revokeLink(linkId)) router.back();
                          })();
                        },
                      },
                    ],
                  );
                }}
                haptic="light"
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel={`Stop coaching ${name ?? 'this client'}`}>
                <Text style={styles.headerAction} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                  Remove
                </Text>
              </PressableScale>
            ) : null,
        }}
      />
      <ScrollView
        style={styles.scroll}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
        onMomentumScrollEnd={() => {
          if (!exhausted && loaded) void load(page + 1);
        }}>
        {/* WHOSE SCREEN THIS IS. One sentence, only on the client's side —
            a coach knows why they are looking at somebody's sessions, and a
            person looking at their OWN needs to be told what changed about
            them. */}
        {self && name ? (
          <Text style={styles.lede} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {`Everything ${name} can read. A filled mark is something they wrote.`}
          </Text>
        ) : null}

        {!loaded ? <ActivityIndicator style={styles.loading} color={color.textMuted} /> : null}

        {loaded && days.length === 0 ? (
          <Text style={styles.empty} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {self
              ? 'Nothing logged yet. Write a session on Today and it will appear here.'
              : 'Nothing to read. Either this client has not logged a session yet, or they have removed your access.'}
          </Text>
        ) : null}

        {days.map((day) => {
          const facts = factsLine(day);
          const preview = previewOf(day.rawText);
          return (
            <PressableScale
              key={day.id}
              onPress={() =>
                router.push({
                  pathname: '/you/coaching/workout/[id]',
                  params: {
                    id: day.id,
                    // EVERY ROW OF THE DAY, not just the one comments anchor to.
                    // The session screen has taken `ids` since it was written
                    // and this row never sent them, so a day the sync split was
                    // listed here with all of its sets and opened showing the
                    // first row's — "3 lifts · 9 sets" leading to one lift, the
                    // exact mismatch `loadCoachDay` exists to prevent.
                    ids: day.workoutIds.join(','),
                    name: name ?? 'Client',
                    self: self ? '1' : '',
                  },
                })
              }
              haptic="light"
              activeScale={0.98}
              accessibilityRole="button"
              accessibilityLabel={[
                `Session on ${sessionDate(day.performedAt)}`,
                facts,
                day.commentCount ? `${day.commentCount} comments` : null,
              ]
                .filter(Boolean)
                .join(', ')}
              style={styles.row}>
              <View style={styles.rowText}>
                <Text style={styles.date} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                  {sessionDate(day.performedAt)}
                </Text>
                {/* THE DAY'S SHAPE, in the reading face because these are
                    readings. Absent rather than zeroed when the parser has not
                    read the text yet — `factsLine` explains why. */}
                {facts ? (
                  <Text style={styles.facts} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                    {facts}
                  </Text>
                ) : null}
                {preview ? (
                  <Text
                    style={styles.preview}
                    numberOfLines={1}
                    maxFontSizeMultiplier={MAX_FONT_SCALE}>
                    {preview}
                  </Text>
                ) : null}
              </View>

              {/* The unread mark is the brand, never `signal` green — green
                  means a PLANNED load in this app and may never mean "new" —
                  and the count sits beside the glyph so colour is not the only
                  carrier (design skill §Colour). */}
              {day.commentCount > 0 ? (
                <View style={styles.count}>
                  <Icon
                    name={day.unreadCount > 0 ? 'note-on' : 'note'}
                    size={15}
                    tint={day.unreadCount > 0 ? color.brand : color.textMuted}
                  />
                  <Text
                    style={[styles.countText, day.unreadCount > 0 && styles.countUnread]}
                    maxFontSizeMultiplier={MAX_FONT_SCALE}>
                    {day.commentCount}
                  </Text>
                </View>
              ) : null}
            </PressableScale>
          );
        })}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  /**
   * THE CANVAS IS THE SCROLL VIEW'S OWN BACKGROUND (11 September 2026).
   *
   * Every screen in this folder drew the retired grouped world instead of the
   * app's paper. Sampled on the iOS 26.5 simulator: a flat `242,242,242` from
   * the status bar to the tab bar, against Today's `247,245,238 → 245,244,243`.
   * The design skill is explicit that there is no `#F2F2F7` grouped world left,
   * and the coaching stack was the last place still living in it.
   *
   * `you/_layout.tsx` already hangs a `PaperField` beside its navigator, and
   * that is exactly why this is needed: **the navigator's own container view is
   * opaque and paints over the sibling.** That file has the whole probe. The
   * answer it lands on is this one — the gradient goes on the scroll view's own
   * style, where it needs no sibling and sits under no container, and the
   * screen keeps its collapsing large title.
   */
  scroll: {
    flex: 1,
    experimental_backgroundImage: PAPER_FIELD_CSS,
  },
  content: { paddingHorizontal: spacing.xxl, paddingBottom: TAB_BAR_CLEARANCE + spacing.xxl },
  lede: { ...type.subhead, color: color.textSecondary, paddingBottom: spacing.md },
  loading: { paddingVertical: spacing.xxxl },
  empty: { ...type.body, color: color.textMuted, paddingVertical: spacing.xxl },
  /** A bare row: air, one hairline, no card. Three lines of falling weight, so
   *  a finger scrolling past reads the date, the size and the words in that
   *  order without stopping. */
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: moderateScale(72),
    paddingVertical: spacing.md,
    borderBottomWidth: hairline,
    borderBottomColor: color.border,
  },
  rowText: { flex: 1, gap: moderateScale(3) },
  date: { ...type.headline, color: color.textPrimary },
  /** Numbers, so the reading face and its tabular figures — three rows of
   *  facts line up down the column instead of drifting. */
  facts: {
    ...readingStyle('500'),
    fontSize: type.subhead.fontSize,
    color: color.textSecondary,
  },
  preview: { ...type.subhead, color: color.textMuted },
  count: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  countText: { ...type.caption, color: color.textMuted },
  countUnread: { color: color.brand },
  headerAction: { ...type.body, color: color.error },
});
