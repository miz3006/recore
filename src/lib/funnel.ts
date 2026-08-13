import { getMeta, setMeta } from '@/lib/db/index';

/**
 * Local funnel instrumentation (CLAUDE.md §2.1, PLAN D4).
 *
 * IN THE META KV, NEVER A THIRD-PARTY SDK. Nothing here leaves the device on
 * its own: it is the user's own row count, sitting in the same local database
 * as their training, wiped with everything else when a different account signs
 * in, and readable by the user through the JSON export like the rest of their
 * data. No identifiers, no note text, no network call. That is the whole design
 * constraint — §7.3 forbids sending `raw_text` anywhere, and §20 forbids an
 * analytics SDK, so the only honest instrument is a counter.
 *
 * Why bother before launch: pre-launch every conversion rate in §2.1 is a
 * hypothesis. These counters are cheap to add now and IMPOSSIBLE TO BACKFILL
 * later — the first hundred installs happen once. The most informative split in
 * the first six months is `imported`: it divides every trial-window number,
 * because a lifter who brings history sees the predictor proved right inside
 * seven days and a lifter starting empty rarely does (§11.1).
 */
const P = 'funnel_';

const KEYS = {
  firstOpenAt: `${P}first_open_at`,
  obStepMax: `${P}ob_step_max`,
  obSteps: `${P}ob_steps_total`,
  obCompletedAt: `${P}ob_completed_at`,
  paywallShown: `${P}paywall_shown`,
  planSelected: `${P}plan_selected`,
  accountAttachedAt: `${P}account_attached_at`,
  trialStartedAt: `${P}trial_started_at`,
  purchaseAttempts: `${P}purchase_attempts`,
  purchasePurchased: `${P}purchase_purchased`,
  purchaseCancelled: `${P}purchase_cancelled`,
  purchaseFailed: `${P}purchase_failed`,
  restoreAttempts: `${P}restore_attempts`,
  restoreRestored: `${P}restore_restored`,
  imported: `${P}imported`,
  importOffered: `${P}import_offered`,
  importStarted: `${P}import_started`,
  importCompleted: `${P}import_completed`,
  importRowBucket: `${P}import_row_bucket`,
  firstFinishedAt: `${P}first_workout_finished_at`,
  firstReflectionAt: `${P}first_reflection_at`,
  reflections: `${P}reflections`,
  firstEntryNoteAt: `${P}first_entry_note_at`,
  entryNotes: `${P}entry_notes`,
  splitDaysSaved: `${P}split_days_saved`,
  parsedItems: `${P}parsed_items`,
  corrections: `${P}corrections`,
  adherenceShown: `${P}adherence_shown`,
  adherenceFollowed: `${P}adherence_followed`,
  firstBriefViewedAt: `${P}first_brief_viewed_at`,
  briefModelShown: `${P}brief_model_shown`,
  briefComposedShown: `${P}brief_composed_shown`,
  recapEnabled: `${P}recap_enabled`,
  recapDisabled: `${P}recap_disabled`,
} as const;

// --- primitives --------------------------------------------------------------

function readInt(key: string): number {
  const n = Number.parseInt(getMeta(key) ?? '', 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function bump(key: string, by = 1) {
  setMeta(key, String(readInt(key) + by));
}

function readIso(key: string): string | null {
  const v = getMeta(key);
  return v && !Number.isNaN(Date.parse(v)) ? v : null;
}

/** Write an instant once and never move it — a "first" that drifts is not one. */
function stampOnce(key: string) {
  if (readIso(key) == null) setMeta(key, new Date().toISOString());
}

// --- the events ---------------------------------------------------------------

/** The install's own clock. Everything time-windowed is measured from here. */
export function markFirstOpen() {
  stampOnce(KEYS.firstOpenAt);
}

export function getFirstOpenAt(): string | null {
  return readIso(KEYS.firstOpenAt);
}

/**
 * The furthest onboarding step this install ever reached — the number block E
 * is built to read (PLAN E7: a step that loses more than ~10% of the people who
 * reach it is cut, not redesigned). Monotonic, so replaying onboarding from You
 * cannot rewrite history downward.
 */
export function markObStepReached(step: number) {
  if (!Number.isInteger(step) || step < 0) return;
  if (step > readInt(KEYS.obStepMax)) setMeta(KEYS.obStepMax, String(step));
}

/**
 * How many screens the flow had when this install ran it. Recorded alongside
 * the high-water mark because block E is built expecting to DELETE screens
 * (E7): a bare "reached step 9" means nothing next quarter if nobody wrote down
 * that the flow was fourteen long at the time.
 */
export function setObStepCount(total: number) {
  if (Number.isInteger(total) && total > 0) setMeta(KEYS.obSteps, String(total));
}

export function markOnboardingCompleted() {
  stampOnce(KEYS.obCompletedAt);
}

export function markPaywallShown() {
  bump(KEYS.paywallShown);
}

/**
 * Which plan the person chose, last write wins (§13: "plan selected"). It is
 * the denominator of the annual-vs-monthly mix and the only way to tell whether
 * the honest preselection in §6 is doing anything.
 */
export function markPlanSelected(plan: 'annual' | 'monthly') {
  setMeta(KEYS.planSelected, plan);
}

/**
 * The account exists and the store now knows about it (§13: "account created").
 * Stamped where the attachment actually succeeds rather than at sign-in, so the
 * number means "ready to buy" instead of "signed in".
 */
export function markAccountAttached() {
  stampOnce(KEYS.accountAttachedAt);
}

export function markTrialStarted() {
  stampOnce(KEYS.trialStartedAt);
}

/**
 * The outcome of a purchase attempt (§13: "purchase state"). Counted by
 * category, never with a price, a receipt or an identifier — a funnel counter
 * is not a payment record.
 */
export function markPurchaseOutcome(status: 'purchased' | 'cancelled' | 'unavailable' | 'failed') {
  bump(KEYS.purchaseAttempts);
  if (status === 'purchased') bump(KEYS.purchasePurchased);
  else if (status === 'cancelled') bump(KEYS.purchaseCancelled);
  else bump(KEYS.purchaseFailed);
}

/** The outcome of a Restore (§13: "restore state"). */
export function markRestoreOutcome(status: 'restored' | 'nothing' | 'failed') {
  bump(KEYS.restoreAttempts);
  if (status === 'restored') bump(KEYS.restoreRestored);
}

/** The split that matters (§13). Set once, on the first successful import. */
export function markImported() {
  if (getMeta(KEYS.imported) !== '1') setMeta(KEYS.imported, '1');
}

export function hasImported(): boolean {
  return getMeta(KEYS.imported) === '1';
}

/**
 * The import funnel (§13: "import offered, started, completed, and row count
 * bucket (no lift names)").
 *
 * Three separate counters because the three failures are different problems:
 * offered-but-never-started is a screen that did not convince, started-but-
 * never-completed is a file picker or a format that failed, and neither is
 * visible from the single `imported` flag that existed before.
 */
export function markImportOfferShown() {
  bump(KEYS.importOffered);
}

export function markImportStarted() {
  bump(KEYS.importStarted);
}

/** `bucket` comes from `rowCountBucket` — a range, never an exact count. */
export function markImportCompleted(bucket: string) {
  bump(KEYS.importCompleted);
  setMeta(KEYS.importRowBucket, bucket);
}

/** §13: "first workout finished". Stamped once, on the first real Finish. */
export function markFirstWorkoutFinished() {
  stampOnce(KEYS.firstFinishedAt);
}

/**
 * §13: "first reflection added", plus a running count.
 *
 * The COUNT is what makes the first stamp worth anything: "did anyone ever
 * write one" and "does anyone keep writing them" are different questions, and
 * step 4's brief is only worth building if the answer to the second is yes.
 *
 * No text, no length, no language — a counter, like everything else here.
 */
export function markReflectionAdded() {
  stampOnce(KEYS.firstReflectionAt);
  bump(KEYS.reflections);
}

/**
 * The same pair for a PER-ENTRY note (owner, 4 Aug), counted separately from a
 * session reflection on purpose: they are different acts. "Wrote once about a
 * whole session" and "keeps remarking on individual lifts" answer different
 * questions about whether the brief's quoting is worth its surface.
 *
 * Not a §13 event yet — §13 lists "first reflection added" and this is its
 * sibling. It is a local counter like every other one here; naming it in the
 * product direction is the owner's call (CLAUDE.md §2 rule 8).
 *
 * No text, no length, no lift name — a counter, like everything else here.
 */
export function markEntryNoteAdded() {
  stampOnce(KEYS.firstEntryNoteAt);
  bump(KEYS.entryNotes);
}

/**
 * A session turned into a split day from the summary sheet (owner, 13 Aug).
 *
 * The one number that says whether the capture path is worth its surface: a
 * split authored from a real session is the difference between a rotation the
 * app can progress and a blank editor nobody opened. A count, nothing else —
 * no label, no movement names, no session id.
 *
 * Not a §13 event yet; naming it in the product direction is the owner's call
 * (CLAUDE.md §2 rule 8), same as `markEntryNoteAdded` above.
 */
export function markSplitDaySaved() {
  bump(KEYS.splitDaysSaved);
}

/**
 * The repair rate's two halves: how many structured items the parser produced,
 * and how many the user had to correct. The ratio is the parser's real quality
 * score — the eval measures the prompt, this measures the product.
 */
export function bumpParsedItems(n: number) {
  if (Number.isInteger(n) && n > 0) bump(KEYS.parsedItems, n);
}

export function bumpCorrections() {
  bump(KEYS.corrections);
}

/**
 * §13: "first Next brief viewed" plus "model brief shown, fallback shown".
 * The two counters are the numerator and denominator of §9.3's fallback rate —
 * a paragraph shown in the model's phrasing vs the composed one. A view that
 * upgrades mid-look counts once in each column, because both states were truly
 * on screen. Categories and counts only, never the paragraph.
 */
export function markBriefShown(kind: 'model' | 'composed') {
  stampOnce(KEYS.firstBriefViewedAt);
  bump(kind === 'model' ? KEYS.briefModelShown : KEYS.briefComposedShown);
}

/** §13: "weekly recap enabled … and disabled" — each explicit switch counts.
 * Delivered/opened need notification-response listeners and stay unbuilt. */
export function markRecapToggled(on: boolean) {
  bump(on ? KEYS.recapEnabled : KEYS.recapDisabled);
}

/** Adherence: how often the app showed a prescription vs how often it was met. */
export function bumpAdherenceShown() {
  bump(KEYS.adherenceShown);
}

export function bumpAdherenceFollowed() {
  bump(KEYS.adherenceFollowed);
}

// --- the read-out --------------------------------------------------------------

export interface FunnelSnapshot {
  first_open_at: string | null;
  onboarding_step_max: number;
  onboarding_steps_total: number;
  onboarding_completed_at: string | null;
  /** Step 11's answer — the only attribution signal ASO-first distribution has. */
  source: string | null;
  paywall_shown: number;
  plan_selected: string | null;
  account_attached_at: string | null;
  trial_started_at: string | null;
  purchase_attempts: number;
  purchases_completed: number;
  purchases_cancelled: number;
  purchases_failed: number;
  restore_attempts: number;
  restores_succeeded: number;
  imported: boolean;
  import_offered: number;
  import_started: number;
  import_completed: number;
  /** A range, never an exact row count (§13). */
  import_row_bucket: string | null;
  first_workout_finished_at: string | null;
  first_reflection_at: string | null;
  reflections_added: number;
  first_entry_note_at: string | null;
  entry_notes_added: number;
  /** Sessions turned into a split day from the summary sheet. */
  split_days_saved: number;
  parsed_items: number;
  corrections: number;
  /** corrections / parsed items, or null before there is anything to divide. */
  repair_rate: number | null;
  adherence_shown: number;
  adherence_followed: number;
  first_brief_viewed_at: string | null;
  brief_model_shown: number;
  brief_composed_shown: number;
  recap_enabled: number;
  recap_disabled: number;
}

/** Everything at once — carried in the JSON export, so the record is the user's. */
export function getFunnelSnapshot(): FunnelSnapshot {
  const parsed = readInt(KEYS.parsedItems);
  const corrections = readInt(KEYS.corrections);
  return {
    first_open_at: readIso(KEYS.firstOpenAt),
    onboarding_step_max: readInt(KEYS.obStepMax),
    onboarding_steps_total: readInt(KEYS.obSteps),
    onboarding_completed_at: readIso(KEYS.obCompletedAt),
    source: getMeta('pref_ob_source'),
    paywall_shown: readInt(KEYS.paywallShown),
    plan_selected: getMeta(KEYS.planSelected),
    account_attached_at: readIso(KEYS.accountAttachedAt),
    trial_started_at: readIso(KEYS.trialStartedAt),
    purchase_attempts: readInt(KEYS.purchaseAttempts),
    purchases_completed: readInt(KEYS.purchasePurchased),
    purchases_cancelled: readInt(KEYS.purchaseCancelled),
    purchases_failed: readInt(KEYS.purchaseFailed),
    restore_attempts: readInt(KEYS.restoreAttempts),
    restores_succeeded: readInt(KEYS.restoreRestored),
    imported: hasImported(),
    import_offered: readInt(KEYS.importOffered),
    import_started: readInt(KEYS.importStarted),
    import_completed: readInt(KEYS.importCompleted),
    import_row_bucket: getMeta(KEYS.importRowBucket),
    first_workout_finished_at: readIso(KEYS.firstFinishedAt),
    first_reflection_at: readIso(KEYS.firstReflectionAt),
    reflections_added: readInt(KEYS.reflections),
    first_entry_note_at: readIso(KEYS.firstEntryNoteAt),
    entry_notes_added: readInt(KEYS.entryNotes),
    split_days_saved: readInt(KEYS.splitDaysSaved),
    parsed_items: parsed,
    corrections,
    repair_rate: parsed > 0 ? Math.round((corrections / parsed) * 1000) / 1000 : null,
    adherence_shown: readInt(KEYS.adherenceShown),
    adherence_followed: readInt(KEYS.adherenceFollowed),
    first_brief_viewed_at: readIso(KEYS.firstBriefViewedAt),
    brief_model_shown: readInt(KEYS.briefModelShown),
    brief_composed_shown: readInt(KEYS.briefComposedShown),
    recap_enabled: readInt(KEYS.recapEnabled),
    recap_disabled: readInt(KEYS.recapDisabled),
  };
}
