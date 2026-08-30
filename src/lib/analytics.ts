import { getMeta, setMeta } from '@/lib/db/index';
import { devLog } from '@/lib/log';

/**
 * THE EVENT LAYER — call sites and a schema, from day one, with nothing
 * attached to the other end yet.
 *
 * Pre-launch every conversion number in the product direction is a hypothesis,
 * and the first hundred installs happen once: an event that was never emitted
 * cannot be backfilled next quarter. So the events exist now, named, typed and
 * queued locally, and the decision about a provider stays open.
 *
 * ## It is local, like everything else that measures Recore
 *
 * `lib/funnel.ts` counts the funnel in the meta KV because §13 says "measure
 * locally and privacy-consciously, without a third-party tracking SDK". This
 * file does not overrule that: it BUFFERS, and `flush()` is deliberately a
 * no-op. Nothing here opens a socket, and no SDK is installed.
 *
 * Wiring a provider is an owner decision and a privacy-policy change, not a
 * follow-up commit (CLAUDE.md §2 rule 8, §12): the moment these events leave
 * the device, what leaves has to be stated in the policy and covered by export
 * and deletion. Until then this is a local record of a person's own progress
 * through the funnel, dropped with their account like every other meta row.
 *
 * ## What may go in an event
 *
 * Option ids, counts, booleans, durations. **Never** `raw_text`, a reflection,
 * a first name, an exercise name, or anything else a person wrote (§7.3, §12) —
 * an event queued today is an event that may be sent tomorrow, so the rule has
 * to hold at the call site rather than at the flush. Every value is capped and
 * the queue itself is bounded.
 */

export type AnalyticsValue = string | number | boolean | null;
export type AnalyticsProps = Record<string, AnalyticsValue>;

/**
 * THE EVENT NAMES. A union rather than a free string: an event nobody can spell
 * consistently is an event nobody can count, and a typo in a funnel name is
 * invisible until the quarter it matters.
 */
export type AnalyticsEvent =
  /** One per onboarding screen, emitted by the step layout itself. */
  | 'onboarding_screen_view'
  /** The forward step off a screen — the numerator of its own drop-off. */
  | 'onboarding_screen_complete'
  /** A demo line was read: `source`, `parsed_locally`, `attempts`. */
  | 'onboarding_demo_parsed'
  /** Nothing could be read, so the canned example ran: `reason`. */
  | 'onboarding_demo_failed'
  /** An answer landed: `step_id`, `value` (an option id, never free text). */
  | 'onboarding_answer'
  | 'onboarding_commit_held'
  | 'onboarding_notifications_choice'
  | 'onboarding_attribution'
  /** Screen 1's "I already have an account" was tapped — the funnel's one exit
   * for somebody who is not new here (28 Aug 2026). */
  | 'onboarding_sign_in_tap'
  | 'paywall_view'
  | 'paywall_cta_tap';

export interface QueuedEvent {
  event: AnalyticsEvent;
  props: AnalyticsProps;
  /** ISO instant, local clock — the only ordering the queue has. */
  at: string;
}

const QUEUE_KEY = 'analytics_queue';
const PROPS_KEY = 'analytics_user_props';

/**
 * How many events the queue keeps. A person can reach it by replaying
 * onboarding, and an unbounded JSON blob in a KV row is a slow leak; past the
 * cap the OLDEST go, because the newest are the ones a flush would still be
 * able to explain.
 */
const MAX_QUEUED = 500;
/** Longest string any single property may carry. */
const MAX_VALUE_CHARS = 120;

/** In memory for the session; the KV row is the copy that survives a kill. */
let queue: QueuedEvent[] | null = null;

function load(): QueuedEvent[] {
  if (queue) return queue;
  try {
    const raw = getMeta(QUEUE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    queue = Array.isArray(parsed) ? (parsed as QueuedEvent[]) : [];
  } catch {
    queue = [];
  }
  return queue;
}

function persist(events: QueuedEvent[]) {
  try {
    setMeta(QUEUE_KEY, JSON.stringify(events));
  } catch {
    // A dropped event is never worth a broken screen.
  }
}

function clean(props: AnalyticsProps | undefined): AnalyticsProps {
  const out: AnalyticsProps = {};
  if (!props) return out;
  for (const [key, value] of Object.entries(props)) {
    if (typeof value === 'string') out[key] = value.slice(0, MAX_VALUE_CHARS);
    else if (typeof value === 'number') out[key] = Number.isFinite(value) ? value : null;
    else if (typeof value === 'boolean' || value === null) out[key] = value;
  }
  return out;
}

/**
 * Record one event. Synchronous, cheap, and it never throws: `expo-sqlite` is
 * the same synchronous KV a keystroke already writes through, so a screen never
 * waits on this and a failure here can never reach the person (§2 invariant 1).
 *
 * WRITTEN THROUGH ON EVERY CALL, on purpose. The interesting events are the
 * ones just before someone closes the app, and a batched write is exactly the
 * write that loses them.
 */
export function track(event: AnalyticsEvent, props?: AnalyticsProps): void {
  try {
    const events = load();
    events.push({ event, props: clean(props), at: new Date().toISOString() });
    if (events.length > MAX_QUEUED) events.splice(0, events.length - MAX_QUEUED);
    persist(events);
    if (__DEV__) devLog('analytics', event, props ?? {});
  } catch {
    // ignored — see above
  }
}

/**
 * A property that describes the PERSON rather than a moment: the attribution
 * answer, today. Last write wins, and the same rule about content applies —
 * option ids only.
 */
export function setUserProperty(key: string, value: AnalyticsValue): void {
  try {
    const raw = getMeta(PROPS_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    const props = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as AnalyticsProps) : {};
    setMeta(PROPS_KEY, JSON.stringify({ ...props, ...clean({ [key]: value }) }));
  } catch {
    // ignored
  }
}

/** Everything recorded so far — for the owner's own reading, and for whatever
 * ends up consuming it. */
export function queuedEvents(): readonly QueuedEvent[] {
  return load();
}

export function userProperties(): AnalyticsProps {
  try {
    const raw = getMeta(PROPS_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as AnalyticsProps) : {};
  } catch {
    return {};
  }
}

/**
 * Send the queue.
 *
 * TODO: wire provider (PostHog/Amplitude) — and not before the owner has said
 * yes and §12's privacy section says what leaves the device. Until then this
 * does nothing at all, deliberately: a stub that quietly posted somewhere would
 * be the one thing in this file that cannot be taken back.
 */
export function flush(): void {
  // no-op
}

/** Development helper — empties the queue, like `useOnboardingAnswers.reset`. */
export function resetAnalytics(): void {
  queue = [];
  persist(queue);
  setMeta(PROPS_KEY, null);
}
