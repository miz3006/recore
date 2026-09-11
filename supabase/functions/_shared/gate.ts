// Server-side spend gates for the three AI functions (S2, security review
// 10 Sep 2026).
//
// THE FINDING, in one line: the anon key is public, signup was open and
// auto-confirmed, every AI function checked only that the JWT was valid, and
// the rate limit was PER USER — so more accounts bought more quota, and the
// bill was the project owner's. There was no global ceiling and no entitlement
// check on either side of the wire.
//
// Two gates live here. They are deliberately different in character:
//
//  · The GLOBAL CEILING is on now and needs nothing else to work. It is the one
//    that actually bounds the damage while signup is open, because it does not
//    care how many accounts an attacker holds.
//  · The ENTITLEMENT CHECK is written but OFF BY DEFAULT, and the section on it
//    below says why in full. It is not a hole left open by accident.

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

/**
 * The whole project's AI budget per window, not one account's.
 *
 * Tunable without a deploy — `supabase secrets set GLOBAL_RATE_MAX=…` — because
 * the right number depends on how many real users exist, and that changes
 * faster than this file does. The default is set where a real user base of a
 * few hundred never touches it and a scripted attacker hits it in minutes.
 */
const GLOBAL_MAX_CALLS = Number(Deno.env.get('GLOBAL_RATE_MAX') ?? '2000');
const GLOBAL_WINDOW_SECONDS = Number(Deno.env.get('GLOBAL_RATE_WINDOW_SECONDS') ?? '3600');

/**
 * WHY ENTITLEMENT ENFORCEMENT DEFAULTS TO OFF.
 *
 * `profiles.entitled_until` is written by the RevenueCat webhook and by nothing
 * else. That webhook does not exist yet — real store billing is step 1 of
 * CLAUDE.md §6's build order and is not done. So today every row's value is
 * null, and a strict gate would answer 402 to every caller including the owner:
 * not a security fix, a silent outage on the workout-logging path, which
 * CLAUDE.md §2 invariant 1 forbids blocking on an entitlement check.
 *
 * So the code is here, deployed, and one environment variable away from live:
 *
 *     supabase secrets set REQUIRE_ENTITLEMENT=true
 *
 * That command is the LAST STEP of wiring the webhook, and until it is run S2
 * stays open in the remediation ledger. It is recorded there as open rather
 * than quietly satisfied by the presence of this function — a gate that is not
 * enforcing is not a gate.
 */
const REQUIRE_ENTITLEMENT = (Deno.env.get('REQUIRE_ENTITLEMENT') ?? 'false') === 'true';

export type GateVerdict =
  | { ok: true }
  | { ok: false; error: 'rate_limited' | 'not_entitled'; status: 429 | 402 }
  | { ok: false; error: 'rate_limit_unavailable'; status: 500 };

/**
 * The global ceiling. `bucket` groups the functions that share a budget — all
 * three AI functions spend from the same provider account, so they share one.
 *
 * A failure to READ the counter is a 500 and not a pass: a ceiling that opens
 * when its own storage is unavailable is not a ceiling. This mirrors how
 * `bump_parse_rate` is already treated in each function.
 */
export async function checkGlobalRate(
  service: SupabaseClient,
  bucket = 'ai',
): Promise<GateVerdict> {
  const { data: allowed, error } = await service.rpc('bump_global_rate', {
    p_bucket: bucket,
    p_max: GLOBAL_MAX_CALLS,
    p_window_seconds: GLOBAL_WINDOW_SECONDS,
  });
  if (error) return { ok: false, error: 'rate_limit_unavailable', status: 500 };
  if (!allowed) return { ok: false, error: 'rate_limited', status: 429 };
  return { ok: true };
}

/**
 * Server-side entitlement. Returns ok when enforcement is off, which is the
 * default — see the note on REQUIRE_ENTITLEMENT above for why that is a
 * recorded open item rather than an oversight.
 *
 * A missing profile row or an unreadable one is NOT entitled. The failure
 * direction matters: this gate exists to stop spending money, so its error case
 * must be "do not spend".
 */
export async function checkEntitlement(
  service: SupabaseClient,
  userId: string,
): Promise<GateVerdict> {
  if (!REQUIRE_ENTITLEMENT) return { ok: true };

  const { data: prof } = await service
    .from('profiles')
    .select('entitled_until')
    .eq('id', userId)
    .maybeSingle();

  const until = (prof as { entitled_until?: string | null } | null)?.entitled_until;
  const entitled = until != null && new Date(until) > new Date();
  return entitled ? { ok: true } : { ok: false, error: 'not_entitled', status: 402 };
}
