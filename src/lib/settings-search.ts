/**
 * SEARCHING A SETTINGS PAGE.
 *
 * You carries thirty-odd rows across seven groups, and until 9 September 2026
 * the only way to reach one was to scroll for it. The screen now puts the
 * system's own `UISearchController` in its navigation item; this is the half
 * that decides what a query finds.
 *
 * ## A row is more than the words it prints
 *
 * Matching only visible text fails on exactly the queries worth having a search
 * for. Somebody looking for pounds types "lbs" — the row says "Units" and its
 * value says "Kilograms", and neither contains the letters. Somebody leaving
 * types "log out"; the row says "Sign out". Somebody who wants their data types
 * "backup" or "csv"; the row says "Export my record".
 *
 * So every row carries `keywords`: the words a person would type that the row
 * does not show. They are never rendered — a hidden vocabulary, not a subtitle
 * — and they are the difference between a search that works and one that only
 * confirms what you could already see.
 *
 * ## The group's name matches too
 *
 * "training" should return the training group rather than nothing, because that
 * is the word a person has for a set of rows they cannot individually name yet.
 * The screen keeps each surviving group's label above its results for the same
 * reason: a row is an answer, and an answer needs its question.
 *
 * ## What it deliberately does not do
 *
 * No fuzzy matching, no stemming, no ranking. A settings list is small and
 * known; a substring test is predictable, and predictable beats clever on a
 * surface where a wrong result means a person believes a setting does not
 * exist. Case and surrounding whitespace are ignored, and nothing else is.
 */

export type SearchableRow = {
  /** What the row prints on its first line. */
  label: string;
  /** The row's current answer, if it shows one. */
  value?: string;
  /** The row's second line, if it has one. */
  sub?: string;
  /** Words a person would type that the row does not print. Never rendered. */
  keywords?: string;
};

/**
 * Does this row answer this query? `sectionLabel` is included so a group's own
 * name reaches its rows.
 *
 * An empty or whitespace-only query matches everything, which is what a caller
 * that has not yet decided whether it is searching wants back.
 */
export function matchesQuery(
  row: SearchableRow,
  sectionLabel: string,
  query: string,
): boolean {
  const needle = query.trim().toLowerCase();
  if (needle.length === 0) return true;
  const hay = [row.label, row.value, row.sub, row.keywords, sectionLabel]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return hay.includes(needle);
}

/**
 * The earliest day in a set of `YYYY-MM-DD` keys, or null for an empty record.
 *
 * A plain string comparison, because that format sorts lexicographically in
 * date order by construction — zero-padded, most significant first. Parsing
 * every key into a `Date` to compare them would be slower and would introduce
 * a timezone into an answer that does not have one.
 */
export function firstLoggedDay(days: Iterable<string>): string | null {
  let min: string | null = null;
  for (const d of days) if (min === null || d < min) min = d;
  return min;
}
