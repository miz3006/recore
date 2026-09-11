import { Stack, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { listLifts, type LiftRow } from '@/lib/db/lifts';
import { PAPER_FIELD_CSS } from '@/lib/paper-field';
import { getPrimaryLift, hasPinnedPrimaryLift, markPrimaryLiftPinned } from '@/lib/prefs';
import { fmtNumber } from '@/lib/parse/summarize';
import {
  color,
  MAX_FONT_SCALE,
  radius,
  readingStyle,
  spacing,
  TAB_BAR_CLEARANCE,
  type,
} from '@/lib/theme';
import { labelForDay, useSession } from '@/state/session-store';

import { FadeSlideIn } from './motion';
import { Row } from './primitives';

/**
 * Lifts (CLAUDE.md §5.1 — "How is my bench going?").
 *
 * There is no exercise library to browse (§1.1), so this list IS the library:
 * every exercise the user has ever named, most recent first.
 *
 * **It is the app's `Row`** (design skill §Structure): the lift's name in ink
 * on the left, when it was last done and how deep the record goes under it, the
 * top set of that session on the right in the reading face. No card, no fill,
 * and — since 20 Aug 2026 — **no rule between two lifts**. The hairline that
 * used to sit between them measured 1.16:1 on the warm canvas, and what
 * separates one lift from the next is the air a 68 pt row leaves around it.
 *
 * §11.2's density ask is answered by the row being ONE object rather than by
 * squeezing it: a lifter with sixty exercises still scans a single column of
 * names with a single column of readings beside it.
 *
 * Tapping a row opens the Lift detail sheet that already exists (the same one
 * the composer's gutter opens), which is where the e1RM curve, the PR and the
 * session history live.
 *
 * ## THE CHROME IS UIKIT'S, AND SO IS THE SEARCH (10 September 2026)
 *
 * `StubScreen` is gone from this screen — the last one it dressed. It drew a
 * `Text` in a row above the scroll view with a chevron beside it, which is a
 * bar that cannot collapse, cannot be Liquid Glass, and cannot name the tab you
 * pushed from. Progress and You made the same move on 9 September; this screen
 * is one tap off both of them, so leaving it behind is what made the app read
 * as two apps.
 *
 * The search field moved with it, and that is the bigger win. It was a
 * hand-built `TextInput` styled as a pill sitting above the list. iOS puts that
 * control IN the navigation bar, hides it until the page is pulled down, and
 * gives it a Cancel button, a dictation key, a scope bar and a keyboard the
 * system dismisses — none of which a `TextInput` in a `View` has. Strong's own
 * exercise library (`Exercise Library`, appllama 464254577) puts it exactly
 * there. It is now `headerSearchBarOptions`, which is a real
 * `UISearchController`.
 *
 * ## WHY THIS IS A COMPONENT AND NOT A ROUTE
 *
 * The library is reached from TWO tabs — the "all lifts" row on Progress and
 * the same row on Next. Registered once on the root stack it covered the tab
 * bar on the way in, which no app iOS ships does for a detail push; and on iOS
 * 26 a screen with no tab bar under it gets the NEW bottom-aligned search
 * capsule, so the same control sat at the top of Progress and at the bottom of
 * the screen one tap below it. Both were the system being consistent with
 * itself, and together they read as two different apps.
 *
 * A route cannot sit in two tab stacks, so the SCREEN moved here and each stack
 * keeps a two-line route file that renders it
 * (`app/(tabs)/next/lifts.tsx`, `app/(tabs)/progress/lifts.tsx`). One
 * implementation, two doors, and the tab you came from is still under you and
 * still named on the back control.
 */

/** Below this many lifts a search field is furniture, not a tool. */
const SEARCH_FLOOR = 7;

/** The right-aligned mono reading — the top set of the last session. */
function topSetText(l: LiftRow): string {
  if (l.topWeight != null) {
    return l.topReps != null
      ? `${fmtNumber(l.topWeight)} kg × ${l.topReps}`
      : `${fmtNumber(l.topWeight)} kg`;
  }
  return l.topReps != null ? `${l.topReps} reps` : '—';
}

/** "Jul 21 · 14 sessions" — when it was last done and how deep the record goes. */
function metaText(l: LiftRow): string {
  const when = labelForDay(l.lastDay);
  return l.sessions === 1 ? `${when} · first recorded` : `${when} · ${l.sessions} sessions`;
}

function matches(l: LiftRow, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return l.key.includes(q) || l.aliases.some((a) => a.toLowerCase().includes(q));
}

export function LiftsScreen({ backTitle }: { backTitle?: string }) {
  const userId = useSession((s) => s.userId);
  const openExerciseSheet = useSession((s) => s.openExerciseSheet);

  // Cheap synchronous SQLite reads — re-run on every focus so a session
  // finished on Today shows up here without a relaunch. Comfortably inside the
  // §12.2 "under 400ms, show nothing" window, so there is no spinner.
  const [refresh, setRefresh] = useState(0);
  useFocusEffect(
    useCallback(() => {
      setRefresh((n) => n + 1);
    }, []),
  );

  const [query, setQuery] = useState('');

  // Block E, step 8: the lift the athlete named in onboarding sorts first ON
  // THE FIRST OPEN of this screen, and never again — after that recency is the
  // truth, and pinning would be the app overruling the record. Read once, on
  // mount, so the row does not jump out from under a finger mid-session.
  const [pin] = useState(() => (hasPinnedPrimaryLift() ? null : getPrimaryLift()));
  useEffect(() => {
    if (pin) markPrimaryLiftPinned();
  }, [pin]);

  /* eslint-disable react-hooks/exhaustive-deps */
  const lifts = useMemo(() => (userId ? listLifts(userId, pin) : []), [userId, refresh]);
  /* eslint-enable react-hooks/exhaustive-deps */

  const shown = useMemo(() => lifts.filter((l) => matches(l, query)), [lifts, query]);

  return (
    <>
      <Stack.Screen
        options={{
          // The title is the same from both doors, so it lives with the screen
          // rather than being repeated in two route files.
          title: 'Lifts',
          headerLargeTitle: true,
          /* WHAT THE BACK CONTROL SAYS, when the tab under it will not do.
             iOS names the previous screen, and Next's title is the SESSION —
             "Nothing due yet", "Upper", "Push" — so the way back out of the
             library read "‹ Nothing due yet". True, and useless. A door names
             the room it came from; the room is the tab. Progress passes
             nothing, because its own title is already the word. */
          headerBackTitle: backTitle,
          // UIKit's own search controller, and only once there is enough record
          // for finding to beat scrolling — the same floor and the same
          // reasoning as Progress.
          headerSearchBarOptions:
            lifts.length >= SEARCH_FLOOR
              ? {
                  placeholder: 'Search your lifts',
                  // The Notes/Mail idiom: the field is there at the top of the
                  // page and gives its 52 pt back the moment the list starts
                  // moving.
                  hideWhenScrolling: false,
                  autoCapitalize: 'none',
                  onChangeText: (e) => setQuery(e.nativeEvent.text),
                  onCancelButtonPress: () => setQuery(''),
                }
              : undefined,
        }}
      />

      {/* THE SCROLL VIEW IS THE SCREEN'S ROOT, and that is load-bearing rather
          than tidy: UIKit collapses a large title against a scroll view it can
          find for itself, and paints the search field's inset into the same
          arithmetic. `automatic` hands it the whole top. */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}>
        {lifts.length === 0 ? (
          // §12.1: an empty state states what will fill it and never reports a
          // lack. Same shell as the full screen — same navigator options, same
          // root scroll view — so nothing reflows when the first lift lands.
          <FadeSlideIn>
            <Text style={styles.emptyNote} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              Lifts appear here as you name them.
            </Text>
            <View style={styles.emptyExample}>
              <Text style={styles.emptyExampleText} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                bench 3x8 80
              </Text>
            </View>
          </FadeSlideIn>
        ) : shown.length === 0 ? (
          <Text style={styles.noMatch} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {`Nothing matches "${query.trim()}".`}
          </Text>
        ) : (
          // One reveal for the whole list, not one per row: a sixty-row stagger
          // is entertainment, and §8 only allows motion that explains.
          <FadeSlideIn>
            {shown.map((l) => (
              <Row
                key={l.key}
                name={l.canonical}
                detail={metaText(l)}
                value={topSetText(l)}
                spoken={`${l.canonical}, ${topSetText(l)}, ${metaText(l)}`}
                // No `tap()` here: `Row` ticks on press-out for the commit
                // (`primitives.tsx`), and a second one on the same finger is
                // the app talking over itself.
                onPress={() => openExerciseSheet(l.canonical)}
              />
            ))}
          </FadeSlideIn>
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  /**
   * THE CANVAS IS THE SCROLL VIEW'S OWN BACKGROUND, and that is the whole
   * reason this screen can have both a paper canvas and a collapsing title.
   * `(tabs)/next/_layout.tsx` has the measurement.
   */
  scroll: {
    flex: 1,
    experimental_backgroundImage: PAPER_FIELD_CSS,
  },
  /**
   * ONE GUTTER, `spacing.lg` — the system's large title hangs off its own
   * inset, and content 8 pt further in would give the page two left edges.
   */
  content: {
    paddingHorizontal: spacing.lg,
    // The top is UIKit's now, but the bottom is not: content scrolls BEHIND
    // the glass tab bar so the bar has something to refract, and the last row
    // clears it by hand.
    paddingBottom: spacing.huge + TAB_BAR_CLEARANCE,
  },
  // The row, the name, the meta line and the reading all live in `Row`
  // (`components/primitives.tsx`).
  emptyNote: {
    ...type.subhead,
    // An empty state INVITES an action; it is read, not skipped.
    color: color.textSecondary,
  },
  emptyExample: {
    marginTop: spacing.md,
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    borderCurve: 'continuous',
    backgroundColor: color.surfaceHigh,
  },
  emptyExampleText: {
    ...readingStyle('400'),
    fontSize: type.subhead.fontSize,
    color: color.textSecondary,
  },
  noMatch: {
    ...type.subhead,
    // It reports the result of a search someone just ran — information.
    color: color.textSecondary,
    paddingTop: spacing.lg,
  },
});
