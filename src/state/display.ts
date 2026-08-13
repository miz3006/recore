import { create } from 'zustand';

import { hasLargeSetReadings, setLargeSetReadings } from '@/lib/prefs';

/**
 * Display preferences that have to reach the screen the moment they change.
 *
 * The prefs themselves live where every other pref lives — the local meta KV,
 * so they export and delete with the rest (§12). This store is only the live
 * copy: You writes it, the ledger reads it, and nothing has to be relaunched
 * for the change to be visible. It is deliberately NOT part of the session
 * store: how text is displayed is not part of what was trained.
 */
interface DisplayState {
  /** Print each set as its own spelled-out line, larger. */
  largeSetReadings: boolean;
  setLargeSetReadings: (on: boolean) => void;
}

/** The stored value, or the default if the database is not open yet — a
 * display preference must never be the thing that throws on launch. */
function storedLargeSetReadings(): boolean {
  try {
    return hasLargeSetReadings();
  } catch {
    return false;
  }
}

export const useDisplay = create<DisplayState>((set) => ({
  // Read once at startup — the meta KV is synchronous SQLite, so there is no
  // flash of the wrong layout.
  largeSetReadings: storedLargeSetReadings(),
  setLargeSetReadings: (on) => {
    setLargeSetReadings(on);
    set({ largeSetReadings: on });
  },
}));
