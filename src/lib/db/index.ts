import * as Crypto from 'expo-crypto';
import { openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';

import { devLog } from '@/lib/log';

import { MIGRATION_2_SQL, MIGRATION_4_SQL, SCHEMA_SQL, SCHEMA_VERSION } from './schema';

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
 * Scope the local database to ONE account. If a different user signs in on
 * this device, every locally cached row from the previous account is wiped so
 * user B can never read user A's training data (mirrors the server-side RLS
 * boundary on-device).
 */
export function ensureLocalUser(userId: string) {
  const current = getMeta('user_id');
  if (current === userId) return;

  const database = getDb();
  database.withTransactionSync(() => {
    database.execSync(
      'DELETE FROM parse_cache; DELETE FROM corrections; DELETE FROM alias_overrides; DELETE FROM sets; DELETE FROM items; DELETE FROM workouts; DELETE FROM predictions; DELETE FROM plan_days; DELETE FROM exercises; DELETE FROM meta;',
    );
  });
  setMeta('user_id', userId);
  devLog('local db scoped to new user');
}
