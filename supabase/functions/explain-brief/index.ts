// explain-brief — Supabase Edge Function (CLAUDE.md §8.3/§8.5, owner ruling 29 Jul).
//
// CODE composes the briefing paragraph (src/lib/brief-prose.ts); this function
// ONLY rewrites it into a natural summary — the owner's sanctioned exception
// for the Next tab. The paragraph arrives as read-only facts; the model must
// never add numbers, exercises or advice that are not in it, and the client
// re-validates with a number whitelist before showing anything (brief-guard).
// Same security model as parse-workout: JWT verified, per-user rate limit,
// size-limited input, structured output, nothing logged.

import Anthropic from 'npm:@anthropic-ai/sdk@0.111.0';
import { createClient } from 'npm:@supabase/supabase-js@2';

import { corsHeaders } from '../_shared/cors.ts';
import { checkEntitlement, checkGlobalRate } from '../_shared/gate.ts';

// The prompt/schema live in prompt.ts so the owner-run §9.4 eval
// (scripts/brief-eval.ts) exercises EXACTLY what deploys — the same
// arrangement parse-workout has.
import { MAX_INPUT_CHARS, MAX_OUTPUT_CHARS, OUTPUT_SCHEMA, SYSTEM_PROMPT, userContent } from './prompt.ts';

const RATE_LIMIT_MAX_CALLS = 30;
const RATE_LIMIT_WINDOW_SECONDS = 600; // shared bump_parse_rate window

const MODEL =
  Deno.env.get('EXPLAIN_MODEL') ?? Deno.env.get('PARSE_MODEL') ?? 'claude-haiku-4-5';
const SUPPORTS_EFFORT = !MODEL.includes('haiku');

Deno.serve(async (req) => {
  // Per request, because the allow-list reflects the caller's own origin (S11).
  const cors = corsHeaders(req);
  const json = (body: unknown, status = 200): Response =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });

  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  // AUTH — identity from the verified JWT only.
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'unauthorized' }, 401);
  const supabaseUser = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const {
    data: { user },
    error: authError,
  } = await supabaseUser.auth.getUser();
  if (authError || !user) return json({ error: 'unauthorized' }, 401);

  // INPUT VALIDATION — one paragraph, size-limited; language is a two-value hint.
  let paragraph = '';
  let language: 'en' | 'slo' = 'en';
  try {
    const body = await req.json();
    if (typeof body?.paragraph !== 'string') return json({ error: 'invalid_body' }, 400);
    paragraph = body.paragraph.trim().slice(0, MAX_INPUT_CHARS);
    if (!paragraph) return json({ error: 'invalid_body' }, 400);
    if (body?.language === 'slo') language = 'slo';
  } catch {
    return json({ error: 'invalid_body' }, 400);
  }

  // RATE LIMIT — shares the per-user window with parse-workout.
  const supabaseService = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
  const { data: allowed, error: rateError } = await supabaseService.rpc('bump_parse_rate', {
    p_user: user.id,
    p_max: RATE_LIMIT_MAX_CALLS,
    p_window_seconds: RATE_LIMIT_WINDOW_SECONDS,
  });
  if (rateError) return json({ error: 'rate_limit_unavailable' }, 500);
  if (!allowed) return json({ error: 'rate_limited' }, 429);

  // GLOBAL CEILING (S2) — beside the per-user window above, which bounds ONE
  // account and says nothing about N of them. Open signup made N cheap.
  const globalGate = await checkGlobalRate(supabaseService);
  if (!globalGate.ok) return json({ error: globalGate.error }, globalGate.status);

  // ENTITLEMENT (S2) — server-side, because the client is the thing being
  // metered. Off until the RevenueCat webhook writes profiles.entitled_until;
  // see _shared/gate.ts for why that is recorded open rather than forced on.
  const entitlement = await checkEntitlement(supabaseService, user.id);
  if (!entitlement.ok) return json({ error: entitlement.error }, entitlement.status);

  const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') });

  let response: Anthropic.Message;
  try {
    response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1000,
      output_config: {
        ...(SUPPORTS_EFFORT ? { effort: 'low' as const } : {}),
        format: { type: 'json_schema', schema: OUTPUT_SCHEMA },
      },
      system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: userContent(language, paragraph) }],
    });
  } catch {
    return json({ error: 'explain_unavailable' }, 502);
  }

  if (response.stop_reason === 'refusal') return json({ summary: null });

  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') return json({ summary: null });

  try {
    const parsed = JSON.parse(textBlock.text) as { summary?: unknown };
    const summary =
      typeof parsed.summary === 'string' && parsed.summary.trim().length > 0
        ? parsed.summary.trim().slice(0, MAX_OUTPUT_CHARS)
        : null;
    return json({ summary });
  } catch {
    return json({ summary: null });
  }
});
