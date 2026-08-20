import { isSupabaseConfigured } from '@/lib/env';
import { devLog } from '@/lib/log';
import { supabase } from '@/lib/supabase';
import { validateParseResult } from '@/lib/parse/types';

import { canonicalLift, type DemoReading } from './demo-parse';

/**
 * THE SECOND OPINION on a demo line — the app's real parser, asked only when it
 * can actually answer.
 *
 * `parse-workout` needs a user JWT (§7.3), so during a first run through the
 * funnel there is no session and this returns null in the same tick, without a
 * request. It earns its place on the OTHER path: someone replaying onboarding
 * from You is signed in, and then a line the local grammar cannot read
 * ("superset bench and rows, 3 rounds") is read by the model that reads
 * everything else in the app.
 *
 * Three rules hold on both paths:
 *
 *  · **A hard 2.5 s ceiling.** The demo is a beat in a conversation; a request
 *    that has not answered by then has missed its moment, and the canned
 *    example is a better answer than a spinner (CLAUDE.md §2 invariant 1 — no
 *    screen waits on a model).
 *  · **Nothing is written.** No workout row, no parse cache, no funnel counter:
 *    this reads a line the person is looking at, and the record starts at
 *    signup with their raw text (`lib/onboarding-seed.ts`).
 *  · **Never throws.** Every failure is null, and null means "show the canned
 *    example", which is a screen rather than an error state.
 */

/** The demo's ceiling on the network half. Past it, the canned example wins. */
export const DEMO_PARSE_TIMEOUT_MS = 2500;

export async function remoteDemoParse(text: string): Promise<DemoReading | null> {
  const line = text.trim();
  if (!line || !isSupabaseConfigured()) return null;

  try {
    // No session → no JWT → the function would refuse. Asking first keeps the
    // ordinary case (a first run, signed out) at zero network cost.
    const { data: auth } = await supabase.auth.getSession();
    if (!auth.session) return null;

    const response = await Promise.race([
      supabase.functions.invoke('parse-workout', { body: { raw_text: line } }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), DEMO_PARSE_TIMEOUT_MS)),
    ]);
    if (!response || response.error || !response.data) return null;

    // Model output is untrusted until validated — the same gate the real client
    // puts in front of SQLite (`lib/parse/types.ts`).
    const result = validateParseResult(response.data);
    const item = result?.items[0];
    if (!item) return null;

    const sets = item.sets.filter((s) => s.kind !== 'warmup');
    const reps = sets.map((s) => s.reps).filter((r): r is number => r != null && r > 0);
    if (reps.length === 0) return null;
    const weights = sets.map((s) => s.weight_kg).filter((w): w is number => w != null && w > 0);

    return {
      exerciseName: canonicalLift(item.exercise) ?? item.exercise,
      weightKg: weights.length > 0 ? Math.max(...weights) : null,
      reps,
      // The edge function speaks kilograms, always (§3: storage is metric).
      unit: 'kg',
    };
  } catch {
    devLog('demo parse unreachable — falling back to the written example');
    return null;
  }
}
