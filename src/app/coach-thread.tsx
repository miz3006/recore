import { Stack, useLocalSearchParams } from 'expo-router';

import { CommentThread } from '@/components/coaching/comment-thread';
import { useAuth } from '@/lib/auth/provider';

/**
 * THE COMMENT THREAD AS A REAL UIKIT FORM SHEET.
 *
 * ## Why it lives at the ROOT and not under `(tabs)/you/coaching/`
 *
 * It was written there first and it did not work: registered as
 * `<Stack.Screen name="coaching/thread" options={{ presentation: 'formSheet' }} />`
 * inside the You tab's own stack, the route rendered FULL SCREEN on the iOS
 * 26.5 simulator — under the status bar, behind the tab bar, no sheet at all.
 *
 * `check-in` is the app's other native sheet and it is on the ROOT stack, with
 * its own note explaining that placement as "so the one push works from Today,
 * from the ledger and from anywhere later". That turns out to be load-bearing
 * rather than convenient: a form sheet has to be presented by a navigator that
 * owns the whole window, and a tab's stack does not.
 *
 * So this is a root route, exactly like `check-in`, and it inherits the two
 * hard-won options recorded there:
 *
 *  · **`sheetGrabberVisible`** — the system draws the grabber, so `CommentThread`
 *    must not bring its own.
 *  · **NO `sheetCornerRadius`.** iOS 26 rounds a floating sheet concentrically
 *    with the display; naming a constant overrides that with a tighter, wronger
 *    number that cannot follow the device.
 *
 * WHERE IT DIFFERS FROM `check-in`: that screen needs `fitToContents`, because
 * fixed detents measured its children at height 0 — it hands a height UP from a
 * fixed head, a flexing scroll and a fixed footer. A thread is the opposite
 * shape: one scroll that wants a height handed DOWN, with a composer pinned
 * under it. So it asks for `[0.6, 1]`, and gets what `bottom-sheet.tsx` never
 * could — a sheet you can drag between two heights.
 */
export default function CoachThread() {
  const { session } = useAuth();
  const { workoutId, ref, label, name } = useLocalSearchParams<{
    workoutId: string;
    /** Absent or empty = the whole session. Otherwise `entryNoteKey(exercise)`. */
    ref?: string;
    label?: string;
    name?: string;
  }>();

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <CommentThread
        workoutId={workoutId}
        exerciseRef={ref && ref.length > 0 ? ref : null}
        scopeLabel={label ?? 'Whole session'}
        viewerId={session?.user.id ?? ''}
        nameFor={(authorId) => (authorId === session?.user.id ? 'You' : (name ?? 'Them'))}
      />
    </>
  );
}
