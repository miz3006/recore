import { upsertPrediction } from '@/lib/db/predictions';
import { type DayKey } from '@/lib/db/dates';
import { isSupabaseConfigured } from '@/lib/env';
import { devLog } from '@/lib/log';
import { supabase } from '@/lib/supabase';

import { type PredictionDraft } from './data';

/**
 * V2 of the prediction reason (CLAUDE.md §7: the AI ONLY explains). The
 * template sentence is already cached — this fires in the background and, if
 * the explain-prediction edge function returns a better one-liner (in the
 * user's own language, quoting their words), quietly upgrades the cached row.
 * Offline or failed → the template stays. Never throws.
 */
export async function refinePredictionReason(
  userId: string,
  forDate: DayKey,
  draft: PredictionDraft,
): Promise<void> {
  if (!draft.explain || !isSupabaseConfigured()) return;

  try {
    const { data, error } = await supabase.functions.invoke('explain-prediction', {
      body: { facts: draft.explain.facts, quotes: draft.explain.quotes },
    });
    if (error || !data) return;

    // Untrusted until checked: one plain string, sane length, or nothing.
    const reason = (data as { reason?: unknown }).reason;
    if (typeof reason !== 'string') return;
    const trimmed = reason.trim().slice(0, 200);
    if (!trimmed || trimmed.includes('\n')) return;

    upsertPrediction(userId, forDate, draft.ghostText, trimmed);
  } catch {
    devLog('explain-prediction unreachable; template reason stays');
  }
}
