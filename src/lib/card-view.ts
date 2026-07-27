import { formatDuration, formatNumber, formatSets } from './format.ts';
import { type Modality, type ParsedSet, type SetKind } from './parse/types.ts';

/**
 * What zone 2 of an exercise card says (CLAUDE.md §8.3) — pure, so the rules
 * about how a session reads can be tested without a renderer.
 *
 * §8.3 gives four rules and they fight each other more than they look:
 *
 *   · Sets collapse to a sequence — `8 · 8 · 7`.
 *   · Identical sets collapse further — `3 × 8`.
 *   · A dropset renders as `80 → 60 → 40` with arrows.
 *   · Cardio renders distance and time instead of load.
 *
 * The tension is between the first two and the record contract. Collapsing is a
 * *display* decision, and it has already gone wrong once here: `120×10 100×15
 * 90×8` was rendered as `120 kg × 10·10·10`, which is not a tidier reading of
 * the session — it is a different session. So collapsing is allowed to hide
 * repetition and is never allowed to hide variation. Where the weight changes
 * per set, every set keeps its own weight.
 */

/** A set as the card needs it — the parse shape and the SQLite shape both fit. */
export interface CardSet {
  kind: SetKind | string;
  reps: number | null;
  weight_kg: number | null;
  distance_m: number | null;
  duration_s: number | null;
  rir?: number | null;
  /** Index of the parent set within the same item — a dropset/myo chain. */
  parent?: number | null;
}

export type SetsView =
  /** One load, one rep sequence: `82.5 kg` · `8 · 8 · 7`. */
  | { kind: 'loaded'; weight: number; reps: string }
  /** The weight moved between sets, so every set keeps its own: `120×10 · 100×15`. */
  | { kind: 'perSet'; pairs: string }
  /** Nothing on the bar: `3 × 10`. */
  | { kind: 'bodyweight'; reps: string }
  /** `5.0 km · 26:04 · 5:13 /km`. */
  | { kind: 'cardio'; parts: string[] }
  /** Carries and holds: `3 × 40 m`, `3 × 60 s`. */
  | { kind: 'effort'; text: string };

export interface CardView {
  /** The working sets, as zone 2 should read them. Null when nothing counts. */
  value: SetsView | null;
  /** Dropset chains under the working sets: `80 → 60 → 40`. One per chain. */
  drops: string[];
  /** Warm-ups, quiet and excluded from every total: `60 × 5`. */
  warmups: string | null;
}

/** Kinds that never count toward the day's work (§18.2). */
const isWarmup = (s: CardSet) => s.kind === 'warmup';
const isDrop = (s: CardSet) => s.kind === 'drop' || s.parent != null;

/** `5:13 /km`, or null when a pace would be arithmetic rather than information. */
export function pacePerKm(distanceM: number, durationS: number): string | null {
  if (!(distanceM > 0) || !(durationS > 0)) return null;
  return `${formatDuration(Math.round(durationS / (distanceM / 1000)))} /km`;
}

/** `5.0 km` above a kilometre, `400 m` below it. */
export function distanceText(meters: number): string {
  if (meters >= 1000) return `${(Math.round(meters / 100) / 10).toFixed(1)} km`;
  return `${Math.round(meters)} m`;
}

function repsOf(sets: CardSet[]): number[] {
  return sets.map((s) => s.reps).filter((r): r is number => r != null);
}

/** The whole of zone 2, plus the two quiet rows that hang under it. */
export function describeSets(sets: readonly CardSet[], modality: Modality = 'strength'): CardView {
  const all = [...sets];
  const warmupSets = all.filter(isWarmup);
  const working = all.filter((s) => !isWarmup(s) && !isDrop(s));
  const dropSets = all.filter((s) => !isWarmup(s) && isDrop(s));

  return {
    value: describeWorking(working, modality),
    drops: describeDrops(all, dropSets),
    warmups: warmupSets.length ? describeWarmups(warmupSets) : null,
  };
}

function describeWorking(working: CardSet[], modality: Modality): SetsView | null {
  if (working.length === 0) return null;

  const distance = working.reduce((sum, s) => sum + (s.distance_m ?? 0), 0);
  const duration = working.reduce((sum, s) => sum + (s.duration_s ?? 0), 0);

  // Cardio reads as distance and time; a load, if there is one, is not the point.
  if (modality === 'cardio' && (distance > 0 || duration > 0)) {
    const parts: string[] = [];
    if (distance > 0) parts.push(distanceText(distance));
    if (duration > 0) parts.push(formatDuration(duration));
    const pace = pacePerKm(distance, duration);
    if (pace) parts.push(pace);
    return { kind: 'cardio', parts };
  }

  // Carries and holds: the count and the effort, never a rep sequence.
  if (modality === 'carry' || modality === 'hold') {
    const unit = distance > 0 ? distanceText(distance / working.length) : `${duration / working.length} s`;
    return {
      kind: 'effort',
      text: working.length > 1 ? `${working.length} × ${unit}` : unit,
    };
  }

  const reps = repsOf(working);
  if (reps.length === 0) {
    // Strength sets with no reps at all — a timed hold written as a lift.
    if (duration > 0) return { kind: 'effort', text: formatDuration(duration) };
    return null;
  }

  const weights = working.map((s) => s.weight_kg);
  if (weights.every((w) => w == null)) return { kind: 'bodyweight', reps: formatSets(reps) };

  const first = weights[0];
  if (weights.every((w) => w === first) && first != null) {
    return { kind: 'loaded', weight: first, reps: formatSets(reps) };
  }

  // The weight moved. Every set keeps its own — collapsing here would rewrite
  // the session rather than tidy it.
  return {
    kind: 'perSet',
    pairs: working
      .map((s) => {
        const load = s.weight_kg == null ? 'bw' : formatNumber(s.weight_kg);
        return s.reps == null ? load : `${load}×${s.reps}`;
      })
      .join(' · '),
  };
}

/**
 * `80 → 60 → 40`. One string per chain, each starting at the working set the
 * chain hangs off — a dropset is a continuation of a set, never its own item.
 */
function describeDrops(all: CardSet[], drops: CardSet[]): string[] {
  if (drops.length === 0) return [];

  const byParent = new Map<number, CardSet[]>();
  const orphans: CardSet[] = [];
  for (const d of drops) {
    if (d.parent == null) orphans.push(d);
    else {
      const chain = byParent.get(d.parent) ?? [];
      chain.push(d);
      byParent.set(d.parent, chain);
    }
  }

  const label = (s: CardSet) =>
    s.weight_kg != null ? formatNumber(s.weight_kg) : s.reps != null ? String(s.reps) : '—';

  const chains: string[] = [];
  for (const [parentIndex, chain] of byParent) {
    const parent = all[parentIndex];
    const steps = parent ? [label(parent), ...chain.map(label)] : chain.map(label);
    chains.push(steps.join(' → '));
  }
  // A drop with no parent still happened; show it rather than swallowing it.
  if (orphans.length) chains.push(orphans.map(label).join(' → '));
  return chains;
}

function describeWarmups(warmups: CardSet[]): string {
  const reps = repsOf(warmups);
  const weights = warmups.map((s) => s.weight_kg);
  const first = weights[0];
  if (first != null && weights.every((w) => w === first)) {
    return reps.length ? `${formatNumber(first)} × ${formatSets(reps)}` : formatNumber(first);
  }
  if (weights.every((w) => w == null)) return formatSets(reps);
  return warmups
    .map((s) => (s.weight_kg == null ? `${s.reps ?? ''}` : `${formatNumber(s.weight_kg)}×${s.reps ?? ''}`))
    .join(' · ');
}

/** Narrow a `ParsedSet` to what the card reads. */
export function toCardSet(s: ParsedSet): CardSet {
  return {
    kind: s.kind,
    reps: s.reps,
    weight_kg: s.weight_kg,
    distance_m: s.distance_m,
    duration_s: s.duration_s,
    rir: s.rir,
    parent: s.parent,
  };
}

/**
 * §6.4's confidence ladder, as three names rather than a float. Below 0.4 the
 * caller renders nothing at all — the line stays in the note and the app says
 * nothing about it (§4.4).
 */
export type Confidence = 'high' | 'medium' | 'low' | 'none';

export function confidenceOf(value: number | null | undefined): Confidence {
  // Absent means the parser has not been asked yet (2.3 adds the field). An
  // unstated confidence is not a low one — it is a reading we have no doubt
  // recorded about, and dimming every card would be a lie about the parser.
  if (value == null) return 'high';
  if (value >= 0.9) return 'high';
  if (value >= 0.6) return 'medium';
  if (value >= 0.4) return 'low';
  return 'none';
}
