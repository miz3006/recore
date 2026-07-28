import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { FadeSlideIn, PressableScale } from '@/components/motion';
import { StubScreen } from '@/components/stub-screen';
import { listLifts, type LiftRow } from '@/lib/db/lifts';
import { tap } from '@/lib/haptics';
import { fmtNumber } from '@/lib/parse/summarize';
import {
  color,
  fonts,
  hairline,
  MAX_FONT_SCALE,
  moderateScale,
  radius,
  spacing,
  TAB_BAR_CLEARANCE,
  type,
} from '@/lib/theme';
import { labelForDay, useSession } from '@/state/session-store';

/**
 * Lifts (CLAUDE.md §5.1 — "How is my bench going?"), the second tab.
 *
 * There is no exercise library to browse (§1.1), so this list IS the library:
 * every exercise the user has ever named, most recent first. §11.2 asks for
 * density — a lifter with 60 exercises should see twelve rows, not five — so a
 * row is one line of name plus one muted line of when and what, and nothing is
 * a card.
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

  /* eslint-disable react-hooks/exhaustive-deps */
  const lifts = useMemo(() => (userId ? listLifts(userId) : []), [userId, refresh]);
  /* eslint-enable react-hooks/exhaustive-deps */

  const shown = useMemo(() => lifts.filter((l) => matches(l, query)), [lifts, query]);

  // §12.1: an empty state states what will fill it and never reports a lack.
  if (lifts.length === 0) {
    return (
      <StubScreen title="Lifts" back={false}>
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
    <StubScreen title="Lifts" back={false}>
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
            {shown.map((l, i) => (
              <PressableScale
                key={l.key}
                haptic="none"
                activeScale={0.99}
                onPress={() => {
                  tap();
                  openExerciseSheet(l.canonical);
                }}
                accessibilityRole="button"
                accessibilityLabel={`${l.canonical}, ${topSetText(l)}, ${metaText(l)}`}
                style={[styles.row, i === shown.length - 1 ? styles.rowLast : null]}
                pressedStyle={styles.rowPressed}>
                <View style={styles.rowText}>
                  <Text style={styles.name} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                    {l.canonical}
                  </Text>
                  <Text style={styles.meta} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                    {metaText(l)}
                  </Text>
                </View>
                <Text style={styles.value} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                  {topSetText(l)}
                </Text>
              </PressableScale>
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
    paddingBottom: spacing.huge + TAB_BAR_CLEARANCE,
  },
  search: {
    ...type.body,
    color: color.textPrimary,
    backgroundColor: color.surfaceHigh,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  row: {
    // minHeight, never height: a name at accessibilityLarge has to be able to
    // grow the row instead of being cropped by it.
    minHeight: moderateScale(56),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: hairline,
    borderBottomColor: color.tableRule,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  rowPressed: {
    backgroundColor: color.surfaceHigh,
  },
  rowText: {
    flexShrink: 1,
  },
  name: {
    ...type.body,
    color: color.textPrimary,
  },
  meta: {
    ...type.caption,
    color: color.textMuted,
  },
  value: {
    fontFamily: fonts.mono,
    fontSize: type.subhead.fontSize,
    color: color.textSecondary,
    flexShrink: 0,
  },
  emptyNote: {
    ...type.subhead,
    color: color.textMuted,
  },
  emptyExample: {
    marginTop: spacing.md,
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: color.surfaceHigh,
  },
  emptyExampleText: {
    fontFamily: fonts.mono,
    fontSize: type.subhead.fontSize,
    color: color.textSecondary,
  },
  noMatch: {
    ...type.subhead,
    color: color.textMuted,
    paddingTop: spacing.lg,
  },
});
