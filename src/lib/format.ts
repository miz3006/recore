/**
 * Number formatting for the record (CLAUDE.md §6.5, §21).
 *
 * Pure and free of React Native imports so `npm test` runs it under node — the
 * same split as `theme/color.ts`, and for the same reason: the rules about how a
 * number reads are worth testing on their own.
 *
 * §21: "Numbers are always specific." A load is never rounded for tidiness, a
 * trailing `.0` is never shown, and a thousands separator only appears where it
 * helps a glance (volumes), never inside a load.
 */

/**
 * A training value as it should read.
 *
 * Loads carry at most one decimal because that is what a plate can express —
 * 82.5 is real, 82.53 is arithmetic. Trailing zeros are dropped: `80`, not
 * `80.0`, because the extra glyph implies a precision the bar does not have.
 */
export function formatNumber(value: number, maxDecimals = 1): string {
  if (!Number.isFinite(value)) return '—';
  const rounded = Number(value.toFixed(maxDecimals));
  return String(rounded);
}

/**
 * Thin-space thousands grouping for totals. Used on volumes (`12 480 kg`) and
 * never on a load: a bar is loaded to 100 kg, not 1 000 kg, and the separator
 * would read as noise at that scale.
 *
 * The separator is a narrow no-break space (U+202F) rather than a comma, which
 * keeps the mono grid even and sidesteps the decimal-comma ambiguity for a
 * Slovenian reader (§9.3 — this app is written in more than one language).
 */
export function groupThousands(value: number): string {
  if (!Number.isFinite(value)) return '—';
  const negative = value < 0;
  const [whole, fraction] = formatNumber(Math.abs(value)).split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${negative ? '-' : ''}${grouped}${fraction ? `.${fraction}` : ''}`;
}

/**
 * A signed delta, always with an explicit sign so the direction survives being
 * read in a hurry (§6.3 — deltas are typographic, never chromatic, so the glyph
 * is the only thing carrying the news).
 *
 * Zero renders without a sign: "+0" claims a change that did not happen.
 */
export function formatDelta(value: number, maxDecimals = 1): string {
  if (!Number.isFinite(value)) return '—';
  const rounded = Number(value.toFixed(maxDecimals));
  if (rounded === 0) return '0';
  return `${rounded > 0 ? '+' : '−'}${Math.abs(rounded)}`;
}

/** `5.0 km · 26:04 · 5:13 /km` — the cardio row's clock (§8.3). */
export function formatDuration(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return '—';
  const s = Math.round(totalSeconds);
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`;
}

/** A rep sequence, collapsed the way §8.3 asks: `8 · 8 · 7`, or `3 × 8`. */
export function formatSets(reps: readonly number[]): string {
  if (reps.length === 0) return '';
  const allEqual = reps.every((r) => r === reps[0]);
  return allEqual && reps.length > 1 ? `${reps.length} × ${reps[0]}` : reps.join(' · ');
}
