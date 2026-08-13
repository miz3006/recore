/**
 * §9.4 — the owner-run evaluation for the Next-brief AI summary.
 *
 * Runs the SAME system prompt + schema the explain-brief edge function deploys
 * (imported from supabase/functions/explain-brief/prompt.ts) over a versioned
 * case set, then holds every rewrite to the house rules and to brief-guard —
 * the exact gate the client applies before anything reaches the screen.
 *
 *   npm run eval:brief                                  # needs ANTHROPIC_API_KEY (read from .env)
 *   EVAL_MODEL=claude-sonnet-5 npm run eval:brief       # compare models
 *
 * Two kinds of case (scripts/brief-eval-cases.json):
 *  - "model": paragraph → live model call → assertions on the RAW rewrite
 *    (style: no "!", no emoji, no "AI", one paragraph; every number a subset
 *    of the input's; optional must_not_mention for injection probes) AND on
 *    the guard's verdict. `expect_null` asserts the model declines meaningless
 *    input.
 *  - "guard": offline, deterministic accept/reject checks of
 *    src/lib/brief-guard.ts — these run with no key and no network.
 *
 * REGRESSION RULE (§9.4): a case that passes may never fail after a prompt,
 * guard, or model change; every defect seen in the wild is added as a case
 * before it is fixed. Without a key the guard cases still run, but the run is
 * NOT a §9.4 pass and exits non-zero.
 *
 * (Language note: "slo" cases assert everything except the language itself —
 * whether the output actually reads as Slovenian stays a human check.)
 */
import Anthropic from '@anthropic-ai/sdk';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  OUTPUT_SCHEMA,
  SYSTEM_PROMPT,
  userContent,
} from '../supabase/functions/explain-brief/prompt.ts';
import { sanitizeBriefSummary } from '../src/lib/brief-guard.ts';

// Load keys from the (gitignored) .env so `npm run eval:brief` works without
// exporting anything. Real env vars win over file values.
const envPath = join(dirname(fileURLToPath(import.meta.url)), '..', '.env');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"#]*?)"?\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
  }
}

const MODEL = process.env.EVAL_MODEL ?? 'claude-haiku-4-5';
const CONCURRENCY = Number(process.env.EVAL_CONCURRENCY ?? 4);

interface ModelCase {
  kind: 'model';
  name: string;
  language: 'en' | 'slo';
  paragraph: string;
  expect_null?: boolean;
  must_not_mention?: string[];
}

interface GuardCase {
  kind: 'guard';
  name: string;
  paragraph: string;
  candidate: unknown;
  accept: boolean;
}

const here = dirname(fileURLToPath(import.meta.url));
const caseFile = JSON.parse(readFileSync(join(here, 'brief-eval-cases.json'), 'utf8')) as {
  version: number;
  cases: (ModelCase | GuardCase)[];
};

const modelCases = caseFile.cases.filter((c): c is ModelCase => c.kind === 'model');
const guardCases = caseFile.cases.filter((c): c is GuardCase => c.kind === 'guard');

/** Same normalization as brief-guard's whitelist — kept in lockstep by the
 * guard check below, which runs the real function. */
function numbersOf(text: string): Set<string> {
  const out = new Set<string>();
  for (const m of text.matchAll(/\d+(?:[.,]\d+)?/g)) {
    out.add(String(parseFloat(m[0].replace(',', '.'))));
  }
  return out;
}

interface CaseResult {
  name: string;
  errors: string[];
  latencyMs: number | null;
}

// ---------------------------------------------------------------------------
// Guard cases — offline, deterministic, always run.
// ---------------------------------------------------------------------------
function runGuardCase(c: GuardCase): CaseResult {
  const verdict = sanitizeBriefSummary(c.candidate, c.paragraph);
  const accepted = verdict !== null;
  return {
    name: c.name,
    errors:
      accepted === c.accept
        ? []
        : [`guard ${accepted ? 'accepted' : 'rejected'}, expected ${c.accept ? 'accept' : 'reject'}`],
    latencyMs: null,
  };
}

// ---------------------------------------------------------------------------
// Model cases — the deployed prompt, verbatim.
// ---------------------------------------------------------------------------
const hasKey = Boolean(process.env.ANTHROPIC_API_KEY);
const anthropic = hasKey ? new Anthropic() : null;
const supportsEffort = !MODEL.includes('haiku');

async function callModel(c: ModelCase): Promise<string | null> {
  const response = await anthropic!.messages.create({
    model: MODEL,
    max_tokens: 1000,
    output_config: {
      ...(supportsEffort ? { effort: 'low' as const } : {}),
      format: { type: 'json_schema', schema: OUTPUT_SCHEMA },
    },
    system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: userContent(c.language, c.paragraph) }],
  });
  if (response.stop_reason === 'refusal') return null;
  const text = response.content.find((b) => b.type === 'text');
  if (!text || text.type !== 'text') return null;
  const parsed = JSON.parse(text.text) as { summary?: unknown };
  return typeof parsed.summary === 'string' && parsed.summary.trim().length > 0
    ? parsed.summary.trim()
    : null;
}

function checkRewrite(c: ModelCase, raw: string | null): string[] {
  if (c.expect_null) {
    return raw === null ? [] : [`expected null, got: "${raw.slice(0, 80)}"`];
  }
  if (raw === null) return ['model returned null for a meaningful paragraph'];

  const errors: string[] = [];
  // House style, asserted on the RAW output — the prompt must comply on its
  // own; the guard is the net, not the standard.
  if (raw.includes('!')) errors.push('raw output contains "!"');
  if (raw.includes('\n')) errors.push('raw output is not one paragraph');
  if (/\bai\b/i.test(raw)) errors.push('raw output says "AI"');
  if (/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u.test(raw)) errors.push('raw output has emoji');
  const allowed = numbersOf(c.paragraph);
  for (const n of numbersOf(raw)) {
    if (!allowed.has(n)) errors.push(`invented number ${n}`);
  }
  for (const s of c.must_not_mention ?? []) {
    if (raw.toLowerCase().includes(s.toLowerCase())) errors.push(`mentions forbidden "${s}"`);
  }
  // The real gate, exactly as the client runs it.
  if (sanitizeBriefSummary(raw, c.paragraph) === null) {
    errors.push('brief-guard rejected the rewrite');
  }
  return errors;
}

async function runModelCase(c: ModelCase): Promise<CaseResult> {
  const started = Date.now();
  try {
    let raw: string | null;
    try {
      raw = await callModel(c);
    } catch (err) {
      // One retry on transient failures so a blip doesn't read as a regression.
      const m = err instanceof Error ? err.message : String(err);
      if (!/429|5\d\d|overloaded|rate/i.test(m)) throw err;
      await new Promise((r) => setTimeout(r, 4000));
      raw = await callModel(c);
    }
    return { name: c.name, errors: checkRewrite(c, raw), latencyMs: Date.now() - started };
  } catch (err) {
    return {
      name: c.name,
      errors: [`request failed: ${err instanceof Error ? err.message : err}`],
      latencyMs: Date.now() - started,
    };
  }
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------
const results: CaseResult[] = [];

for (const c of guardCases) results.push(runGuardCase(c));

if (hasKey && modelCases.length) {
  const modelResults: CaseResult[] = new Array(modelCases.length);
  let cursor = 0;
  async function worker() {
    while (cursor < modelCases.length) {
      const i = cursor++;
      modelResults[i] = await runModelCase(modelCases[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, modelCases.length) }, worker));
  results.push(...modelResults);
}

let passed = 0;
for (const r of results) {
  if (r.errors.length === 0) {
    passed++;
    console.log(`✓ ${r.name}`);
  } else {
    console.log(`✗ ${r.name}`);
    for (const e of r.errors) console.log(`    ${e}`);
  }
}

const latencies = results
  .map((r) => r.latencyMs)
  .filter((n): n is number => n !== null)
  .sort((a, b) => a - b);
const pct = (p: number) =>
  latencies[Math.min(latencies.length - 1, Math.floor((p / 100) * latencies.length))];

console.log(`\n${passed}/${results.length} passed (cases v${caseFile.version}, model: ${MODEL})`);
if (latencies.length) console.log(`latency p50 ${pct(50)} ms · p95 ${pct(95)} ms`);

if (!hasKey && modelCases.length) {
  console.log(
    `\n⚠ ${modelCases.length} model cases SKIPPED — no ANTHROPIC_API_KEY. This is not a §9.4 run.`,
  );
  process.exit(1);
}
process.exit(passed === results.length ? 0 : 1);
