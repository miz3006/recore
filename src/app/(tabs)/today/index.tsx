import { Stack } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Keyboard, Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomToolbar } from '@/components/bottom-toolbar';
import { CalendarSheet } from '@/components/calendar-sheet';
import { EntryNoteSheet } from '@/components/entry-note-sheet';
import { FixSheet } from '@/components/fix-sheet';
import { InsightHeader } from '@/components/insight-header';
import { NoteSurface } from '@/components/note-surface';
import { PaperField } from '@/components/paper-field';
import { ReadOnlyLedger } from '@/components/read-only-ledger';
import { SpotlightTour } from '@/components/spotlight-tour';
import { StreakSheet } from '@/components/streak-sheet';
import { TodayBarButton, TodayDateline } from '@/components/today-header';
import { TrialReminderSheet } from '@/components/trial-reminder-sheet';
import { TrialStartedSheet } from '@/components/trial-started-sheet';
import { UndoDelete } from '@/components/undo-delete';
import { useEntitlement } from '@/lib/billing/state';
import { refreshRecapNotification } from '@/lib/recap';
import { color, NAV_BAR_HEIGHT, spacing, TAB_BAR_CLEARANCE } from '@/lib/theme';
import { labelForDay, useSession } from '@/state/session-store';

/**
 * Today — the default tab and 85% of the time spent in Recore (CLAUDE.md §5.1).
 *
 * A warm paper canvas, and since 9 September 2026 **a page rather than a
 * screen with a lid on it.** The reference has always been Apple Notes; what
 * was missing was not the styling but the grammar. Notes does not put a bar
 * with the app's name over your writing: the note runs to the top of the
 * display, the day it belongs to is the title of the page, and the chrome is
 * one bar button. That is now literally what this is, and every part of it is
 * the system's own — see `_layout.tsx` for what moved where and why.
 *
 *   Today                            ← `headerLargeTitle`, collapses on scroll
 *   Tuesday, 9 September   42 sessions
 *   ○ Bench press   82.5 kg · 5·5·5
 *   ○ ▊▊▊ …                          ← the blue line, while a line is read
 *   |                                ← where you write
 *
 * ## The three layers, and nothing else (v6, design skill §Structure)
 *
 * **canvas (the world) → ink text (the record) → white pills (the controls).**
 * The canvas is the scroll view's own background now (`note-surface.tsx`) —
 * `_layout.tsx` has the measurement, and it is the only place it can be
 * without costing UIKit the scroll view it tracks. Everything that IS the
 * record stays bare: no card, no fill, no border, and no rule between two
 * entries. What separates one record from the next is air.
 *
 * ## What this file still owns
 *
 * Only what cannot live inside the scroll view: the navigator's options, the
 * accessory bar (an overlay over the keyboard, not a row under the page), and
 * the sheets. The page itself — dateline, record, composer, day swipe — is
 * `NoteSurface`.
 *
 * This used to be `app/index.tsx`, which was Home *and* the funnel dispatcher,
 * then `app/(tabs)/today.tsx`. The dispatcher stayed behind at `/`.
 */
export default function Today() {
  const insets = useSafeAreaInsets();
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  /** How much of the screen the keyboard is covering — what the accessory bar
   * has to sit on top of, now that it floats rather than sitting in a column
   * under the page. */
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  /** How tall the accessory row is drawing right now — what the undo pill has
   * to clear to sit ABOVE it rather than behind it. Measured rather than
   * derived: the row is one or two shapes depending on whether a rest is
   * running, and a constant here would be wrong half the time. */
  const [toolbarHeight, setToolbarHeight] = useState(0);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [streakOpen, setStreakOpen] = useState(false);
  // Resolved once per session in AuthProvider and cached (§12.2) — reading it
  // here is a memory read, never a check.
  const entitlement = useEntitlement();
  const selectedDay = useSession((s) => s.selectedDay);
  const sessionCount = useSession((s) => s.sessionCount);
  const userId = useSession((s) => s.userId);

  // Keep the pending §12.1 recap notice current: its content is computed at
  // schedule time, so every open re-computes it from the record as it stands
  // (Finish does the same). A no-op while the recap is off.
  useEffect(() => {
    if (userId) void refreshRecapNotification(userId);
  }, [userId]);

  useEffect(() => {
    const show = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hide = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const s = Keyboard.addListener(show, (e) => {
      setKeyboardOpen(true);
      setKeyboardHeight(e.endCoordinates.height);
    });
    const h = Keyboard.addListener(hide, () => {
      setKeyboardOpen(false);
      setKeyboardHeight(0);
    });
    return () => {
      s.remove();
      h.remove();
    };
  }, []);

  const openCalendar = useCallback(() => setCalendarOpen(true), []);
  const openStreak = useCallback(() => setStreakOpen(true), []);

  // With the keyboard up the accessory bar rides on top of it and the tab bar
  // is behind the keyboard — the composer owns the screen (§5.2). The resting
  // value is what the bar would need to clear the floating tab bar, which no
  // inset reports (see the token); nothing is drawn down there at rest now.
  const bottomInset = keyboardOpen
    ? spacing.sm
    : Math.max(insets.bottom, spacing.md) + TAB_BAR_CLEARANCE;

  /**
   * THE TITLE IS THE DAY. "Today", "Yesterday", or the date two swipes back —
   * `labelForDay`, the same words every other surface names a day with. A
   * `UINavigationItem` holds one string, so the rest of the sentence (the
   * weekday, the full date) is the dateline on the page below it.
   */
  const title = labelForDay(selectedDay);

  // A lapsed subscription pauses NEW LOGGING and nothing else (PLAN B4): the
  // composer is replaced by the read-only ledger, Lifts / Progress / You stay
  // exactly as they were, and export stays free and complete (§20).
  if (entitlement === 'lapsed') {
    return (
      <>
        <Stack.Screen options={{ title, headerLargeTitle: true }} />
        {/* The ledger brings its own scroll view; the canvas comes back as a
            sibling here because there is no composer, no title to collapse
            under a finger, and nothing this branch asks UIKit to track. */}
        <View style={styles.lapsed}>
          <PaperField />
          <ReadOnlyLedger />
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title,
          headerLargeTitle: true,
          // The calendar at rest, Done while the keyboard is up — Notes' own
          // arrangement (`today-header.tsx`).
          headerRight: () => (
            <TodayBarButton keyboardOpen={keyboardOpen} onOpenCalendar={openCalendar} />
          ),
        }}
      />

      {/* THE PAGE, and the screen's root scroll view. It has to be the first
          child and it has to be a scroll view: `_layout.tsx` says what UIKit
          does with that and what it cannot do without it. */}
      <NoteSurface
        daySwipeEnabled={!keyboardOpen}
        header={
          <>
            {/* WHICH DAY THIS IS, spelled out, and how many sessions are on
                record. The old top row's two remaining facts, on the page,
                under the title they belong to. */}
            <TodayDateline
              day={selectedDay}
              sessionCount={sessionCount}
              onOpenStreak={openStreak}
            />
            {/* THE FURNITURE ARRIVES WITH THE RECORD (owner, 12 Aug 2026): the
                weekly line renders nothing at all until the day has produced a
                reading, so an untouched day is the dateline and a blank page.
                It recedes while typing — mid-workout the note owns the screen
                (CLAUDE.md §8). */}
            <InsightHeader hidden={keyboardOpen} />
          </>
        }
      />

      {/* THE RESTING PILL IS GONE (owner, 18 Aug 2026) and the bottom of Today
          belongs to the keyboard alone: the accessory bar while composing, and
          nothing at all at rest.

          It is an OVERLAY now rather than a row under the page, because the
          page had to become the screen's root scroll view. So it tracks the
          keyboard by hand — `bottom` is exactly how much of the screen the
          keyboard is covering — where before a `KeyboardAvoidingView` shrank a
          column around it. Same result, and the page underneath got the native
          inset behaviour in exchange (`note-surface.tsx`).

          The toolbar stays MOUNTED (just hidden) at rest so a running rest
          timer keeps counting instead of resetting when the keyboard closes. */}
      <View
        style={[styles.toolbar, { bottom: keyboardHeight }, keyboardOpen ? null : styles.hidden]}
        onLayout={(e) => setToolbarHeight(e.nativeEvent.layout.height)}
        pointerEvents="box-none">
        {/* `active` is the difference between MOUNTED and IN USE: the toolbar
            stays mounted at rest so a running rest keeps counting, and the
            automatic rest timer may only start while somebody is actually
            writing. */}
        <BottomToolbar bottomInset={bottomInset} active={keyboardOpen} />
      </View>

      {/* UNDO, for the delete that used to be final (11 September 2026). It
          floats above whatever currently owns the bottom of the screen: the
          accessory row while the keyboard is up, the tab bar at rest. The
          component itself is silent unless a line has just been deleted, so
          this costs an unbroken day nothing. */}
      <UndoDelete
        bottom={keyboardOpen ? keyboardHeight + toolbarHeight + spacing.sm : bottomInset}
      />

      {/* The day's own calendar, opened from the bar button. It used to hang
          off the day pill inside `top-bar.tsx`; with the button living in a
          native navigation bar, the sheet is mounted by the screen and the
          button only flips the flag. */}
      <CalendarSheet visible={calendarOpen} onClose={() => setCalendarOpen(false)} />
      <StreakSheet visible={streakOpen} onClose={() => setStreakOpen(false)} />

      {/* The Lift detail sheet is app-wide (`_layout.tsx`) — Lifts opens the
          same one, and two mounted copies would stack two modals. FixSheet is
          the composer's own, so it stays here — opened from a card's alias
          echo or the inline editor's "fix reading". */}
      <FixSheet />

      {/* One ledger entry's own sheet (owner, 4 Aug) — how hard that lift was
          (which moves the next load) and the athlete's words about it (which
          Next quotes back, never counts). Reached from the card's ⋯ sheet since
          11 Aug, when the per-card bubble was retired in favour of one
          end-of-session prompt. It renders nothing until an entry is chosen. */}
      <EntryNoteSheet />

      {/* The day-5 trial reminder (§12.1). It decides its own visibility on
          mount and renders nothing at all when there is no trial running, which
          is every state the app can be in before billing lands. Today is the
          first screen of an open, so this is where "first open after day 5"
          means what it says. */}
      <TrialReminderSheet />

      {/* The trial-start welcome, and the ONE place notification permission is
          ever asked — on a surface that has just explained what it is for
          (§12.1, §18). Never in onboarding. Like the reminder, it renders
          nothing when there is no trial. */}
      <TrialStartedSheet />

      {/* The first-open walk-through (owner, 29 Jul): shown once per account,
          before the FIRST SESSION ledger's steps are taken.

          Its `topInset` used to be the measured height of Today's own header
          row. There is no row to measure any more, so it is the safe area plus
          the navigation bar's COLLAPSED height — the token says why that is the
          right one of the two heights a large-title bar has. */}
      <SpotlightTour topInset={insets.top + NAV_BAR_HEIGHT} />
    </>
  );
}

const styles = StyleSheet.create({
  lapsed: {
    flex: 1,
    // The flat fill wherever the gradient cannot render.
    backgroundColor: color.canvas,
  },
  toolbar: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  hidden: {
    display: 'none',
  },
});
