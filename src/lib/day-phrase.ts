// No imports at all, so this runs unchanged under `node --test` and inside
// Metro — the same rule `entry-note.ts` and `streak.ts` follow.

/**
 * A DAY, INSIDE A SENTENCE (owner, 4 September 2026).
 *
 * `labelForDay` (state/session-store.ts) answers "what do I call this day?" and
 * gives back one of two different KINDS of answer: an absolute date, "Sep 4",
 * or a relative word, "Today" / "Yesterday". Prose that drops either into the
 * same slot produces one correct sentence and one broken one:
 *
 *     …is 120 kg × 12, on Sep 4, for an estimated 1RM of 145 kg.   ✓
 *     …is 120 kg × 12, on Today, for an estimated 1RM of 145 kg.   ✗
 *
 * English does not take a preposition before "today" — you did it *today*, not
 * *on today* — and it does not capitalise it mid-sentence either. The screen
 * that gets this wrong reads as a template with a variable showing through,
 * which is exactly what it is.
 *
 * The repository's previous answer to this was to DELETE the fact: the lift
 * sheet drops its "since …" clause whenever the label is relative, with the
 * comment *"since Today" is not a sentence about a record*. That is true and it
 * is also a fact thrown away to dodge a grammar problem. These two functions
 * are the grammar problem solved, so callers can keep the fact.
 *
 * They are deliberately about the LABEL rather than about a `DayKey`: the
 * relative words are produced upstream, the pure modules that compose prose
 * receive strings, and a helper that needed today's date could not be tested
 * without freezing a clock.
 */

/** The two words `labelForDay` returns instead of a date. Matched exactly —
 * an absolute label can never collide with them. */
const RELATIVE_LABELS = new Set(['Today', 'Yesterday']);

/**
 * True when the label names a day RELATIVE to now ("Today", "Yesterday")
 * rather than dating it.
 *
 * The distinction is grammatical, not semantic: a relative word is already an
 * adverb and refuses the preposition an absolute date requires.
 */
export function isRelativeDayLabel(label: string): boolean {
  return RELATIVE_LABELS.has(label.trim());
}

/**
 * The day as a phrase that can be dropped into a sentence: `on Sep 4`, or
 * `today` with no preposition and no capital.
 *
 * The preposition is INSIDE the returned string on purpose — that is the whole
 * difference between the two forms, and a caller that had to decide whether to
 * print "on" would be re-deriving the rule this function exists to hold.
 */
export function onDayPhrase(label: string): string {
  const trimmed = label.trim();
  return isRelativeDayLabel(trimmed) ? trimmed.toLowerCase() : `on ${trimmed}`;
}

/**
 * The same day as the OBJECT of "last": `last Sep 4`, or plain `today`.
 *
 * "last Today" is the same defect one preposition over, and it is on Progress
 * and on the per-lift screen. A relative word already says when, so "last"
 * falls away with the preposition.
 */
export function lastDayPhrase(label: string): string {
  const trimmed = label.trim();
  return isRelativeDayLabel(trimmed) ? trimmed.toLowerCase() : `last ${trimmed}`;
}
