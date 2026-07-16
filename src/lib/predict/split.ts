/**
 * Zero-config split matching (CLAUDE.md §7.2 Gap 2) — PURE, zero I/O, runs
 * under `node --test`.
 *
 * A push/pull/legs athlete must not get tomorrow's ghost… of today's push
 * day. Instead of asking the user to define their split, infer it:
 *
 *  1. CLUSTER the recent sessions by exercise overlap (Jaccard on the set of
 *     exercise ids; ≥ 0.5 with a cluster's most recent member joins it — the
 *     rolling representative lets a program drift without breaking the label).
 *  2. Read the label sequence as a rotation and predict the cluster that
 *     FOLLOWS the just-finished session: the unique observed successor, or
 *     the clearly dominant one (≥ 2 observations, strictly ahead).
 *  3. Return the most recent session of that cluster — the one the caller
 *     progresses.
 *
 * Anything thin or ambiguous returns null and the caller falls back to
 * progressing the last session (the pre-split behavior). Wrong predictions
 * erode the moat faster than no predictions (§7.4).
 */
export interface SessionExercises {
  id: string;
  /** Distinct exercise ids performed in this session. */
  exerciseIds: string[];
}

const SIM_THRESHOLD = 0.5;
const MIN_SESSIONS = 3;

export function jaccard(a: ReadonlySet<string>, b: ReadonlySet<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let intersection = 0;
  for (const x of a) if (b.has(x)) intersection++;
  return intersection / (a.size + b.size - intersection);
}

/** Label each session with a cluster index, in chronological order. */
export function clusterSessions(sessions: SessionExercises[]): number[] {
  const labels: number[] = [];
  const representatives: Set<string>[] = []; // cluster → most recent member

  for (const session of sessions) {
    const exercises = new Set(session.exerciseIds);
    let assigned = -1;
    for (let c = 0; c < representatives.length; c++) {
      if (jaccard(exercises, representatives[c]!) >= SIM_THRESHOLD) {
        assigned = c;
        break;
      }
    }
    if (assigned === -1) {
      representatives.push(exercises);
      assigned = representatives.length - 1;
    } else {
      representatives[assigned] = exercises;
    }
    labels.push(assigned);
  }
  return labels;
}

/**
 * The session most like what the athlete is DUE for next, or null when no
 * rotation can be read with confidence. `sessions` must be chronological
 * (oldest first) and END with the just-finished session.
 */
export function pickNextSession(sessions: SessionExercises[]): string | null {
  if (sessions.length < MIN_SESSIONS) return null;

  const labels = clusterSessions(sessions);
  const clusterCount = Math.max(...labels) + 1;
  if (clusterCount === 1) return null; // one repeating session — nothing to rotate

  // What follows the current cluster, historically?
  const current = labels[labels.length - 1]!;
  const successorCounts = new Map<number, number>();
  for (let i = 0; i < labels.length - 1; i++) {
    if (labels[i] === current) {
      const next = labels[i + 1]!;
      successorCounts.set(next, (successorCounts.get(next) ?? 0) + 1);
    }
  }
  if (successorCounts.size === 0) return null;

  let target: number | null = null;
  if (successorCounts.size === 1) {
    // Every observed transition agrees — thin evidence is still evidence.
    target = [...successorCounts.keys()][0]!;
  } else {
    const ranked = [...successorCounts.entries()].sort((a, b) => b[1] - a[1]);
    const [best, second] = [ranked[0]!, ranked[1]!];
    if (best[1] >= 2 && best[1] > second[1]) target = best[0];
  }
  if (target === null) return null;

  for (let i = sessions.length - 1; i >= 0; i--) {
    if (labels[i] === target) return sessions[i]!.id;
  }
  return null;
}
