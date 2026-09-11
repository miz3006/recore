import { create } from 'zustand';

/**
 * The rest timer's clock, lifted out of the accessory bar (owner, 11 Aug 2026).
 *
 * It lived as local state inside `BottomToolbar`'s RestTimer, which was fine
 * while the chip was the only thing that displayed it. Today's resting pill now
 * reports the live session — the set you just logged, and the rest you are
 * standing through — and the pill and the chip must never show two different
 * numbers, so the countdown became shared state instead of a second interval
 * computing its own answer.
 *
 * ONLY the clock moved. The chip still owns its own ticking, its haptic and its
 * "go" flash, because those belong to the control the athlete pressed.
 *
 * ## What 10 September 2026 added, and why the clock had to know about it
 *
 * The timer grew a ring, a readout and a `+30 s`, and every one of those is a
 * question this store is the only honest place to answer:
 *
 * · **`total`** — the ring is a fraction, and a fraction needs a denominator.
 *   It is the length this rest was STARTED at, not the pref: change the pref
 *   mid-rest and the arc still reports the rest you are actually standing
 *   through.
 * · **`extend`** — `+30 s` moves the end AND grows `total` by the same amount,
 *   so the arc slides backwards by exactly the time you bought instead of
 *   jumping to a new scale. A ring that reported a different number than the
 *   digits beside it would be the one thing a readout may never do.
 * · **`source`** — a rest that started ITSELF (a set landed in the note) has to
 *   be able to say so once, or the first time it happens it reads as a bug.
 *
 * Nothing here decides anything: the pref, the auto-start rule and the haptics
 * all live at the call site. This is the clock.
 */

/** How a rest began. `auto` = a set was written and the timer started itself. */
export type RestSource = 'manual' | 'auto';

interface RestTimerState {
  /** Epoch ms the rest ends, or null when no timer is running. */
  endsAt: number | null;
  /** Whole seconds left, republished on each tick by the chip that owns it. */
  remaining: number;
  /** The length this rest is running over, in seconds — the ring's denominator.
   * Grows with `extend`; 0 while nothing is running. */
  total: number;
  /** How this rest began. */
  source: RestSource;
  /**
   * Whether THIS rest should explain itself — true only for the first
   * automatic rest of a person's life.
   *
   * It lives in the store rather than in the component that draws it for one
   * reason: the thing that knows a rest just started automatically is the
   * effect that started it, and a `setState` from inside an effect body is a
   * cascading render. A store write from an effect is the sanctioned shape —
   * "update external systems with the latest state" — and the bar then just
   * reads a value like it reads the clock.
   */
  teach: boolean;
  start: (seconds: number, opts?: { source?: RestSource; teach?: boolean }) => void;
  /** Retire the explanation without touching the clock — any deliberate touch
   * on the timer means it has been understood. */
  taught: () => void;
  /** Buy more time. Moves the end and the denominator by the same amount, so
   * the arc stays a true fraction of the rest actually being taken. A no-op
   * when nothing is running — `+30 s` is not a way to start a timer. */
  extend: (seconds: number) => void;
  stop: () => void;
  tick: (remaining: number) => void;
}

export const useRestTimer = create<RestTimerState>((set, get) => ({
  endsAt: null,
  remaining: 0,
  total: 0,
  source: 'manual',
  teach: false,
  start: (seconds, opts) =>
    set({
      endsAt: Date.now() + seconds * 1000,
      remaining: seconds,
      total: seconds,
      source: opts?.source ?? 'manual',
      teach: opts?.teach ?? false,
    }),
  taught: () => set({ teach: false }),
  extend: (seconds) => {
    const { endsAt, total, remaining } = get();
    if (endsAt === null) return;
    set({
      endsAt: endsAt + seconds * 1000,
      total: total + seconds,
      // Republished immediately so the digits move on the tap rather than on
      // the next tick — a control that answers a quarter-second late reads as
      // a control that did not take the press.
      remaining: remaining + seconds,
    });
  },
  stop: () => set({ endsAt: null, remaining: 0, total: 0, teach: false }),
  tick: (remaining) => set({ remaining }),
}));

/** "2:41" — the one clock format, shared so the pill and the chip agree. */
export function fmtClock(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** How much of the rest has been stood through, 0→1. The ring's own value, and
 * the one place the fraction is computed — a second call site would be a second
 * chance to disagree with the digits. Clamped, so a stale tick cannot overrun. */
export function restProgress(remaining: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(1, Math.max(0, (total - remaining) / total));
}

/** The one step `+30 s` buys. Long enough to matter between heavy sets, short
 * enough that two taps is still a sane way to ask for a minute. */
export const REST_EXTEND_S = 30;
