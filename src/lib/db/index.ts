import * as Crypto from 'expo-crypto';
import { openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';

import { devLog } from '@/lib/log';

import { ADDED_COLUMNS, SCHEMA_SQL, SCHEMA_VERSION, WIPE_SQL } from './schema';

/**
 * expo-sqlite is the on-device source of truth (CLAUDE.md §2). Everything here
 * uses the synchronous API on purpose: a keystroke's raw_text write completes
 * in the same tick — the UI never waits on the network OR on an async queue.
 */
let db: SQLiteDatabase | null = null;

export function getDb(): SQLiteDatabase {
  if (!db) {
    /**
     * THE CONNECTION IS CACHED ONLY ONCE IT IS MIGRATED (10 September 2026).
     *
     * `db` used to be assigned before `migrate()` ran, so a migration that
     * threw left an OPEN, UN-MIGRATED connection in the module — and every
     * later call returned it happily, because the only thing that triggers a
     * migration is opening. The app then ran for the rest of its life against
     * a schema it had already decided was too old: usable for every query that
     * predated the failure, fatal for every query that was the reason for it.
     */
    const opened = openDatabaseSync('recore.db');
    migrate(opened);
    db = opened;
  }
  return db;
}

/**
 * Bring any database — fresh, current, or half-upgraded — to this bundle's
 * schema. Runs on every open and is idempotent, which is the whole design:
 * see `ADDED_COLUMNS` in `schema.ts` for why a version number is not allowed
 * to decide what happens here.
 */
function migrate(database: SQLiteDatabase) {
  const row = database.getFirstSync<{ user_version: number }>('PRAGMA user_version');
  const current = row?.user_version ?? 0;

  // Tables, indexes, and the two pragmas that do not persist across
  // connections (`journal_mode`, `foreign_keys`) — every statement in there is
  // `IF NOT EXISTS`, so this is a no-op on a current database and the pragmas
  // now get re-applied on a MIGRATING connection too, which the old
  // if/else missed entirely.
  database.execSync(SCHEMA_SQL);

  // Then the columns, by presence. A fresh install got them all from the
  // CREATE above and adds nothing.
  const added: string[] = [];
  for (const { table, column, decl } of ADDED_COLUMNS) {
    if (!hasTable(database, table) || hasColumn(database, table, column)) continue;
    database.execSync(`ALTER TABLE ${table} ADD COLUMN ${column} ${decl};`);
    added.push(`${table}.${column}`);
  }

  if (current !== SCHEMA_VERSION) {
    database.execSync(`PRAGMA user_version = ${SCHEMA_VERSION}`);
    devLog('sqlite migrated to schema', SCHEMA_VERSION, `from ${current}`);
  }
  // Said out loud even when the version claimed to be current, because that is
  // exactly the case worth knowing about: the stamp lied and the repair worked.
  if (added.length > 0) devLog('sqlite added missing columns', added.join(', '));
}

function hasTable(database: SQLiteDatabase, table: string): boolean {
  const row = database.getFirstSync<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
    [table],
  );
  return row != null;
}

function hasColumn(database: SQLiteDatabase, table: string, column: string): boolean {
  // `table_info` takes no bound parameter, and the names come from
  // `ADDED_COLUMNS` in this repository — never from a device, an account or a
  // parse — so there is nothing here for an interpolation to smuggle in.
  const rows = database.getAllSync<{ name: string }>(`PRAGMA table_info(${table})`);
  return rows.some((r) => r.name === column);
}

export function newId(): string {
  return Crypto.randomUUID();
}

export function nowIso(): string {
  return new Date().toISOString();
}

// --- meta KV -----------------------------------------------------------------

export function getMeta(key: string): string | null {
  const row = getDb().getFirstSync<{ value: string | null }>(
    'SELECT value FROM meta WHERE key = ?',
    [key],
  );
  return row?.value ?? null;
}

export function setMeta(key: string, value: string | null) {
  getDb().runSync(
    'INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    [key, value],
  );
}

/**
 * Every table that carries a `user_id` of its own. `items`, `sets` and
 * `parse_cache` are absent on purpose: they hang off `workouts` / `exercises`
 * by foreign key and follow their parents without being named here.
 *
 * `exercises` is the one that needs the `user_id = ?` predicate to matter —
 * a NULL there is a GLOBAL exercise, shared by every account on the device,
 * and claiming those would hand the built-in catalogue to one user.
 */
const OWNED_TABLES = [
  'workouts',
  'exercises',
  'predictions',
  'plan_days',
  'corrections',
  'alias_overrides',
] as const;

/**
 * HAND THE PRE-ACCOUNT RECORD TO THE ACCOUNT (owner's ruling, 4 September 2026).
 *
 * The funnel writes before an account exists — onboarding answers, a plan, the
 * demo line that becomes the first session — all scoped to the local id
 * (`auth/provider.tsx`). Until this existed, `ensureLocalUser` saw the id change
 * at the instant sign-in succeeded and did what it does for any change: wiped
 * everything. The person's plan and every `pref_*` answer were deleted at the
 * exact moment they finished the funnel, and the only reason it was survivable
 * is that `seedOnboardingDemo` re-runs afterwards and re-seeds the one line.
 *
 * So a claim, not a delete. **`meta` is kept whole** — that is where `prefs.ts`
 * stores every onboarding answer — and only its `user_id` key is re-pointed.
 *
 * ## Why the rows are marked dirty
 *
 * They were written while the sync loop was stopped, so this account's server
 * has never seen any of them. `dirty = 1` is the honest state and it is what
 * makes the first pass after sign-in push the whole funnel up.
 *
 * ## This is ONLY ever local → account
 *
 * Two real accounts on one device still wipe, and must: that boundary is the
 * on-device mirror of the server's RLS, and a claim across it would hand user
 * A's training to user B. The caller names the id it is claiming FROM, so this
 * function can never be talked into the general case.
 */
function claimLocalRows(from: string, to: string) {
  const database = getDb();
  database.withTransactionSync(() => {
    for (const table of OWNED_TABLES) {
      database.runSync(`UPDATE ${table} SET user_id = ?, dirty = 1 WHERE user_id = ?`, [to, from]);
    }
  });
  setMeta('user_id', to);
  devLog('local record claimed by the signed-in account');
}

/**
 * Scope the local database to ONE account. If a DIFFERENT user signs in on
 * this device, every locally cached row from the previous account is wiped so
 * user B can never read user A's training data (mirrors the server-side RLS
 * boundary on-device).
 *
 * @param claimFrom The id whose rows should be ADOPTED rather than deleted —
 *   the pre-account local scope, and nothing else. Omit it and every change of
 *   user wipes, which is the rule for two real accounts.
 */
export function ensureLocalUser(userId: string, claimFrom?: string) {
  const current = getMeta('user_id');
  if (current === userId) return;

  if (claimFrom && current === claimFrom && userId !== claimFrom) {
    claimLocalRows(claimFrom, userId);
    return;
  }

  const database = getDb();
  database.withTransactionSync(() => {
    database.execSync(WIPE_SQL);
  });
  setMeta('user_id', userId);
  devLog('local db scoped to new user');
}
