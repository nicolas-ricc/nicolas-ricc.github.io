import type { Vec2 } from "../iso/geometry";
import { inBuildRegion } from "../map/geo";
import { BRIDGE, QUAY_TERRACES, WEST_QUAY, inCrater, type Rect } from "../scenes/city-grid";
import { AXES, BLOCK, CITY_BOUNDS, GRID_ORIGIN, HOTEL_LOT, LAND, PITCH, PLAZA_MAYOR, STREET, type Axis, axisBand, clipSeg, inCrossingPlaza, onAxis, pointInPoly, segX } from "../scenes/city-plan";

/** Axes × axes and axes × ordinary streets: where the crossings and the zebra crosswalks of the west bank go (#473). */

/** The city's domain: north of its south edge, inside the build region (the cover plus the pan reach strip, #496): it is the only west bound (#479). */
// 1e-9: a centroid computed on the south edge (the crossing plaza at y 348) lands a few ulps past it
export const inDomain = (p: Vec2): boolean => p.y <= CITY_BOUNDS.y1 + 1e-9 && inBuildRegion(p.x, p.y);

const strictlyIn = (r: Rect, p: Vec2): boolean => p.x > r.x && p.x < r.x + r.w && p.y > r.y && p.y < r.y + r.d;

const spans = new Map<string, readonly [Vec2, Vec2] | null>();
/** The axis center segment in the city: inside `LAND` (the costanera clipped on y only, at its own x) and cut exactly at y = 348 (`CITY_BOUNDS.y1`) (its west end is the cover's: `inDomain` decides). */
export function axisSpan(a: Axis): readonly [Vec2, Vec2] | null {
  const hit = spans.get(a.id);
  if (hit !== undefined) return hit;
  let span: readonly [Vec2, Vec2] | null = null;
  // deliberate: the costanera runs at x 188, east of LAND.x1, so clipSeg drops it; it is clipped on y along LAND.x1 and taken back to its own x
  const seg = clipSeg(a.from, a.to) ?? (a.kind === "costanera" ? clipSeg({ x: LAND.x1, y: a.from.y }, { x: LAND.x1, y: a.to.y }) : null);
  if (seg) {
    const [p, q] = a.kind === "costanera" ? [{ x: a.from.x, y: seg[0].y }, { x: a.from.x, y: seg[1].y }] : seg;
    let t0 = 0, t1 = 1;
    // half-plane a·x + b·y <= c: y <= south
    for (const [h, k, c] of [[0, 1, CITY_BOUNDS.y1]] as const) {
      const fp = h * p.x + k * p.y - c, fq = h * q.x + k * q.y - c;
      if (fp > 0 && fq > 0) { t1 = t0; break; }
      if (fp > 0) t0 = Math.max(t0, fp / (fp - fq));
      else if (fq > 0) t1 = Math.min(t1, fp / (fp - fq));
    }
    if (t1 > t0) {
      const at = (t: number): Vec2 => ({ x: p.x + t * (q.x - p.x), y: p.y + t * (q.y - p.y) });
      span = [at(t0), at(t1)];
    }
  }
  spans.set(a.id, span);
  return span;
}

/** The build region's west edge on row y, or null if the row misses it: the region is convex, so the first inside sample is bracketed and bisected. */
export function domainWest(y: number): number | null {
  const inside = (x: number): boolean => inBuildRegion(x, y);
  for (let x = -2000; x <= LAND.x1; x += 4) {
    if (!inside(x)) continue;
    let out = x - 4, inn = x;
    for (let i = 0; i < 40; i++) { const m = (out + inn) / 2; if (inside(m)) inn = m; else out = m; }
    return inn;
  }
  return null;
}
/** Some point of the column x on y in [LAND.y0, CITY_BOUNDS.y1] is inside the build region. */
const columnInDomain = (x: number): boolean => { for (let y = LAND.y0; y <= CITY_BOUNDS.y1; y++) if (inBuildRegion(x, y)) return true; return false; };

/** Ordinary street centers, by the rule `gridLines` follows: those that run along an axis are the axis. */
function ordinary(horizontal: boolean): number[] {
  const along = (c: number): boolean => AXES.some((a) => (horizontal ? a.from.y === a.to.y : a.from.x === a.to.x) && Math.abs((horizontal ? a.from.y : a.from.x) - c) < a.w / 2);
  const out: number[] = [];
  for (let k = -20; k < 10; k++) {
    const c = horizontal ? GRID_ORIGIN.y + BLOCK + STREET / 2 + PITCH * k : GRID_ORIGIN.x + BLOCK + STREET / 2 + PITCH * k;
    if (horizontal ? c > LAND.y0 && c < CITY_BOUNDS.y1 : c < LAND.x1 && columnInDomain(c)) if (!along(c)) out.push(c);
  }
  return out;
}
export const ORDINARY_X: readonly number[] = ordinary(false);
export const ORDINARY_Y: readonly number[] = ordinary(true);

/** Strict interior of the plaza and the hotel lot; crossing plazas and craters. */
export const blocked = (p: Vec2): boolean =>
  strictlyIn(PLAZA_MAYOR, p) || strictlyIn(HOTEL_LOT, p) || inCrossingPlaza(p.x, p.y) || inCrater(p.x, p.y);

/** On an ordinary street's band (width 6, widened by `pad`) and not on an axis. */
export function onOrdinaryStreet(p: Vec2, pad = 0): boolean {
  const h = STREET / 2 + pad;
  const x = LAND.y0 <= p.y && p.y <= CITY_BOUNDS.y1 && ORDINARY_X.some((c) => Math.abs(p.x - c) < h);
  const y = p.x <= LAND.x1 && inBuildRegion(p.x, p.y) && ORDINARY_Y.some((c) => Math.abs(p.y - c) < h);
  return (x || y) && !onAxis(p.x, p.y);
}

const bandOf = new Map(AXES.map((a) => [a.id, axisBand(a)]));
const inForeignBand = (a: Axis, p: Vec2): boolean => AXES.some((o) => o !== a && pointInPoly(p.x, p.y, bandOf.get(o.id)!));
const underBridge = (p: Vec2): boolean => p.x >= BRIDGE.x0 - STREET && BRIDGE.y0 <= p.y && p.y <= BRIDGE.y1;

/** The point is on the axis's own ground: not blocked, not in another axis's band, on land, not under the bridge, off the quay terraces (costanera). */
export const axisFree = (a: Axis, p: Vec2): boolean =>
  !blocked(p) && !inForeignBand(a, p) && p.y >= LAND.y0 && p.x <= (a.kind === "costanera" ? WEST_QUAY.x0 : LAND.x1) && !underBridge(p) && !(a.kind === "costanera" && strictlyIn(QUAY_TERRACES, p));

export interface Crossing { a: Axis; other: Axis | null; otherId: string; at: Vec2; half: number }

interface Line { id: string; axis: Axis | null; from: Vec2; to: Vec2; w: number }
export const unit = (p: Vec2, q: Vec2): Vec2 => { const L = Math.hypot(q.x - p.x, q.y - p.y); return { x: (q.x - p.x) / L, y: (q.y - p.y) / L }; };
const extend = (p: Vec2, q: Vec2, e: number): [Vec2, Vec2] => { const u = unit(p, q); return [{ x: p.x - u.x * e, y: p.y - u.y * e }, { x: q.x + u.x * e, y: q.y + u.y * e }]; };

let crossingsMemo: readonly Crossing[] | null = null;
/** One entry per (axis, other line): an axis × axis crossing appears twice. */
export function crossings(): readonly Crossing[] {
  if (crossingsMemo) return crossingsMemo;
  const lines: Line[] = [
    ...AXES.map((a): Line => ({ id: a.id, axis: a, from: a.from, to: a.to, w: a.w })),
    ...ORDINARY_X.map((x): Line => ({ id: `x${x}`, axis: null, from: { x, y: LAND.y0 }, to: { x, y: CITY_BOUNDS.y1 }, w: STREET })),
    ...ORDINARY_Y.map((y): Line => ({ id: `y${y}`, axis: null, from: { x: domainWest(y) ?? LAND.x1, y }, to: { x: LAND.x1, y }, w: STREET })),
  ];
  const out: Crossing[] = [];
  for (const a of AXES) {
    const span = axisSpan(a);
    if (!span) continue;
    const ua = unit(a.from, a.to);
    for (const o of lines) {
      if (o.id === a.id) continue;
      const [o0, o1] = extend(o.from, o.to, a.w / 2), [s0, s1] = extend(span[0], span[1], o.w / 2);
      const at = segX(s0, s1, o0, o1);
      if (!at || blocked(at) || !inDomain(at)) continue;
      const uo = unit(o.from, o.to), sin = Math.abs(ua.x * uo.y - ua.y * uo.x);
      if (sin < 0.1) continue;
      if (!o.axis) {
        const reach = a.w / 2 / sin + 1.5, len = Math.hypot(o.to.x - o.from.x, o.to.y - o.from.y);
        const reaches = [1, -1].some((sg) => {
          const p = { x: at.x + sg * uo.x * reach, y: at.y + sg * uo.y * reach }, t = (p.x - o.from.x) * uo.x + (p.y - o.from.y) * uo.y;
          return t >= -1e-9 && t <= len + 1e-9 && p.y >= LAND.y0 && p.x <= LAND.x1 && inDomain(p) && !blocked(p) && !onAxis(p.x, p.y);
        });
        if (!reaches) continue;
      }
      out.push({ a, other: o.axis, otherId: o.id, at, half: o.w / 2 / sin });
    }
  }
  return (crossingsMemo = out);
}

export interface Crosswalk { a: Axis; at: Vec2; strips: readonly (readonly [Vec2, Vec2])[] }

let crosswalksMemo: readonly Crosswalk[] | null = null;
/** One crosswalk per crossing where a side is free: three strips across the axis, 1.6 apart, on the side toward `a.from` or else the other. */
export function crosswalks(): readonly Crosswalk[] {
  if (crosswalksMemo) return crosswalksMemo;
  const out: Crosswalk[] = [];
  for (const c of crossings()) {
    const a = c.a, u = unit(a.from, a.to), n = { x: -u.y, y: u.x };
    for (const sg of [-1, 1]) {
      const d = c.half + 1 + 2, m = { x: c.at.x + sg * d * u.x, y: c.at.y + sg * d * u.y };
      if (!inDomain(m) || out.some((w) => w.a === a && Math.hypot(w.at.x - m.x, w.at.y - m.y) < 4)) continue;
      const strips = [-1.6, 0, 1.6].map((o): readonly [Vec2, Vec2] => {
        const q = { x: m.x + o * u.x, y: m.y + o * u.y };
        return [{ x: q.x - n.x * a.w / 2, y: q.y - n.y * a.w / 2 }, { x: q.x + n.x * a.w / 2, y: q.y + n.y * a.w / 2 }];
      });
      const pts = strips.flatMap(([p, q]) => [p, { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 }, q]).flatMap((p) => [0.4, -0.4].map((e) => ({ x: p.x + e * u.x, y: p.y + e * u.y })));
      if (pts.every((p) => axisFree(a, p))) { out.push({ a, at: m, strips }); break; }
    }
  }
  return (crosswalksMemo = out);
}
