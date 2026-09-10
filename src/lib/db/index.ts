import * as Crypto from 'expo-crypto';
import { openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';

import { devLog } from '@/lib/log';

import {
  MIGRATION_2_SQL,
  MIGRATION_4_SQL,
  MIGRATION_5_SQL,
  MIGRATION_6_SQL,
  SCHEMA_SQL,
  SCHEMA_VERSION,
} from './schema';

/**
 * expo-sqlite is the on-device source of truth (CLAUDE.md §2). Everything here
 * uses the synchronous API on purpose: a keystroke's raw_text write completes
 * in the same tick — the UI never waits on the network OR on an async queue.
 */
let db: SQLiteDatabase | null = null;

export function getDb(): SQLiteDatabase {
  if (!db) {
    db = openDatabaseSync('recore.db');
    migrate(db);
  }
  return db;
}

function migrate(database: SQLiteDatabase) {
  const row = database.getFirstSync<{ user_version: number }>('PRAGMA user_version');
  const current = row?.user_version ?? 0;
  if (current < SCHEMA_VERSION) {
    // Stepped ALTERs for tables that already exist (IF NOT EXISTS never adds
    // columns), then the full script — its IF NOT EXISTS creates whatever a
    // fresh OR upgrading install is missing.
    if (current >= 1 && current < 2) database.execSync(MIGRATION_2_SQL);
    // A fresh install (current === 0) gets the column from SCHEMA_SQL's CREATE;
    // only an existing `workouts` table needs the ALTER.
    if (current >= 1 && current < 4) database.execSync(MIGRATION_4_SQL);
    if (current >= 1 && current < 5) database.execSync(MIGRATION_5_SQL);
    if (current >= 1 && current < 6) database.execSync(MIGRATION_6_SQL);
    database.execSync(SCHEMA_SQL);
    database.execSync(`PRAGMA user_version = ${SCHEMA_VERSION}`);
    devLog('sqlite migrated to schema', SCHEMA_VERSION);
  } else {
    // Re-apply pragmas that don't persist across connections.
    database.execSync('PRAGMA foreign_keys = ON;');
  }
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
    database.execSync(
      'DELETE FROM parse_cache; DELETE FROM corrections; DELETE FROM alias_overrides; DELETE FROM sets; DELETE FROM items; DELETE FROM workouts; DELETE FROM predictions; DELETE FROM plan_days; DELETE FROM exercises; DELETE FROM meta;',
    );
  });
  setMeta('user_id', userId);
  devLog('local db scoped to new user');
}
