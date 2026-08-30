import type { SessionRow } from './sections.ts';

/**
 * WHAT CHANGED SINCE LAST TIME — the session summarised by its own decisions
 * (owner, 29 August 2026).
 *
 * Tiimo groups a planned day into tinted, counted pills — MORNING (2),
 * EVENING (9) — and the strip does more work than its size suggests: it tells
 * you the shape of the day before you have read one item in it. Next has a
 * better thing to group by than time, because the athlete already knows what
 * lifts are in their push day. What they do not know is **which of them moved,
 * and which did not.**
 *
 *     GOING UP · 3    HOLDING · 1    BACKING OFF · 1
 *
 * That is the answer to "what is different this week" in one glance, and it is
 * derived from `Move` — the engine's own lever — so it invents nothing.
 *
 * ## The strip does not reorder the session
 *
 * These are a SUMMARY, not section headers, and the distinction is a rule
 * rather than a layout preference. Grouping the cards under these headings
 * would reorder the session — progressions first, plateaus after — and the
 * order somebody trains in is a training opinion the app does not hold (§20:
 * *"we never tell someone what to train"*). The list stays in the session's own
 * order; the strip counts across it.
 *
 * ## Every pill opens its own reason
 *
 * Tapping one explains WHY the engine moved that lever, in the app's own words
 * — the rule, not a per-lift restatement — and then lists the lifts it applies
 * to with the reason each already carries. It is the audit thesis of this
 * screen taken one level up: the row says *what* changed, the pill says *what
 * rule changed it*.
 *
 * **The copy below is fixed text about the ENGINE, never about the athlete.**
 * It describes what the code does; it makes no claim about a person, their
 * body or their training. No model touches it, so there is nothing here for a
 * guard to validate (§9).
 *
 * Pure, node-testable, no I/O.
 */

export type GroupKey = 'up' | 'hold' | 'backoff' | 'new';

export interface Group {
  key: GroupKey;
  /** The pill's own word. Uppercased by the component, not here. */
  label: string;
  rows: SessionRow[];
}

export interface GroupExplainer {
  /** One sentence naming what the group IS, with its count folded in. */
  title: string;
  /** The rule, in plain language. Two sentences at most. */
  body: string;
}

/** Fixed order, so the strip never rearranges itself between two reads. It
 * runs progress → held → backed off → not yet known, which is the order the
 * facts change what somebody does. */
const ORDER: GroupKey[] = ['up', 'hold', 'backoff', 'new'];

const LABEL: Record<GroupKey, string> = {
  up: 'Going up',
  hold: 'Holding',
  backoff: 'Backing off',
  new: 'New',
};

/**
 * Which group a row belongs to.
 *
 * A PLATEAU OUTRANKS THE LEVER, the same way it outranks it in the reason line:
 * a lift held for the third session is in Holding whether the engine phrased its
 * move as `hold` or not, because "you have been here three times" is the fact
 * that changes what the athlete does.
 *
 * A row with no prescription is `new` — the record has nothing on it yet. A row
 * with a prescription but no lever (cardio, a carry, a ghost cached before the
 * levers were stored) belongs to no group and is simply not counted: a summary
 * that quietly files unknowns under "going up" would be the screen guessing.
 */
export function groupOf(row: SessionRow): GroupKey | null {
  if (!row.prescription) return 'new';
  if (row.watch) return 'hold';
  switch (row.move?.kind) {
    case 'weight':
    case 'rep':
      return 'up';
    case 'hold':
      return 'hold';
    case 'backoff':
      return 'backoff';
    default:
      return null;
  }
}

/** The session's groups, in fixed order, empty ones dropped. */
export function groupsOf(rows: readonly SessionRow[]): Group[] {
  const buckets = new Map<GroupKey, SessionRow[]>();
  for (const row of rows) {
    const key = groupOf(row);
    if (!key) continue;
    const found = buckets.get(key);
    if (found) found.push(row);
    else buckets.set(key, [row]);
  }
  return ORDER.filter((key) => buckets.has(key)).map((key) => ({
    key,
    label: LABEL[key],
    rows: buckets.get(key)!,
  }));
}

/**
 * The rule behind a group, as the sheet says it.
 *
 * Second person, plain, and about the ENGINE — "the load goes up", not "you are
 * getting stronger". The app is a calculation and not coaching (the Terms say
 * so in as many words), and the difference between those two sentences is the
 * whole of it.
 */
export function explain(key: GroupKey, count: number): GroupExplainer {
  const n = `${count} ${count === 1 ? 'lift' : 'lifts'}`;
  switch (key) {
    case 'up':
      return {
        title: `${n} moving up`,
        body:
          'You finished every set in range at the last weight, so there is nothing left to earn there. The load goes up by one plate pair, or the target gains a rep — whichever your last session had room for.',
      };
    case 'hold':
      return {
        title: `${n} holding`,
        body:
          'The weight stays where it is. Either you came in under the rep range last time, or you have now met this weight three sessions running — and adding load before you have cleared the reps is how a lift stops moving for a month.',
      };
    case 'backoff':
      return {
        title: `${n} backing off`,
        body:
          'Three sessions at the same weight and the same reps. The target drops by about a tenth so you can climb back through it — a deliberate step down, not a lost session.',
      };
    case 'new':
      return {
        title: `${n} with no history`,
        body:
          'Recore has nothing to progress from yet, so it prescribes nothing. Write one session with these and each gets a target the next time you open this screen.',
      };
  }
}
