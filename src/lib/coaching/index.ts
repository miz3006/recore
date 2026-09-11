import { supabase } from '@/lib/supabase';

/**
 * THE COACHING DATA LAYER — every read and write of another person's record.
 *
 * ## It deliberately does not touch SQLite
 *
 * Everything else in this app reads the local database and lets `lib/sync`
 * reconcile it. Nothing here does, and that is a rule rather than an omission.
 * The local tables are scoped to ONE person: `workouts.user_id` is the account,
 * every query in `db/` filters on it, and Today, Progress and Next all assume
 * what is in there belongs to the person holding the phone. Writing a client's
 * sessions into those tables would make that assumption false everywhere at
 * once — their volume in the coach's charts, their lifts in the coach's
 * catalogue, their private words on the coach's disk after the link is cut.
 *
 * So a coach's view of a client is REMOTE-ONLY and lives for as long as the
 * screen does. It is slower and it needs a connection, which is correct: the
 * offline promise in CLAUDE.md §3 is about a person's own logging, and reading
 * someone else's training is not that.
 *
 * ## The hot path is untouched
 *
 * Nothing in this module is imported by Today, the composer, the parser or
 * `lib/sync`. Logging makes no new network call because of this feature.
 */

/**
 * Every rejection `redeem_coach_invite` can answer with, as the RPC names them.
 *
 * ANSWER, not raise — and the difference is a security fix rather than a style
 * (`20260910200000_redeem_rate_limit.sql`). Guessing a six-character code had
 * no cost, so the RPC now counts attempts; PostgREST runs a request in one
 * transaction, and an exception would roll the counter's own increment back
 * along with everything else. So the failures come back in the payload, every
 * write commits, and the limiter remembers what it refused.
 */
export type RedeemError =
  | 'invalid_or_expired'
  | 'self_invite'
  | 'already_has_coach'
  | 'too_many_attempts'
  | 'not_authenticated'
  | 'offline'
  | 'unknown';

/** Every rejection `create_coach_invite` can raise. */
export type InviteError =
  | 'too_many_invites'
  | 'not_a_coach'
  | 'not_authenticated'
  | 'offline'
  | 'unknown';

/** Every rejection `set_coach_role` can raise. */
export type RoleError = 'still_coaching' | 'not_authenticated' | 'offline' | 'unknown';

export interface CoachClient {
  linkId: string;
  clientId: string;
  displayName: string | null;
  lastWorkoutAt: string | null;
  unreadCount: number;
}

export interface MyCoach {
  linkId: string;
  coachId: string;
  displayName: string | null;
  unreadCount: number;
}

/**
 * ONE TRAINING DAY of a client's record, as the coach's feed shows it.
 *
 * A DAY, NOT A ROW — and that distinction is the owner's bug report of 10
 * September 2026: one bench-press session appeared in the feed three times.
 * The client's own app treats a day as one session (`saveRawText` keeps one
 * `workouts` row per local day) and their coach was being shown the plumbing.
 * `day-id.ts` stops new splits and `merge_duplicate_workout_days()` folds the
 * ones already there; this grouping is the third lock, so a client who has not
 * opened their app since the fix still reads as one session per day here.
 */
export interface FeedDay {
  /** The oldest row of the day — what comments anchor to, and the id the
   *  session screen is opened with. */
  id: string;
  /** Every row of that day, oldest first. One, after the repair has run. */
  workoutIds: string[];
  performedAt: string;
  /** What they wrote, all of it, in the order they wrote it. */
  rawText: string;
  /** Distinct movements, counted sets and kilograms moved — the SAME
   *  definition `getProfileTotals` uses for the athlete's own header
   *  (warm-ups, drops and skipped sets excluded), so the two never disagree. */
  lifts: number;
  sets: number;
  volumeKg: number;
  commentCount: number;
  unreadCount: number;
}

export interface Comment {
  id: string;
  workoutId: string;
  exerciseRef: string | null;
  authorId: string;
  body: string;
  createdAt: string;
  readAt: string | null;
}

/** The longest comment the column accepts — mirrored so the field can count
 * down instead of letting a check constraint reject a paragraph after send. */
export const MAX_COMMENT_CHARS = 2000;

/** How many sessions one page of a client's feed carries. */
export const FEED_PAGE_SIZE = 20;

/**
 * The error NAME out of a Postgres exception, or a guess at why there was no
 * answer at all. The RPCs raise with the code as the message (see the coaching
 * migration), so this is a direct read rather than a parse — but a network
 * failure produces no message at all, and telling someone their code was
 * invalid when the phone had no signal is the kind of small lie that makes a
 * person retype a code that was fine.
 */
function errorName(err: unknown): string {
  const msg =
    err && typeof err === 'object' && 'message' in err ? String((err as { message: unknown }).message) : '';
  if (!msg) return 'unknown';
  if (/network|fetch|timeout|connection/i.test(msg)) return 'offline';
  // PostgREST wraps the raise message; take the bare token if one is in there.
  const known = [
    'invalid_or_expired',
    'self_invite',
    'already_has_coach',
    'too_many_invites',
    'not_a_coach',
    'still_coaching',
    'not_authenticated',
    'link_not_found',
    'not_a_participant',
  ];
  return known.find((k) => msg.includes(k)) ?? 'unknown';
}

// --- linking ---------------------------------------------------------------

/**
 * IS THIS PERSON HERE TO COACH? — the answer the whole coach half of You hangs
 * on.
 *
 * Being a coach used to be nothing but the existence of a link, which meant a
 * CLIENT — someone who had just typed somebody else's code — was shown "Invite
 * a client" beside it. The owner put it plainly on 10 September 2026: you are a
 * client, you have no business being offered that. So it is a row a person owns
 * now (`coach_profiles`, migration 20260910190000), and this reads it.
 *
 * A network failure answers `false`, and that is the right way round: the worst
 * case is a coach who has to pull to refresh, rather than a client shown a
 * surface that is not theirs. The RPC behind the invite screen enforces the
 * same rule server-side, so a wrong answer here can never grant anything.
 */
export async function isCoach(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('coach_profiles')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle();
  return !error && data != null;
}

/**
 * Turn coaching on or off. Returns the state that is now true, so the caller
 * never has to assume its optimistic guess landed.
 *
 * Turning it OFF while people are still linked is refused by the RPC
 * (`still_coaching`) rather than quietly hiding them: the links would stay
 * live, so the coach could still read those sessions while the screen said
 * they coached nobody. Ending a relationship is `revokeLink`, on purpose.
 */
export async function setCoachRole(on: boolean): Promise<{ on: boolean } | { error: RoleError }> {
  const { data, error } = await supabase.rpc('set_coach_role', { p_on: on });
  if (error) return { error: errorName(error) as RoleError };
  return { on: Boolean(data) };
}

export async function createInvite(): Promise<{ code: string } | { error: InviteError }> {
  const { data, error } = await supabase.rpc('create_coach_invite');
  if (error) return { error: errorName(error) as InviteError };
  return { code: String(data) };
}

export async function redeemInvite(code: string): Promise<{ linkId: string } | { error: RedeemError }> {
  const { data, error } = await supabase.rpc('redeem_coach_invite', {
    p_code: code.trim().toUpperCase(),
  });
  // `error` is now only ever TRANSPORT — no connection, no session, the
  // function missing. Every refusal the feature itself decides on rides in the
  // payload; see the note on `RedeemError`.
  if (error) return { error: errorName(error) as RedeemError };

  const answer = (data ?? {}) as { link_id?: string | null; error?: string | null };
  if (answer.error) return { error: answer.error as RedeemError };
  if (!answer.link_id) return { error: 'unknown' };
  return { linkId: String(answer.link_id) };
}

/**
 * PUT A NAME ON THE LINK.
 *
 * `coach_client_overview` and `my_coach` both read `profiles.display_name`, and
 * the coaching migration calls that column "the ONLY thing the link exposes
 * about a person besides their training". Nothing ever WROTE it except the
 * Apple and Google sign-in paths, and only when the provider handed a name
 * over — so a pair who had linked perfectly still read each other as the words
 * "Coach" and "Client", which is indistinguishable from a link that never
 * happened. Measured against the hosted project on 10 September 2026: every
 * one of these RPCs answers with `display_name: null`.
 *
 * The name is the one the person typed in onboarding (`prefs.getName`), the
 * same one their own profile header shows them. It is published at the two
 * moments somebody deliberately opens a coaching relationship — issuing a code
 * and redeeming one — and nowhere else: it is chosen information (CLAUDE.md §2
 * rule 2), and the `profiles` policy hands it to a linked account only.
 *
 * Failure is silent on purpose. A name that did not land costs a label; a name
 * that blocked a join would cost the feature.
 */
export async function publishDisplayName(userId: string, name: string | null): Promise<void> {
  const trimmed = (name ?? '').trim().slice(0, 60);
  if (!trimmed) return;
  await supabase.from('profiles').update({ display_name: trimmed }).eq('id', userId);
}

export async function revokeLink(linkId: string): Promise<boolean> {
  const { error } = await supabase.rpc('revoke_coach_link', { p_link_id: linkId });
  return !error;
}

export async function listClients(): Promise<CoachClient[]> {
  const { data, error } = await supabase.rpc('coach_client_overview');
  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map((r) => ({
    linkId: String(r.link_id),
    clientId: String(r.client_id),
    displayName: r.display_name ? String(r.display_name) : null,
    lastWorkoutAt: r.last_workout_at ? String(r.last_workout_at) : null,
    unreadCount: Number(r.unread_count ?? 0),
  }));
}

export async function myCoach(): Promise<MyCoach | null> {
  const { data, error } = await supabase.rpc('my_coach');
  if (error || !data) return null;
  const rows = data as Record<string, unknown>[];
  const r = rows[0];
  if (!r) return null;
  return {
    linkId: String(r.link_id),
    coachId: String(r.coach_id),
    displayName: r.display_name ? String(r.display_name) : null,
    unreadCount: Number(r.unread_count ?? 0),
  };
}

// --- reading a client's record --------------------------------------------

/**
 * One page of a client's training days, newest first.
 *
 * Four round trips rather than two, and they buy the thing that was missing:
 * a row that says what the day WAS. The feed used to print two lines of raw
 * text and nothing else, so a coach scanning a month could not see which
 * session was heavy without opening every one of them. Counting sets and
 * kilograms here means the list answers that at a glance — and it answers it
 * with the client's own numbers, because the arithmetic is copied from
 * `getProfileTotals` rather than invented for this screen.
 *
 * Paging is still by ROW, so a day whose rows straddle a page boundary can
 * appear as two partial days until the repair has folded it. That is the
 * conservative direction: a day shown twice is a cosmetic error, a day shown
 * with somebody else's sets in it would not be.
 */
export async function clientFeed(clientId: string, page = 0): Promise<FeedDay[]> {
  const from = page * FEED_PAGE_SIZE;
  const { data, error } = await supabase
    .from('workouts')
    .select('id, performed_at, raw_text, created_at')
    .eq('user_id', clientId)
    .order('performed_at', { ascending: false })
    .order('created_at', { ascending: true })
    .range(from, from + FEED_PAGE_SIZE - 1);
  if (error || !data) return [];

  const ids = data.map((w) => String(w.id));
  if (ids.length === 0) return [];

  const [counts, structure] = await Promise.all([
    commentCounts(ids, clientId),
    sessionFacts(ids),
  ]);

  // Group by the exact `performed_at`, which is the same key the repair uses:
  // every row of one day carries that device's idea of local noon, to the
  // second. Two rows a timezone apart stay two days here, deliberately.
  //
  // `lifts` is a UNION rather than a sum, because it is a count of distinct
  // movements: a day split across two rows that both hold a bench press did
  // one bench press, and `factsOf` on the session screen counts it once. Two
  // screens reporting one day differently is the whole defect class this
  // grouping exists inside.
  const byDay = new Map<string, FeedDay & { liftIds: Set<string> }>();
  for (const w of data) {
    const key = String(w.performed_at);
    const id = String(w.id);
    const facts = structure.get(id) ?? { lifts: new Set<string>(), sets: 0, volumeKg: 0 };
    const count = counts.get(id) ?? { total: 0, unread: 0 };
    const text = String(w.raw_text ?? '').trim();

    const day = byDay.get(key);
    if (!day) {
      byDay.set(key, {
        id,
        workoutIds: [id],
        performedAt: key,
        rawText: text,
        liftIds: new Set(facts.lifts),
        lifts: facts.lifts.size,
        sets: facts.sets,
        volumeKg: facts.volumeKg,
        commentCount: count.total,
        unreadCount: count.unread,
      });
      continue;
    }
    day.workoutIds.push(id);
    // The same "already in there" rule the repair applies, for the same reason:
    // three identical rows are one session the sync split, not three sessions.
    // And the row's SETS go the same way as its words — counting a reading
    // whose text was dropped is how a session of six sets came to be headed
    // "9 sets · 12,960 kg" (`db/merge-days.ts`). The exception is a day
    // nothing has been counted for yet: then this row's reading is the only
    // one it has.
    const wordsDropped = text.length > 0 && day.rawText.includes(text);
    if (text && !wordsDropped) {
      day.rawText = day.rawText ? `${day.rawText}\n${text}` : text;
    }
    if (!wordsDropped || day.sets === 0) {
      for (const lift of facts.lifts) day.liftIds.add(lift);
      day.lifts = day.liftIds.size;
      day.sets += facts.sets;
      day.volumeKg += facts.volumeKg;
    }
    // A comment is never a duplicate of another comment: it is counted whatever
    // happened to the row it was written on.
    day.commentCount += count.total;
    day.unreadCount += count.unread;
  }

  return [...byDay.values()].map(({ liftIds: _liftIds, ...day }) => day);
}

/** How many comments each of these sessions carries, and how many of them the
 *  client wrote and the coach has not opened. */
async function commentCounts(
  workoutIds: string[],
  clientId: string,
): Promise<Map<string, { total: number; unread: number }>> {
  const out = new Map<string, { total: number; unread: number }>();
  const { data } = await supabase
    .from('workout_comments')
    .select('workout_id, author_id, read_at')
    .in('workout_id', workoutIds);
  for (const c of data ?? []) {
    const key = String(c.workout_id);
    const entry = out.get(key) ?? { total: 0, unread: 0 };
    entry.total += 1;
    if (String(c.author_id) === clientId && c.read_at == null) entry.unread += 1;
    out.set(key, entry);
  }
  return out;
}

/**
 * Movements, counted sets and kilograms per session.
 *
 * `kind not in (warmup, drop, skipped)` is copied verbatim from
 * `getProfileTotals`, and the duplication is on purpose — that file states the
 * rule that each aggregate must name the exclusion itself, so a new one cannot
 * inherit a stale version of it.
 */
async function sessionFacts(
  workoutIds: string[],
): Promise<Map<string, { lifts: Set<string>; sets: number; volumeKg: number }>> {
  const out = new Map<string, { lifts: Set<string>; sets: number; volumeKg: number }>();

  const { data: items } = await supabase
    .from('items')
    .select('id, workout_id, exercise_id')
    .in('workout_id', workoutIds);
  if (!items?.length) return out;

  const workoutOfItem = new Map<string, string>();
  for (const i of items) {
    const workoutId = String(i.workout_id);
    workoutOfItem.set(String(i.id), workoutId);
    const entry = out.get(workoutId) ?? { lifts: new Set<string>(), sets: 0, volumeKg: 0 };
    // Keyed by exercise, so a movement written twice in a day counts once —
    // the way every other aggregate in this app counts it.
    if (i.exercise_id) entry.lifts.add(String(i.exercise_id));
    out.set(workoutId, entry);
  }

  const { data: sets } = await supabase
    .from('sets')
    .select('item_id, kind, reps, weight_kg')
    .in('item_id', [...workoutOfItem.keys()]);
  for (const s of sets ?? []) {
    const kind = String(s.kind ?? 'working');
    if (kind === 'warmup' || kind === 'drop' || kind === 'skipped') continue;
    const workoutId = workoutOfItem.get(String(s.item_id));
    if (!workoutId) continue;
    const entry = out.get(workoutId);
    if (!entry) continue;
    entry.sets += 1;
    if (s.reps != null && s.weight_kg != null) {
      entry.volumeKg += Number(s.reps) * Number(s.weight_kg);
    }
  }

  for (const entry of out.values()) entry.volumeKg = Math.round(entry.volumeKg);
  return out;
}

// --- comments --------------------------------------------------------------

export async function listComments(workoutId: string): Promise<Comment[]> {
  const { data, error } = await supabase
    .from('workout_comments')
    .select('id, workout_id, exercise_ref, author_id, body, created_at, read_at')
    .eq('workout_id', workoutId)
    .order('created_at', { ascending: true });
  if (error || !data) return [];
  return data.map((c) => ({
    id: String(c.id),
    workoutId: String(c.workout_id),
    exerciseRef: c.exercise_ref ? String(c.exercise_ref) : null,
    authorId: String(c.author_id),
    body: String(c.body),
    createdAt: String(c.created_at),
    readAt: c.read_at ? String(c.read_at) : null,
  }));
}

/**
 * Send one comment. The caller has already put it on screen optimistically, so
 * this answers with the stored row (to swap in) or null (to roll back and give
 * the words back to the field — never to a toast that loses them).
 */
export async function postComment(
  workoutId: string,
  exerciseRef: string | null,
  body: string,
  authorId: string,
): Promise<Comment | null> {
  const { data, error } = await supabase
    .from('workout_comments')
    .insert({ workout_id: workoutId, exercise_ref: exerciseRef, author_id: authorId, body })
    .select('id, workout_id, exercise_ref, author_id, body, created_at, read_at')
    .single();
  if (error || !data) return null;
  return {
    id: String(data.id),
    workoutId: String(data.workout_id),
    exerciseRef: data.exercise_ref ? String(data.exercise_ref) : null,
    authorId: String(data.author_id),
    body: String(data.body),
    createdAt: String(data.created_at),
    readAt: null,
  };
}

export async function markRead(workoutId: string): Promise<void> {
  await supabase.rpc('mark_comments_read', { p_workout_id: workoutId });
}
