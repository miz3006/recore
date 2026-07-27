#!/usr/bin/env node
/**
 * The token gate (PLAN.md 1.4, CLAUDE.md §23).
 *
 * Fails on a hex colour, a raw font size, a raw font family or a raw spacing
 * number anywhere outside `src/lib/theme/`. This is the check that keeps the §6
 * system alive for the next twelve weeks: a design system is not a set of files,
 * it is the absence of alternatives, and the only thing that reliably enforces
 * an absence is a build failure.
 *
 * **The ratchet.** Phase 1 does not rewrite every legacy screen — §22 schedules
 * `/stats`, `/settings`, `/paywall`, `onboarding/*` and the sheets for phases 2
 * through 5 — so a strict repo-wide gate today would either fail forever or be
 * turned off, and a gate that is allowed to fail is not a gate. Instead every
 * known violation is recorded in `token-baseline.json` with a count per file,
 * and the run fails when:
 *
 *   · a file NOT in the baseline has any violation at all, or
 *   · a file in the baseline has MORE violations than it did.
 *
 * `--write` re-records the counts, but **only downward**: it refuses to raise a
 * number, so the escape hatch cannot be used to launder a new violation. The
 * baseline can only shrink, and it reaches zero when the last legacy screen is
 * rewritten — at which point this comment and the file both go away.
 *
 *   node scripts/check-tokens.mjs           # check
 *   node scripts/check-tokens.mjs --write   # ratchet the baseline down
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const SRC = join(ROOT, 'src');
const BASELINE = join(ROOT, 'scripts', 'token-baseline.json');

/** The one directory allowed to contain literals — it is where they come from. */
const EXEMPT = ['src/lib/theme/'];

/**
 * Spacing and shape properties. A number here should have come off `space`,
 * `spacing` or `radius`; `0` is exempt because zero is zero on every scale.
 */
const SPACE_PROPS = [
  'padding',
  'paddingTop',
  'paddingBottom',
  'paddingLeft',
  'paddingRight',
  'paddingHorizontal',
  'paddingVertical',
  'paddingStart',
  'paddingEnd',
  'margin',
  'marginTop',
  'marginBottom',
  'marginLeft',
  'marginRight',
  'marginHorizontal',
  'marginVertical',
  'marginStart',
  'marginEnd',
  'gap',
  'rowGap',
  'columnGap',
  'borderRadius',
  'borderTopLeftRadius',
  'borderTopRightRadius',
  'borderBottomLeftRadius',
  'borderBottomRightRadius',
];

const RULES = [
  {
    id: 'colour-literal',
    re: /#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3}(?:[0-9a-fA-F]{2})?)?\b/g,
    hint: 'colour literal — resolve it through useTheme()/makeStyles (§6.3)',
  },
  {
    id: 'colour-function',
    re: /\b(?:rgba?|hsla?)\(/g,
    hint: 'colour literal — resolve it through useTheme()/makeStyles (§6.3)',
  },
  {
    id: 'font-size',
    re: /\bfontSize:\s*-?\d+(?:\.\d+)?/g,
    hint: 'raw font size — spread a `type.*` rung (§6.5)',
  },
  {
    id: 'font-family',
    re: /\bfontFamily:\s*['"`]/g,
    hint: 'raw font family — use `mono.*` or a `type.*` rung (§6.5)',
  },
  {
    id: 'spacing',
    re: new RegExp(String.raw`\b(?:${SPACE_PROPS.join('|')}):\s*-?(?!0\b)\d+(?:\.\d+)?`, 'g'),
    hint: 'raw spacing/radius number — use `space`, `spacing` or `radius` (§6.6, §6.7)',
  },
];

/** Blank out comments and template/quoted strings' insides are kept — a hex in a
 * string is exactly what we are hunting — but a hex in prose is not. */
function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:])\/\/[^\n]*/g, (m, p1) => p1 + ' '.repeat(m.length - p1.length));
}

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

const findings = new Map(); // relPath → [{ line, id, hint, text }]

for (const file of walk(SRC)) {
  const rel = relative(ROOT, file);
  if (EXEMPT.some((prefix) => rel.startsWith(prefix))) continue;
  const lines = stripComments(readFileSync(file, 'utf8')).split('\n');
  const hits = [];
  lines.forEach((line, i) => {
    for (const rule of RULES) {
      rule.re.lastIndex = 0;
      for (const m of line.matchAll(rule.re)) {
        hits.push({ line: i + 1, id: rule.id, hint: rule.hint, text: m[0].trim() });
      }
    }
  });
  if (hits.length) findings.set(rel, hits);
}

let baseline = {};
let seeded = true;
try {
  baseline = JSON.parse(readFileSync(BASELINE, 'utf8'));
} catch {
  // No baseline yet — this is the one run allowed to record the debt as it
  // stands. Every run after it may only lower the numbers. Re-seeding means
  // deleting a checked-in file, which is not something that happens quietly.
  seeded = false;
}

const write = process.argv.includes('--write');
const counts = Object.fromEntries([...findings].map(([f, h]) => [f, h.length]));

if (write) {
  const raised = seeded ? Object.entries(counts).filter(([f, n]) => n > (baseline[f] ?? 0)) : [];
  if (raised.length) {
    console.error('Refusing to write: the baseline may only shrink.\n');
    for (const [f, n] of raised) console.error(`  ${f}  ${baseline[f] ?? 0} → ${n}`);
    console.error('\nFix the new violations instead.');
    process.exit(1);
  }
  const next = Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(BASELINE, `${JSON.stringify(next, null, 2)}\n`);
  const before = Object.values(baseline).reduce((a, b) => a + b, 0);
  const after = Object.values(next).reduce((a, b) => a + b, 0);
  console.log(`token baseline: ${before} → ${after} violations in ${Object.keys(next).length} files`);
  process.exit(0);
}

const failures = [];
for (const [file, hits] of findings) {
  const allowed = baseline[file] ?? 0;
  if (hits.length > allowed) failures.push({ file, hits, allowed });
}

if (failures.length) {
  console.error('\nToken gate failed — §6 values must come from src/lib/theme/.\n');
  for (const { file, hits, allowed } of failures) {
    console.error(`${file}  (${hits.length} violations, ${allowed} allowed)`);
    for (const h of hits.slice(0, 12)) console.error(`  ${file}:${h.line}  ${h.text}  ← ${h.hint}`);
    if (hits.length > 12) console.error(`  … ${hits.length - 12} more`);
    console.error('');
  }
  process.exit(1);
}

const shrunk = Object.entries(baseline).filter(([f, n]) => (counts[f] ?? 0) < n);
const total = Object.values(counts).reduce((a, b) => a + b, 0);
console.log(
  `token gate: clean (${total} legacy violations held at the baseline${
    shrunk.length ? `; ${shrunk.length} file(s) improved — run with --write to ratchet down` : ''
  })`
);
