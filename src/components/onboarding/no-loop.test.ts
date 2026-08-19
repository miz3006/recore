import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

/**
 * §A.1: onboarding illustrations are STATIC. No float, no breathe, no scale
 * loop — nothing under the onboarding directories may start an animation that
 * repeats. A one-shot entrance is still allowed and is why this is a check for
 * looping primitives rather than for motion.
 *
 * The banned tokens are assembled from pieces so this file does not itself
 * answer a `grep` for them: the check has to be the only thing standing between
 * the flow and a reintroduced loop, and a test that shows up in the search for
 * the very thing it forbids makes that search useless.
 */
const BANNED = [
  ['with', 'Repeat'].join(''), // reanimated's loop
  ['Animated', '.loop'].join(''), // the RN Animated equivalent
  ['IDLE_', 'CYCLE_MS'].join(''), // the token the removed float loop ran on
];

const ROOTS = [
  path.join(import.meta.dirname, '..', '..', 'components', 'onboarding'),
  path.join(import.meta.dirname, '..', '..', 'app', 'onboarding'),
];

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...sourceFiles(full));
      continue;
    }
    if (/\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

test('zero looping animations anywhere under the onboarding directories', () => {
  let scanned = 0;
  for (const root of ROOTS) {
    const files = sourceFiles(root);
    assert.ok(files.length > 0, `no source files found under ${root} — wrong path?`);
    for (const file of files) {
      scanned += 1;
      const source = readFileSync(file, 'utf8');
      for (const token of BANNED) {
        assert.ok(
          !source.includes(token),
          `${path.relative(process.cwd(), file)} uses ${token} — onboarding illustrations are static (§A.1)`,
        );
      }
    }
  }
  // A vacuous pass (an empty or mis-resolved directory) is the one way this
  // check could quietly stop protecting anything.
  assert.ok(scanned >= 15, `only ${scanned} onboarding files were scanned`);
});
