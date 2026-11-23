import { convexHull, v3, type Vec2 } from "../../iso/geometry";
import type { Facade } from "../../iso/facade";
import type { MeshFace, Solid } from "../../iso/solids";
import type { Material } from "../../map/palette-iso";
import type { Rng } from "../../map/seed";
import type { Rect } from "../../scenes/city-grid";
import { prism } from "../../scenes/city-pieces";
import { addBuilding, emptyPiece, fitToCap, floorsFor, interlock, recipeCap } from "../piece";
import { CORNICE_H, offsetFootprint } from "../roofs";
import type { Lot, Piece, RecipeDef, Style } from "../types";
import { chamferCorner } from "./composite";
import { ring } from "./courtyard";

/** Chamfer thresholds (decision T1): a corner with |cos| below RIGHT_COS is "right" (ochava class); above FLAT_COS the edges are nearly collinear. */
export const RIGHT_COS = 0.35;
export const FLAT_COS = 0.95;

const EPS = 1e-9;
const area2 = (p: Vec2[]): number => p.reduce((s, a, i) => { const b = p[(i + 1) % p.length]!; return s + a.x * b.y - b.x * a.y; }, 0);

/** Absolute area of a polygon. */
export const polyArea = (poly: Vec2[]): number => Math.abs(area2(poly)) / 2;

/** Area centroid of a polygon; the vertex mean if it is degenerate. */
export function polyCentroid(poly: Vec2[]): Vec2 {
  const a = area2(poly);
  if (Math.abs(a) < EPS) return { x: poly.reduce((s, p) => s + p.x, 0) / (poly.length || 1), y: poly.reduce((s, p) => s + p.y, 0) / (poly.length || 1) };
  let x = 0, y = 0;
  poly.forEach((p, i) => { const q = poly[(i + 1) % poly.length]!, c = p.x * q.y - q.x * p.y; x += (p.x + q.x) * c; y += (p.y + q.y) * c; });
  return { x: x / (3 * a), y: y / (3 * a) };
}

/** Drops consecutive duplicates (also first = last); `[]` below 3 vertices or at area < 1e-9. */
function clean(poly: Vec2[]): Vec2[] {
  const out = poly.filter((p, i) => { const q = poly[(i + poly.length - 1) % poly.length]!; return Math.hypot(p.x - q.x, p.y - q.y) >= EPS; });
  return out.length < 3 || polyArea(out) < EPS ? [] : out;
}

/** Keeps `a·x + b·y ≤ c` of a polygon (Sutherland–Hodgman against one half-plane). */
export function clipHalf(poly: Vec2[], a: number, b: number, c: number): Vec2[] {
  const out: Vec2[] = [], f = (p: Vec2): number => a * p.x + b * p.y - c;
  poly.forEach((p, i) => {
    const q = poly[(i + 1) % poly.length]!, fp = f(p), fq = f(q);
    if (fp <= 0) out.push(p);
    if ((fp < 0 && fq > 0) || (fp > 0 && fq < 0)) { const t = fp / (fp - fq); out.push({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t }); }
  });
  return clean(out);
}

/** Clips `subject` to the convex `clip` (a non-convex `clip` is replaced by its hull). Either winding; keeps the subject's winding. */
export function clipConvex(subject: Vec2[], clip: Vec2[]): Vec2[] {
  const hull = convexHull(clip);
  if (hull.length < 3) return [];
  let out = subject;
  for (let i = 0; i < hull.length && out.length >= 3; i++) {
    const p = hull[i]!, q = hull[(i + 1) % hull.length]!;
    // convexHull is canonical (positive shoelace, y down): the inside is where cross(q − p, x − p) ≥ 0
    const dx = q.x - p.x, dy = q.y - p.y, a = dy, b = -dx;
    out = clipHalf(out, a, b, a * p.x + b * p.y);
  }
  return clean(out);
}

/** The rectangle clipped to a parcel polygon; the rectangle corners are in canonical order (north, east, south, west). */
export function clipToPoly(rect: Rect, poly: Vec2[]): Vec2[] {
  const { x, y, w, d } = rect;
  return clipConvex([{ x, y }, { x: x + w, y }, { x: x + w, y: y + d }, { x, y: y + d }], poly);
}

/**
 * Cuts `k` along both edges at every vertex whose two edges are longer than 3k and that is not nearly flat (T1).
 * `"oblique"` also leaves the near-right corners alone.
 */
export function chamferPoly(poly: Vec2[], k: number, corners: "all" | "oblique" = "all"): Vec2[] {
  if (k <= 0) return poly;
  const n = poly.length, out: Vec2[] = [];
  poly.forEach((v, i) => {
    const p = poly[(i + n - 1) % n]!, q = poly[(i + 1) % n]!;
    const l1 = Math.hypot(p.x - v.x, p.y - v.y), l2 = Math.hypot(q.x - v.x, q.y - v.y);
    if (l1 <= 3 * k || l2 <= 3 * k) { out.push(v); return; }
    const e1 = { x: (p.x - v.x) / l1, y: (p.y - v.y) / l1 }, e2 = { x: (q.x - v.x) / l2, y: (q.y - v.y) / l2 };
    const cos = e1.x * e2.x + e1.y * e2.y;
    if (cos < -FLAT_COS || (corners === "oblique" && Math.abs(cos) < RIGHT_COS)) { out.push(v); return; }
    out.push({ x: v.x + e1.x * k, y: v.y + e1.y * k }, { x: v.x + e2.x * k, y: v.y + e2.y * k });
  });
  return out;
}

/** Footprint of a lot: its rectangle (inset) clipped to `lot.poly` if any, then chamfered. Without `poly` the rectangle is the lot minus `inset`. */
export function polyFootprint(lot: Lot, inset: number, chamfer: number, corners: "all" | "oblique" = "all"): Vec2[] {
  const r = { x: lot.x + inset, y: lot.y + inset, w: lot.w - 2 * inset, d: lot.d - 2 * inset };
  const base = lot.poly ? clipToPoly(r, lot.poly) : [{ x: r.x, y: r.y }, { x: r.x + r.w, y: r.y }, { x: r.x + r.w, y: r.y + r.d }, { x: r.x, y: r.y + r.d }];
  return chamferPoly(base, chamfer, corners);
}

/** A body shape (rectangle or polygon) clipped to the lot footprint `fp` and with its own oblique corners chamfered 2; `null` below area 4. */
export function clipBody(subject: Rect | Vec2[], fp: Vec2[]): Vec2[] | null {
  const clipped = Array.isArray(subject) ? clipConvex(subject, fp) : clipToPoly(subject, fp), out = chamferPoly(clipped, 2, "oblique");
  return polyArea(out) < 4 ? null : out;
}

/** Miter limit of `polyCornice`: past this ratio (miter length / overhang) a vertex is bevelled, so an acute corner cannot shoot a spike out of the lot. */
const MITER_LIMIT = 1.6;

/** Interlocked `poly` cornice of body footprint `fp`, overhanging 0.5: like `offsetFootprint`, but a vertex whose miter exceeds `MITER_LIMIT` becomes two bevel vertices (a bevel of a convex corner stays convex). */
export function polyCornice(fp: Vec2[], z: number, mat: Material): Solid {
  const m = 0.5, s = area2(fp) > 0 ? 1 : -1, n = fp.length, footprint: Vec2[] = [];
  const normal = (a: Vec2, b: Vec2): Vec2 => { const l = Math.hypot(b.x - a.x, b.y - a.y); return { x: (s * (b.y - a.y)) / l, y: (s * (a.x - b.x)) / l }; };
  fp.forEach((p, i) => {
    const n1 = normal(fp[(i + n - 1) % n]!, p), n2 = normal(p, fp[(i + 1) % n]!), dot = n1.x * n2.x + n1.y * n2.y;
    if (1 / Math.sqrt((1 + dot) / 2) > MITER_LIMIT) footprint.push({ x: p.x + n1.x * m, y: p.y + n1.y * m }, { x: p.x + n2.x * m, y: p.y + n2.y * m });
    else { const k = m / (1 + dot); footprint.push({ x: p.x + (n1.x + n2.x) * k, y: p.y + (n1.y + n2.y) * k }); }
  });
  return interlock({ kind: "poly", footprint, z, h: CORNICE_H, mat });
}

/** Mesh between two same-length rings (`bottom` at z0, `top` at z1; `top` must have the same vertex count and winding as `bottom`): a top face and one quad per edge, outward-facing. */
export function frustum(bottom: Vec2[], top: Vec2[], z0: number, z1: number, mat: Material): Solid {
  const flip = area2(bottom) < 0, idx = bottom.map((_, i) => i);
  if (flip) idx.reverse(); // canonical order: positive shoelace
  const b = idx.map((i) => bottom[i]!), t = idx.map((i) => top[i]!), n = b.length;
  const faces: MeshFace[] = [{ pts: t.map((p) => v3(p.x, p.y, z1)) }];
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    faces.push({ pts: [v3(b[i]!.x, b[i]!.y, z0), v3(b[j]!.x, b[j]!.y, z0), v3(t[j]!.x, t[j]!.y, z1), v3(t[i]!.x, t[i]!.y, z1)] });
  }
  return { kind: "mesh", faces, mat };
}

/** Whether `pt` is inside `poly` or within `eps` of its boundary. */
export function insidePoly(poly: Vec2[], pt: Vec2, eps = 1e-6): boolean {
  let inside = false;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!, b = poly[(i + 1) % poly.length]!, dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy;
    const t = l2 < EPS ? 0 : Math.max(0, Math.min(1, ((pt.x - a.x) * dx + (pt.y - a.y) * dy) / l2));
    if (Math.hypot(pt.x - a.x - dx * t, pt.y - a.y - dy * t) <= eps) return true;
    if ((a.y > pt.y) !== (b.y > pt.y) && pt.x < a.x + ((pt.y - a.y) / dy) * dx) inside = !inside;
  }
  return inside;
}

/** `fp` offset inward by `m`, or `null` if it flips winding, has area < 4, leaves `fp` or stops being convex while `fp` is (a mitered short chamfer folds over); the tier is then skipped. */
export function insetPoly(fp: Vec2[], m: number): Vec2[] | null {
  const q = offsetFootprint(fp, -m);
  if (q.some((p) => !Number.isFinite(p.x + p.y)) || Math.sign(area2(q)) !== Math.sign(area2(fp)) || polyArea(q) < 4) return null;
  if (convexHull(fp).length === fp.length && convexHull(q).length !== q.length) return null;
  return q.every((p) => insidePoly(fp, p)) ? q : null;
}

const CUPOLA_H = 2.5 + 2 + 1.2, CUPOLA_R = 2, WING_T = 5;

/** Corner block: a ring of wings clipped to the parcel, stacked floors with trim slabs, and a copper-domed turret over the open corner (decision T4). */
export function cornerCupola(lot: Lot, rng: Rng, style: Style): Piece {
  const p = emptyPiece(), { z } = lot, fp = polyFootprint(lot, 0, 2.4);
  const turretH = recipeCap(lot) - CUPOLA_H, hr = 5.5 + 3 * rng.next(), roofed = turretH >= 3; // under one floor of body the turret is dropped
  const h = Math.min(hr, roofed ? turretH : recipeCap(lot)), floors = floorsFor(h, style), fh = h / floors;
  const { wings, patio } = ring(lot, WING_T, ["n", "s", "w", "e"]), built: Vec2[][] = [];
  for (const { rect } of wings) {
    const wing = clipToPoly(rect, fp), cols = rng.int(3, 4), f: Facade = { floors: 1, cols };
    if (wing.length < 3 || polyArea(wing) < 4) continue;
    built.push(wing);
    for (let k = 0; k < floors; k++) {
      const zk = z + k * fh;
      addBuilding(p, { kind: "poly", footprint: wing, z: zk, h: fh - 0.15, mat: style.mat, facade: f, tone: style.tone }, f);
      p.solids.push(interlock({ kind: "poly", footprint: offsetFootprint(wing, 0.25), z: zk + fh - 0.15, h: 0.15, mat: style.trim }));
    }
  }
  const corner = chamferCorner(lot.open), q = { x: corner[1] === "e" ? lot.x + lot.w : lot.x, y: corner[0] === "s" ? lot.y + lot.d : lot.y };
  const mid = polyCentroid(fp), len = Math.hypot(mid.x - q.x, mid.y - q.y), r2 = CUPOLA_R + 0.2;
  const onWings = (c: Vec2): boolean => Array.from({ length: 16 }, (_, i) => ({ x: c.x + CUPOLA_R * Math.cos((i * Math.PI) / 8), y: c.y + CUPOLA_R * Math.sin((i * Math.PI) / 8) })).every((pt) => built.some((w) => insidePoly(w, pt)));
  let c: Vec2 | null = null; // the turret stands only where its whole disk is over the wings
  for (let t = 0; roofed && len > 0 && t <= len && !c; t += 0.1) {
    const s = { x: q.x + ((mid.x - q.x) * t) / len, y: q.y + ((mid.y - q.y) * t) / len };
    if (onWings(s)) c = s;
  }
  if (roofed && !c) { // the walk met a wedge or the patio: the point of a 0.25 grid nearest to the corner
    const xs = fp.map((v) => v.x), ys = fp.map((v) => v.y);
    let best = Infinity;
    for (let x = Math.min(...xs); x <= Math.max(...xs); x += 0.25) for (let y = Math.min(...ys); y <= Math.max(...ys); y += 0.25) {
      const g = { x, y }, dd = Math.hypot(x - q.x, y - q.y);
      if (dd < best && onWings(g)) { best = dd; c = g; }
    }
  }
  const top = z + h;
  if (c) p.solids.push(
    { kind: "cylinder", at: v3(c.x, c.y, top), r: CUPOLA_R, h: 2.5, mat: style.mat },
    { kind: "dome", at: v3(c.x, c.y, top + 2.5), r: r2, h: 2, mat: "copper" },
    { kind: "cone", at: v3(c.x, c.y, top + 4.5), r: 0.3, h: 1.2, mat: style.trim },
  );
  p.courtyard = patio;
  return fitToCap(p, lot);
}

const DORMER = { along: 1.4, deep: 0.8, h: 1.6 };

/** Mansard block: 4..5 floors, cornice, a frustum roof inset 0.8 to 2, and 3 dormers on each south or east edge of 6 or more (decision T5). */
export function mansard(lot: Lot, rng: Rng, style: Style): Piece {
  const p = emptyPiece(), { z } = lot, floors = rng.int(4, 5);
  const fp = lot.poly ? clipConvex(polyFootprint(lot, 1, 2.4), polyFootprint(lot, 0, 2.4)) : polyFootprint(lot, 1, 2.4); // inset 1 would leave a short wedge edge's chamfer short of the lot-level cut
  if (fp.length < 3 || polyArea(fp) < 4) return p;
  const roofed = recipeCap(lot) - CORNICE_H - 2.2 >= 3, h = Math.min(floors * style.floorH, recipeCap(lot) - CORNICE_H - (roofed ? 2.2 : 0)), f: Facade = { floors: floorsFor(h, style), cols: 3 };
  addBuilding(p, { kind: "poly", footprint: fp, z, h, mat: style.mat, facade: f, tone: style.tone }, f);
  p.solids.push({ kind: "poly", footprint: offsetFootprint(fp, 0.4), z: z + h, h: CORNICE_H, mat: style.trim });
  const top = z + h + CORNICE_H, base = insetPoly(fp, 0.8), tip = insetPoly(fp, 2);
  if (!roofed || !base || !tip) return fitToCap(p, lot);
  p.solids.push(frustum(base, tip, top, top + 2.2, style.roof));
  const s = area2(fp) > 0 ? 1 : -1, d: Facade = { floors: 1, cols: 1 };
  fp.forEach((a, i) => {
    const b = fp[(i + 1) % fp.length]!, dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy);
    if (l < 6 || (dx !== 0 && dy !== 0)) return;
    const nx = (s * dy) / l, ny = (-s * dx) / l; // outward normal
    if (ny !== 1 && nx !== 1) return; // south or east only
    for (const t of [0.25, 0.5, 0.75]) {
      const cx = a.x + dx * t, cy = a.y + dy * t;
      const [w, dd] = ny === 1 ? [DORMER.along, DORMER.deep] : [DORMER.deep, DORMER.along];
      addBuilding(p, prism(ny === 1 ? cx - w / 2 : a.x - w, ny === 1 ? a.y - dd : cy - dd / 2, top, w, dd, DORMER.h, style.mat, { facade: d }), d);
    }
  });
  return fitToCap(p, lot);
}

export const PORTENO: readonly RecipeDef[] = [
  { name: "cornerCupola", recipe: cornerCupola, family: "porteno" },
  { name: "mansard", recipe: mansard, family: "porteno" },
];
