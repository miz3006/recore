import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';

import { devLog } from '@/lib/log';

import { applyImport, type ImportResult } from './apply';
import { parseCsv } from './csv';
import { detectFormat, mapCsv } from './formats';

/**
 * The whole pick-a-CSV → import flow, shared by /settings and onboarding
 * (CLAUDE.md §10 — import is a growth feature, not a settings feature).
 * Callers phrase the outcome; this never throws.
 */
export type PickImportOutcome =
  | { status: 'cancelled' }
  | { status: 'invalid' } // not a Hevy/Strong export
  | { status: 'failed' }
  | ({ status: 'done' } & ImportResult);

export async function pickAndImportCsv(userId: string): Promise<PickImportOutcome> {
  try {
    const picked = await DocumentPicker.getDocumentAsync({
      type: ['text/comma-separated-values', 'text/csv', 'public.comma-separated-values-text', 'text/plain'],
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (picked.canceled || !picked.assets?.[0]) return { status: 'cancelled' };

    const text = await FileSystem.readAsStringAsync(picked.assets[0].uri);
    const rows = parseCsv(text);
    const format = rows.length > 0 ? detectFormat(rows[0]!) : null;
    if (!format) return { status: 'invalid' };

    const days = mapCsv(rows, format);
    return { status: 'done', ...applyImport(userId, days) };
  } catch (err) {
    devLog('import failed:', err instanceof Error ? err.message : err);
    return { status: 'failed' };
  }
}
