import { useEffect, useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomToolbar } from '@/components/bottom-toolbar';
import { DaySwipe } from '@/components/day-swipe';
import { CheckInSheet } from '@/components/check-in-sheet';
import { FixSheet } from '@/components/fix-sheet';
import { InsightHeader } from '@/components/insight-header';
import { NoteSurface } from '@/components/note-surface';
import { PlanStrip } from '@/components/plan-strip';
import { ReadOnlyLedger } from '@/components/read-only-ledger';
import { SpotlightTour } from '@/components/spotlight-tour';
import { SummaryPill } from '@/components/summary-pill';
import { TopBar } from '@/components/top-bar';
import { TrialReminderSheet } from '@/components/trial-reminder-sheet';
import { TrialStartedSheet } from '@/components/trial-started-sheet';
import { useEntitlement } from '@/lib/billing/state';
import { color, spacing, TAB_BAR_CLEARANCE } from '@/lib/theme';

/**
 * Today — the default tab and 85% of the time spent in Recore (CLAUDE.md §5.1).
 *
 * "Recore Light" frames 01–03: a warm paper canvas — the nav row (wordmark ·
 * day pill · settings), a blank page you write your workout into, and a bottom
 * that swaps with focus (accessory bar while composing, a quiet summary pill at
 * rest).
 *
 * This used to be `app/index.tsx`, which was Home *and* the funnel dispatcher.
 * The dispatcher stayed behind at `/`; everything below is unchanged except for
 * the tab bar's clearance at the bottom.
 */
export default function Today() {
  const insets = useSafeAreaInsets();
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  // Where the writing surface begins: the nav block's own height, measured
  // rather than assumed because the title grows with Dynamic Type (§5.3). The
  // spotlight tour points at that surface and needs the number.
  const [headerH, setHeaderH] = useState(0);
  // Resolved once per session in AuthProvider and cached (§12.2) — reading it
  // here is a memory read, never a check.
  const entitlement = useEntitlement();

  useEffect(() => {
    const show = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hide = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const s = Keyboard.addListener(show, () => setKeyboardOpen(true));
    const h = Keyboard.addListener(hide, () => setKeyboardOpen(false));
    return () => {
      s.remove();
      h.remove();
    };
  }, []);

  // With the keyboard up the accessory bar rides on top of it and the tab bar
  // is behind the keyboard — the composer owns the screen (§5.2). At rest the
  // pill has to clear the floating bar, which no inset reports (see the token).
  const bottomInset = keyboardOpen
    ? spacing.sm
    : Math.max(insets.bottom, spacing.md) + TAB_BAR_CLEARANCE;

  // A lapsed subscription pauses NEW LOGGING and nothing else (PLAN B4): the
  // composer is replaced by the read-only ledger, Lifts / Progress / You stay
  // exactly as they were, and export stays free and complete (§20).
  if (entitlement === 'lapsed') {
    return (
      <View style={styles.root}>
        <SafeAreaView edges={['top']}>
          <TopBar />
        </SafeAreaView>
        <ReadOnlyLedger />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <SafeAreaView
        edges={['top']}
        onLayout={(e) => setHeaderH(e.nativeEvent.layout.height)}>
        <TopBar />
      </SafeAreaView>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Swipe left/right to move between days — the thumb's own shortcut to
            yesterday, which the day pill and the calendar sheet were the only
            way to reach. Disabled while the keyboard is up: mid-sentence a
            horizontal drag is the user placing a cursor, not asking for
            another day. The header, the plan strip and the note travel
            together, because all three belong to the day being read. */}
        <DaySwipe enabled={!keyboardOpen}>
          {/* The landmark recedes while typing — mid-workout the note owns the
              screen (CLAUDE.md §8). */}
          <InsightHeader hidden={keyboardOpen} />
          <PlanStrip />
          <NoteSurface />
        </DaySwipe>
        {/* The bottom swaps with focus: accessory bar while composing (frame
            03), a settled summary pill at rest (frames 01/02). The toolbar
            stays MOUNTED (just hidden) at rest so a running rest timer keeps
            counting instead of resetting when the keyboard closes. */}
        <View style={keyboardOpen ? undefined : styles.hidden}>
          <BottomToolbar bottomInset={bottomInset} />
        </View>
        {keyboardOpen ? null : <SummaryPill bottomInset={bottomInset} />}
      </KeyboardAvoidingView>

      {/* The Lift detail sheet is app-wide (`_layout.tsx`) — Lifts opens the
          same one, and two mounted copies would stack two modals. FixSheet is
          the composer's own, so it stays here. */}
      <FixSheet />

      {/* The end-of-session check-in (§8.1) — the reflection and the effort
          scale on one surface. Opened by Finish, and again from the receipt.
          It renders whenever there is a session to attach a note to, and
          deliberately does NOT wait for a parse: offline there are no effort
          rows and the check-in still has to work. */}
      <CheckInSheet />

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
          before the FIRST SESSION ledger's steps are taken. It decides its own
          visibility, like the trial sheets — and today the two can never
          collide, because a trial does not exist before billing does. */}
      <SpotlightTour topInset={headerH} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: color.bg,
  },
  flex: {
    flex: 1,
  },
  hidden: {
    display: 'none',
  },
});
