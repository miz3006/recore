import { getDb, getMeta, setMeta } from '@/lib/db/index';
import { devLog } from '@/lib/log';
import { clearV2Run, setSandboxRun } from '@/state/onboarding-v2';

/**
 * THE SANDBOX — how either onboarding flow can be run without consequences.
 *
 * `docs/onboarding-v2-spec.md` §0 asks the You tab for three development rows:
 * run the current flow (sandboxed), run v2, and reset sandbox state.
 *
 * v2 IS THE PRIMARY FLOW SINCE 28 AUGUST 2026, so it now has real answers to
 * protect as well: a dev run of it opens with `?dev=1`, which stops the store
 * persisting and stops the flow committing (`state/onboarding-v2.ts`), and the
 * reset row clears whatever a dev run left in memory. Everything else below —
 * the `pref_%` snapshot — still exists for the FIRST row, the v1 flow, which
 * writes as it goes.
 *
 * ## Why the existing flow needs a snapshot and v2 does not
 *
 * The shipping flow at `src/app/onboarding/` writes as it goes: `setName`,
 * `setGoal`, `setSplit`, the key lifts, `markOnboardingDone`. Sandboxing it
 * properly would mean changing it — and §0 is explicit that touching anything
 * under `src/app/onboarding/` means you are in the wrong place. So it is
 * sandboxed from the OUTSIDE instead: every `pref_%` row is copied before the
 * flow is launched, and "Reset sandbox state" puts them all back.
 *
 * That is a weaker guarantee than v2's, and it is stated plainly rather than
 * implied: the real flow still writes while it runs, and the snapshot undoes
 * the writes afterwards. An app killed mid-run leaves the snapshot on disk and
 * the restore still works on next launch, which is the case that matters.
 *
 * `pref_%` is the right net because it is the same predicate `export-json.ts`
 * uses for "the things onboarding decided about this person".
 *
 * DEV ONLY. Every caller is behind `__DEV__`; nothing here ships.
 */

const SNAPSHOT_KEY = 'dev_ob_sandbox_snapshot';
/**
 * `lib/recap.ts`'s one-bit "the OS has been asked" flag. Cleared on reset so a
 * dev run can reach the prompt again.
 *
 * THE OS-LEVEL PERMISSION ITSELF CANNOT BE UNDONE by any code, ours or
 * Apple's — clearing this only lets us ask again, and iOS will still refuse to
 * show a second prompt once `canAskAgain` is false. It is the one thing the
 * sandbox genuinely cannot put back, and it is why v2 asks for the permission
 * but never switches the real recap feature on. See FINDINGS §17.
 */
const RECAP_ASKED_KEY = 'recap_notif_asked';

interface Row {
  key: string;
  value: string | null;
}

/** Copy every onboarding-owned preference. Overwrites any older snapshot — the
 * useful one is always the most recent launch. */
export function snapshotPrefs(): void {
  try {
    const rows = getDb().getAllSync<Row>("SELECT key, value FROM meta WHERE key LIKE 'pref_%'");
    setMeta(SNAPSHOT_KEY, JSON.stringify(rows));
    devLog('sandbox', 'snapshot', { rows: rows.length });
  } catch (error) {
    devLog('sandbox', 'snapshot failed', { error: String(error) });
  }
}

export function hasSnapshot(): boolean {
  return getMeta(SNAPSHOT_KEY) !== null;
}

/**
 * Put the person's real answers back and drop the sandbox.
 *
 * Keys that exist NOW but were absent from the snapshot are cleared, not left
 * behind — a run of the flow that invented a new preference would otherwise
 * survive the reset and be invisible.
 */
export function restorePrefs(): number {
  try {
    const raw = getMeta(SNAPSHOT_KEY);
    if (!raw) return 0;
    const saved = JSON.parse(raw) as Row[];
    const savedKeys = new Set(saved.map((r) => r.key));

    const current = getDb().getAllSync<Row>("SELECT key, value FROM meta WHERE key LIKE 'pref_%'");
    for (const row of current) {
      if (!savedKeys.has(row.key)) setMeta(row.key, null);
    }
    for (const row of saved) setMeta(row.key, row.value);

    setMeta(SNAPSHOT_KEY, null);
    devLog('sandbox', 'restored', { rows: saved.length });
    return saved.length;
  } catch (error) {
    devLog('sandbox', 'restore failed', { error: String(error) });
    return 0;
  }
}

/** Everything "Reset sandbox state" does: the mode is dropped, the v2 answers
 * and their stored row go, and the real preferences come back if a run of the
 * current flow is still in flight. */
export function resetSandbox(): { restored: number } {
  setSandboxRun(false);
  clearV2Run();
  try {
    setMeta(RECAP_ASKED_KEY, null);
  } catch {
    // A dev-only flag failing to clear is never worth an error.
  }
  return { restored: restorePrefs() };
}
