import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';

import { devLog } from '@/lib/log';

import { applyImport, type ImportResult } from './apply';
import { parseCsv } from './csv';
import { detectFormat, mapCsv } from './formats';

/**
 * The file is read into memory whole, parsed one character at a time, and
 * written in a single transaction — so its size is this flow's memory ceiling
 * (S10, security review 10 Sep 2026). Ten megabytes is far above any real
 * training history (a decade of Hevy is comfortably under two) and far below
 * what runs an iPhone out of memory. The import feature exists precisely to
 * accept files from elsewhere, so "the user picked it themselves" is not a
 * reason to read whatever arrives.
 */
export const MAX_IMPORT_BYTES = 10 * 1024 * 1024;
const MAX_IMPORT_MB = MAX_IMPORT_BYTES / (1024 * 1024);

/**
 * The whole pick-a-CSV → import flow, shared by /settings and onboarding
 * (CLAUDE.md §10 — import is a growth feature, not a settings feature).
 * Callers phrase the outcome; this never throws.
 */
export type PickImportOutcome =
  | { status: 'cancelled' }
  | { status: 'invalid' } // not a Hevy/Strong export
  // A real export, refused for its size. Its own outcome and not `invalid`,
  // because telling someone their genuine Hevy export "is not a Hevy export"
  // is a lie the copy would then have to tell (CLAUDE.md §5.3).
  | { status: 'too-large'; limitMb: number }
  | { status: 'failed' }
  | ({ status: 'done'; droppedRows: number } & ImportResult);

export async function pickAndImportCsv(userId: string): Promise<PickImportOutcome> {
  try {
    const picked = await DocumentPicker.getDocumentAsync({
      type: ['text/comma-separated-values', 'text/csv', 'public.comma-separated-values-text', 'text/plain'],
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (picked.canceled || !picked.assets?.[0]) return { status: 'cancelled' };
    const asset = picked.assets[0];

    // Checked BEFORE the read, so an oversized file never reaches memory.
    if (asset.size != null && asset.size > MAX_IMPORT_BYTES) {
      return { status: 'too-large', limitMb: MAX_IMPORT_MB };
    }

    const text = await FileSystem.readAsStringAsync(asset.uri);
    // `size` is absent from some providers (iCloud, a few third-party ones), so
    // the same ceiling is applied again to what actually arrived. Bounding only
    // the reported size would leave the unreported case unbounded.
    if (text.length > MAX_IMPORT_BYTES) {
      return { status: 'too-large', limitMb: MAX_IMPORT_MB };
    }

    const rows = parseCsv(text);
    const format = rows.length > 0 ? detectFormat(rows[0]!) : null;
    if (!format) return { status: 'invalid' };

    const { days, droppedRows } = mapCsv(rows, format);
    return { status: 'done', droppedRows, ...applyImport(userId, days) };
  } catch (err) {
    devLog('import failed:', err instanceof Error ? err.message : err);
    return { status: 'failed' };
  }
}
