/**
 * The parse-workout edge function's response shape (CLAUDE.md §6) and the
 * client-side validator. Model output is UNTRUSTED: the edge function already
 * validates server-side, but the client re-validates before anything is
 * written into SQLite — never insert unvalidated model output.
 */
export const SET_KINDS = ['warmup', 'working', 'drop', 'myo', 'amrap', 'failure'] as const;
export type SetKind = (typeof SET_KINDS)[number];

export const MODALITIES = ['strength', 'cardio', 'carry', 'hold'] as const;
export type Modality = (typeof MODALITIES)[number];

export interface ParsedSet {
  kind: SetKind;
  reps: number | null;
  weight_kg: number | null;
  distance_m: number | null;
  duration_s: number | null;
  rir: number | null;
  /** 0-based index of the parent set within the same item (dropset/myo chain). */
  parent: number | null;
}

export interface ParsedItem {
  exercise: string;
  aliases_seen: string[];
  modality: Modality;
  group_key: string | null;
  /** 0-based line index in raw_text this item renders against (right gutter). */
  line: number;
  sets: ParsedSet[];
}

export interface ParseResult {
  items: ParsedItem[];
  parse_version: number;
}

/** Client-side cap mirrored from the edge function. */
export const MAX_RAW_TEXT_CHARS = 4000;

const SET_KIND_SET = new Set<string>(SET_KINDS);
const MODALITY_SET = new Set<string>(MODALITIES);

function clampNumber(v: unknown, min: number, max: number, integer = false): number | null {
  if (typeof v !== 'number' || !Number.isFinite(v)) return null;
  const n = Math.min(max, Math.max(min, v));
  return integer ? Math.round(n) : Math.round(n * 100) / 100;
}

/** Validate + clamp an edge-function response. Returns null if malformed. */
export function validateParseResult(raw: unknown): ParseResult | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const { items, parse_version } = raw as { items?: unknown; parse_version?: unknown };
  if (!Array.isArray(items) || typeof parse_version !== 'number') return null;

  const outItems: ParsedItem[] = [];
  for (const it of items.slice(0, 60)) {
    if (typeof it !== 'object' || it === null) return null;
    const o = it as Record<string, unknown>;
    if (typeof o.exercise !== 'string' || !o.exercise.trim()) return null;
    if (!MODALITY_SET.has(o.modality as string)) return null;
    if (!Array.isArray(o.sets)) return null;

    const sets: ParsedSet[] = [];
    for (const s of (o.sets as unknown[]).slice(0, 40)) {
      if (typeof s !== 'object' || s === null) return null;
      const t = s as Record<string, unknown>;
      if (!SET_KIND_SET.has(t.kind as string)) return null;
      sets.push({
        kind: t.kind as SetKind,
        reps: clampNumber(t.reps, 0, 1000, true),
        weight_kg: clampNumber(t.weight_kg, 0, 2000),
        distance_m: clampNumber(t.distance_m, 0, 1_000_000),
        duration_s: clampNumber(t.duration_s, 0, 86_400, true),
        rir: clampNumber(t.rir, 0, 10),
        parent:
          t.parent == null ? null : clampNumber(t.parent, 0, Math.max(0, sets.length - 1), true),
      });
    }
    if (sets.length === 0) continue;

    outItems.push({
      exercise: o.exercise.trim().slice(0, 120),
      aliases_seen: Array.isArray(o.aliases_seen)
        ? o.aliases_seen
            .filter((a): a is string => typeof a === 'string')
            .map((a) => a.trim().toLowerCase())
            .filter(Boolean)
            .slice(0, 8)
        : [],
      modality: o.modality as Modality,
      group_key: typeof o.group_key === 'string' ? o.group_key.slice(0, 8) : null,
      line: clampNumber(o.line, 0, 10_000, true) ?? 0,
      sets,
    });
  }

  return { items: outItems, parse_version: Math.round(parse_version) };
}

// --- Gutter signals (CLAUDE.md §8 + task §6) ---------------------------------
// The gutter shows how THIS session compares to the PREVIOUS one — ↑ +2.5,
// = same, ↓ -2 rep, or a PR flag — never a raw volume number. A line whose
// exercise has no history yet gets a quiet 'set' ECHO of the normalized
// prescription (e.g. "3×12 100" — sets×reps weight, the same voice the ghost
// prediction speaks in) — the visible proof the analysis understood it.

export type GutterSignal =
  | { kind: 'up'; delta: string }
  | { kind: 'down'; delta: string }
  | { kind: 'equal' }
  | { kind: 'pr' }
  | { kind: 'set'; text: string };

/** A signal pinned to a specific line of the note. */
export interface LineSignal {
  line: number;
  signal: GutterSignal;
}
