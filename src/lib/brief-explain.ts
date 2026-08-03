import { getMeta, setMeta } from '@/lib/db/index';
import { isSupabaseConfigured } from '@/lib/env';
import { devLog } from '@/lib/log';
import { getObLanguage } from '@/lib/prefs';
import { supabase } from '@/lib/supabase';

import { sanitizeBriefSummary } from './brief-guard';

/**
 * The model-written briefing summary (CLAUDE.md §8.5, owner ruling 29 Jul —
 * the ONE sanctioned exception to "composed only", and the packaging around
 * it is the whole point):
 *
 *  - the COMPOSED paragraph renders first, instantly, always — the rewrite is
 *    an upgrade that arrives late or never (§1.1 invariant 2: nothing blocks
 *    on the network);
 *  - the rewrite is validated by `sanitizeBriefSummary` (number whitelist —
 *    the model cannot invent a load and reach the screen), and any failure
 *    anywhere resolves to the composed paragraph, silently;
 *  - cached in the meta KV keyed by a signature of the paragraph it rewrites,
 *    so one brief costs one call — a changed record changes the signature and
 *    honestly invalidates the cache.
 */

const META_KEY = 'brief_summary_cache';

/**
 * Which paragraph is being rewritten. `undefined` is Next's briefing (§8.5) and
 * keeps the original key; the lift sheet passes `lift_<canonical>` so a summary
 * per lift gets its own slot — one shared slot would make every opened lift
 * evict the last one and pay for the same rewrite twice.
 */
function metaKeyFor(scope?: string): string {
  return scope ? `summary_cache_${scope}` : META_KEY;
}

/** djb2 — stable, tiny; collisions only cost one stale summary until the next
 * successful refine. */
function signatureOf(paragraph: string, language: string, scope?: string): string {
  let h = 5381;
  const s = `${scope ?? ''}\n${language}\n${paragraph}`;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return String(h >>> 0);
}

function languagePref(): string {
  return getObLanguage() === 'slo' ? 'slo' : 'en';
}

/** The cached summary for exactly this paragraph, or null. Synchronous — safe
 * to call during render. */
export function getCachedBriefSummary(paragraph: string, scope?: string): string | null {
  const raw = getMeta(metaKeyFor(scope));
  if (!raw) return null;
  try {
    const stored = JSON.parse(raw) as { sig?: unknown; text?: unknown };
    if (stored.sig !== signatureOf(paragraph, languagePref(), scope)) return null;
    // Re-validated on the way out: the guard may have tightened since this
    // was written, and a stored value must not outrank the current rule.
    return sanitizeBriefSummary(stored.text, paragraph);
  } catch {
    return null;
  }
}

let inflightSig: string | null = null;

/**
 * Fire-and-forget: rewrite the composed paragraph via the explain-brief edge
 * function, cache and deliver the result. No-ops when already cached, already
 * in flight, or offline/unconfigured. Never throws.
 */
export function refineBriefSummary(
  paragraph: string,
  onLanded: (summary: string) => void,
  scope?: string,
): void {
  if (!paragraph || !isSupabaseConfigured()) return;
  const language = languagePref();
  const sig = signatureOf(paragraph, language, scope);
  if (inflightSig === sig) return;
  if (getCachedBriefSummary(paragraph, scope) != null) return;

  inflightSig = sig;
  void (async () => {
    try {
      const { data, error } = await supabase.functions.invoke('explain-brief', {
        body: { paragraph, language },
      });
      if (error || !data) return;
      const summary = sanitizeBriefSummary((data as { summary?: unknown }).summary, paragraph);
      if (!summary) return;
      setMeta(metaKeyFor(scope), JSON.stringify({ sig, text: summary }));
      onLanded(summary);
    } catch {
      devLog('explain-brief unreachable; the composed paragraph stays');
    } finally {
      if (inflightSig === sig) inflightSig = null;
    }
  })();
}
