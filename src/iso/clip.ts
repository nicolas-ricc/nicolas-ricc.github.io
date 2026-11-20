import type { Vec2, Vec3 } from "./geometry";

export interface ClipRect { x0: number; y0: number; x1: number; y1: number }

export const lerp2 = (a: Vec2, b: Vec2, t: number): Vec2 => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
export const lerp3 = (a: Vec3, b: Vec3, t: number): Vec3 => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t });

/** Liang–Barsky: parameters along a→b of the part inside r (edges inclusive); null if none or zero-length on a≠b. */
export function clipSegment(a: Vec2, b: Vec2, r: ClipRect): { t0: number; t1: number } | null {
  const dx = b.x - a.x, dy = b.y - a.y;
  let t0 = 0, t1 = 1;
  const p = [-dx, dx, -dy, dy];
  const q = [a.x - r.x0, r.x1 - a.x, a.y - r.y0, r.y1 - a.y];
  for (let i = 0; i < 4; i++) {
    const pi = p[i]!, qi = q[i]!;
    if (pi === 0) { if (qi < 0) return null; continue; }
    const t = qi / pi;
    if (pi < 0) { if (t > t1) return null; if (t > t0) t0 = t; }
    else { if (t < t0) return null; if (t < t1) t1 = t; }
  }
  if (t1 <= t0 && (dx !== 0 || dy !== 0)) return null;
  return { t0, t1 };
}

/** Sutherland–Hodgman of a convex polygon against the four edges of r; [] when fewer than 3 points are left. */
export function clipPolygon<T extends Vec2>(pts: readonly T[], r: ClipRect, lerp: (a: T, b: T, t: number) => T): T[] {
  // each edge: signed distance, >= 0 inside
  const edges: ((p: Vec2) => number)[] = [p => p.x - r.x0, p => r.x1 - p.x, p => p.y - r.y0, p => r.y1 - p.y];
  let cur: T[] = pts.slice();
  for (const dist of edges) {
    if (cur.length === 0) return [];
    const out: T[] = [];
    const push = (p: T): void => {
      const last = out[out.length - 1];
      if (!last || last.x !== p.x || last.y !== p.y) out.push(p);
    };
    for (let i = 0; i < cur.length; i++) {
      const a = cur[i]!, b = cur[(i + 1) % cur.length]!;
      const da = dist(a), db = dist(b);
      if (da >= 0) push(a);
      if ((da < 0 && db > 0) || (da > 0 && db < 0)) push(lerp(a, b, da / (da - db)));
    }
    while (out.length > 1 && out[0]!.x === out[out.length - 1]!.x && out[0]!.y === out[out.length - 1]!.y) out.pop();
    cur = out;
  }
  return cur.length < 3 ? [] : cur;
}

const ccw2 = (p: readonly Vec2[]): Vec2[] => (p.reduce((s, a, i) => { const b = p[(i + 1) % p.length]!; return s + a.x * b.y - b.x * a.y; }, 0) > 0 ? p.slice() : p.slice().reverse());
const same2 = (a: Vec2, b: Vec2): boolean => Math.abs(a.x - b.x) < 1e-7 && Math.abs(a.y - b.y) < 1e-7;
const isConvex2 = (p: readonly Vec2[]): boolean => p.every((o, i) => { const a = p[(i + 1) % p.length]!, b = p[(i + 2) % p.length]!; return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x) >= -1e-9; });
/** The union of two CCW convex pieces across a shared (reversed) edge, or null if they share none or the union is concave. */
function joinConvex(A: readonly Vec2[], B: readonly Vec2[]): Vec2[] | null {
  for (let i = 0; i < A.length; i++) for (let j = 0; j < B.length; j++) {
    if (!same2(A[i]!, B[(j + 1) % B.length]!) || !same2(A[(i + 1) % A.length]!, B[j]!)) continue;
    const out = [...A.slice(i + 1), ...A.slice(0, i + 1)];
    for (let k = 2; k < B.length; k++) out.push(B[(j + k) % B.length]!);
    return isConvex2(out) ? out : null;
  }
  return null;
}

/** Greedily merges convex pieces (either winding) that share an edge and whose union stays convex; output CCW, same total area. Deterministic: always the first pair (i < j). */
export function mergeConvex(pieces: readonly Vec2[][]): Vec2[][] {
  const out = pieces.map(ccw2);
  for (let again = true; again;) {
    again = false;
    for (let i = 0; i < out.length && !again; i++) for (let j = i + 1; j < out.length; j++) {
      const m = joinConvex(out[i]!, out[j]!);
      if (m) { out[i] = m; out.splice(j, 1); again = true; break; }
    }
  }
  return out;
}
