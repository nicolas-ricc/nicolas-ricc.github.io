import { v3, type Vec2 } from "../iso/geometry";
import type { Solid } from "../iso/solids";
import { streetTree, trafficLight } from "../kit/props";
import { PLINTH_H, prism } from "../scenes/city-pieces";
import { AXES, axisBand, crossingPlazas, polyCentroid, pointInPoly, segX, type Axis, type Bounds2 } from "../scenes/city-plan";

/**
 * The street language of the axes (D13, story #471), parametrized by `bounds`: the city and the south of the map share it.
 * A point is painted only where `stop` is false and it lies inside `bounds`. No dependency on zoning or on `streets.ts`.
 */

/** True where nothing may be painted (water, outside the cover, ...). */
export type Stop = (x: number, y: number) => boolean;

const DASH = 5, GAP = 5;
const SAMPLE = 0.5;
const LAMP_EVERY = 12, LAMP_INSET = 0.7;
const TREE_EVERY = 8;
const strip = (path: Vec2[], width: number, mat: "paving"): Solid => ({ kind: "strip", path, width, z: 0.02, mat });

/** The axes that get street furniture: the costanera south of 324 is the waterfront's promenade, unchanged. */
const furnished = (): Axis[] => AXES.filter((a) => a.kind !== "costanera");
const unit = (a: Axis): { ux: number; uy: number; len: number } => {
  const dx = a.to.x - a.from.x, dy = a.to.y - a.from.y, len = Math.hypot(dx, dy);
  return { ux: dx / len, uy: dy / len, len };
};
const inBounds = (b: Bounds2, x: number, y: number, m = 0): boolean => x >= b.x0 + m && x <= b.x1 - m && y >= b.y0 + m && y <= b.y1 - m;
const onOtherBand = (a: Axis, x: number, y: number): boolean => AXES.some((o) => o !== a && pointInPoly(x, y, axisBand(o)));
const inAnyPlaza = (x: number, y: number): boolean => crossingPlazas().some((p) => pointInPoly(x, y, p));

/** Dashed lane (5 / 5, width 0.4) on each carriageway of the avenues and diagonals; the boulevard's lanes sit beside its planter. */
export function axisLanes(ground: Solid[], bounds: Bounds2, stop: Stop): void {
  for (const a of furnished()) {
    const { ux, uy, len } = unit(a), nx = -uy, ny = ux;
    const off = a.kind === "boulevard" ? 2 + (a.w / 2 - 2) / 2 : a.w / 4;
    const bad = (x: number, y: number): boolean => !inBounds(bounds, x, y, 0.2) || stop(x, y) || inAnyPlaza(x, y) || onOtherBand(a, x, y);
    for (const side of [-1, 1]) {
      const ox = a.from.x + nx * off * side, oy = a.from.y + ny * off * side;
      for (let s = 0; s + DASH <= len; s += DASH + GAP) {
        const p0 = { x: ox + ux * s, y: oy + uy * s }, p1 = { x: ox + ux * (s + DASH), y: oy + uy * (s + DASH) };
        if (bad(p0.x, p0.y) || bad(p1.x, p1.y)) continue;
        ground.push(strip([p0, p1], 0.4, "paving"));
      }
    }
  }
}

/** Planter of the boulevard (4 wide, 0.3 high, on its center line) cut 1 u short of other bands and plazas, with a tree every 8. */
export function boulevardPlanter(solids: Solid[], bounds: Bounds2, stop: Stop): void {
  for (const a of furnished()) {
    if (a.kind !== "boulevard") continue;
    const { ux, uy, len } = unit(a);
    const at = (s: number): Vec2 => ({ x: a.from.x + ux * s, y: a.from.y + uy * s });
    const blocked = (s: number): boolean => {
      const c = at(s);
      if (!inBounds(bounds, c.x, c.y) || stop(c.x, c.y)) return true;
      for (const k of [-1, 0, 1]) for (const e of [-2, 2]) {
        const x = c.x + e, y = c.y + uy * k; // the boulevard runs N–S: its planter's two long edges, 1 u either side
        if (onOtherBand(a, x, y) || inAnyPlaza(x, y)) return true;
      }
      return false;
    };
    const runs: [number, number][] = [];
    let start: number | undefined, last = 0;
    const flush = (): void => { if (start !== undefined && last - start >= 1) runs.push([start, last]); start = undefined; };
    for (let i = 0; ; i++) {
      const s = Math.min(i * SAMPLE, len);
      if (blocked(s)) flush(); else { start ??= s; last = s; }
      if (s === len) break;
    }
    flush();
    for (const [s0, s1] of runs) {
      const p = at(s0), q = at(s1);
      solids.push(prism(a.from.x - 2, Math.min(p.y, q.y), 0, 4, Math.abs(q.y - p.y), 0.3, "leafDark"));
    }
    for (let s = TREE_EVERY / 2; s <= len; s += TREE_EVERY) {
      if (runs.some(([s0, s1]) => s - 1.5 >= s0 && s + 1.5 <= s1)) solids.push(...streetTree(v3(at(s).x, at(s).y, 0.3)));
    }
  }
}

/** Where two axes cross inside `bounds` (a crossing on the south edge belongs to the bounds beyond it), outside the crossing plazas. */
export function axisCrossings(bounds: Bounds2, stop: Stop): Vec2[] {
  const out: Vec2[] = [], as = furnished();
  for (let i = 0; i < as.length; i++) for (let j = i + 1; j < as.length; j++) {
    const c = segX(as[i]!.from, as[i]!.to, as[j]!.from, as[j]!.to);
    if (!c || c.x < bounds.x0 || c.x > bounds.x1 || c.y <= bounds.y0 + 1e-6 || c.y > bounds.y1) continue;
    if (inAnyPlaza(c.x, c.y) || stop(c.x, c.y)) continue;
    out.push(c);
  }
  return out;
}

/** Crosswalks across each axis on both sides of every crossing (3 strips of 0.8, 1.6 apart) and two traffic lights (off) at opposite corners. */
export function axisCrosswalks(ground: Solid[], solids: Solid[], bounds: Bounds2, stop: Stop): void {
  const ok = (x: number, y: number): boolean => inBounds(bounds, x, y) && !stop(x, y);
  const as = furnished();
  for (const c of axisCrossings(bounds, stop)) {
    const here = as.filter((a) => pointInPoly(c.x, c.y, axisBand(a)));
    for (const a of here) for (const o of here) {
      if (a === o) continue;
      const { ux, uy } = unit(a), nx = -uy, ny = ux, ou = unit(o);
      // the strips must clear the other band whatever the angle: the nearest strip's whole length stays beyond its edge
      const sin = Math.abs(ux * -ou.uy + uy * ou.ux), cos = Math.abs(ux * ou.ux + uy * ou.uy);
      const inner = (o.w / 2 + 0.5 + (a.w / 2) * cos) / sin + 0.4;
      for (const side of [-1, 1]) for (const k of [0, 1, 2]) {
        const d = inner + 1.6 * k, mx = c.x + ux * d * side, my = c.y + uy * d * side;
        if (!pointInPoly(mx, my, axisBand(a))) continue;
        const p0 = { x: mx - nx * a.w / 2, y: my - ny * a.w / 2 }, p1 = { x: mx + nx * a.w / 2, y: my + ny * a.w / 2 };
        if ([{ x: mx, y: my }, p0, p1].every((q) => ok(q.x, q.y) && !onOtherBand(a, q.x, q.y))) ground.push(strip([p0, p1], 0.8, "paving"));
      }
    }
    const [a, b] = here;
    if (!a || !b) continue;
    const A = unit(a), B = unit(b);
    const nA = { x: -A.uy, y: A.ux }, nB = { x: -B.uy, y: B.ux };
    const uBnA = B.ux * nA.x + B.uy * nA.y, uAnB = A.ux * nB.x + A.uy * nB.y;
    if (Math.abs(uBnA) < 1e-6 || Math.abs(uAnB) < 1e-6) continue;
    for (const sg of [-1, 1]) {
      const tA = sg * (a.w / 2 + 0.8), tB = sg * (b.w / 2 + 0.8);
      const al = tB / uAnB, be = tA / uBnA;
      const x = c.x + al * A.ux + be * B.ux, y = c.y + al * A.uy + be * B.uy;
      if (ok(x, y)) solids.push(...trafficLight(v3(x, y, 0)));
    }
  }
}

/** Lamp posts every 12 at the curb inside the band (0.7 from its edge, on asphalt, z 0): north side of E–W axes and diagonals, west side of N–S axes. */
export function axisLampSpots(bounds: Bounds2, stop: Stop): Vec2[] {
  const out: Vec2[] = [];
  for (const a of furnished()) {
    const { ux, uy, len } = unit(a);
    let nx = -uy, ny = ux;
    if (a.kind === "boulevard" ? nx > 0 : ny > 0) { nx = -nx; ny = -ny; }
    const k = a.w / 2 - LAMP_INSET;
    for (let s = LAMP_EVERY / 2; s <= len; s += LAMP_EVERY) {
      const x = a.from.x + ux * s + nx * k, y = a.from.y + uy * s + ny * k;
      if (!inBounds(bounds, x, y) || stop(x, y) || inAnyPlaza(x, y) || onOtherBand(a, x, y)) continue;
      out.push({ x, y });
    }
  }
  return out;
}

/** Crossing plaza: `plaza` tile inside the octagon inset 1.2, curb ring of 8 quads of paving. Returns the center, where the lamp stands. */
export function crossingPlaza(ground: Solid[], solids: Solid[], plaza: Vec2[]): Vec2 {
  const c = polyCentroid(plaza), n = plaza.length;
  const apothem = Math.hypot((plaza[0]!.x + plaza[1]!.x) / 2 - c.x, (plaza[0]!.y + plaza[1]!.y) / 2 - c.y);
  const k = (apothem - 1.2) / apothem;
  const inner = plaza.map((p) => ({ x: c.x + (p.x - c.x) * k, y: c.y + (p.y - c.y) * k }));
  ground.push({ kind: "poly", footprint: inner, z: 0, h: 0.05, mat: "plaza" });
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    solids.push({ kind: "poly", footprint: [plaza[i]!, plaza[j]!, inner[j]!, inner[i]!], z: 0, h: PLINTH_H, mat: "paving" });
  }
  return c;
}
