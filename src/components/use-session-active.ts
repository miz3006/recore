import { useEffect, useState } from 'react';

import { isSessionActive, msUntilSettled } from '@/lib/session-activity';
import { useSession } from '@/state/session-store';

/**
 * "Is the athlete still in the gym?" — the store's facts run through the pure
 * rule in `lib/session-activity.ts`.
 *
 * Two surfaces ask, from opposite sides: the resting pill (live set, or the
 * day's totals) and the ledger's end-of-session reflection row. They share this
 * so they can never contradict each other about the same moment.
 *
 * It does NOT poll. The answer only changes on a store update — or at one known
 * instant, ninety quiet minutes after the last line was written — so the hook
 * schedules a single timeout for exactly that moment. A screen left open across
 * the boundary settles by itself; a phone in a pocket burns nothing.
 */
export function useSessionActive(): boolean {
  const receipt = useSession((s) => s.receipt);
  const lastActivityAt = useSession((s) => s.lastActivityAt);
  const finished = useSession((s) => s.sessionFinished);
  const note = useSession((s) => s.note);

  const hasSets = note.trim().length > 0 && (receipt?.totalSets ?? 0) > 0;
  const facts = { hasSets, lastActivityAt, finished };

  // The clock is read at RENDER, never held in state: a phone that spent the
  // boundary asleep (where timers don't fire) still answers correctly the
  // moment anything re-renders. The counter below only exists to cause that
  // render when nothing else would.
  const [tick, setTick] = useState(0);
  const active = isSessionActive(facts, Date.now());

  useEffect(() => {
    const delay = msUntilSettled(facts, Date.now());
    if (delay === null) return;
    const t = setTimeout(() => setTick((n) => n + 1), delay + 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasSets, lastActivityAt, finished, tick]);

  return active;
}
