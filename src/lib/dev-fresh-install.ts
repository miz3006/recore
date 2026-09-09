import { signOut } from '@/lib/auth/sign-in';
import { devResetBillingState } from '@/lib/billing/state';
import { getDb } from '@/lib/db/index';
import { devLog } from '@/lib/log';
import { discardSandbox } from '@/lib/onboarding-v2-sandbox';
import { clearOnboardingDone } from '@/lib/prefs';
import { useOnboardingAnswers } from '@/state/onboarding';

/**
 * THE FRESH-INSTALL SIMULATION — one call that puts this device back in the
 * state a person is in the second after they download Recore, so the whole
 * funnel can be walked end to end: onboarding → paywall → sign-in → Today.
 *
 * It replaced four development rows in the You tab on 31 August 2026 (owner's
 * ask). Those rows each simulated a PIECE of the funnel — run v2 sandboxed, run
 * the illustrated v1 flow, reset the sandbox, open the v1 paywall — and none of
 * them could reach the thing that actually needed testing, which is the joins
 * between the pieces. A sandboxed run in particular commits nothing and so can
 * never hand over to the paywall at all.
 *
 * ## It is deliberately NOT sandboxed
 *
 * `beginSandboxRun()` exists so a dev run writes nothing. That is the opposite
 * of what this is for: the point is that the commit fires, the dispatcher sees
 * a finished funnel, the paywall gates on a real absent session, and sign-in
 * creates a real account. Anything less tests a rehearsal rather than the flow.
 * `discardSandbox()` is called first for exactly that reason — if a previous
 * dev run left the mode on, every write below would be silently swallowed.
 *
 * ## What it clears, and what it deliberately does not
 *
 * Cleared: every `pref_%` row (all onboarding answers and preferences), the
 * `onboarding_done` flag, the v1 and v2 flow stores, the sandbox snapshot, and
 * every locally cached billing fact. Then the session.
 *
 * **The training record is NOT touched.** A genuinely fresh install has no
 * workouts either, but deleting somebody's ledger is irreversible and no part
 * of the funnel reads it — Today merely renders whatever is there once you
 * arrive. Wiping it would make this button destructive in a way its label does
 * not warn about, for no test coverage in return. `account/delete.ts` is the
 * honest way to do that, and it asks first.
 *
 * **The store's own subscription is NOT touched**, because it is not ours to
 * touch. `devResetBillingState()` drops the local cache only, so the app has to
 * ask the store again — which is what a fresh install does. A sandbox account
 * that already owns a subscription will be told so, and the paywall will say
 * so. That is the store telling the truth, not the simulation failing.
 *
 * DEV ONLY. The single caller is behind `__DEV__`.
 */
export async function simulateFreshInstall(): Promise<void> {
  // FIRST, or every write below is swallowed by a sandbox left on by an
  // earlier run. It also throws the snapshot away rather than restoring it.
  discardSandbox();
  useOnboardingAnswers.getState().reset();

  try {
    // The same `pref_%` net `export-json.ts` and the sandbox use for "the
    // things onboarding decided about this person" — one predicate, so a
    // preference added later is covered here without anybody remembering to.
    getDb().runSync("DELETE FROM meta WHERE key LIKE 'pref_%'");
  } catch (error) {
    devLog('fresh-install', 'pref wipe failed', { error: String(error) });
  }

  // NOT covered by the net above: `onboarding_done` is the one key in `prefs`
  // that carries no `pref_` prefix, and it is the exact bit the dispatcher
  // reads to decide whether the funnel has been finished.
  clearOnboardingDone();
  devResetBillingState();

  // LAST. The session is what `_layout.tsx` guards the app on, so dropping it
  // is what actually moves the user out of the tabs — everything above has to
  // already be true by the time that happens.
  await signOut();
}
