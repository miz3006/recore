/**
 * Smoothing, for a chart that is not allowed to lie.
 *
 * ## Why this is monotone cubic and not Catmull-Rom
 *
 * The obvious way to smooth a series is a Catmull-Rom spline, and it is what
 * most chart libraries reach for. It **overshoots**: between two points it can
 * swing past both of them, so a lift that went 100 → 105 draws a curve that
 * touches 107 on the way. On a decorative chart that is a rounding artefact. On
 * THIS one it is a load nobody lifted, drawn inside the app whose first rule is
 * that the record is the source of truth (CLAUDE.md §3).
 *
 * So the curve is a **Fritsch–Carlson monotone cubic Hermite**. It is smooth,
 * it is visually indistinguishable from a Catmull-Rom at this density, and it is
 * *provably* bounded by its own data: between any two points the curve stays
 * between their values, and a run that only rises can only rise. `path.test.ts`
 * asserts exactly that, by sampling every curve it builds.
 *
 * Pure, no imports, node-testable.
 */

export interface P {
  x: number;
  y: number;
}

/**
 * An SVG path through `points`, smoothed and monotone.
 *
 * Fewer than two points has no path; exactly two is a straight line, because a
 * curve between two points is invention.
 */
export function monotonePathD(points: readonly P[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0]!.x} ${points[0]!.y}`;
  if (points.length === 2) {
    return `M ${points[0]!.x} ${points[0]!.y} L ${points[1]!.x} ${points[1]!.y}`;
  }

  const n = points.length;
  const h: number[] = [];
  const d: number[] = [];
  for (let i = 0; i < n - 1; i += 1) {
    const dx = points[i + 1]!.x - points[i]!.x;
    h.push(dx);
    d.push(dx === 0 ? 0 : (points[i + 1]!.y - points[i]!.y) / dx);
  }

  // Tangents: the average of the neighbouring secants, flattened to zero at any
  // turning point. That flattening is what forbids the overshoot.
  const m: number[] = new Array(n).fill(0);
  m[0] = d[0]!;
  m[n - 1] = d[n - 2]!;
  for (let i = 1; i < n - 1; i += 1) {
    m[i] = d[i - 1]! * d[i]! <= 0 ? 0 : (d[i - 1]! + d[i]!) / 2;
  }

  // Fritsch–Carlson: keep each tangent inside the circle of radius 3 around its
  // secant, which is the condition for monotonicity on that interval.
  for (let i = 0; i < n - 1; i += 1) {
    if (d[i] === 0) {
      m[i] = 0;
      m[i + 1] = 0;
      continue;
    }
    const a = m[i]! / d[i]!;
    const b = m[i + 1]! / d[i]!;
    const sq = a * a + b * b;
    if (sq > 9) {
      const t = 3 / Math.sqrt(sq);
      m[i] = t * a * d[i]!;
      m[i + 1] = t * b * d[i]!;
    }
  }

  let out = `M ${r(points[0]!.x)} ${r(points[0]!.y)}`;
  for (let i = 0; i < n - 1; i += 1) {
    const third = h[i]! / 3;
    const c1x = points[i]!.x + third;
    const c1y = points[i]!.y + m[i]! * third;
    const c2x = points[i + 1]!.x - third;
    const c2y = points[i + 1]!.y - m[i + 1]! * third;
    out += ` C ${r(c1x)} ${r(c1y)} ${r(c2x)} ${r(c2y)} ${r(points[i + 1]!.x)} ${r(points[i + 1]!.y)}`;
  }
  return out;
}

/** Two decimals is under a tenth of a pixel at 3× and keeps the path string short. */
function r(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * A guaranteed UPPER bound on the path's arc length, for `strokeDasharray`.
 *
 * `DrawnLine` reveals a stroke by running `strokeDashoffset` from the path's
 * length down to zero, so the number it is given must never be SHORTER than the
 * real path — a short dash array leaves the line partly drawn on frame one.
 * Summing the chords between data points is an under-estimate for a curve (a
 * curve is longer than its chord), which is the bug this function exists to
 * avoid. The control polygon of a cubic Bézier is always at least as long as the
 * curve inside it, so summing it is both safe and tight.
 */
export function pathUpperBound(points: readonly P[]): number {
  if (points.length < 2) return 1;
  const seg = (a: P, b: P) => Math.hypot(b.x - a.x, b.y - a.y);
  if (points.length === 2) return Math.max(seg(points[0]!, points[1]!), 1);
  // Re-walk the same control points the path uses, and sum the polygon.
  const d = monotonePathD(points);
  const nums = d.match(/-?\d+(\.\d+)?/g)?.map(Number) ?? [];
  let total = 0;
  let cur: P = { x: nums[0]!, y: nums[1]! };
  for (let i = 2; i + 5 < nums.length + 1; i += 6) {
    const pts: P[] = [
      { x: nums[i]!, y: nums[i + 1]! },
      { x: nums[i + 2]!, y: nums[i + 3]! },
      { x: nums[i + 4]!, y: nums[i + 5]! },
    ];
    total += seg(cur, pts[0]!) + seg(pts[0]!, pts[1]!) + seg(pts[1]!, pts[2]!);
    cur = pts[2]!;
  }
  return Math.max(total, 1);
}

/**
 * Where each point falls along the drawn path, 0…1 — so a dot can land as the
 * pen reaches it rather than all of them arriving at once.
 *
 * Measured on the control polygon, the same yardstick `pathUpperBound` uses, so
 * a dot's fraction and the stroke's progress agree.
 */
export function pointFractions(points: readonly P[]): number[] {
  if (points.length === 0) return [];
  if (points.length === 1) return [0];
  const seg = (a: P, b: P) => Math.hypot(b.x - a.x, b.y - a.y);
  const d = monotonePathD(points);
  const nums = d.match(/-?\d+(\.\d+)?/g)?.map(Number) ?? [];
  if (points.length === 2) return [0, 1];
  const running: number[] = [0];
  let total = 0;
  let cur: P = { x: nums[0]!, y: nums[1]! };
  for (let i = 2; i + 5 < nums.length + 1; i += 6) {
    const pts: P[] = [
      { x: nums[i]!, y: nums[i + 1]! },
      { x: nums[i + 2]!, y: nums[i + 3]! },
      { x: nums[i + 4]!, y: nums[i + 5]! },
    ];
    total += seg(cur, pts[0]!) + seg(pts[0]!, pts[1]!) + seg(pts[1]!, pts[2]!);
    running.push(total);
    cur = pts[2]!;
  }
  if (total <= 0) return points.map(() => 0);
  return running.map((v) => v / total);
}
