import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

import { dayKeyFor } from './db/dates';
import { devLog } from './log';

/**
 * Hand the export out as a FILE (CLAUDE.md §13, PLAN C6).
 *
 * It used to go out as `Share.share({ message: csv })` — the entire export as
 * the body of a message. That reaches Mail and Notes and nothing else: it
 * cannot be saved to Files, cannot be opened by a spreadsheet, and silently
 * truncates on a long history. §20 says export may never be gated, degraded or
 * delayed, and handing someone their five-year training record as an SMS body
 * is a degradation even though nothing errored.
 *
 * So it is written to the cache directory and shared with `Sharing.shareAsync`
 * and a real UTI — exactly what `session-receipt.tsx` already does for the PNG.
 * The system sheet then offers Files, AirDrop, Drive, Mail, everything.
 */
export type ExportFormat = 'csv' | 'json';

export type ShareExportOutcome = 'shared' | 'unavailable' | 'failed';

const SPEC: Record<ExportFormat, { ext: string; mimeType: string; uti: string }> = {
  csv: { ext: 'csv', mimeType: 'text/csv', uti: 'public.comma-separated-values-text' },
  json: { ext: 'json', mimeType: 'application/json', uti: 'public.json' },
};

/** "recore-export-2026-07-28.csv" — a name that means something in Files. */
export function exportFilename(format: ExportFormat, now = new Date()): string {
  return `recore-export-${dayKeyFor(now)}.${SPEC[format].ext}`;
}

export async function shareExportFile(
  format: ExportFormat,
  contents: string,
): Promise<ShareExportOutcome> {
  const spec = SPEC[format];
  try {
    if (!(await Sharing.isAvailableAsync())) return 'unavailable';

    // The cache directory, not documents: this is a handoff artefact, not a
    // second copy of the record. iOS reclaims it, and the user's real copy is
    // wherever they chose to put it in the share sheet.
    const uri = `${FileSystem.cacheDirectory}${exportFilename(format)}`;
    await FileSystem.writeAsStringAsync(uri, contents, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    await Sharing.shareAsync(uri, {
      mimeType: spec.mimeType,
      UTI: spec.uti,
      dialogTitle: 'Recore export',
    });
    return 'shared';
  } catch (err) {
    devLog('export share failed:', err instanceof Error ? err.message : err);
    return 'failed';
  }
}
