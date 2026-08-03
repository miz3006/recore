// Zero imports on purpose: pure and runnable under `node --test`, like the
// other pure modules (engine.ts, streak.ts).

/**
 * The gate between the explain-brief edge function and the screen (CLAUDE.md
 * §8.5, owner ruling 29 Jul). The server already validates; the client does
 * not trust it anyway — the same posture the parser takes (§7.1 step 5).
 *
 * The one rule that makes the model-written summary honest is the NUMBER
 * WHITELIST: every number in the rewrite must already appear in the composed
 * paragraph it rewrites. A model cannot invent a load, a delta, a session
 * count or a hit rate and get it past this function — at worst it can drop or
 * reorder facts, which composition already allows. Everything else here is the
 * house voice at the door: one paragraph, sane length, no exclamation marks,
 * no emoji, never the word "AI" (§15).
 *
 * Returns the cleaned summary, or null — and null always means "show the
 * composed paragraph instead", never an error state.
 */

const MIN_CHARS = 20;
const MAX_CHARS = 420;

/** Number tokens, decimal comma or point, normalized so "82,5" == "82.5". */
function numbersOf(text: string): Set<string> {
  const out = new Set<string>();
  for (const m of text.matchAll(/\d+(?:[.,]\d+)?/g)) {
    out.add(String(parseFloat(m[0].replace(',', '.'))));
  }
  return out;
}

export function sanitizeBriefSummary(candidate: unknown, sourceParagraph: string): string | null {
  if (typeof candidate !== 'string') return null;
  const text = candidate.trim();
  if (text.length < MIN_CHARS || text.length > MAX_CHARS) return null;
  if (text.includes('\n')) return null; // one paragraph, no headings, no lists
  if (text.includes('!')) return null; // §15 — no cheering, and "!" is its uniform
  if (/\bai\b/i.test(text)) return null; // §15 — the mechanism is not the promise
  if (/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u.test(text)) return null; // no emoji on a record surface (§5.7)

  const allowed = numbersOf(sourceParagraph);
  for (const n of numbersOf(text)) {
    if (!allowed.has(n)) return null; // an invented number kills the whole rewrite
  }
  return text;
}
