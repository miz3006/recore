import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { getMeta, setMeta } from '@/lib/db/index';
import type { DemoEntry } from '@/lib/demo-parse';

/**
 * THE v2 ONBOARDING STORE — the primary flow's answers since 28 August 2026.
 *
 * It was the sandbox store. `docs/onboarding-v2-spec.md` §0 built it in memory
 * on purpose ("every run starts clean"), because a flow being run twenty times
 * in an afternoon must not leave anything behind. The owner's ruling of 28
 * August makes v2 the flow a new person actually meets, and that reverses
 * exactly one of those requirements: **a real run has to survive the app being
 * killed**, because a person completes onboarding once and losing four minutes
 * of answers to a phone call is not a trade anybody accepted.
 *
 * So the store now has two modes, and the difference is one boolean:
 *
 *  · **A REAL RUN persists** — answers and position, through the SQLite meta KV
 *    (`lib/db`), which is synchronous, so the store hydrates in the same tick
 *    it is created and the dispatcher never flashes the wrong step. The key is
 *    `pref_*` on purpose: `export-json.ts` carries every `pref_%` row and
 *    account deletion drops the whole meta table, so these answers inherit §12's
 *    export and deletion guarantees for free.
 *  · **A SANDBOX RUN writes nothing at all.** The dev rows in the You tab open
 *    the same flow with `beginSandboxRun()`, and while that is set the storage
 *    adapter below drops every write on the floor. §0's promise — "running it
 *    must not overwrite name/split/key lifts" — is kept by the run that was
 *    always meant to keep it, and only by that one.
 *
 * WHAT IS STILL TRUE OF BOTH: nothing here creates an account, starts a trial
 * or touches RevenueCat. Writing the answers to the rest of the app happens in
 * exactly one place, once, at the end of a real run —
 * `lib/onboarding-v2-commit.ts`.
 */

export interface V2Answers {
  /** Screen 2 — where they log today. Decides whether import is offered. */
  tracker: string | null;
  /** Screen 3 — up to two frustrations. Decides which value prop leads. */
  obstacles: string[];
  /** Screen 4 — attribution. Changes nothing in-product. */
  attribution: string | null;
  /** Screen 5 — the raw line, verbatim, exactly as typed. */
  demoText: string;
  /** Screen 5 — what the offline grammar made of it. Empty when nothing read. */
  demoEntries: DemoEntry[];
  /** Screen 7 — first name. */
  name: string;
  /** Screen 9 — selects the progression model. */
  goal: string | null;
  /** Screen 10 — sets the progression increment size. */
  experience: string | null;
  /** Screen 11 — sessions per week. */
  frequency: string | null;
  /** Screen 12 — the split. `flat` routes the clustering engine to flat mode. */
  split: string | null;
  /** Screen 13 — the lifts Recore watches, in pick order. */
  keyLifts: string[];
  /** Screen 13 — current load per lift, in kilograms. */
  liftLoads: Record<string, number>;
  /**
   * Screen 13 — the smallest plate in their gym, in kilograms.
   *
   * `null` means "not answered", which is a first-class outcome: the screen
   * offers a skip and says the answer can be added later. Screen 17 rounds its
   * prescription to something loadable only when this is known, and says so
   * either way — a target of 82.5 kg is a fiction in a gym whose smallest
   * plate is 2.5.
   */
  smallestPlateKg: number | null;
  /** Screen 15 — whether the hold completed. */
  committed: boolean;
  /** Screen 18 — when the weekly recap should arrive. */
  recap: string | null;
  /**
   * Screen 18 — what iOS said when we asked for notification permission.
   *
   * `null` until asked. This is intent versus reality: `recap` is what they
   * chose, this is whether the recap can actually be delivered, and the screen
   * has to be honest about the gap.
   */
  notificationsGranted: boolean | null;
}

export const EMPTY_V2: V2Answers = {
  tracker: null,
  obstacles: [],
  attribution: null,
  demoText: '',
  demoEntries: [],
  name: '',
  goal: null,
  experience: null,
  frequency: null,
  split: null,
  keyLifts: [],
  liftLoads: {},
  smallestPlateKg: null,
  committed: false,
  recap: null,
  notificationsGranted: null,
};

interface V2Store {
  answers: V2Answers;
  /** 1-based position in `FLOW`; the route records it on every view so a killed
   * app resumes where it stopped. */
  step: number;
  set: <K extends keyof V2Answers>(key: K, value: V2Answers[K]) => void;
  /** Toggle membership of a list answer, capped. Used by screens 3 and 13. */
  toggle: (key: 'obstacles' | 'keyLifts', value: string, max: number) => void;
  setLoad: (lift: string, kg: number) => void;
  setStep: (step: number) => void;
  reset: () => void;
}

const STORAGE_KEY = 'pref_ob_v2';

/**
 * SANDBOX MODE — module state, not store state, and deliberately not persisted.
 *
 * It gates the storage adapter, which has to answer "may I write this?" outside
 * of any React render, and it must not itself be a thing that can be restored
 * from disk: an app killed inside a dev run has to come back as an ordinary
 * install, not as a sandbox that never ends.
 */
let sandbox = false;

/**
 * Which kind of run is on screen. The route reasserts it from its own `dev`
 * search param on every screen, so the mode is a property of the navigation
 * rather than a latch somebody can leave on: a dev run that is abandoned
 * halfway cannot make the next real onboarding silently write nothing.
 *
 * LEAVING A DEV RUN REHYDRATES, and that is not housekeeping: the sandbox run
 * left its own answers in memory, and without this the next real write would
 * persist a dev run's name and lifts over the person's own. The storage is
 * synchronous, so the real answers are back before the next render.
 */
export function setSandboxRun(on: boolean): void {
  if (on === sandbox) return;
  sandbox = on;
  if (!on) void useV2.persist.rehydrate();
}

export function isSandboxRun(): boolean {
  return sandbox;
}

/**
 * Start a development run: the mode goes on FIRST, then the answers are cleared
 * so the run opens blank.
 *
 * THE STORED ROW IS NOT TOUCHED, and the order is what guarantees it: the
 * adapter refuses every write while the mode is on, so the reset below empties
 * memory only, and leaving the run rehydrates the person's real answers off the
 * disk they never left. A dev row that wiped somebody's onboarding to show them
 * the funnel would be the exact thing §0 was written against.
 */
export function beginSandboxRun(): void {
  setSandboxRun(true);
  useV2.getState().reset();
}

const sqliteStorage = {
  getItem: (name: string) => getMeta(name),
  setItem: (name: string, value: string) => {
    if (sandbox) return; // §0: a dev run touches no storage, ever.
    setMeta(name, value);
  },
  removeItem: (name: string) => {
    if (sandbox) return;
    setMeta(name, null);
  },
};

export const useV2 = create<V2Store>()(
  persist(
    (set) => ({
      answers: { ...EMPTY_V2 },
      step: 1,
      set: (key, value) => set((s) => ({ answers: { ...s.answers, [key]: value } })),
      toggle: (key, value, max) =>
        set((s) => {
          const current = s.answers[key];
          const next = current.includes(value)
            ? current.filter((v) => v !== value)
            : // Oldest out when the cap is reached, so the last tap always lands.
              [...current, value].slice(-max);
          return { answers: { ...s.answers, [key]: next } };
        }),
      setLoad: (lift, kg) =>
        set((s) => ({
          answers: { ...s.answers, liftLoads: { ...s.answers.liftLoads, [lift]: kg } },
        })),
      setStep: (step) => set({ step }),
      reset: () => set({ answers: { ...EMPTY_V2 }, step: 1 }),
    }),
    {
      name: STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() => sqliteStorage),
      partialize: (s) => ({ answers: s.answers, step: s.step }),
      /**
       * EVERY ANSWER EXISTS AFTER A REHYDRATE, whatever the stored row is
       * missing — the same guarantee `state/onboarding.ts` makes, for the same
       * reason: a field added without a version bump would come back
       * `undefined`, and `undefined` is not a value `V2Answers` admits.
       */
      merge: (persisted, current) => {
        const stored = (persisted ?? {}) as Partial<{ answers: Partial<V2Answers>; step: number }>;
        return {
          ...current,
          answers: { ...EMPTY_V2, ...(stored.answers ?? {}) },
          step: stored.step ?? current.step,
        };
      },
    },
  ),
);

/** Read the answers outside React (analytics, the route's guards, the commit). */
export function v2Answers(): V2Answers {
  return useV2.getState().answers;
}

/**
 * Forget the run and its stored row. Used by the You tab's development rows and
 * by nothing in the product — a person does not re-run onboarding by accident.
 *
 * It clears the meta row directly rather than through the adapter, because the
 * adapter refuses to write during a dev run and clearing is the one thing a dev
 * run is allowed to want.
 */
export function clearV2Run(): void {
  useV2.getState().reset();
  try {
    setMeta(STORAGE_KEY, null);
  } catch {
    // Dev-only path; a failed clear is never worth an error.
  }
}
