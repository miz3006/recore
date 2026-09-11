// A RELATIVE, EXTENSIONED import, because this module is node-testable and
// `node --test` does not resolve the `@/` alias (`facts.test.ts`).
import { groupThousands } from '../parse/estimate.ts';

/**
 * WHAT A DAY OF SOMEBODY ELSE'S TRAINING WAS, in one line.
 *
 * The coach's feed used to print a session as two lines of the client's raw
 * text and nothing else, so a month of sessions all looked the same size and
 * the only way to find the heavy one was to open every one of them. The
 * pattern this fixes is the one every finished workout screen uses — STNDRD's
 * "Workout Completed", Symmetry's, Boostcamp's (studied on Appllama, 10
 * September 2026): a session leads with a short count of what it WAS —
 * exercises, sets, volume — and the detail follows underneath.
 *
 * Pure, so it is tested rather than eyeballed on a screen.
 */

/**
 * `1234567` → `1,234,567`. **Re-exported, not reimplemented** (11 Sep 2026).
 *
 * This file had its own copy, and the copy grouped with the DEVICE LOCALE:
 * `toLocaleString(undefined, …)`. On a Slovenian phone that is a full stop, so
 * the coach's session header printed **`1.500 kg`** for fifteen hundred
 * kilograms while Today, three taps away, printed `27,869 kg` from the other
 * implementation. Two number voices in one app — and the coaching one is the
 * ambiguous half, because every label beside it is English ("Kg lifted") and
 * `1.500` reads as one and a half to an English reader.
 *
 * `parse/estimate.ts` is the app's formatter and it is deliberately NOT
 * locale-aware: the record prints the same way for everybody, which is what
 * makes two screens comparable. Coaching had no reason to differ and no note
 * saying it meant to.
 */
export { groupThousands };

/**
 * Kilograms, short enough to sit in a column. A day's tonnage runs to five
 * digits and a lifetime's to seven, so past a million it reads "1.2M" —
 * still specific, and it stops one number setting the type size of a strip.
 */
export function compactKg(kg: number): string {
  return kg >= 1_000_000 ? `${(kg / 1_000_000).toFixed(1)}M` : groupThousands(kg);
}

export interface SessionFacts {
  lifts: number;
  sets: number;
  volumeKg: number;
}

/**
 * "4 lifts · 12 sets · 4,320 kg" — the day's shape, for a feed row.
 *
 * **Null when there is nothing counted, and that is the point.** A session
 * whose text has not been parsed yet has zero of everything, and printing "0
 * lifts · 0 sets · 0 kg" would report an empty day where the person in fact
 * wrote something the parser has not read. The caller shows their words
 * instead, which is the true thing to show.
 *
 * Volume drops out of the line when nothing carried a load — a day of pull-ups
 * and a plank is a real session and "0 kg" is not a fact about it.
 */
export function factsLine(facts: SessionFacts): string | null {
  const parts: string[] = [];
  if (facts.lifts > 0) parts.push(`${facts.lifts} ${facts.lifts === 1 ? 'lift' : 'lifts'}`);
  if (facts.sets > 0) parts.push(`${facts.sets} ${facts.sets === 1 ? 'set' : 'sets'}`);
  if (facts.volumeKg > 0) parts.push(`${compactKg(facts.volumeKg)} kg`);
  return parts.length ? parts.join(' · ') : null;
}

/**
 * The first line or two of what somebody wrote, on one line, for a feed row.
 * Their words verbatim — never a summary, which is the app talking over the
 * person whose record it is.
 */
export function previewOf(rawText: string): string {
  return rawText
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 2)
    .join(' · ');
}
