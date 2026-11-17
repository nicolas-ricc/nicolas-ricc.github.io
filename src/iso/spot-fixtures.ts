import type { AccentColor } from "../map/palette-iso";
import { v3, type Vec3 } from "./geometry";
import { spot, type Accent } from "./accent";

const EPS = 1e-9;

/**
 * Test-only fixture (#403): reads a `spot()` back as `{ at, r, color, alpha }`, or `null` for anything else
 * (dot, poly that is not the 4-point spot pattern, such as a lit window). Not imported by production code.
 */
export function spotOf(a: Accent): { at: Vec3; r: number; color: AccentColor; alpha: number } | null {
  if (a.kind !== "poly" || a.pts.length !== 4) return null;
  const p0 = a.pts[0]!, p1 = a.pts[1]!, p3 = a.pts[3]!;
  const at = v3(p1.x, p1.y, (p1.z + p3.z) / 2), r = 2 * (p0.x - at.x);
  if (!(r > 0)) return null;
  const alpha = a.alpha ?? 1;
  const e = spot(at, r, a.color, alpha);
  if (e.kind !== "poly" || !e.pts.every((q, i) => Math.abs(q.x - a.pts[i]!.x) < EPS && Math.abs(q.y - a.pts[i]!.y) < EPS && Math.abs(q.z - a.pts[i]!.z) < EPS)) return null;
  return { at, r, color: a.color, alpha };
}
