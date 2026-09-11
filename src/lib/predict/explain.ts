import { sanitizePredictionReason } from '@/lib/brief-guard';
import { upsertPrediction } from '@/lib/db/predictions';
import { type DayKey } from '@/lib/db/dates';
import { isSupabaseConfigured } from '@/lib/env';
import { bumpGuardRejection } from '@/lib/funnel';
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

    // Untrusted until checked (CLAUDE.md §4). Type and length were never the
    // risk — the number was: this sentence prints under a load the code
    // computed, so every figure in it must come from the facts we sent or from
    // the user's own quoted lines. Rejected → the template sentence stays.
    const reason = sanitizePredictionReason(
      (data as { reason?: unknown }).reason,
      draft.explain.facts,
      draft.explain.quotes,
    );
    if (!reason) {
      bumpGuardRejection('prediction'); // §9.3 — counted, so prompt drift is visible
      return;
    }

    upsertPrediction(userId, forDate, draft.ghostText, reason);
  } catch {
    devLog('explain-prediction unreachable; template reason stays');
  }
}
