/**
 * THE LIFT LIBRARY, AS REACHED FROM NEXT — one of two doors onto the same
 * screen (`components/lifts-screen.tsx`, which says why it is a component).
 *
 * The file exists so the push happens INSIDE Next's stack: the tab bar stays,
 * the back control says "Next", and the search field sits where it sits on
 * every other tab.
 */
import { LiftsScreen } from '@/components/lifts-screen';

/**
 * `backTitle` is passed here and nowhere else: Next's own title is whatever the
 * session is called, so without it the way back out of the library reads
 * "‹ Nothing due yet". Progress needs no override — its title is already the
 * word the tab is known by.
 */
export default function NextLifts() {
  return <LiftsScreen backTitle="Next" />;
}
