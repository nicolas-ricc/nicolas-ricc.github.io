import { BLEED, COVER_MARGIN, WORLD, inCoverQuad } from "../map/geo";
import type { Vec2 } from "../iso/geometry";
import type { Rect } from "./city-grid";

/**
 * Layout of Resume's west bank: street axes, plazas and the parcels the grid blocks leave once those are cut out.
 * Pure geometry (port of the study plan `plano.html`); `city-grid` imports this module, so no value import goes back.
 */

export const PITCH = 30, BLOCK = 24, STREET = 6;
/** Top-left corner of grid block (0, 0): blocks stand at `(13 + 30i, 21 + 30j)`. */
export const GRID_ORIGIN = { x: 13, y: 21 } as const;
/** The land ends north at y 164 and east at x 184 (the quay side). */
export const LAND = { y0: 164, x1: 184 } as const;
export const PLAZA_MAYOR: Rect = { x: 132, y: 206, w: 54, d: 85 };
export const PLAZA_CENTER: Vec2 = { x: 159, y: 248 };
export const HOTEL_LOT: Rect = { x: 73, y: 234, w: 54, d: 51 };
export const BRIDGE_LANDING: Rect = { x: 132, y: 207, w: 54, d: 10 };
export const TOWER_ISLAND: Rect = { x: 120, y: 219, w: 18, d: 16 };
export const CROSSING_PLAZA_R = 11;

export interface Bounds2 { x0: number; y0: number; x1: number; y1: number }
/** The city builds parcels inside these. `x0` is the literal of `CITY_EDGE.west` (a test guards it; importing it would close a cycle). */
export const CITY_BOUNDS: Bounds2 = { x0: -54, y0: LAND.y0, x1: LAND.x1, y1: 318 };
/** The whole cover width, to the southern avenue (y 318). */
export const PLAN_BOUNDS: Bounds2 = { x0: -Infinity, y0: LAND.y0, x1: LAND.x1, y1: 318 };

// ---------------------------------------------------------------- geometry

/** Keep `a x + b y <= c` (Sutherland–Hodgman against one half-plane). */
export function clipHalf(poly: readonly Vec2[], a: number, b: number, c: number): Vec2[] {
  const out: Vec2[] = [];
  for (let i = 0; i < poly.length; i++) {
    const P = poly[i]!, Q = poly[(i + 1) % poly.length]!;
    const fp = a * P.x + b * P.y - c, fq = a * Q.x + b * Q.y - c;
    if (fp <= 0) out.push(P);
    if ((fp < 0 && fq > 0) || (fp > 0 && fq < 0)) { const t = fp / (fp - fq); out.push({ x: P.x + t * (Q.x - P.x), y: P.y + t * (Q.y - P.y) }); }
  }
  return out;
}
/** `LAND` as half-planes `a x + b y <= c`: y >= 164, x <= 184. */
const LAND_HALVES: readonly (readonly [number, number, number])[] = [[0, -1, -LAND.y0], [1, 0, LAND.x1]];
const clipLand = (poly: readonly Vec2[]): Vec2[] => {
  let p = poly as Vec2[];
  for (const [a, b, c] of LAND_HALVES) { p = clipHalf(p, a, b, c); if (p.length < 3) return []; }
  return p;
};
export const polyArea = (p: readonly Vec2[]): number => {
  let s = 0;
  for (let i = 0; i < p.length; i++) { const a = p[i]!, b = p[(i + 1) % p.length]!; s += a.x * b.y - b.x * a.y; }
  return Math.abs(s) / 2;
};
export const polyPerimeter = (p: readonly Vec2[]): number => {
  let s = 0;
  for (let i = 0; i < p.length; i++) { const a = p[i]!, b = p[(i + 1) % p.length]!; s += Math.hypot(b.x - a.x, b.y - a.y); }
  return s;
};
/** Vertex average (not the area centroid). */
export const polyCentroid = (p: readonly Vec2[]): Vec2 => {
  let x = 0, y = 0;
  for (const q of p) { x += q.x; y += q.y; }
  return { x: x / p.length, y: y / p.length };
};
const bbox = (p: readonly Vec2[]) => {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const { x, y } of p) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  return { x0, y0, x1, y1 };
};
/** Bounding box of a polygon as a `Rect`. */
export const polyBox = (p: readonly Vec2[]): Rect => { const b = bbox(p); return { x: b.x0, y: b.y0, w: b.x1 - b.x0, d: b.y1 - b.y0 }; };
const overlap = (a: readonly Vec2[], b: readonly Vec2[]): boolean => {
  const A = bbox(a), B = bbox(b);
  return A.x0 < B.x1 && B.x0 < A.x1 && A.y0 < B.y1 && B.y0 < A.y1;
};
/** Half-plane `a x + b y <= c` of edge `i` of a convex polygon, on the side of `m` (an interior point). */
const halfOf = (conv: readonly Vec2[], i: number, m: Vec2): [number, number, number] => {
  const p = conv[i]!, q = conv[(i + 1) % conv.length]!;
  let a = q.y - p.y, b = -(q.x - p.x), c = a * p.x + b * p.y;
  if (a * m.x + b * m.y > c) { a = -a; b = -b; c = -c; }
  return [a, b, c];
};
/** `piece` minus the convex polygon `conv`: up to one convex piece per edge (slivers under 0.5 u² dropped). */
export function subtract(piece: Vec2[], conv: readonly Vec2[]): Vec2[][] {
  if (!overlap(piece, conv)) return [piece];
  const out: Vec2[][] = [], m = polyCentroid(conv);
  let rest = piece;
  for (let i = 0; i < conv.length; i++) {
    const [a, b, c] = halfOf(conv, i, m);
    const outside = clipHalf(rest, -a, -b, -c);
    if (outside.length >= 3 && polyArea(outside) > 0.5) out.push(outside);
    rest = clipHalf(rest, a, b, c);
    if (rest.length < 3 || polyArea(rest) < 0.01) break;
  }
  return out;
}
/** Area of `a` inside the convex polygon `b`. */
export function intersectionArea(a: Vec2[], b: Vec2[]): number {
  if (!overlap(a, b)) return 0;
  const m = polyCentroid(b);
  let rest = a;
  for (let i = 0; i < b.length && rest.length >= 3; i++) { const [p, q, c] = halfOf(b, i, m); rest = clipHalf(rest, p, q, c); }
  return rest.length < 3 ? 0 : polyArea(rest);
}
const rectPoly = (r: Rect): Vec2[] => [{ x: r.x, y: r.y }, { x: r.x + r.w, y: r.y }, { x: r.x + r.w, y: r.y + r.d }, { x: r.x, y: r.y + r.d }];
/** Rectangle of width `w` centered on the segment `p`–`q`. */
export function segRect(p: Vec2, q: Vec2, w: number): Vec2[] {
  const dx = q.x - p.x, dy = q.y - p.y, L = Math.hypot(dx, dy), nx = -dy / L * w / 2, ny = dx / L * w / 2;
  return [{ x: p.x + nx, y: p.y + ny }, { x: q.x + nx, y: q.y + ny }, { x: q.x - nx, y: q.y - ny }, { x: p.x - nx, y: p.y - ny }];
}
/** Regular polygon of `n` vertices, circumradius `r`, first vertex at angle `rot`. */
export function ngon(c: Vec2, r: number, n: number, rot = 0): Vec2[] {
  const out: Vec2[] = [];
  for (let i = 0; i < n; i++) { const a = rot + i * 2 * Math.PI / n; out.push({ x: c.x + r * Math.cos(a), y: c.y + r * Math.sin(a) }); }
  return out;
}
/** Cut the right-angled corners (`k` along each edge) where both edges are longer than `3k`. */
export function chamfer(p: readonly Vec2[], k: number): Vec2[] {
  const out: Vec2[] = [], n = p.length;
  for (let i = 0; i < n; i++) {
    const A = p[(i - 1 + n) % n]!, B = p[i]!, C = p[(i + 1) % n]!;
    const u = { x: A.x - B.x, y: A.y - B.y }, v = { x: C.x - B.x, y: C.y - B.y };
    const lu = Math.hypot(u.x, u.y), lv = Math.hypot(v.x, v.y);
    const cos = (u.x * v.x + u.y * v.y) / (lu * lv);
    if (lu > 3 * k && lv > 3 * k && Math.abs(cos) < 0.35) {
      out.push({ x: B.x + u.x / lu * k, y: B.y + u.y / lu * k });
      out.push({ x: B.x + v.x / lv * k, y: B.y + v.y / lv * k });
    } else out.push(B);
  }
  return out;
}
/** Segment `p1`–`p2` against `p3`–`p4`: the crossing point, or null when they are parallel or miss. */
export function segX(p1: Vec2, p2: Vec2, p3: Vec2, p4: Vec2): Vec2 | null {
  const d = (p2.x - p1.x) * (p4.y - p3.y) - (p2.y - p1.y) * (p4.x - p3.x);
  if (Math.abs(d) < 1e-9) return null;
  const t = ((p3.x - p1.x) * (p4.y - p3.y) - (p3.y - p1.y) * (p4.x - p3.x)) / d;
  const u = ((p3.x - p1.x) * (p2.y - p1.y) - (p3.y - p1.y) * (p2.x - p1.x)) / d;
  if (t < 0 || t > 1 || u < 0 || u > 1) return null;
  return { x: p1.x + t * (p2.x - p1.x), y: p1.y + t * (p2.y - p1.y) };
}
/** Liang–Barsky of the segment against `LAND`; the cover is the caller's business (it samples). */
export function clipSeg(p: Vec2, q: Vec2): [Vec2, Vec2] | null {
  let t0 = 0, t1 = 1;
  for (const [a, b, c] of LAND_HALVES) {
    const fp = a * p.x + b * p.y - c, fq = a * q.x + b * q.y - c;
    if (fp > 0 && fq > 0) return null;
    if (fp > 0) t0 = Math.max(t0, fp / (fp - fq));
    else if (fq > 0) t1 = Math.min(t1, fp / (fp - fq));
  }
  if (t1 <= t0) return null;
  const at = (t: number): Vec2 => ({ x: p.x + t * (q.x - p.x), y: p.y + t * (q.y - p.y) });
  return [at(t0), at(t1)];
}
/** Ray casting; a point within 1e-6 of the boundary counts as inside. */
export function pointInPoly(x: number, y: number, p: readonly Vec2[]): boolean {
  let inside = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const a = p[i]!, b = p[j]!;
    const dx = b.x - a.x, dy = b.y - a.y, L2 = dx * dx + dy * dy;
    const t = L2 === 0 ? 0 : Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / L2));
    if (Math.hypot(x - (a.x + t * dx), y - (a.y + t * dy)) <= 1e-6) return true;
    if ((a.y > y) !== (b.y > y) && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}
export const inRect = (r: Rect, x: number, y: number): boolean => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.d;
/** Strictly inside (the border does not count). */
const strictlyInRect = (r: Rect, x: number, y: number): boolean => x > r.x && x < r.x + r.w && y > r.y && y < r.y + r.d;

// ---------------------------------------------------------------- axes

export type AxisKind = "costanera" | "avenue" | "diagonal" | "boulevard";
export interface Axis { id: string; name: string; from: Vec2; to: Vec2; w: number; kind: AxisKind }
/** The street axes that cut the grid, in drawing order. */
export const AXES: readonly Axis[] = [
  { id: "costanera", name: "Costanera", from: { x: 188, y: 160 }, to: { x: 188, y: 480 }, w: 8, kind: "costanera" },
  { id: "plaza", name: "Avenida de la Plaza", from: { x: 132, y: 228 }, to: { x: -440, y: 228 }, w: 12, kind: "avenue" },
  { id: "diagonalNorte", name: "Diagonal Norte", from: { x: 132, y: 210 }, to: { x: -14, y: 169 }, w: 10, kind: "diagonal" },
  { id: "diagonalSur", name: "Diagonal Sur", from: { x: 132, y: 291 }, to: { x: -420, y: 522 }, w: 10, kind: "diagonal" },
  { id: "bulevar", name: "Bulevar Central", from: { x: 10, y: 160 }, to: { x: 10, y: 480 }, w: 20, kind: "boulevard" },
  { id: "vias", name: "Avenida de las Vías", from: { x: 184, y: 169 }, to: { x: -440, y: 169 }, w: 10, kind: "avenue" },
  { id: "sur", name: "Avenida del Sur", from: { x: 184, y: 318 }, to: { x: -440, y: 318 }, w: 10, kind: "avenue" },
  { id: "barrio", name: "Avenida del Barrio", from: { x: 184, y: 378 }, to: { x: -440, y: 378 }, w: 10, kind: "avenue" },
];
export const axis = (id: string): Axis => {
  const a = AXES.find((x) => x.id === id);
  if (!a) throw new Error(`unknown axis: ${id}`);
  return a;
};
const bands = AXES.map((a) => segRect(a.from, a.to, a.w));
export const axisBand = (a: Axis): Vec2[] => segRect(a.from, a.to, a.w);
export const onAxis = (x: number, y: number): boolean => bands.some((b) => pointInPoly(x, y, b));

let plazasMemo: Vec2[][] | null = null;
/** Octagonal plazas where a diagonal crosses an avenue or the boulevard, inside the land and the plain cover (margin 0), clear of the Plaza Mayor and of each other. */
export function crossingPlazas(): Vec2[][] {
  if (plazasMemo) return plazasMemo;
  const centers: Vec2[] = [];
  for (const d of AXES) if (d.kind === "diagonal") for (const o of AXES) if (o.kind === "avenue" || o.kind === "boulevard") {
    const c = segX(d.from, d.to, o.from, o.to);
    if (!c || c.y < LAND.y0 || c.x > LAND.x1 || !inCoverQuad(c.x, c.y, 16 / 9)) continue;
    if (Math.hypot(c.x - PLAZA_CENTER.x, c.y - PLAZA_CENTER.y) <= 50) continue;
    if (centers.some((k) => Math.hypot(k.x - c.x, k.y - c.y) <= 26)) continue;
    centers.push(c);
  }
  return (plazasMemo = centers.map((c) => ngon(c, CROSSING_PLAZA_R, 8, Math.PI / 8)));
}
export const inCrossingPlaza = (x: number, y: number): boolean => crossingPlazas().some((p) => pointInPoly(x, y, p));
export const inPlazaMayor = (x: number, y: number): boolean => inRect(PLAZA_MAYOR, x, y);

// ---------------------------------------------------------------- barrios

export type Barrio = "clasico" | "transicion" | "moderno" | "bajo" | "residencial";
/** Barrio by distance to the Plaza Mayor, then by the south bands. */
export function barrioAt(c: Vec2): Barrio {
  const d = Math.hypot(c.x - PLAZA_CENTER.x, c.y - PLAZA_CENTER.y);
  let b: Barrio = d < 105 ? "clasico" : d < 205 ? "transicion" : "moderno";
  if (c.y > 318) b = "bajo";
  if (c.y > 380) b = "residencial";
  if (b === "moderno" && c.y > 290) b = "transicion";
  return b;
}

// ---------------------------------------------------------------- parcels

export interface Parcel { poly: Vec2[]; c: Vec2; area: number; d: number; barrio: Barrio; cell: { col: number; row: number }; rect: Rect }

/** Largest axis-aligned rectangle (1 u lattice of the box, plus its exact edges) whose corners and edge midpoints lie in `poly`. */
export function inscribedRect(poly: readonly Vec2[]): Rect {
  const b = bbox(poly), ticks = (lo: number, hi: number): number[] => {
    const t: number[] = [];
    for (let v = Math.ceil(lo); v <= Math.floor(hi); v++) t.push(v);
    t.push(lo, hi);
    return t;
  };
  const xs = ticks(b.x0, b.x1), ys = ticks(b.y0, b.y1);
  const ok = (x: number, y: number) => pointInPoly(x, y, poly);
  let best: Rect = { x: b.x0, y: b.y0, w: 0, d: 0 }, bestA = 0;
  for (const x0 of xs) for (const x1 of xs) if (x1 > x0) for (const y0 of ys) for (const y1 of ys) if (y1 > y0) {
    const A = (x1 - x0) * (y1 - y0);
    if (A <= bestA) continue;
    const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
    if (ok(x0, y0) && ok(x1, y0) && ok(x1, y1) && ok(x0, y1) && ok(mx, y0) && ok(mx, y1) && ok(x0, my) && ok(x1, my)) { bestA = A; best = { x: x0, y: y0, w: x1 - x0, d: y1 - y0 }; }
  }
  return best;
}

const parcelMemo = new Map<string, Parcel[]>();
const passes = (p: readonly Vec2[], area: number): boolean => {
  if (area < 70 || (2 * area) / polyPerimeter(p) < 3.4) return false;
  const b = bbox(p);
  return Math.min(b.x1 - b.x0, b.y1 - b.y0) >= 9;
};
/** Grid blocks (center in `bounds`) minus axes, Plaza Mayor, crossing plazas and the tower island; the pieces that pass the filter. Memoized per bounds. */
export function parcels(bounds: Bounds2): Parcel[] {
  const key = `${bounds.x0},${bounds.y0},${bounds.x1},${bounds.y1}`;
  const hit = parcelMemo.get(key);
  if (hit) return hit;
  const holes = [...bands, rectPoly(PLAZA_MAYOR), ...crossingPlazas(), rectPoly(TOWER_ISLAND)];
  const out: Parcel[] = [];
  let hotel = false;
  const j0 = Math.floor((bounds.y0 - BLOCK / 2 - GRID_ORIGIN.y) / PITCH), j1 = Math.ceil((bounds.y1 - BLOCK / 2 - GRID_ORIGIN.y) / PITCH);
  const i0 = Number.isFinite(bounds.x0) ? Math.floor((bounds.x0 - BLOCK / 2 - GRID_ORIGIN.x) / PITCH) : Math.floor((WORLD.x0 - BLEED.x - GRID_ORIGIN.x) / PITCH) /* no cover point lies west of the bleed */;
  const i1 = Math.ceil((bounds.x1 - BLOCK / 2 - GRID_ORIGIN.x) / PITCH);
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const col = GRID_ORIGIN.x + PITCH * i, row = GRID_ORIGIN.y + PITCH * j, cx = col + BLOCK / 2, cy = row + BLOCK / 2;
    if (cx < bounds.x0 || cx > bounds.x1 || cy < bounds.y0 || cy > bounds.y1) continue;
    const land = clipLand(rectPoly({ x: col, y: row, w: BLOCK, d: BLOCK }));
    if (land.length < 3) continue;
    let pieces = [land];
    for (const h of holes) { pieces = pieces.flatMap((p) => subtract(p, h)); if (!pieces.length) break; }
    for (const poly of pieces) {
      const area = polyArea(poly);
      if (!passes(poly, area)) continue;
      const c = polyCentroid(poly);
      if (!inCoverQuad(c.x, c.y, 16 / 9, COVER_MARGIN)) continue;
      if (strictlyInRect(HOTEL_LOT, c.x, c.y)) {
        if (!hotel) {
          hotel = true;
          const hc = { x: HOTEL_LOT.x + HOTEL_LOT.w / 2, y: HOTEL_LOT.y + HOTEL_LOT.d / 2 };
          out.push({ poly: rectPoly(HOTEL_LOT), c: hc, area: HOTEL_LOT.w * HOTEL_LOT.d, d: Math.hypot(hc.x - PLAZA_CENTER.x, hc.y - PLAZA_CENTER.y), barrio: barrioAt(hc), cell: { col: 73, row: 231 }, rect: { ...HOTEL_LOT } });
        }
        continue;
      }
      out.push({ poly, c, area, d: Math.hypot(c.x - PLAZA_CENTER.x, c.y - PLAZA_CENTER.y), barrio: barrioAt(c), cell: { col, row }, rect: inscribedRect(poly) });
    }
  }
  out.sort((a, b) => a.cell.row - b.cell.row || a.cell.col - b.cell.col);
  parcelMemo.set(key, out);
  return out;
}
/** The point lies inside a parcel polygon (default: those of `CITY_BOUNDS`). */
export const inParcel = (x: number, y: number, ps: readonly Parcel[] = parcels(CITY_BOUNDS)): boolean => ps.some((p) => pointInPoly(x, y, p.poly));
