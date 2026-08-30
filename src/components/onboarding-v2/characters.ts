/**
 * WHERE THE CAP CHARACTER APPEARS — the whole rule, as data, in one file.
 *
 * `docs/onboarding-v2-spec.md` §4: "Declare per-screen presence in one file, as
 * data, not scattered conditionals. I want to change this rule by editing one
 * table." So this is the table. No screen file asks whether it has a character;
 * it renders `<Character step={n} />` and this decides.
 *
 * ## The principle
 *
 * "It appears only where the app speaks to the user, never where it asks them
 * something." A character beside a question competes with the options and slows
 * every screen it sits on.
 *
 * ## The two hard rules, and why they are CODE and not comments
 *
 * §4 states the presence table AND two hard rules, and on this flow they
 * contradict each other — the table says yes on 15, 16 and 17, and rule 2 says
 * never on two consecutive screens. A comment cannot resolve that; a resolver
 * can, and it keeps the resolution visible instead of baking it into a hand-
 * edited list where the next person cannot see what was traded away.
 *
 *   Rule 1 — never adjacent to a number. "A character beside a figure makes the
 *   figure look decorative." Declared per screen as `nearNumber`.
 *   Rule 2 — never on two consecutive screens. "If two in a row would show it,
 *   drop it from the first." Resolved by `weight`: in a conflicting pair the
 *   lower weight loses, so the flow keeps its best placement rather than
 *   whichever happened to come second.
 *
 * WHAT THAT RESOLVES TO, today: 1, 8 and 16.
 *   · 6 and 14 are explainers the spec marks optional — both are built entirely
 *     out of the person's own numbers, so rule 1 removes them.
 *   · 17 is the reveal, which is numbers and nothing else — rule 1 again. §4's
 *     own note there ("the numbers are the subject") says the same thing.
 *   · 15 and 16 are both declared present and are adjacent. 16 is the flow's
 *     signature placement (Cal AI's `Circular Mascot Ring` sits exactly there),
 *     so 15 yields.
 *
 * To change any of it: edit `PRESENCE` below. Nothing else in the flow knows.
 *
 * ## KEYED BY SCREEN ID, NOT BY POSITION
 *
 * It used to be `Record<number, …>`, and that was a trap: inserting a screen
 * anywhere in the flow silently moved the character onto whatever screen
 * happened to inherit the old number. Two screens were inserted on 28 August
 * 2026 and the mascot would have landed on the wrong three. Ids do not move
 * when the running order does, and adjacency is computed from `FLOW` itself.
 *
 * THIS FILE HAS NO IMPORTS BEYOND THE FLOW'S ORDER and no asset `require`s,
 * which is what lets the resolver be tested under `node --test`
 * (`characters.test.ts`). The drawings live next door in `character-art.ts`.
 */

export type CharacterPlacement =
  /** Centred, large — the character is the screen. */
  | 'hero'
  /** Inside the slowly rotating ring on the building screen. */
  | 'ring'
  /** Small, to one side of the content. */
  | 'aside'
  /** Small, centred, under a centred block — the insight screens. */
  | 'below';

export interface CharacterDeclaration {
  /** What §4's table says for this screen. */
  present: boolean;
  placement: CharacterPlacement;
  /** True when the screen puts a figure the person has to read next to it.
   * Rule 1 removes the character outright. */
  nearNumber?: boolean;
  /** Which screen wins when two adjacent screens both want it (rule 2).
   * Higher survives. */
  weight: number;
  /** Which drawing. Slugs map to files in `art.ts`. */
  art: CharacterArt;
}

export type CharacterArt = 'arriving' | 'greeting' | 'building' | 'committing';

/**
 * The flow's running order, as ids. Declared here rather than imported from
 * `flow.ts` so this file keeps no imports and stays testable under
 * `node --test`; `characters.test.ts` asserts it matches `FLOW` exactly, so the
 * duplication cannot drift.
 */
export const ORDER: readonly string[] = [
  'welcome',
  'tracker',
  'obstacles',
  'obstacle-insight',
  'attribution',
  'demo',
  'reading',
  'name',
  'greeting',
  'goal',
  'experience',
  'frequency',
  'year-insight',
  'split',
  'lifts',
  'overload',
  'commit',
  'building',
  'reveal',
  'recap',
];

/** §4's table, verbatim, keyed by screen id. Screens absent from this map have
 * no character — every question screen, and the demo. */
export const PRESENCE: Readonly<Record<string, CharacterDeclaration>> = {
  // Welcome — "Settles in with a small spring".
  welcome: { present: true, placement: 'hero', weight: 50, art: 'arriving' },
  // The obstacle insight — the flow's clearest case of §4's own rule: "it
  // appears only where the app speaks to the user, never where it asks them
  // something". This screen asks nothing and carries no figure, so both hard
  // rules pass and the character can react to what was just said.
  'obstacle-insight': { present: true, placement: 'below', weight: 60, art: 'greeting' },
  // The read — §4 "Optional, small … only if it reacts to or points at the
  // content". The content is a parsed table of loads and reps. Rule 1.
  reading: { present: true, placement: 'aside', nearNumber: true, weight: 10, art: 'greeting' },
  // "Hello, [name]" — "Yes — its screen".
  greeting: { present: true, placement: 'hero', weight: 90, art: 'greeting' },
  // Why overload works — one chart built from their own loads. Rule 1.
  overload: { present: true, placement: 'aside', nearNumber: true, weight: 10, art: 'building' },
  // Commitment — "Reacts as the hold completes". Loses to building on rule 2.
  commit: { present: true, placement: 'aside', weight: 40, art: 'committing' },
  // Building — the signature placement, inside the rotating ring.
  building: { present: true, placement: 'ring', weight: 100, art: 'building' },
  // Reveal — "Small, to one side. The numbers are the subject." Rule 1.
  reveal: { present: true, placement: 'aside', nearNumber: true, weight: 20, art: 'greeting' },
};

/**
 * The table after both hard rules have been applied. Computed once at module
 * load, because it is a pure function of a constant.
 */
export const RESOLVED: Readonly<Record<string, CharacterDeclaration>> = resolve(PRESENCE, ORDER);

function resolve(
  declared: Readonly<Record<string, CharacterDeclaration>>,
  order: readonly string[],
): Record<string, CharacterDeclaration> {
  const out: Record<string, CharacterDeclaration> = {};
  // Rule 1 first: a character next to a number is never a candidate at all, so
  // it cannot displace a neighbour it was never allowed to beat.
  for (const [id, decl] of Object.entries(declared)) {
    if (decl.present && !decl.nearNumber) out[id] = decl;
  }
  // Rule 2: walk the flow's REAL running order and drop the lighter of any
  // adjacent pair. Adjacency is a property of the order, so inserting a screen
  // between two candidates correctly stops them being neighbours.
  const surviving = order.filter((id) => out[id]);
  for (let i = 1; i < surviving.length; i += 1) {
    const before = surviving[i - 1];
    const here = surviving[i];
    if (order.indexOf(here) - order.indexOf(before) !== 1) continue;
    if (!out[before] || !out[here]) continue;
    if (out[here].weight >= out[before].weight) delete out[before];
    else delete out[here];
  }
  return out;
}

/** Does this screen show the character, after both rules? */
export function characterFor(id: string): CharacterDeclaration | null {
  return RESOLVED[id] ?? null;
}
