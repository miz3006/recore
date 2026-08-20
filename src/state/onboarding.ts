import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { getMeta, setMeta } from '@/lib/db/index';

/**
 * Answers for the illustrated onboarding flow, persisted so a killed app
 * resumes on the same step.
 *
 * Persistence goes through the SQLite meta KV (`lib/db`), which IS expo-sqlite
 * and synchronous — the store hydrates in the same tick it is created, so there
 * is never a flash of the wrong step. The key is `pref_*` ON PURPOSE:
 * `export-json.ts` carries every `pref_%` row and account deletion drops the
 * whole meta table, so these answers (they are personal data — §12) get the
 * export and deletion guarantees for free, exactly like `lib/prefs.ts`.
 *
 * Values are option ids from the flow config (`components/onboarding/config.ts`).
 * `gender` doubles as the switch for the step-3 illustration variant.
 */

export type AnswerKey =
  | 'name'
  | 'gender'
  | 'goal'
  | 'experience'
  | 'tracker'
  /** §5 screen 10 — structured / flexible / hybrid; feeds `setSessionFeel`. */
  | 'sessionFeel'
  /** Monday-first 7-bit day mask, stored as a decimal string (`toggleDay`). */
  | 'trainingDays'
  /** Free-text priority movement — feeds `setPrimaryLift` at completion. */
  | 'primaryLift'
  /** Rest length in seconds ('60'…'180') — feeds the toolbar timer default. */
  | 'restSeconds'
  /** The RAW typed weight text — converted to kg once, at completion. */
  | 'bodyweight'
  /** Display unit; null = derive from the device locale (`lib/locale.ts`). */
  | 'weightUnit'
  /** Commitment horizon. The v3 flow has ONE horizon (12 weeks, the design's
   * own constant) and the screen asks for a hold rather than a length, so this
   * reads '12w' once the person has committed and stays null if they never
   * did. Context only; never read as a target. */
  | 'commitment'
  | 'notifications'
  /** v3 screen 3 — what stops them logging today. A SET of option ids, joined
   * by `serializeList`; it changes nothing deterministic and is kept so the
   * answer can be read back in copy and counted in the funnel. */
  | 'obstacles'
  /** v3 screen 10 — the lifts Recore watches closest. A SET of exercise names
   * (`serializeList`); the first of them becomes `primaryLift` at completion. */
  | 'keyLifts'
  /** v3 screen 10 — starting load per key lift, as a JSON map of name to a
   * number IN THE DISPLAY UNIT (`parseLiftLoads`). The projection screen is its
   * only reader; nothing is written to the record from it. */
  | 'liftLoads'
  /**
   * THE LINE THE PERSON TYPED ON THE DEMO SCREEN, and the reading made of it —
   * a `DemoEntry` as JSON (`lib/demo-parse.ts`).
   *
   * It is the one answer that is not an option id, and the one answer that
   * leaves the flow: the key-lift screen pre-selects from it, the overload card
   * and the projection are built out of it, and after signup its RAW TEXT is
   * seeded as the first real session (`lib/onboarding-seed.ts`) so the app
   * opens on the person's own writing rather than on an empty page.
   *
   * Null when the demo was never completed, or when all the person saw was the
   * canned fallback — nothing the app invents is ever stored here.
   */
  | 'demoEntry'
  /**
   * WHERE THEY FOUND RECORE — one tap, late in the flow, and skippable.
   *
   * Distribution is ASO-first, and the store's own attribution stops at the
   * channel it can see. This is the only signal that separates "found us by
   * searching" from "came from a video" from "a friend told them", which is the
   * difference between a keyword to defend and a post to make more of.
   *
   * It is the one question in the flow that changes nothing the person will
   * see, and it is kept anyway — asked AFTER the projection has been earned,
   * where it reads as a company asking a question rather than as marketing.
   * Null is a first-class answer: Continue never waits for it.
   */
  | 'attribution';

export type Answers = Record<AnswerKey, string | null>;

export const EMPTY_ANSWERS: Answers = {
  name: null,
  gender: null,
  goal: null,
  experience: null,
  tracker: null,
  sessionFeel: null,
  trainingDays: null,
  primaryLift: null,
  restSeconds: null,
  bodyweight: null,
  weightUnit: null,
  commitment: null,
  notifications: null,
  obstacles: null,
  keyLifts: null,
  liftLoads: null,
  demoEntry: null,
  attribution: null,
};

interface OnboardingAnswersState {
  answers: Answers;
  /** 1-based position in the flow; the renderer records it on every mount. */
  currentStep: number;
  setAnswer: (key: AnswerKey, value: string) => void;
  setStep: (step: number) => void;
  /** Development helper — wipes answers, position, and the persisted row. */
  reset: () => void;
}

const STORAGE_KEY = 'pref_ob_illustrated';

/**
 * The attribution screen's 1-based position in the flow (`config.ts`), spelled
 * out here for the v6 → v7 migration alone.
 *
 * A number rather than an import: `config.ts` imports this module for its
 * answer types, and a store that imported the config back would be a cycle —
 * and the config only loads inside Metro anyway. If the screen ever moves, this
 * migration is finished with; it only ever ran once.
 */
const ATTRIBUTION_STEP = 13;

const sqliteStorage = {
  getItem: (name: string) => getMeta(name),
  setItem: (name: string, value: string) => setMeta(name, value),
  removeItem: (name: string) => setMeta(name, null),
};

export const useOnboardingAnswers = create<OnboardingAnswersState>()(
  persist(
    (set) => ({
      answers: EMPTY_ANSWERS,
      currentStep: 1,
      setAnswer: (key, value) => set((s) => ({ answers: { ...s.answers, [key]: value } })),
      setStep: (step) => set({ currentStep: step }),
      reset: () => set({ answers: EMPTY_ANSWERS, currentStep: 1 }),
    }),
    {
      name: STORAGE_KEY,
      // v2: welcome step shifted numbering. v3: day mask + typed weight.
      // v4: the §5 alignment pass (30 Jul) — company/commitment deleted,
      // routine became sessionFeel, restTimer became restSeconds, name and
      // primaryLift added. v5: the 21-screen rebuild (11 Aug) — commitment
      // returned with consumers (its affirm line, the building checklist) and
      // the flow grew to twenty config screens, so old positions mis-resume.
      // An old snapshot restarts the flow instead of mis-resuming with keys
      // the steps no longer read.
      // v6: the v3 design import (18 Aug) — fourteen screens in a new order,
      // three new answers (obstacles, key lifts, their loads), and questions
      // the flow no longer asks (rest length, bodyweight). Every stored
      // position is wrong against the new array, so an old snapshot restarts.
      // v7: the attribution screen (20 Aug 2026) is inserted BEFORE the recap,
      // so every stored position from there on names a different screen than it
      // used to. Answers keep — they are keyed by name, not by index — and only
      // a position inside the shifted tail is moved, onto the new screen itself.
      version: 7,
      migrate: (persisted, version) => {
        if (version < 6) return { answers: EMPTY_ANSWERS, currentStep: 1 };
        const prior = persisted as { answers: Answers; currentStep: number };
        if (version < 7) {
          return {
            answers: prior.answers,
            currentStep: prior.currentStep >= ATTRIBUTION_STEP ? ATTRIBUTION_STEP : prior.currentStep,
          };
        }
        return prior;
      },
      storage: createJSONStorage(() => sqliteStorage),
      partialize: (s) => ({ answers: s.answers, currentStep: s.currentStep }),
      /**
       * EVERY KEY EXISTS AFTER A REHYDRATE, whatever the stored row is missing.
       *
       * `migrate` only runs when the version moves, so a key added WITHOUT a
       * bump (the ordinary case — a new answer that mis-resumes nothing) would
       * come back `undefined` on an old snapshot, and `undefined` is not a
       * value `Answers` admits. Merging over `EMPTY_ANSWERS` on every rehydrate
       * makes "unanswered" one thing instead of two, so every reader can keep
       * checking for null alone.
       */
      merge: (persisted, current) => {
        const stored = (persisted ?? {}) as Partial<{
          answers: Partial<Answers>;
          currentStep: number;
        }>;
        return {
          ...current,
          answers: { ...EMPTY_ANSWERS, ...(stored.answers ?? {}) },
          currentStep: stored.currentStep ?? current.currentStep,
        };
      },
    },
  ),
);
