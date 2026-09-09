import { useEffect, useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomToolbar } from '@/components/bottom-toolbar';
import { DaySwipe } from '@/components/day-swipe';
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
 * A warm paper canvas: the nav row with its floating day pill, a blank page you
 * write your workout into, and a bottom that belongs to the keyboard alone (the
 * accessory bar while composing, and nothing at all at rest — see the 18 Aug
 * ruling below).
 *
 * ## The three layers, and nothing else (v6, design skill §Structure)
 *
 * **canvas (the world) → ink text (the record) → white pills (the controls).**
 * The screen's own background is `color.canvas` — it was `surface` white for
 * the three days the app had no canvas, which made the page and the pills on it
 * the same object. Everything that floats above the page is a white pill with
 * the warm `shadow.card`: the day pill, the accessory circles, the Finish
 * button. **Everything that IS the record is bare** — no card, no fill, no
 * border, and since this pass no rule between two entries either
 * (`note-surface.tsx`). What separates one record from the next is air.
 *
 * This used to be `app/index.tsx`, which was Home *and* the funnel dispatcher.
 * The dispatcher stayed behind at `/`.
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
      {/* The canvas is a surface, not a flat fill: three tones a fraction apart
          on the page diagonal — peach at the top-left, lavender-pink at the
          bottom-right. It is STATIC (skill §Canvas: "diagonal, subtle, static,
          and never animates"), so there is nothing here for Reduce Motion to
          turn off. It renders behind everything and takes no touches.

          Every screen mounts it — the field IS the canvas (skill §Canvas: "one
          canvas runs the whole app"), and the flat `color.canvas` under it is
          the fill for wherever a gradient cannot render, not an alternative to
          one. Today was the only screen drawing it until 31 August 2026, which
          made switching tabs a visible step in HUE: the stops are matched on
          luminance, so what the eye caught was peach against paper, never light
          against dark. */}
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
              what the 17 Aug "no exception" ruling was reaching for.

              20 Aug: the accessory bar's PLAN BUTTON is gone too, which is the
              same ruling finished rather than a new one. That button was the
              "still within reach" clause of this note — the plan on demand,
              over the keyboard — and on demand meant a fourth control standing
              in the row all session for a line most days never have. Today now
              carries no prescription at any depth; the brief on Next is where
              the plan lives (bottom-toolbar.tsx).

              `components/plan-strip.tsx` and `planned-checklist.tsx` stay on
              disk, unmounted, so a way back is one wire.

              29 Aug: the checklist WAS wired here for a day, behind Next's
              pinned Start. Both are gone again on the owner's ruling, and the
              reason is CLAUDE.md §3 rather than taste — *"training input is
              free text first; touch controls repair, inspect or enrich it,
              they never replace writing as the primary path."* A full-width
              button on Next that filled Today with a checklist made the
              checklist the way into a session. Next is a briefing you read;
              this page is where you write. */}
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
    // THE PAGE. `PaperField` draws the gradient over it; this is what shows
    // wherever the gradient cannot render, and what the lapsed branch above
    // (which mounts no field) sits on.
    backgroundColor: color.canvas,
  },
  flex: {
    flex: 1,
  },
  hidden: {
    display: 'none',
  },
});
