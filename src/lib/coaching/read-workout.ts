import { buildReceipt, type ReceiptRow } from '@/lib/parse/receipt';
import { type ParsedItem, type ParsedSet, type ParseResult, type SetKind, type Modality } from '@/lib/parse/types';
import { parseEntryNotes, readEntryNote } from '@/lib/entry-note';
import { supabase } from '@/lib/supabase';

/**
 * ONE CLIENT SESSION, ASSEMBLED FOR READING — the coach's side of a workout.
 *
 * ## Why this rebuilds a `ParseResult` instead of fetching one
 *
 * `buildReceipt` is the app's one renderer-facing view of a session, it is pure
 * and it is already tested, so the coach's screen should use it rather than
 * grow a second interpretation of the same rows. What it wants is a
 * `ParseResult` — and there isn't one to fetch. The remote schema stores the
 * structure NORMALISED across `items` and `sets`; the whole `ParseResult` exists
 * only in `parse_cache`, which is a LOCAL table on the device that did the
 * parsing. So the shape is reassembled here from the two tables, which is a
 * lossless direction: `applyParseResult` flattened a `ParseResult` into those
 * rows in the first place.
 *
 * The one field that needs care is `ParsedSet.parent`: locally it is an INDEX
 * into the item's own sets, remotely it is `sets.parent_set_id`, a row id. The
 * mapping is rebuilt below, in the same order the rows are read.
 *
 * ## What the coach is NOT given
 *
 * `buildReceipt` takes a `signals` array — the gutter's comparison against the
 * athlete's own history ("↑ 2.5 kg", "PR"). It gets an EMPTY one here, and that
 * is deliberate on two counts. It would need the client's full history pulled
 * onto the coach's device, which `lib/coaching/index.ts` explains at length is
 * not something this feature does; and the spec is explicit that the coach view
 * shows the logged session, not the app's own recommendations. A coach reading
 * a client's numbers should be forming their own judgement, not agreeing with
 * a prescription engine the client is already being shown.
 */
export interface CoachWorkout {
  id: string;
  performedAt: string;
  /** What the client actually typed. Per the spec this is the most valuable
   * thing on the screen, so it is carried verbatim and never rewritten. */
  rawText: string;
  /** The client's end-of-session note, if they wrote one. */
  reflection: string | null;
  rows: ReceiptRow[];
  /** Counted sets and kilograms, straight off `buildReceipt` — the app's own
   *  tested arithmetic, warm-ups and drops already excluded, so the coach's
   *  header cannot disagree with the athlete's own profile about one session. */
  sets: number;
  volumeKg: number;
  /** `entryNoteKey` → the client's own words about that lift. */
  entryNotes: Record<string, string>;
}

/**
 * What a line is called when its catalogue row cannot be read. Named once,
 * because two places depend on the exact string: the row that prints it, and
 * the count below that must not treat two unreadable lines as one movement.
 */
export const UNRESOLVED_EXERCISE = 'Unread line';

interface RemoteItem {
  id: string;
  position: number;
  group_key: string | null;
  exercise_id: string | null;
}

export async function loadCoachWorkout(workoutId: string): Promise<CoachWorkout | null> {
  const { data: w, error } = await supabase
    .from('workouts')
    .select('id, performed_at, raw_text, reflection, entry_notes, parse_version')
    .eq('id', workoutId)
    .single();
  if (error || !w) return null;

  const { data: items } = await supabase
    .from('items')
    .select('id, position, group_key, exercise_id')
    .eq('workout_id', workoutId)
    .order('position', { ascending: true });

  const rows = (items ?? []) as RemoteItem[];
  const itemIds = rows.map((i) => i.id);

  const { data: sets } = itemIds.length
    ? await supabase
        .from('sets')
        .select('id, item_id, position, kind, parent_set_id, reps, weight_kg, distance_m, duration_s, rir, note')
        .in('item_id', itemIds)
        .order('position', { ascending: true })
    : { data: [] as Record<string, unknown>[] };

  // The catalogue names, so a row can say "Bench Press" rather than a uuid.
  const exerciseIds = rows.map((i) => i.exercise_id).filter((v): v is string => !!v);
  const nameById = new Map<string, { canonical: string; modality: string }>();
  if (exerciseIds.length) {
    const { data: exercises } = await supabase
      .from('exercises')
      .select('id, canonical, modality')
      .in('id', exerciseIds);
    for (const e of exercises ?? []) {
      nameById.set(String(e.id), {
        canonical: String(e.canonical),
        modality: String(e.modality ?? 'strength'),
      });
    }
  }

  const setsByItem = new Map<string, Record<string, unknown>[]>();
  for (const s of (sets ?? []) as Record<string, unknown>[]) {
    const key = String(s.item_id);
    const list = setsByItem.get(key) ?? [];
    list.push(s);
    setsByItem.set(key, list);
  }

  const parsedItems: ParsedItem[] = rows.map((item, index) => {
    const own = setsByItem.get(item.id) ?? [];
    // `parent_set_id` → index within THIS item, which is what ParsedSet holds.
    const indexById = new Map<string, number>();
    own.forEach((s, i) => indexById.set(String(s.id), i));

    const parsedSets: ParsedSet[] = own.map((s) => ({
      kind: String(s.kind ?? 'working') as SetKind,
      reps: s.reps == null ? null : Number(s.reps),
      weight_kg: s.weight_kg == null ? null : Number(s.weight_kg),
      distance_m: s.distance_m == null ? null : Number(s.distance_m),
      duration_s: s.duration_s == null ? null : Number(s.duration_s),
      rir: s.rir == null ? null : Number(s.rir),
      parent: s.parent_set_id == null ? null : (indexById.get(String(s.parent_set_id)) ?? null),
      note: s.note == null ? null : String(s.note),
    }));

    const meta = item.exercise_id ? nameById.get(item.exercise_id) : undefined;
    return {
      exercise: meta?.canonical ?? UNRESOLVED_EXERCISE,
      aliases_seen: [],
      modality: (meta?.modality ?? 'strength') as Modality,
      group_key: item.group_key,
      // The remote schema does not carry the physical line back, and nothing on
      // this read-only screen addresses a line — position is a faithful stand-in
      // for ordering, which is the only thing the receipt uses it for here.
      line: index,
      sets: parsedSets,
    };
  });

  const result: ParseResult = {
    items: parsedItems,
    parse_version: Number(w.parse_version ?? 0),
  };

  const receipt = buildReceipt(result, []);
  return {
    id: String(w.id),
    performedAt: String(w.performed_at),
    rawText: String(w.raw_text ?? ''),
    reflection: w.reflection ? String(w.reflection) : null,
    rows: receipt.rows,
    sets: receipt.totalSets,
    volumeKg: Math.round(receipt.volume),
    entryNotes: parseEntryNotes(w.entry_notes as string | null),
  };
}

/** The client's own remark on one lift of this session, or null. */
export function noteFor(workout: CoachWorkout, exercise: string): string | null {
  return readEntryNote(workout.entryNotes, exercise);
}

/**
 * A WHOLE TRAINING DAY, assembled from however many rows it ended up as.
 *
 * One row is the normal case and the only one after `day-id.ts` and the merge
 * have done their work. This exists for the record that already split: the
 * feed groups those rows into one day, so the screen it opens has to show the
 * day rather than whichever row happened to be first — otherwise a coach taps
 * "3 lifts · 9 sets" and lands on a screen with one lift on it.
 *
 * The ids arrive from the feed, oldest first, so nothing here has to re-derive
 * which row is the survivor. Merging follows the same rules as the SQL repair
 * (`20260910191000_merge_duplicate_days.sql`, amended by
 * `20260911090000_merge_days_structure.sql`): text appended verbatim unless it
 * is already there, the first non-empty reflection, notes filled in where they
 * are missing.
 *
 * TEXT AND STRUCTURE TRAVEL TOGETHER, and that is the rule this screen taught
 * the repair rather than the other way round. A row whose words are skipped as
 * already-present is the split, not a second effort — so its entries and its
 * numbers are skipped with them. Keeping them drew the owner's screenshot of
 * 11 September 2026: two written lines of "benchpress 120kgx12x3", three
 * bench-press entries under them, and a header reading 9 sets and 12,960 kg.
 * The one exception is a primary that was never parsed: then the duplicate's
 * reading is the only reading those words have.
 */
export async function loadCoachDay(workoutIds: string[]): Promise<CoachWorkout | null> {
  const [first, ...rest] = workoutIds;
  if (!first) return null;

  const primary = await loadCoachWorkout(first);
  if (!primary || rest.length === 0) return primary;

  const others = (await Promise.all(rest.map((id) => loadCoachWorkout(id)))).filter(
    (w): w is CoachWorkout => w != null,
  );

  for (const other of others) {
    const text = other.rawText.trim();
    const wordsDropped = text.length > 0 && primary.rawText.includes(text);

    if (!wordsDropped || primary.rows.length === 0) {
      primary.rows.push(...other.rows);
      primary.sets += other.sets;
      primary.volumeKg += other.volumeKg;
    }
    if (text && !wordsDropped) {
      primary.rawText = primary.rawText.trim() ? `${primary.rawText.trim()}\n${text}` : text;
    }
    if (!primary.reflection?.trim()) primary.reflection = other.reflection;
    primary.entryNotes = { ...other.entryNotes, ...primary.entryNotes };
  }
  return primary;
}

/**
 * What the session WAS — the three numbers a coach reads before the table.
 *
 * Sets and volume come off `buildReceipt`, which is the app's own tested
 * arithmetic and the same one behind `getProfileTotals` and the feed row, so
 * one session cannot be reported three different sizes. Only the count of
 * distinct movements is computed here, because a receipt does not carry it.
 */
export function factsOf(workout: CoachWorkout): { lifts: number; sets: number; volumeKg: number } {
  // Distinct NAMES, so a movement written twice in a day counts once, the way
  // every other aggregate in this app counts it — except for lines whose
  // catalogue row could not be read, which are counted one each. They all
  // carry the same placeholder, and folding them together reported a two-lift
  // session as one lift. Seen on the simulator, 10 September 2026, before the
  // policy that lets a coach read the names at all.
  const named = new Set<string>();
  let unresolved = 0;
  for (const row of workout.rows) {
    const name = row.exercise.trim();
    if (!name || name === UNRESOLVED_EXERCISE) unresolved += 1;
    else named.add(name.toLowerCase());
  }
  return { lifts: named.size + unresolved, sets: workout.sets, volumeKg: workout.volumeKg };
}
