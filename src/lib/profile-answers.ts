import {
  FLOW,
  KEY_LIFTS,
  MAX_KEY_LIFTS,
  type Option,
} from '@/components/onboarding-v2/flow';
import { getMeta, setMeta } from '@/lib/db/index';
import type { Experience, Goal } from '@/lib/onboarding';
import { trackerToPref } from '@/lib/onboarding-v2-map';
import { setExperience, setGoal, setObTracker, setPrimaryLift } from '@/lib/prefs';

/**
 * THE ONBOARDING ANSWERS, AFTER ONBOARDING (28 August 2026).
 *
 * The v2 flow asks seven questions that shape the product — where they log
 * today, what gets in the way, goal, experience, sessions a week, split, key
 * lifts — and until this file existed there was nowhere for any of them to live
 * once the flow closed. `state/onboarding-v2.ts`
 * is an in-memory zustand store whose own header says "every run starts clean":
 * killing the app loses the run, by design, because it is a sandbox. That is the
 * right storage for a flow being run twenty times in an afternoon and the wrong
 * storage for an answer a person expects to still be true next week.
 *
 * So the ANSWERS OF RECORD live here, in the meta KV, under `pref_*` keys. That
 * prefix is not cosmetic: `export-json.ts` carries every `pref_%` row and
 * `account/delete.ts` drops the whole `meta` table, so all of them inherit §12's
 * export and deletion guarantees the moment they are written, with no further
 * work anywhere.
 *
 * ## What this file is NOT
 *
 * It is not a second onboarding store, and it is not written to screen by
 * screen. The flow keeps its answers in `state/onboarding-v2.ts` for the length
 * of a run and calls `commitV2Onboarding` once at the end, which is the single
 * commit point a flow should have. Nothing here reads that store; the traffic in
 * the other direction — record back into the store, so a replay of the flow
 * starts from what Profile says today — is `lib/onboarding-v2-seed.ts`.
 *
 * The sandbox rule in `docs/onboarding-v2-spec.md` §0 — "running it must not
 * overwrite name/split/key lifts" — is intact: a dev run writes nothing to disk
 * and never reaches the commit.
 *
 * ## Why the option lists are imported rather than restated
 *
 * `flow.ts` already declares every option id and its label, and it is the file
 * an owner edits when the wording changes. A second copy here would drift within
 * a month and the drift would show as a Profile row reading "Push / Pull / Legs"
 * for an answer the flow now calls something else. `optionsFor` reads the flow,
 * `getAnswer` validates against it, and an id that no longer exists reads as
 * unanswered rather than as a stale label.
 *
 * ## The v1 mirrors
 *
 * Four of the old `pref_*` answers still have live readers: `pref_goal` feeds
 * `focusForGoal` in `predict/data.ts` and `db/strip.ts` and the paywall's copy,
 * `pref_primary_lift` feeds the paywall and the empty-note cards, and
 * `pref_ob_tracker` decides whether the import fast path is offered. The two
 * vocabularies are not the same — v2 asks "hypertrophy / strength / both /
 * consistency / hybrid" where v1 asked "muscle / strength / fitness / sport /
 * both" — so every write below ALSO writes the mapped v1 value. Leaving
 * `pref_goal` stale would mean the prediction engine quietly kept using an
 * answer the person had just changed on screen.
 */

/**
 * The five single-choice answers. The two list answers — key lifts and
 * obstacles — have their own APIs below.
 *
 * `tracker` joined them on 29 August 2026. Screen 2 has always been asked and
 * has always decided something real (whether the CSV import fast path is
 * offered), but until now the only thing that survived it was the DERIVED
 * `pref_ob_tracker` enum — four flow options collapsed onto three values, with
 * no way back. So Profile could not show what the person actually said and
 * could not let them change it, and somebody who moved from a paper notebook to
 * Hevy had no way to tell Recore. The answer of record is now the flow's own id;
 * the derived pref is written beside it, exactly as goal and experience are.
 */
export type AnswerId = 'goal' | 'experience' | 'frequency' | 'split' | 'tracker';

const KEYS: Record<AnswerId, string> = {
  goal: 'pref_training_goal',
  experience: 'pref_training_experience',
  frequency: 'pref_weekly_sessions',
  split: 'pref_split',
  tracker: 'pref_current_tracker',
};

const KEY_LIFTS_KEY = 'pref_key_lifts';
const LIFT_LOADS_KEY = 'pref_lift_loads';
const OBSTACLES_KEY = 'pref_obstacles';

/**
 * v2's goal ids → the `Goal` the engine has always taken. `consistency` maps to
 * `fitness` and `hybrid` to `sport` because those are the v1 answers that select
 * the same rep-range fallback; nothing here invents a sixth focus.
 */
const GOAL_TO_V1: Readonly<Record<string, Goal>> = {
  hypertrophy: 'muscle',
  strength: 'strength',
  both: 'both',
  consistency: 'fitness',
  hybrid: 'sport',
};

/**
 * v2 asks for a duration, v1 stored a stage. Four buckets fold into three:
 * everything past two years is "experienced" as far as v1's copy is concerned.
 * The v2 answer stays the finer one — `incrementKg` reads it, not this.
 */
const EXPERIENCE_TO_V1: Readonly<Record<string, Experience>> = {
  under6m: 'new',
  '6m2y': 'building',
  '2y5y': 'experienced',
  over5y: 'experienced',
};

/** The flow screen whose options an answer is drawn from. Same id, on purpose. */
export function optionsFor(id: AnswerId): readonly Option[] {
  return FLOW.find((s) => s.id === id)?.options ?? [];
}

/** The question, as the flow words it — so the picker and the flow cannot drift. */
export function headlineFor(id: AnswerId): string {
  return FLOW.find((s) => s.id === id)?.headline ?? '';
}

export function sublineFor(id: AnswerId): string | undefined {
  return FLOW.find((s) => s.id === id)?.subline;
}

/**
 * The stored answer, or null. Validated against the flow's own option list: an
 * id that has since been renamed or removed reads as unanswered, which is the
 * honest outcome — better a row that says "Not set" than one that prints a
 * label for a choice the app no longer offers.
 */
export function getAnswer(id: AnswerId): string | null {
  const stored = getMeta(KEYS[id]);
  if (!stored) return null;
  return optionsFor(id).some((o) => o.id === stored) ? stored : null;
}

/** Writes the answer of record, then the v1 mirror any live reader still uses. */
export function setAnswer(id: AnswerId, value: string): void {
  setMeta(KEYS[id], value);
  if (id === 'goal') {
    const v1 = GOAL_TO_V1[value];
    if (v1) setGoal(v1);
  }
  if (id === 'experience') {
    const v1 = EXPERIENCE_TO_V1[value];
    if (v1) setExperience(v1);
  }
  if (id === 'tracker') {
    // `wantsImportFastPath` and `import-start.tsx` both read the derived enum,
    // so changing the answer in Profile has to move it too — otherwise the
    // import screen would go on naming a tracker the person just left.
    const pref = trackerToPref(value);
    if (pref) setObTracker(pref);
  }
}

/** What the Profile row prints on the right. Never a guess. */
export function labelFor(id: AnswerId): string {
  const chosen = getAnswer(id);
  if (!chosen) return 'Not set';
  return optionsFor(id).find((o) => o.id === chosen)?.label ?? 'Not set';
}

/**
 * The lifts Recore watches, in pick order, capped at `MAX_KEY_LIFTS`. Unknown
 * names are dropped for the same reason a stale answer id is: `KEY_LIFTS` is the
 * list the picker offers, and a lift not on it has no row to be edited from.
 */
export function getKeyLifts(): string[] {
  const raw = getMeta(KEY_LIFTS_KEY);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((v): v is string => typeof v === 'string')
      .filter((v) => KEY_LIFTS.some((l) => l.id === v))
      .slice(0, MAX_KEY_LIFTS);
  } catch {
    return [];
  }
}

/**
 * Writes the list, and mirrors the FIRST one onto `pref_primary_lift` — the
 * paywall and the empty-note cards both read it, and "the lift you named first"
 * is exactly what that pref has always meant.
 */
export function setKeyLifts(lifts: string[]): void {
  const kept = lifts.filter((v) => KEY_LIFTS.some((l) => l.id === v)).slice(0, MAX_KEY_LIFTS);
  setMeta(KEY_LIFTS_KEY, JSON.stringify(kept));
  if (kept[0]) setPrimaryLift(kept[0]);
}

/** Current working load per lift, in kilograms. Absent is a real answer. */
export function getLiftLoads(): Record<string, number> {
  const raw = getMeta(LIFT_LOADS_KEY);
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const out: Record<string, number> = {};
    for (const [lift, kg] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof kg === 'number' && Number.isFinite(kg) && kg > 0) out[lift] = kg;
    }
    return out;
  } catch {
    return {};
  }
}

export function setLiftLoad(lift: string, kg: number): void {
  setMeta(LIFT_LOADS_KEY, JSON.stringify({ ...getLiftLoads(), [lift]: kg }));
}

/**
 * The key-lifts row's value. Two names fit; three do not, so the third becomes a
 * count — the same shape the session-types row already uses, so two rows in one
 * list truncate the same way.
 */
export function keyLiftsLabel(): string {
  const lifts = getKeyLifts();
  if (lifts.length === 0) return 'Not set';
  if (lifts.length <= 2) return lifts.join(', ');
  return `${lifts.slice(0, 2).join(', ')} +${lifts.length - 2}`;
}

// --- what gets in the way ----------------------------------------------------

/**
 * SCREEN 3'S ANSWER, WHICH USED TO EVAPORATE.
 *
 * "What gets in the way?" is the question that decides which value proposition
 * leads on the reveal and on the paywall, and it was the one product-shaping
 * answer the commit never wrote anywhere. It survived only inside the v2 store —
 * fine while that store was a sandbox, wrong the moment the flow became the one
 * a real person walks through, because Profile could neither show it nor let
 * them change it, and nothing outside the flow could read it.
 *
 * It is a list, capped by the flow's own `max`, and it is stored and validated
 * the same way the key lifts are: unknown ids are dropped rather than printed.
 */
const OBSTACLE_SCREEN = FLOW.find((s) => s.id === 'obstacles');

/** "Pick up to two" — read from the screen, never restated. */
export const MAX_OBSTACLES = OBSTACLE_SCREEN?.max ?? 2;

export function obstacleOptions(): readonly Option[] {
  return OBSTACLE_SCREEN?.options ?? [];
}

export function obstaclesHeadline(): string {
  return OBSTACLE_SCREEN?.headline ?? '';
}

export function obstaclesSubline(): string | undefined {
  return OBSTACLE_SCREEN?.subline;
}

export function getObstacles(): string[] {
  const raw = getMeta(OBSTACLES_KEY);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((v): v is string => typeof v === 'string')
      .filter((v) => obstacleOptions().some((o) => o.id === v))
      .slice(0, MAX_OBSTACLES);
  } catch {
    return [];
  }
}

export function setObstacles(ids: string[]): void {
  const kept = ids.filter((v) => obstacleOptions().some((o) => o.id === v)).slice(0, MAX_OBSTACLES);
  setMeta(OBSTACLES_KEY, JSON.stringify(kept));
}

/**
 * The row's value, on the right, where there is room for two words and not for
 * "I never know what weight to use next".
 *
 * The count is the flow's own way of summarising this answer — `echo.ts` prints
 * "One thing to fix" / "Two things to fix" under the same question — and the
 * chosen options themselves are named in the row's sub line, where two lines of
 * body text actually fit.
 */
export function obstaclesLabel(): string {
  const count = getObstacles().length;
  if (count === 0) return 'Not set';
  return count === 1 ? 'One thing' : `${count} things`;
}

/** The chosen frustrations, in the flow's own words, for the row's sub line. */
export function obstaclesSub(): string | undefined {
  const chosen = getObstacles();
  if (chosen.length === 0) return undefined;
  return chosen
    .map((id) => obstacleOptions().find((o) => o.id === id)?.label)
    .filter((l): l is string => !!l)
    .join(' · ');
}
