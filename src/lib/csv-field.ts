// Zero imports on purpose: pure and runnable under `node --test`, like the
// other pure modules (brief-guard.ts, engine.ts, streak.ts). `export-csv.ts`
// cannot be tested directly — it reaches expo-sqlite through `db/index` — so
// the rule that decides what a CSV cell may contain lives here, where a test
// can actually reach it.

/**
 * Leading characters a spreadsheet reads as the start of a formula (S6,
 * security review 10 Sep 2026).
 *
 * The names Recore writes into a CSV are not necessarily the user's own:
 * `import/pick.ts` accepts an arbitrary third-party CSV and `import/apply.ts`
 * stores `exercise.name` as written. So a "Hevy export" carrying
 * `=cmd|'/c calc'!A1` becomes a row in the local record, and opening Recore's
 * own export in Excel is what fires it. Tab and CR are in the set because a
 * leading whitespace character is stripped before the cell is evaluated, which
 * puts the `=` back at the front.
 */
export const RISKY_LEAD = /^[=+\-@\t\r]/;

/**
 * One CSV cell, escaped. A leading apostrophe is the conventional neutraliser:
 * Excel, Numbers and LibreOffice all read it as "the rest of this cell is
 * text", and it is not part of the value the user sees.
 *
 * Prefix first, quote second — the apostrophe has to be INSIDE the quotes to
 * survive them. `\r` joined the quote set with this change: a bare CR inside an
 * unquoted field splits the row in some readers, which is its own small lie
 * about the record.
 */
export function csvField(value: string): string {
  const safe = RISKY_LEAD.test(value) ? `'${value}` : value;
  return /[",\n\r]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}
