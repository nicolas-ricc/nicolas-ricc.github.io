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

/** Sutherland–Hodgman of a convex polygon against the four edges of r; [] when nothing is left. */
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
      if ((da >= 0) !== (db >= 0)) push(lerp(a, b, da / (da - db)));
    }
    while (out.length > 1 && out[0]!.x === out[out.length - 1]!.x && out[0]!.y === out[out.length - 1]!.y) out.pop();
    cur = out;
  }
  return cur;
}
