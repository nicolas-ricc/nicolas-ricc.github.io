import { convexHull, v3, type Vec2 } from "../../iso/geometry";
import type { MeshFace, Solid } from "../../iso/solids";
import type { Material } from "../../map/palette-iso";
import type { Rect } from "../../scenes/city-grid";
import { offsetFootprint } from "../roofs";
import type { Lot } from "../types";

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
