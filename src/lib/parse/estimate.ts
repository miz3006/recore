/**
 * Instant, text-only volume estimate for the bottom-toolbar pill while a line
 * hasn't been parsed yet. The moment the edge function returns, the pill
 * switches to the real parsed volume (warm-ups excluded). This is display
 * garnish only — it never writes to the database.
 */
const SETS_REPS = /(\d+)\s*[x×]\s*(\d+)/;

/** Group digits with thousands commas: 2040 -> "2,040". */
export function groupThousands(n: number): string {
  return Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function extractWeight(line: string, sr: RegExpMatchArray | null): number | null {
  const kg = line.match(/(\d+(?:\.\d+)?)\s*kg\b/i);
  if (kg) return parseFloat(kg[1]!);

  const stripped = sr ? line.replace(sr[0], ' ') : line;
  const decimal = stripped.match(/\b(\d+\.\d+)\b/);
  if (decimal) return parseFloat(decimal[1]!);

  const ints = (stripped.match(/\b\d+\b/g) ?? []).map(Number).filter((n) => n >= 20);
  return ints.length ? Math.max(...ints) : null;
}

function lineVolume(line: string): number {
  const t = line.trim();
  if (!t) return 0;
  const sr = t.match(SETS_REPS);
  const sets = sr ? parseInt(sr[1]!, 10) : null;
  const reps = sr ? parseInt(sr[2]!, 10) : null;
  const weight = extractWeight(t, sr);
  if (weight == null || !sets || !reps) return 0;
  return Math.round(sets * reps * weight);
}

export function estimateVolume(note: string): number {
  return note.split('\n').reduce((sum, line) => sum + lineVolume(line), 0);
}
