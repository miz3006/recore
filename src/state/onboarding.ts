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
  | 'notifications';

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
  notifications: null,
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
      // primaryLift added. An old snapshot restarts the flow instead of
      // mis-resuming with keys the steps no longer read.
      version: 4,
      migrate: (persisted, version) =>
        version < 4
          ? { answers: EMPTY_ANSWERS, currentStep: 1 }
          : (persisted as { answers: Answers; currentStep: number }),
      storage: createJSONStorage(() => sqliteStorage),
      partialize: (s) => ({ answers: s.answers, currentStep: s.currentStep }),
    },
  ),
);
