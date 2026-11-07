import { convexHull, v3, type Vec2 } from "./geometry";
import { VIEW_DIR, project } from "./project";
import { pointInPolygon } from "../map/geo";
import { bounds, hullRings, tessellateAll, type Bounds, type Solid } from "./solids";

const EPS = 1e-6;

export interface ScreenBounds { minX: number; minY: number; maxX: number; maxY: number }

export function screenBounds(b: Bounds): ScreenBounds {
  const out = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) {
    const p = project(v3(x, y, z));
    out.minX = Math.min(out.minX, p.x); out.maxX = Math.max(out.maxX, p.x);
    out.minY = Math.min(out.minY, p.y); out.maxY = Math.max(out.maxY, p.y);
  }
  return out;
}

export const overlaps = (a: ScreenBounds, b: ScreenBounds): boolean =>
  a.minX < b.maxX && b.minX < a.maxX && a.minY < b.maxY && b.minY < a.maxY;

/**
 * Screen hexagon of a world box (convex hull of its eight projected vertices). The rectangle
 * of `screenBounds` wraps it with a lot of slack when the box is long on the diagonal (a freighter heading north): it gave
 * false occlusion positives with the basin's breakwater, 35 u from the ship (#83). Two boxes overlap on
 * screen if their hexagons intersect.
 */
export function screenHull(b: Bounds): Vec2[] {
  const pts: Vec2[] = [];
  for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) pts.push(project(v3(x, y, z)));
  return convexHull(pts);
}

/** SAT between two convex polygons: they intersect if no axis (normal of a side) separates them. Touching counts as intersecting. */
export function hullsIntersect(a: Vec2[], b: Vec2[]): boolean {
  const axes = [a, b].flatMap((poly) => poly.map((p, i) => { const q = poly[(i + 1) % poly.length]!; return { x: p.y - q.y, y: q.x - p.x }; }));
  return axes.every((n) => {
    const pa = a.map((p) => p.x * n.x + p.y * n.y), pb = b.map((p) => p.x * n.x + p.y * n.y);
    return Math.max(...pa) >= Math.min(...pb) && Math.max(...pb) >= Math.min(...pa);
  });
}

/** `a` is behind `b` if an axis separates them with `a` on the far side (west, north or below). */
export function isBehind(a: Bounds, b: Bounds): boolean {
  return a.max.x <= b.min.x + EPS || a.max.y <= b.min.y + EPS || a.max.z <= b.min.z + EPS;
}

/** Two convex polygons cross if no axis of their edges separates them (touching does not count). Unlike `hullsIntersect`, where touching does count: the occlusion in `lights.ts` does not cover a window with a neighbor that barely grazes it. */
export function hullsOverlap(a: Vec2[], b: Vec2[]): boolean {
  for (const poly of [a, b]) for (let i = 0; i < poly.length; i++) {
    const p = poly[i]!, q = poly[(i + 1) % poly.length]!, nx = q.y - p.y, ny = p.x - q.x;
    let aMin = Infinity, aMax = -Infinity, bMin = Infinity, bMax = -Infinity;
    for (const v of a) { const d = v.x * nx + v.y * ny; aMin = Math.min(aMin, d); aMax = Math.max(aMax, d); }
    for (const v of b) { const d = v.x * nx + v.y * ny; bMin = Math.min(bMin, d); bMax = Math.max(bMax, d); }
    if (aMax <= bMin + EPS || bMax <= aMin + EPS) return false;
  }
  return true;
}

/** `front` hides `back`: `back` is behind and their silhouettes cross on screen. */
export function hides(back: Bounds, front: Bounds, hulls?: { back: Vec2[]; front: Vec2[] }): boolean {
  return isBehind(back, front) && hullsOverlap(hulls?.back ?? screenHull(back), hulls?.front ?? screenHull(front));
}

/**
 * `a` is on the far side of `b` along an axis whose view component is `v`. With the view parallel to the plane
 * that separates them (component ~0) neither hides the other: it counts as behind in both directions.
 */
const farAlong = (v: number, aMin: number, aMax: number, bMin: number, bMax: number): boolean =>
  (v > -EPS && aMax <= bMin + EPS) || (v < EPS && aMin >= bMax - EPS);

/**
 * `a` is behind `b` with the view expressed in a rotated frame (`vx`, `vy`): on each horizontal axis
 * the far side is the one facing against the view component. With `vx`, `vy` > 0 it is `isBehind`.
 * With a ~0 component (view parallel to that axis), separating along it counts as behind in both directions.
 */
function isBehindView(a: Bounds, b: Bounds, vx: number, vy: number): boolean {
  return farAlong(vx, a.min.x, a.max.x, b.min.x, b.max.x) || farAlong(vy, a.min.y, a.max.y, b.min.y, b.max.y)
    || a.max.z <= b.min.z + EPS;
}

/** Boxes of the solid in the world and in the frame rotated by `heading` (vertices rotated −heading; z the same), with a single tessellation. */
function worldAndFrameBounds(s: Solid, heading: number): { world: Bounds; frame: Bounds } {
  const c = Math.cos(heading), sn = Math.sin(heading);
  const wmin = v3(Infinity, Infinity, Infinity), wmax = v3(-Infinity, -Infinity, -Infinity);
  const fmin = v3(Infinity, Infinity, Infinity), fmax = v3(-Infinity, -Infinity, -Infinity);
  for (const f of tessellateAll(s)) for (const p of f.pts) {
    const x = p.x * c + p.y * sn, y = -p.x * sn + p.y * c;
    wmin.x = Math.min(wmin.x, p.x); wmin.y = Math.min(wmin.y, p.y); wmin.z = Math.min(wmin.z, p.z);
    wmax.x = Math.max(wmax.x, p.x); wmax.y = Math.max(wmax.y, p.y); wmax.z = Math.max(wmax.z, p.z);
    fmin.x = Math.min(fmin.x, x); fmin.y = Math.min(fmin.y, y); fmin.z = wmin.z;
    fmax.x = Math.max(fmax.x, x); fmax.y = Math.max(fmax.y, y); fmax.z = wmax.z;
  }
  return { world: { min: wmin, max: wmax }, frame: { min: fmin, max: fmax } };
}

/** Without rotation it is the usual coordinate sum; rotated, it is the same formula expressed in the frame (each axis weighted by the view), as in the measured prototype. */
const depthKey = (b: Bounds, vx?: number, vy?: number): number =>
  vx === undefined || vy === undefined
    ? b.min.x + b.max.x + b.min.y + b.max.y + (b.min.z + b.max.z) * 0.5
    : (vx * (b.min.x + b.max.x) + vy * (b.min.y + b.max.y)) / VIEW_DIR.x + (b.min.z + b.max.z) * 0.5;

/**
 * Side of a non-hull piece against a hull: 1 after it, -1 before it, 0 no rule. All in the sort frame; `ring` is the
 * hull's deck ring in that frame, flat `[x0, y0, x1, y1, ...]`.
 * 0. Not a hull / other is a hull / the plan boxes do not overlap: 0.
 * 1. Base at or above the midship deck (`hull.at.z + hull.h`, no sheer): after.
 * 2. All four plan-box corners inside the deck ring (the piece hangs from the deck): after if it rises above the
 *    deck, else before (sunk under it).
 * 3. Wholly under the keel: 0.
 * 4. Otherwise it hangs from a face: the hull box face it sits against (the axis where its centre is farthest out,
 *    normalised by the hull half-extent) gives a normal; after if that normal points toward the view, before if away,
 *    0 if the view is parallel to the face or the piece is centred.
 */
function hullSide(hull: Solid, other: Solid, hb: Bounds, ob: Bounds, ring: number[], vx: number, vy: number): number {
  if (hull.kind !== "hull" || other.kind === "hull") return 0;
  if (!(ob.min.x < hb.max.x && hb.min.x < ob.max.x && ob.min.y < hb.max.y && hb.min.y < ob.max.y)) return 0;
  const deck = hull.at.z + hull.h;
  if (ob.min.z >= deck - EPS) return 1;
  if (pointInPolygon(ob.min.x, ob.min.y, ring) && pointInPolygon(ob.max.x, ob.min.y, ring)
    && pointInPolygon(ob.min.x, ob.max.y, ring) && pointInPolygon(ob.max.x, ob.max.y, ring)) return ob.max.z > deck + EPS ? 1 : -1;
  if (ob.max.z <= hb.min.z + EPS) return 0;
  const u = (ob.min.x + ob.max.x - hb.min.x - hb.max.x) / (hb.max.x - hb.min.x);
  const w = (ob.min.y + ob.max.y - hb.min.y - hb.max.y) / (hb.max.y - hb.min.y);
  const t = Math.abs(u) >= Math.abs(w) ? Math.sign(u) * vx : Math.sign(w) * vy;
  return Math.abs(t) <= EPS ? 0 : Math.sign(t);
}

/**
 * Topological painter order: for each pair that overlaps on screen, the one
 * behind is drawn first. If each is "behind" the other through a different plane (diagonal
 * corners), neither hides the other and no order is imposed: that tie-break edge used to close cycles that
 * cut real relations. If no plane separates them, the coordinate sum decides.
 * Cycles: they are cut and the sort carries on.
 * Pairs are found with a sweep over screen x (only boxes whose x ranges
 * cross are compared) and each `before` list is sorted ascending:
 * the result is the same as comparing all pairs in index order.
 *
 * `heading` is the frame in which the solids are axis-aligned (a ship's heading). The world-aligned
 * box of a rotated piece inflates and almost never separates; in its own frame it does. If a plane x=c (or y=c, z=c)
 * of that frame separates two convex solids, the one on the far side of the view does not hide the
 * other. The screen stays in the world; the tie-break (`depthKey`) uses the frame, because in the world
 * a rotated piece ties badly and the cycle cut drops real relations.
 *
 * The hull rules (`hullSide`: deck, outline and face of the hull a piece hangs from; and the hull separating what
 * goes before it from what goes after) hold at any heading, also in static scenes.
 */
export function sortByDepth(solids: Solid[], heading = 0): Solid[] {
  const n = solids.length;
  let wb: Bounds[], bs: Bounds[];
  if (heading === 0) wb = bs = solids.map(bounds);
  else { const both = solids.map((s) => worldAndFrameBounds(s, heading)); wb = both.map((x) => x.world); bs = both.map((x) => x.frame); }
  const c = Math.cos(heading), sn = Math.sin(heading);
  const vx = VIEW_DIR.x * c + VIEW_DIR.y * sn, vy = -VIEW_DIR.x * sn + VIEW_DIR.y * c;
  const sbs = wb.map(screenBounds);
  const keys = heading === 0 ? bs.map((b) => depthKey(b)) : bs.map((b) => depthKey(b, vx, vy));
  // Side of each solid relative to each hull (1 after, −1 before): the hull separates, and what goes before it goes before what goes after.
  const hulls = solids.flatMap((s, i) => (s.kind === "hull" ? [i] : []));
  const rings = new Map<number, number[]>(); // deck ring of each hull in the sort frame, once per call
  for (const k of hulls) rings.set(k, hullRings(solids[k] as Solid & { kind: "hull" }).deck.flatMap((p) => [p.x * c + p.y * sn, -p.x * sn + p.y * c]));
  const sides = solids.map((s, i) => {
    let m: Map<number, number> | null = null; // almost no solid touches a hull: without a map nothing is allocated
    for (const k of hulls) {
      const side = hullSide(solids[k]!, s, bs[k]!, bs[i]!, rings.get(k)!, vx, vy);
      if (side !== 0) (m ??= new Map()).set(k, side);
    }
    return m;
  });
  // Positive if j goes after i by a hull rule: one of the two is the other's hull, or a hull separates them
  // (i before, j after). If two hulls disagree, the first in the list wins. 0 if there is no rule.
  const hullOrder = (i: number, j: number): number => {
    const a = sides[i], b = sides[j];
    const own = b?.get(i) ?? -(a?.get(j) ?? 0);
    if (own || !a || !b) return own;
    for (const [k, ai] of a) { const bj = b.get(k); if (bj !== undefined && bj !== ai) return bj; }
    return 0;
  };
  const before: number[][] = Array.from({ length: n }, () => []); // before[i] = indices that go before i
  const byX = solids.map((_, i) => i).sort((a, b) => sbs[a]!.minX - sbs[b]!.minX);
  for (let a = 0; a < n; a++) {
    const p = byX[a]!, sp = sbs[p]!;
    for (let b = a + 1; b < n; b++) {
      const q = byX[b]!, sq = sbs[q]!;
      if (sq.minX >= sp.maxX) break;
      if (!(sp.minY < sq.maxY && sq.minY < sp.maxY)) continue;
      const i = Math.min(p, q), j = Math.max(p, q);
      const side = hullOrder(i, j);
      const ij = isBehindView(bs[i]!, bs[j]!, vx, vy), ji = isBehindView(bs[j]!, bs[i]!, vx, vy);
      if (side > 0) before[j]!.push(i);
      else if (side < 0) before[i]!.push(j);
      // Two planes separate them at once: neither hides the other
      else if (ij && ji) continue;
      else if (ij === ji) { if (keys[i]! <= keys[j]!) before[j]!.push(i); else before[i]!.push(j); }
      else if (ij) before[j]!.push(i);
      else before[i]!.push(j);
    }
  }
  for (const list of before) list.sort((a, b) => a - b);
  const state = new Uint8Array(n); // 0 unvisited, 1 in progress, 2 done
  const out: Solid[] = [];
  const visit = (i: number): void => {
    if (state[i] !== 0) return;
    state[i] = 1;
    for (const p of before[i]!) if (state[p] !== 1) visit(p);
    state[i] = 2;
    out.push(solids[i]!);
  };
  const order = solids.map((_, i) => i).sort((a, b) => keys[a]! - keys[b]!);
  for (const i of order) visit(i);
  return out;
}
