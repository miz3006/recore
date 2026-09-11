/**
 * FOLD THE ACCOUNT'S DUPLICATE EXERCISE ROWS INTO ONE EACH — a one-off repair
 * for catalogues that already have them.
 *
 *   node scripts/dedupe-exercises.ts             # say what it would do
 *   node scripts/dedupe-exercises.ts --apply     # do it, after writing a backup
 *
 * ## What causes them
 *
 * A parse resolves every reading against the LOCAL exercise catalogue. A device
 * that has not pulled one yet — a fresh install, a restored account, a wiped
 * database, or a sync pass that parsed before it pulled — creates its own row
 * for a movement the account already has and pushes it. Nothing upstream
 * notices: the rows have different ids, so every later pull keeps both. The
 * history then splits between them and Progress lists one lift twice.
 *
 * The app fixes the cause (`syncNow` pulls before it parses) and heals new
 * cases on the device (`mergeDuplicateExercises` runs after every pull). This
 * script is for what is already in the account, because a device only ever
 * merges its OWN copy — the duplicate rows in the cloud have to be re-pointed
 * where they live.
 *
 * ## The rules it follows
 *
 * The same ones the app follows (`src/lib/db/exercise-identity.ts`, imported
 * here so the two cannot drift): rows are grouped by the WORDS of their name,
 * so "Bench Press", "Bench press" and "bench presses" are one movement while
 * "Squat" and "Front Squat" are two; the survivor is the row with the most
 * items behind it; the losers' items and alias overrides are re-pointed, their
 * spelling is carried over as shorthand, and only then are they deleted.
 *
 * GLOBAL rows (user_id null) are never touched — they are the shared catalogue.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { duplicateGroups, normalizeName } from '../src/lib/db/exercise-identity.ts';

const here = dirname(fileURLToPath(import.meta.url));
const envPath = join(here, '..', '.env');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"#]*?)"?\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
  }
}

const APPLY = process.argv.includes('--apply');
const URL_BASE = process.env.EXPO_PUBLIC_SUPABASE_URL;
const ANON = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const EMAIL = process.env.EVAL_EDGE_EMAIL ?? 'dev@recore.invalid';
const PASSWORD = process.env.EVAL_EDGE_PASSWORD ?? 'recore-development-only';
if (!URL_BASE || !ANON) throw new Error('EXPO_PUBLIC_SUPABASE_URL / _ANON_KEY missing (.env)');

const auth = await fetch(`${URL_BASE}/auth/v1/token?grant_type=password`, {
  method: 'POST',
  headers: { apikey: ANON, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
});
if (!auth.ok) throw new Error(`sign-in ${auth.status}: ${(await auth.text()).slice(0, 200)}`);
const { access_token: token, user } = (await auth.json()) as {
  access_token: string;
  user: { id: string };
};

const headers = {
  apikey: ANON,
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json',
};

async function rest<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${URL_BASE}/rest/v1/${path}`, { ...init, headers });
  if (!res.ok) throw new Error(`${init?.method ?? 'GET'} ${path} → ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

interface RemoteExercise {
  id: string;
  user_id: string | null;
  canonical: string;
  aliases: string[] | null;
  modality: string | null;
  increment_kg: number | null;
}

const exercises = await rest<RemoteExercise[]>(
  'exercises?select=id,user_id,canonical,aliases,modality,increment_kg',
);
const mine = exercises.filter((e) => e.user_id === user.id);
const items = await rest<{ id: string; exercise_id: string | null }[]>(
  'items?select=id,exercise_id',
);
const counts = new Map<string, number>();
for (const item of items) {
  if (item.exercise_id) counts.set(item.exercise_id, (counts.get(item.exercise_id) ?? 0) + 1);
}

console.log(
  `account ${user.id}: ${exercises.length} rows visible, ${mine.length} owned, ${items.length} items`,
);

const groups = duplicateGroups(
  mine.map((e) => ({
    id: e.id,
    canonical: e.canonical,
    items: counts.get(e.id) ?? 0,
    // Nothing here is "local": every row in this table has been synced. The
    // tiebreak that matters in the cloud is the item count, then the id.
    local: false,
  })),
);

if (groups.length === 0) {
  console.log('no duplicates — nothing to do');
  process.exit(0);
}

const byId = new Map(mine.map((e) => [e.id, e]));
const plan = groups.map(([keep, ...losers]) => ({
  keep: keep!,
  losers,
  moves: losers.reduce((sum, l) => sum + l.items, 0),
}));

for (const { keep, losers, moves } of plan) {
  console.log(
    `\n"${keep.canonical}" (${keep.items} items) ← ${losers
      .map((l) => `"${l.canonical}" (${l.items})`)
      .join(', ')}${moves > 0 ? ` — ${moves} item(s) move` : ''}`,
  );
}
console.log(
  `\n${plan.reduce((n, p) => n + p.losers.length, 0)} row(s) would be merged away, ` +
    `${plan.reduce((n, p) => n + p.moves, 0)} item(s) re-pointed`,
);

if (!APPLY) {
  console.log('\ndry run — pass --apply to write the changes');
  process.exit(0);
}

const backup = join(here, '..', `exercises-backup-${user.id.slice(0, 8)}.json`);
writeFileSync(backup, JSON.stringify({ exercises: mine, items }, null, 1));
console.log(`\nbackup written to ${backup}`);

for (const { keep, losers } of plan) {
  const keeper = byId.get(keep.id)!;
  const known = new Set([normalizeName(keeper.canonical), ...(keeper.aliases ?? []).map(normalizeName)]);
  const carried: string[] = [];

  for (const loser of losers) {
    const row = byId.get(loser.id)!;
    for (const alias of [...(row.aliases ?? []), row.canonical].map(normalizeName)) {
      if (alias && !known.has(alias)) {
        known.add(alias);
        carried.push(alias);
      }
    }
    await rest(`items?exercise_id=eq.${loser.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ exercise_id: keep.id }),
    });
    await rest(`alias_overrides?exercise_id=eq.${loser.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ exercise_id: keep.id }),
    });
  }

  if (carried.length > 0) {
    await rest(`exercises?id=eq.${keep.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ aliases: [...(keeper.aliases ?? []), ...carried] }),
    });
  }
  for (const loser of losers) {
    await rest(`exercises?id=eq.${loser.id}`, { method: 'DELETE' });
  }
  console.log(`merged ${losers.length} into "${keep.canonical}"`);
}

console.log('\ndone — every device folds its own copy away on the next pull');
