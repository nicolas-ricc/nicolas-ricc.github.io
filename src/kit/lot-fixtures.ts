import type { Vec2 } from "../iso/geometry";
import { bounds, type Solid } from "../iso/solids";
import type { Lot, Piece } from "./types";

/**
 * Parcel test fixtures (#476): lots with a `poly` and the oracles that check a piece against it.
 * The oracles carry their own convex clip, independent of `src/kit/forms/porteno.ts`.
 */
const SLOPE = 0.42;

/** The kit contract's two lots (as in `kit.test.ts`): the city's usable 21×15 and the lab's 24×18. */
export const L0: Lot = { x: 1.5, y: 1.5, w: 21, d: 15, z: 0, open: ["s"], maxH: 24 };
export const L1: Lot = { x: 0, y: 0, w: 24, d: 18, z: 0, open: ["s", "e"], maxH: 24 };

/**
 * `lot` minus the corner triangle cut by the line `x + 0.42·y = c`: the southeast corner (keeps `≤ c`) or the
 * northwest one (keeps `≥ c`), with `c` chosen so the cut runs `leg` along the east (se) or west (nw) edge.
 */
export function wedgeLot(lot: Lot, leg: number, corner: "se" | "nw" = "se"): Lot {
  const x0 = lot.x, y0 = lot.y, x1 = lot.x + lot.w, y1 = lot.y + lot.d;
  const poly: Vec2[] = corner === "se"
    ? [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 - leg }, { x: x1 - SLOPE * leg, y: y1 }, { x: x0, y: y1 }]
    : [{ x: x0 + SLOPE * leg, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }, { x: x0, y: y0 + leg }];
  return { ...lot, poly };
}

/** The parcel lots of the contract: both lots cut at the southeast, and the lab lot cut at the northwest. */
export const WEDGE_LOTS: Lot[] = [wedgeLot(L0, 7.5), wedgeLot(L1, 9), wedgeLot(L1, 9, "nw")];

/** A parcel that leaves only a strip 0.5..1.5 deep along the north edge. */
export const SLIVER_LOT: Lot = { ...L1, poly: [{ x: 0, y: 0 }, { x: 24, y: 0 }, { x: 24, y: 0.5 }, { x: 0, y: 1.5 }] };

const sub = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, y: a.y - b.y });
const unit = (a: Vec2): Vec2 => { const l = Math.hypot(a.x, a.y); return { x: a.x / l, y: a.y / l }; };

/** Signed shoelace area (positive in the canonical order: north, east, south, west). */
export function signedArea(poly: Vec2[]): number {
  let a = 0;
  for (let i = 0; i < poly.length; i++) { const p = poly[i]!, q = poly[(i + 1) % poly.length]!; a += p.x * q.y - q.x * p.y; }
  return a / 2;
}

/** Vertices of `poly` whose angle is not right (|cos| > 1e-6), with the unit directions of their two edges. */
export function obliqueCorners(poly: Vec2[]): { v: Vec2; e1: Vec2; e2: Vec2 }[] {
  const n = poly.length;
  return poly.flatMap((v, i) => {
    const e1 = unit(sub(poly[(i - 1 + n) % n]!, v)), e2 = unit(sub(poly[(i + 1) % n]!, v));
    return Math.abs(e1.x * e2.x + e1.y * e2.y) > 1e-6 ? [{ v, e1, e2 }] : [];
  });
}

/** Plan polygons of a solid: its footprint (`poly`), its triangles (`ground`), or its box corners. */
function plans(s: Solid): Vec2[][] {
  if (s.kind === "poly") return [s.footprint];
  if (s.kind === "ground") return s.tris.map((t) => t.pts.map((p) => ({ x: p.x, y: p.y })));
  const { min, max } = bounds(s);
  return [[{ x: min.x, y: min.y }, { x: max.x, y: min.y }, { x: max.x, y: max.y }, { x: min.x, y: max.y }]];
}

/** Plan polygons of the piece's ground-level solids: all of `ground`, plus every solid that starts at `lot.z`. */
export function groundPlans(p: Piece, lot: Lot): Vec2[][] {
  return [...p.ground, ...p.solids.filter((s) => bounds(s).min.z <= lot.z + 1e-6)].flatMap(plans);
}

/** The points of `pts` farther than `margin` outside the convex `poly` (either winding). */
export function outsideConvex(pts: Vec2[], poly: Vec2[], margin: number): Vec2[] {
  const s = Math.sign(signedArea(poly)), n = poly.length;
  return pts.filter((p) => poly.some((a, i) => {
    const b = poly[(i + 1) % n]!, e = unit(sub(b, a));
    // outward normal of a→b in canonical order is (e.y, −e.x)
    return s * ((p.x - a.x) * e.y - (p.y - a.y) * e.x) > margin + 1e-9;
  }));
}

/** Sutherland–Hodgman of `subject` against the convex `clip` (either winding). */
function clip(subject: Vec2[], clipPoly: Vec2[]): Vec2[] {
  const s = Math.sign(signedArea(clipPoly)), n = clipPoly.length;
  let out = subject;
  for (let i = 0; i < n && out.length > 0; i++) {
    const a = clipPoly[i]!, b = clipPoly[(i + 1) % n]!;
    const side = (p: Vec2) => s * ((b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x)); // ≥ 0 inside
    const inp = out;
    out = [];
    for (let j = 0; j < inp.length; j++) {
      const p = inp[j]!, q = inp[(j + 1) % inp.length]!, sp = side(p), sq = side(q);
      if ((sp >= 0) !== (sq >= 0)) { const t = sp / (sp - sq); out.push({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t }); }
      if (sq >= 0) out.push(q);
    }
  }
  return out;
}

/** Area of the intersection of two convex polygons. */
export function triangleOverlap(plan: Vec2[], tri: [Vec2, Vec2, Vec2]): number {
  const c = clip(plan, tri);
  return c.length < 3 ? 0 : Math.abs(signedArea(c));
}
