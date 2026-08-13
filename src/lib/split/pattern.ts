/**
 * MOVEMENT PATTERN — which half of a split an exercise belongs to. PURE, zero
 * I/O, runs under `node --test`.
 *
 * It exists so the app can look at a finished session and offer a NAME for it
 * ("Push"), which is the one thing standing between a written record and a
 * split the athlete never had to author by hand. `plan_days` already stores the
 * split, `computePlanStrip` already progresses it, and `predict/split.ts`
 * already clusters sessions by exercise overlap — but every cluster it finds is
 * an anonymous integer. This gives one a name to suggest.
 *
 * ## The suggestion is never the decision
 *
 * Nothing in this file writes anything. It returns a STRING TO OFFER, and the
 * athlete confirms or replaces it before a split day is created (CLAUDE.md
 * rule 2: personalise only from chosen information). That is not politeness —
 * it is the only honest design available, because a real chunk of this
 * vocabulary is genuinely contested:
 *
 * **The deadlift problem.** A deadlift is a leg day to one lifter and a pull
 * day to the next, and both are right. So are the Romanian deadlift, the
 * upright row, the pullover and every olympic lift. Those return `null` on
 * purpose — they are listed in `CONTESTED` above every other rule so no later
 * pattern can swallow them. Do NOT "fix" this with a cleverer lexicon; the
 * ambiguity is real, and the confirm step is where it gets resolved by the only
 * person who knows the answer.
 *
 * ## Order is the whole implementation
 *
 * The rules are tried in sequence and the FIRST match wins, because the English
 * names collide: "leg press" contains *press* (push), "leg curl" contains
 * *curl* (pull), "hanging leg raise" contains *leg* (legs), and "rear delt fly"
 * contains *fly* (push) while being the most pull movement in the gym. Every
 * one of those is a test case. Re-ordering this array is a behaviour change.
 */

export type MovementPattern = 'push' | 'pull' | 'legs' | 'core';

interface Rule {
  re: RegExp;
  /** `null` = deliberately contested; see the deadlift note above. */
  pattern: MovementPattern | null;
}

/**
 * Ordered. First match wins. Matched against the canonical name lowercased,
 * with punctuation flattened to spaces so "push-up", "push up" and "pushup"
 * are one thing.
 */
const RULES: readonly Rule[] = [
  // 1. CONTESTED — checked before everything, so no later rule can claim them.
  { re: /\bdead ?lift|\brdl\b|\bstiff leg|good ?morning/, pattern: null },
  { re: /upright row|pull ?over/, pattern: null },
  { re: /\bclean\b|\bsnatch\b|\bjerk\b|thruster/, pattern: null },
  { re: /back ?extension|hyper ?extension/, pattern: null },
  { re: /farmer|\bcarry\b|sled/, pattern: null },

  // 2. CORE — before legs, or "hanging leg raise" reads as a leg movement.
  { re: /\bab\b|\babs\b|crunch|sit ?up|plank|leg raise|knee raise|russian twist|hollow|dead ?bug|wood ?chop|pallof|ab wheel|roll ?out/, pattern: 'core' },

  // 3. PULL overrides — before push, or the word "fly" claims the rear delt.
  { re: /rear delt|reverse fly|reverse pec|face pull/, pattern: 'pull' },

  // 4. LEGS — before push/pull, or "leg press" and "leg curl" go the wrong way.
  { re: /squat|\bleg press|leg extension|leg curl|\blunge|split squat|bulgarian|hip thrust|glute|\bcalf|hamstring|\bquad|step ?up|adductor|abductor|\bhack\b|leg day/, pattern: 'legs' },

  // 5. PUSH.
  { re: /bench|\bchest|\bdip\b|\bdips\b|\bfly\b|\bflye|pec deck|push ?up|\bpress\b|pressing|overhead press|\bohp\b|shoulder press|military|tricep|skull|push ?down|press ?down|lateral raise|side raise|front raise|\bdelt raise/, pattern: 'push' },

  // 6. PULL.
  { re: /\brow\b|rowing|pull ?up|chin ?up|pull ?down|\blat\b|\blats\b|pulldown|\bcurl|\bshrug|high pull|\bpull\b/, pattern: 'pull' },
];

/** Punctuation and doubled spaces flattened, so one name has one spelling. */
function normalize(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * The pattern an exercise belongs to, or `null` when the lexicon does not know
 * it OR deliberately refuses to choose (see `CONTESTED`). The two are the same
 * answer on purpose: both mean "this set does not vote", and both make the
 * suggested label less confident rather than more wrong.
 */
export function patternOf(canonical: string): MovementPattern | null {
  const name = normalize(canonical);
  if (!name) return null;
  for (const rule of RULES) {
    if (rule.re.test(name)) return rule.pattern;
  }
  return null;
}

/** One exercise of a finished session, with the working sets it actually got. */
export interface SessionExercise {
  canonical: string;
  /** Counted working sets — warmups, drops and skipped sets do not vote. */
  sets: number;
}

export interface PatternShares {
  push: number;
  pull: number;
  legs: number;
  core: number;
  /** Sets whose exercise the lexicon would not classify. */
  unknown: number;
  /** Every counted set, including `unknown`. */
  total: number;
}

/**
 * Shares of the session by WORKING SET, not by exercise.
 *
 * Four sets of bench and one set of curls is a push day; counting exercises
 * would call it an even split. Volume is what makes a session what it is, and
 * it is also what the athlete means by "I did more chest today".
 *
 * The denominator includes `unknown`, deliberately: a session the lexicon half
 * understands must come out LESS confident, not artificially confident over the
 * half it happened to recognise.
 */
export function sharesOf(exercises: readonly SessionExercise[]): PatternShares {
  const counts = { push: 0, pull: 0, legs: 0, core: 0, unknown: 0 };
  let total = 0;
  for (const ex of exercises) {
    const sets = Number.isFinite(ex.sets) ? Math.max(0, Math.floor(ex.sets)) : 0;
    if (sets === 0) continue;
    total += sets;
    const pattern = patternOf(ex.canonical);
    if (pattern) counts[pattern] += sets;
    else counts.unknown += sets;
  }
  if (total === 0) return { ...counts, total: 0 };
  return {
    push: counts.push / total,
    pull: counts.pull / total,
    legs: counts.legs / total,
    core: counts.core / total,
    unknown: counts.unknown / total,
    total,
  };
}

/** One pattern this far ahead names the whole session. */
const DOMINANT = 0.65;
/** Push and pull together, with legs barely present, is an upper day. */
const UPPER = 0.7;
const UPPER_LEGS_MAX = 0.2;
/** Both halves present this much, and most of the session accounted for. */
const MIXED = 0.25;

/**
 * The name to OFFER for a finished session, or `null` when the record does not
 * support one.
 *
 * `null` is a first-class answer and the sheet must honour it by opening with
 * an EMPTY field rather than a guess: §15 and CLAUDE.md rule 2 both land in the
 * same place — an app that confidently mislabels someone's training teaches
 * them the labels are noise.
 *
 * Single patterns are tested before combinations, so a pure push day is "Push"
 * and never "Upper".
 */
export function suggestSplitLabel(exercises: readonly SessionExercise[]): string | null {
  const s = sharesOf(exercises);
  if (s.total === 0) return null;

  if (s.push >= DOMINANT) return 'Push';
  if (s.pull >= DOMINANT) return 'Pull';
  if (s.legs >= DOMINANT) return 'Legs';

  const upper = s.push + s.pull;
  if (upper >= UPPER && s.legs < UPPER_LEGS_MAX) return 'Upper';

  if (upper >= MIXED && s.legs >= MIXED && upper + s.legs >= UPPER) return 'Full body';

  return null;
}
