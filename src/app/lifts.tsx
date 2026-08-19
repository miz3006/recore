import { useFocusEffect } from 'expo-router';
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { FadeSlideIn, PressableScale } from '@/components/motion';
import { StubScreen } from '@/components/stub-screen';
import { listLifts, type LiftRow } from '@/lib/db/lifts';
import { tap } from '@/lib/haptics';
import { getPrimaryLift, hasPinnedPrimaryLift, markPrimaryLiftPinned } from '@/lib/prefs';
import { fmtNumber } from '@/lib/parse/summarize';
import {
  color,
  fonts,
  hairline,
  MAX_FONT_SCALE,
  moderateScale,
  radius,
  spacing,
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

/** How far a pressed row's highlight bleeds past its content (see `row`). */
const PRESS_BLEED = spacing.sm;

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
            {shown.map((l, i) => (
              // The rule is a SIBLING, not a border on the row (the You screen's
              // pattern): a bordered row cannot take a corner radius without the
              // hairline curving with it, and without a radius the pressed fill
              // is a hard grey rectangle.
              <Fragment key={l.key}>
                {i > 0 ? <View style={styles.rowSep} /> : null}
                <PressableScale
                  haptic="none"
                  activeScale={0.98}
                  onPress={() => {
                    tap();
                    openExerciseSheet(l.canonical);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`${l.canonical}, ${topSetText(l)}, ${metaText(l)}`}
                  style={styles.row}>
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
              </Fragment>
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
  row: {
    // minHeight, never height: a name at accessibilityLarge has to be able to
    // grow the row instead of being cropped by it.
    minHeight: moderateScale(56),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.lg,
    paddingVertical: spacing.md,
    // The press highlight bleeds toward the screen edge and is rounded, so a
    // tap lights the row up instead of drawing a hard grey box inside the
    // list's padding. Content stays put: the margin is paid back as padding.
    marginHorizontal: -PRESS_BLEED,
    paddingHorizontal: PRESS_BLEED,
    borderRadius: radius.sm,
    borderCurve: 'continuous',
  },
  rowSep: {
    height: hairline,
    backgroundColor: color.tableRule,
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
    fontFamily: fonts.reading,
    fontVariant: ['tabular-nums'],
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
    borderCurve: 'continuous',
    backgroundColor: color.surfaceHigh,
  },
  emptyExampleText: {
    fontFamily: fonts.reading,
    fontVariant: ['tabular-nums'],
    fontSize: type.subhead.fontSize,
    color: color.textSecondary,
  },
  noMatch: {
    ...type.subhead,
    color: color.textMuted,
    paddingTop: spacing.lg,
  },
});
