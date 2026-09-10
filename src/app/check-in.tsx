import { useEffect } from 'react';

import { CheckInSheet } from '@/components/check-in-sheet';
import { useSession } from '@/state/session-store';

/**
 * The end-of-session check-in (§8.1) as a native form sheet — UIKit presents
 * it, drags it between detents and dismisses it, and the app supplies only the
 * content. The presentation lives in `app/_layout.tsx`; the content, and every
 * word of the reasoning behind it, in `components/check-in-sheet.tsx`.
 *
 * WHY IT IS A ROUTE AND NOT A `<Modal>` (6 September 2026). The sheet it
 * replaced was the app's own chrome: an RN `Modal`, a Reanimated slide and a
 * hand-rolled pan gesture on a drawn grabber. Everything that made it feel
 * approximately native — the rubber-band at the top detent, the interruptible
 * drag, the way the keyboard lifts the card, the scrim's exact curve — is free
 * and exact here, and none of it is ours to maintain.
 *
 * ## THIS FILE OWNS `checkInOpen`, and it is the only writer
 *
 * Two readers depend on that flag being true for exactly as long as the sheet
 * is on screen: `bottom-toolbar.tsx` refuses to raise the App Store review
 * prompt over it, and `note-surface.tsx` re-reads the reflection when it
 * closes. `openCheckIn` deliberately does NOT set it — it only navigates. If
 * both the opener and the route wrote the flag, a swipe-dismiss (which the
 * opener never hears about) would leave it stuck true, and the review prompt
 * would go quiet forever with nothing on screen to explain why.
 *
 * Mount sets it, unmount clears it, and every way out is an unmount.
 */
export default function CheckInRoute() {
  const setOnScreen = useSession((s) => s.setCheckInOnScreen);

  useEffect(() => {
    setOnScreen(true);
    return () => setOnScreen(false);
  }, [setOnScreen]);

  return <CheckInSheet />;
}
