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
 */
interface RestTimerState {
  /** Epoch ms the rest ends, or null when no timer is running. */
  endsAt: number | null;
  /** Whole seconds left, republished on each tick by the chip that owns it. */
  remaining: number;
  start: (seconds: number) => void;
  stop: () => void;
  tick: (remaining: number) => void;
}

export const useRestTimer = create<RestTimerState>((set) => ({
  endsAt: null,
  remaining: 0,
  start: (seconds) => set({ endsAt: Date.now() + seconds * 1000, remaining: seconds }),
  stop: () => set({ endsAt: null, remaining: 0 }),
  tick: (remaining) => set({ remaining }),
}));

/** "2:41" — the one clock format, shared so the pill and the chip agree. */
export function fmtClock(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
