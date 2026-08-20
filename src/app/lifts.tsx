import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { FadeSlideIn } from '@/components/motion';
import { Row } from '@/components/primitives';
import { StubScreen } from '@/components/stub-screen';
import { listLifts, type LiftRow } from '@/lib/db/lifts';
import { tap } from '@/lib/haptics';
import { getPrimaryLift, hasPinnedPrimaryLift, markPrimaryLiftPinned } from '@/lib/prefs';
import { fmtNumber } from '@/lib/parse/summarize';
import { color, MAX_FONT_SCALE, radius, readingStyle, spacing, type } from '@/lib/theme';
import { labelForDay, useSession } from '@/state/session-store';

/**
 * Lifts (CLAUDE.md §5.1 — "How is my bench going?"), the second tab.
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

export default function Lifts() {
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

  // §12.1: an empty state states what will fill it and never reports a lack.
  if (lifts.length === 0) {
    return (
      <StubScreen title="Lifts">
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
      </StubScreen>
    );
  }

  return (
    <StubScreen title="Lifts">
      {lifts.length >= SEARCH_FLOOR ? (
        <TextInput
          style={styles.search}
          value={query}
          onChangeText={setQuery}
          placeholder="Search your lifts"
          placeholderTextColor={color.textMuted}
          autoCorrect={false}
          autoCapitalize="none"
          clearButtonMode="while-editing"
          returnKeyType="search"
          accessibilityLabel="Search your lifts"
          maxFontSizeMultiplier={MAX_FONT_SCALE}
        />
      ) : null}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}>
        {shown.length === 0 ? (
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
                onPress={() => {
                  tap();
                  openExerciseSheet(l.canonical);
                }}
              />
            ))}
          </FadeSlideIn>
        )}
      </ScrollView>
    </StubScreen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    marginHorizontal: -spacing.xxl, // StubScreen pads the body; the rows own it
  },
  content: {
    paddingHorizontal: spacing.xxl,
    // Content scrolls *behind* the tab bar (§5.2), so the last row clears it
    // with padding rather than an inset.
    // A push, not a tab root any more — nothing floats over the bottom here.
    paddingBottom: spacing.huge,
  },
  search: {
    ...type.body,
    color: color.textPrimary,
    backgroundColor: color.surfaceHigh,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  // The row, the rule between two of them, the name, the meta line and the
  // reading all live in `Row` now (`components/primitives.tsx`) — six styles
  // deleted rather than restyled, and the list is the primitive's second home
  // after the lapsed ledger.
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
