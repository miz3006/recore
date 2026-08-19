import { useEffect, useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomToolbar } from '@/components/bottom-toolbar';
import { DaySwipe } from '@/components/day-swipe';
import { CheckInSheet } from '@/components/check-in-sheet';
import { EntryNoteSheet } from '@/components/entry-note-sheet';
import { FixSheet } from '@/components/fix-sheet';
import { InsightHeader } from '@/components/insight-header';
import { NoteSurface } from '@/components/note-surface';
import { PaperField } from '@/components/paper-field';
import { ReadOnlyLedger } from '@/components/read-only-ledger';
import { SpotlightTour } from '@/components/spotlight-tour';
import { TopBar } from '@/components/top-bar';
import { TrialReminderSheet } from '@/components/trial-reminder-sheet';
import { TrialStartedSheet } from '@/components/trial-started-sheet';
import { useEntitlement } from '@/lib/billing/state';
import { refreshRecapNotification } from '@/lib/recap';
import { DUR } from '@/lib/motion';
import { color, spacing, TAB_BAR_CLEARANCE } from '@/lib/theme';
import { useHasEntries, useSession } from '@/state/session-store';

/**
 * Today — the default tab and 85% of the time spent in Recore (CLAUDE.md §5.1).
 *
 * "Recore Light" frames 01–03: a warm paper canvas — the nav row (wordmark ·
 * day pill · settings), a blank page you write your workout into, and a bottom
 * that belongs to the keyboard alone (the accessory bar while composing, and
 * nothing at all at rest — see the 18 Aug ruling below).
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
  const reduceMotion = useReducedMotion();
  // Whether today has produced a reading — the test the weekly line is gated
  // on (the card and the pill that used to share it are both gone).
  const hasEntries = useHasEntries();
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
    const s = Keyboard.addListener(show, () => setKeyboardOpen(true));
    const h = Keyboard.addListener(hide, () => setKeyboardOpen(false));
    return () => {
      s.remove();
      h.remove();
    };
  }, []);

  // With the keyboard up the accessory bar rides on top of it and the tab bar
  // is behind the keyboard — the composer owns the screen (§5.2). The resting
  // value is what the bar would need to clear the floating tab bar, which no
  // inset reports (see the token); nothing is drawn down there at rest now.
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
      {/* The canvas is a surface, not a flat fill (§C): three near-white tones
          a couple of units apart, drifting over forty-two seconds, behind
          everything and still under Reduce Motion. */}
      <PaperField />

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
            another day. The header and the note travel together, because
            both belong to the day being read. */}
        <DaySwipe enabled={!keyboardOpen}>
          {/* THE FURNITURE ARRIVES WITH THE RECORD (owner, 12 Aug 2026).
              A day with no reading on it shows the header row and a blank
              page — nothing else. The weekly line, the session-start card and
              the resting pill all described training that did not exist yet,
              and six pieces of chrome around an empty line is the app talking
              to itself.

              Two of the three have since been removed outright (the card on
              17 Aug, the pill on 18 Aug); the weekly line is what is left, and
              it still fades in on the first read line, so the canvas visibly
              BECOMES the ledger. */}
          {hasEntries ? (
            <Animated.View entering={reduceMotion ? undefined : FadeIn.duration(DUR.slow)}>
              {/* The landmark recedes while typing — mid-workout the note owns
                  the screen (CLAUDE.md §8). */}
              <InsightHeader hidden={keyboardOpen} />
            </Animated.View>
          ) : null}
          {/* THE PLAN IS NOT ON THIS PAGE (owner, 18 Aug 2026). The read-only
              PLANNED strip that used to sit here — today's declared day with
              its progressed loads — is gone from Today entirely. It lives one
              tab over, in Next's brief, which already carries the identical
              rows off the identical `computePlanStrip` read ("Today · Push
              day", `lib/db/brief.ts`); printing them above the composer as
              well was the same prescription twice, and it put a list of what
              to do on the one page whose job is to record what happened.

              With it goes the last thing between the header and the note: an
              untouched day is now the blank page and nothing else, which is
              what the 17 Aug "no exception" ruling was reaching for. Writing
              still has the plan within reach — the accessory bar's plan button
              writes the next prescribed line into the note (§8, bottom-
              toolbar.tsx) — but it does that on demand, over the keyboard,
              instead of standing on the page unasked.

              `components/plan-strip.tsx` and `planned-checklist.tsx` stay on
              disk, unmounted, so a way back is one wire. */}
          <NoteSurface />
        </DaySwipe>
        {/* THE RESTING PILL IS GONE (owner, 18 Aug 2026). The floating capsule
            that sat above the tab bar — "last set · Bench Press · 82.5 kg × 5
            · 1:30" mid-session, "today · 14 sets · 9 840 kg" once settled —
            is removed. The bottom of Today now belongs to the keyboard alone:
            the accessory bar while composing, and nothing at all at rest.

            KNOWN COST, ACCEPTED BY THE OWNER: the pill was the only way into
            `SessionSummarySheet`, and that sheet is the only home of "Save as
            a split day" (`save-split.tsx`). Both are unreachable from the app
            as of this change. `summary-pill.tsx`, `session-summary-sheet.tsx`
            and `save-split.tsx` stay in the tree, unmounted, so restoring the
            door is one line here.

            The toolbar stays MOUNTED (just hidden) at rest so a running rest
            timer keeps counting instead of resetting when the keyboard
            closes. */}
        <View style={keyboardOpen ? undefined : styles.hidden}>
          <BottomToolbar bottomInset={bottomInset} />
        </View>
      </KeyboardAvoidingView>

      {/* The Lift detail sheet is app-wide (`_layout.tsx`) — Lifts opens the
          same one, and two mounted copies would stack two modals. FixSheet is
          the composer's own, so it stays here — opened from a card's alias
          echo or the inline editor's "fix reading". */}
      <FixSheet />

      {/* The end-of-session check-in (§8.1) — the reflection and the effort
          scale on one surface. Opened by Finish, and again from the receipt.
          It renders whenever there is a session to attach a note to, and
          deliberately does NOT wait for a parse: offline there are no effort
          rows and the check-in still has to work. */}
      <CheckInSheet />

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
    backgroundColor: color.surface,
  },
  flex: {
    flex: 1,
  },
  hidden: {
    display: 'none',
  },
});
