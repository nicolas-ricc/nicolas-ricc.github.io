import { v3, type Vec2 } from "../iso/geometry";
import { bounds, type Solid } from "../iso/solids";
import type { Material } from "../map/palette-iso";
import { ESTUARY_Y0, STATION_LAND, eastBank } from "../map/geo";
import { CROSSING_GAP } from "./rail-lands";
import { AVENUE, BLOCK_W, BOULEVARD, CITY_EDGE, DISTRICT_BANK_Y, DISTRICT_ROW_Y, EAST_COLS, EAST_RING, HARBOR, PROMENADE, QUAY_TERRACES, RING_Y0, ROWS, SIDEWALK, STREET, WEST_COLS, WEST_QUAY, estuaryEast, estuaryReaches, inBlock, inCrater } from "../scenes/city-grid";
import { lamp, streetTree, trafficLight } from "../kit/props";
import { placeLit, type FixedLight } from "./lights";
import { PLINTH_H, TILE, plazaTone, prism } from "../scenes/city-pieces";
import { createRng, type Rng } from "../map/seed";
import { WEST_DISTRICT_X, builtParcels, neighborhoodOfParcel } from "./zoning";
import { AXES, type Axis, CITY_BOUNDS, HOTEL_LOT, LAND, axis, axisBand, clipHalf, crossingPlazas, inCrossingPlaza, inParcel, inPlazaMayor, inRect, onAxis, polyCentroid } from "../scenes/city-plan";
import { ORDINARY_X, ORDINARY_Y, axisFree, axisSpan, blocked, coverWest, crossings, crosswalks, inDomain, onOrdinaryStreet, unit } from "./crossings";

/**
 * Resume streets: lanes, avenue with dashed lanes and crosswalks,
 * tree-lined boulevard and avenue furniture.
 * Spec: docs/superpowers/specs/2026-10-15-resume-nivel-2-kit-zonificacion-luces-design.md §6 "Calles".
 */

const strip = (path: Vec2[], width: number, mat: Material): Solid => ({ kind: "strip", path, width, z: 0.02, mat });

const DASH = 5, GAP = 5; // 4/4 put too many strips in the scene (the city caps them in city-budget.test.ts)

/**
 * Dashed lane (dash 5, gap 5) along a N-S street (fixed x) or
 * E-W (fixed y). A dash with either of its two ends inside a crater
 * is not painted: the ground is drawn on top of the pit.
 */
function dashes(out: Solid[], from: Vec2, to: Vec2): void {
  const len = Math.hypot(to.x - from.x, to.y - from.y), ux = (to.x - from.x) / len, uy = (to.y - from.y) / len;
  for (let s = 0; s + DASH <= len; s += DASH + GAP) {
    const p0 = { x: from.x + ux * s, y: from.y + uy * s }, p1 = { x: from.x + ux * (s + DASH), y: from.y + uy * (s + DASH) };
    if (inCrater(p0.x, p0.y) || inCrater(p1.x, p1.y)) continue;
    if (inPlaza(p0.x, p0.y) || inPlaza(p1.x, p1.y)) continue; // the plaza is drawn before the streets: a stripe there would paint over it
    out.push(strip([p0, p1], 0.4, "paving"));
  }
}

const SAMPLE = 0.5;

type Stop = (x: number, y: number) => boolean;
export const inPlaza = (x: number, y: number): boolean => inPlazaMayor(x, y) || inCrossingPlaza(x, y);
/** The strip and the east lines stop at craters and plazas. */
const flatStop: Stop = (x, y) => inCrater(x, y) || inPlaza(x, y);
/** An ordinary street of the grid also stops at an axis, and the hotel lot. */
const streetStop: Stop = (x, y) => flatStop(x, y) || onAxis(x, y) || inRect(HOTEL_LOT, x, y);

/**
 * Continuous center line of 0.3 along a straight street (any direction): a `strip`
 * of two points per piece, broken wherever `stop` holds. The segment's endpoints are
 * kept; a piece shorter than 1 is not painted.
 */
function centerLine(out: Solid[], from: Vec2, to: Vec2, stop: Stop = flatStop): void {
  const len = Math.hypot(to.x - from.x, to.y - from.y), ux = (to.x - from.x) / len, uy = (to.y - from.y) / len;
  const at = (s: number): Vec2 => ({ x: from.x + ux * s, y: from.y + uy * s });
  let start: number | undefined, last = 0;
  const flush = (): void => {
    if (start !== undefined && last - start >= 1) out.push(strip([at(start), at(last)], 0.3, "paving"));
    start = undefined;
  };
  for (let i = 0; ; i++) {
    const s = Math.min(i * SAMPLE, len), p = at(s);
    if (stop(p.x, p.y)) flush();
    else { start ??= s; last = s; }
    if (s === len) break;
  }
  flush();
}

/** Ordinary grid streets (`ORDINARY_X` / `ORDINARY_Y`): x from the land's north edge to y 318, y from the cover's west edge to the land's east edge. */
function gridLines(ground: Solid[]): void {
  for (const x of ORDINARY_X) centerLine(ground, { x, y: LAND.y0 }, { x, y: CITY_BOUNDS.y1 }, streetStop);
  for (const y of ORDINARY_Y) {
    const edge = coverWest(y);
    // the center line samples every `SAMPLE` from its start: it starts on the same phase as when it began at x -54, so the east pieces keep their ends
    if (edge !== null) centerLine(ground, { x: CITY_EDGE.west - SAMPLE * Math.floor((CITY_EDGE.west - edge) / SAMPLE), y }, { x: LAND.x1, y }, streetStop);
  }
}

/** Offsets of an axis's two carriageway lanes from its center line, along the normal n = (−u.y, u.x). */
export const laneOffsets = (a: Axis): readonly [number, number] => (a.kind === "boulevard" ? [-6, 6] : [-a.w / 4, a.w / 4]);

/**
 * Dashes of 5 every 10 from the span start on each lane of each axis. A dash is kept only when its sampled points (center and both long edges, ±0.2 across) are on the axis's own ground;
 * when it is not, the scan moves on by `SAMPLE` until one fits, and the 10-pitch restarts there, so a free stretch between two obstacles is not lost to the phase.
 */
function axisLanes(ground: Solid[]): void {
  for (const a of AXES) {
    const span = axisSpan(a);
    if (!span) continue;
    const [s0, s1] = span, len = Math.hypot(s1.x - s0.x, s1.y - s0.y), ux = (s1.x - s0.x) / len, uy = (s1.y - s0.y) / len, nx = -uy, ny = ux;
    const walks = crosswalks().filter((w) => w.a === a).map((w) => (w.at.x - s0.x) * ux + (w.at.y - s0.y) * uy); // stations of this axis's crosswalks
    for (const o of laneOffsets(a)) {
      const at = (t: number, e: number): Vec2 => ({ x: s0.x + ux * t + nx * (o + e), y: s0.y + uy * t + ny * (o + e) });
      const fits = (s: number): boolean => {
        if (walks.some((w) => s < w + CROSSWALK_REACH && s + DASH > w - CROSSWALK_REACH)) return false; // the lane stops at the zebra
        for (let t = 0; t <= DASH + 1e-9; t += SAMPLE) {
          if (!inDomain({ x: s0.x + ux * (s + t), y: s0.y + uy * (s + t) }) || ![-0.2, 0, 0.2].every((e) => { const q = at(s + t, e); return q.y <= CITY_BOUNDS.y1 && axisFree(a, q); })) return false; // south of y 318 the south's streets paint the lanes (#478)
        }
        return true;
      };
      for (let s = 0; s + DASH <= len + 1e-9;) {
        if (fits(s)) { ground.push(strip([at(s, 0), at(s + DASH, 0)], 0.4, "paving")); s += DASH + GAP; } else s += SAMPLE;
      }
    }
  }
}

/** Half the along-axis reach of a crosswalk: strips at ±1.6, 0.4 wide each. */
const CROSSWALK_REACH = 2;

/** The zebra crosswalks of `crosswalks()`: one strip of 0.8 each. */
function crosswalkStrips(ground: Solid[]): void {
  for (const w of crosswalks()) for (const [p, q] of w.strips) ground.push(strip([p, q], 0.8, "paving"));
}

const MEDIAN_X = 8, MEDIAN_W = 4, MEDIAN_CLEAR = 6, STREET_CLEAR = 3, MEDIAN_MIN = 2, TREE_PITCH = 8, TREE_MARGIN = 4, CROSSWALK_HALF = 0.4; // a crosswalk strip is 0.8 wide: the median does not cover any part of it

/** Range of y that a polygon covers over the column x in [x0, x1]: vertices inside it and edge crossings with its two sides. */
function yExtent(poly: readonly Vec2[], x0: number, x1: number): readonly [number, number] | null {
  const ys: number[] = [];
  poly.forEach((p, i) => {
    const q = poly[(i + 1) % poly.length]!;
    if (p.x >= x0 && p.x <= x1) ys.push(p.y);
    for (const x of [x0, x1]) if ((p.x - x) * (q.x - x) < 0 || (p.x === x && q.x !== x)) ys.push(p.y + ((x - p.x) / (q.x - p.x)) * (q.y - p.y));
  });
  return ys.length ? [Math.min(...ys), Math.max(...ys)] : null;
}

/**
 * Y intervals of the boulevard's median, sorted: the axis span, less 6 around the y extent (over the median's x) of each other axis's band and of each crossing plaza,
 * and less 3 around each ordinary street and each crosswalk across the boulevard. Stretches under 2 are dropped.
 */
export function boulevardStretches(): readonly (readonly [number, number])[] {
  const b = axis("bulevar"), span = axisSpan(b);
  if (!span) return [];
  const cuts: [number, number][] = [];
  const clear = (e: readonly [number, number] | null, m: number): void => { if (e) cuts.push([e[0] - m, e[1] + m]); };
  for (const a of AXES) if (a !== b) clear(yExtent(axisBand(a), MEDIAN_X, MEDIAN_X + MEDIAN_W), MEDIAN_CLEAR);
  for (const p of crossingPlazas()) clear(yExtent(p, MEDIAN_X, MEDIAN_X + MEDIAN_W), MEDIAN_CLEAR);
  for (const c of crossings()) if (c.a === b && !c.other) clear([c.at.y, c.at.y], STREET_CLEAR);
  for (const w of crosswalks()) if (w.a === b) { const ys = w.strips.flatMap(([p, q]) => [p.y, q.y]); clear([Math.min(...ys), Math.max(...ys)], CROSSWALK_HALF); }
  cuts.sort((p, q) => p[0] - q[0]);
  const out: [number, number][] = [];
  let y = Math.min(span[0].y, span[1].y);
  const end = Math.max(span[0].y, span[1].y);
  for (const [c0, c1] of [...cuts, [end, end] as [number, number]]) {
    const stop = Math.min(c0, end);
    if (stop - y >= MEDIAN_MIN) out.push([y, stop]);
    y = Math.max(y, c1);
  }
  return out;
}

/** Grass median of the boulevard (4 wide, x 8..12) with a tree every 8, per stretch of `boulevardStretches()`. */
function boulevardMedian(solids: Solid[]): void {
  for (const [y0, y1] of boulevardStretches()) {
    solids.push(prism(MEDIAN_X, y0, 0, MEDIAN_W, y1 - y0, 0.3, "leafDark"));
    for (let y = y0 + TREE_MARGIN; y <= y1 - TREE_MARGIN; y += TREE_PITCH) solids.push(...streetTree(v3(MEDIAN_X + MEDIAN_W / 2, y, 0.3)));
  }
}

const QUAY_TOP = 0.6; // the west quay's deck (`westQuay`: z −1, h 1.6)
/** Rests each post on the real ground below: plaza tile, block plinth, quay deck or asphalt. */
export const postZ = (x: number, y: number): number => (inPlaza(x, y) ? 0.05 : inBlock(x, y) || inParcel(x, y) ? PLINTH_H : x >= WEST_QUAY.x0 && x <= WEST_QUAY.x1 ? QUAY_TOP : 0);

const WEST_LANE_X = WEST_COLS.map((x) => x + BLOCK_W + STREET / 2);              // centers of the old N-S streets of the strip (-21..189); south of y 164 the grid has its own
const RING_X = EAST_RING.x0 + STREET / 2;                                        // 273
const EAST_LANE_X = [RING_X, EAST_COLS[0] + BLOCK_W + STREET / 2];               // 273, 307
const LANE_X = [...WEST_LANE_X, ...EAST_LANE_X];

/**
 * N-S and E-W streets: continuous center line of 0.3 on ordinary streets and a
 * dashed lane only on the east ring (without the avenue, which has its own line).
 * The strip (y < 164) and the east bank keep their lines; the west bank has the grid's and the axes'.
 */
function lanes(ground: Solid[]): void {
  for (const cx of LANE_X) {
    const line = cx === RING_X ? dashes : centerLine; // the east ring keeps the dashed lanes
    const west = WEST_LANE_X.includes(cx), yN = west ? LAND.y0 : AVENUE.y0; // the west lines of the strip end where the land begins
    if (cx < STATION_LAND.x0) { // the level crossings of the railyard stay unstriped
      line(ground, { x: cx, y: CITY_EDGE.north }, { x: cx, y: CROSSING_GAP.y0 });
      line(ground, { x: cx, y: CROSSING_GAP.y1 }, { x: cx, y: yN });
    } else line(ground, { x: cx, y: cx === RING_X ? RING_Y0 : ESTUARY_Y0 + 12 }, { x: cx, y: yN }); // the city does not stripe the station
    if (west) continue;
    // south of the avenue the east ring is cut where the estuary comes in, and goes no further than where the east bank turns to jungle: the ground is drawn on top of the water
    const yEnd = Math.min(DISTRICT_BANK_Y, estuaryReaches(cx) - 1);
    if (yEnd > AVENUE.y1 + 3) line(ground, { x: cx, y: AVENUE.y1 }, { x: cx, y: yEnd });
  }
  const rowsY = [...ROWS.slice(2).map((y) => y - STREET / 2), CITY_EDGE.south - 2].filter((y) => y < AVENUE.y0 || y > AVENUE.y1); // 185, 239, 269, 299, 322 (the south street is 4 wide)
  for (const cy of rowsY) {
    if (cy < DISTRICT_ROW_Y - STREET) centerLine(ground, { x: Math.max(EAST_RING.x0, Math.ceil(cy < ESTUARY_Y0 ? eastBank(cy) : estuaryEast(cy)) + 1), y: cy }, { x: PROMENADE.x0, y: cy }); // starts on land; south of the district the east bank is jungle; eastBank north of the estuary is defensive (every cy here is ≥ 185 today)
  }
  centerLine(ground, { x: CITY_EDGE.west, y: 113 }, { x: STATION_LAND.x0, y: 113 }); // north of the railyard, west of the station
  centerLine(ground, { x: Math.ceil(eastBank(137)) + 1, y: 137 }, { x: HARBOR.x1 - 2, y: 137 }); // between the east blocks
  gridLines(ground);
  ground.push(strip([{ x: 187.5, y: LAND.y0 }, { x: 187.5, y: CITY_BOUNDS.y1 }], 3, "paving")); // the costanera's promenade: before the lanes, which paint over it
  axisLanes(ground);
  crosswalkStrips(ground);
}

/** East stretch of the avenue: dashed lanes on each carriageway (the boulevard has no line), 3-strip crosswalks at each crossing and the tree-lined boulevard per block stretch. */
function avenue(ground: Solid[], solids: Solid[]): void {
  for (const y of [(AVENUE.y0 + BOULEVARD.y0) / 2, (BOULEVARD.y1 + AVENUE.y1) / 2]) dashes(ground, { x: EAST_RING.x1, y }, { x: PROMENADE.x0, y });
  for (const cx of EAST_LANE_X) {
    if (cx === RING_X) continue; // the crosswalk under the bridge deck is not painted
    for (const x of [cx - 1.6, cx, cx + 1.6]) ground.push(strip([{ x, y: AVENUE.y0 }, { x, y: AVENUE.y1 }], 0.8, "paving"));
  }
  for (const x of EAST_COLS) {
    const x0 = x === EAST_COLS[0] ? x + 3 : x;                                  // the first east stretch grazes the bridge ramp (276..282)
    const x1 = x === EAST_COLS[1] ? PROMENADE.x0 - 0.5 : x + BLOCK_W;             // the last one ends at the foot of the promenade, without running into its wall
    solids.push(prism(x0, BOULEVARD.y0, 0, x1 - x0, BOULEVARD.y1 - BOULEVARD.y0, 0.3, "leafDark"));
    for (const dx of [4, 12, 20]) solids.push(...streetTree(v3(x + dx, BOULEVARD.y0 + 2, 0.3)));
  }
}

export const LAMP_MIN_GAP = 3; // a displaced post is dropped if it lands closer than this to another
const STREET_SHIFT = 6; // how far along the sidewalk a lamp on a street's roadway may move
const LAMP_W = 0.6;

/** Free stretch `[x0, x1]` of a bar block on the avenue, and the two x of its corner posts (the east one at `x1`, clear of the traffic light at `b.x + 23.5`). */
export interface BarFront { x0: number; x1: number; corners: readonly [number, number] }

/** The bars parcels that face the vias axis (their north edge is the band's south edge). No lamp row consumes it in the scene until #473. */
const VIAS_SOUTH = Math.max(...axisBand(axis("vias")).map((p) => p.y));
export const BAR_FRONTS: readonly BarFront[] = builtParcels()
  .filter((p) => neighborhoodOfParcel(p) === "bars" && p.rect.y === VIAS_SOUTH)
  .map((p) => p.rect)
  .sort((a, b) => a.x - b.x)
  .map((r) => ({ x0: r.x + SIDEWALK, x1: r.x + r.w - SIDEWALK, corners: [r.x, r.x + r.w - SIDEWALK] as const }));

/** Lamp post x in `[x0, x1]`: every 12 u; posts crossing a bar front move to its nearest corner (dropped if < LAMP_MIN_GAP from another). Sorted. */
export function lampXs([x0, x1]: readonly [number, number], fronts: readonly BarFront[]): number[] {
  const kept: number[] = [];
  const moved: number[] = [];
  for (let x = x0 + 6; x < x1 - 6; x += 12) {
    const f = fronts.find((f) => x + LAMP_W > f.x0 && x < f.x1);
    if (!f) { kept.push(x); continue; }
    const [a, b] = f.corners;
    moved.push(Math.abs(x - a) <= Math.abs(x - b) ? a : b);
  }
  for (const x of moved) if (kept.every((k) => Math.abs(k - x) >= LAMP_MIN_GAP)) kept.push(x);
  return kept.sort((a, b) => a - b);
}

/** Street lamps on the avenue's north sidewalk, in the stretch `[x0, x1]`: every 12 u, except in front of the bar shops (their neons), where they step aside to the block corners. */
function lampRow(solids: Solid[], lights: FixedLight[], range: readonly [number, number]): void {
  const y = AVENUE.y0 - 1.3;
  for (const x of lampXs(range, BAR_FRONTS)) placeLit(solids, lights, lamp(v3(x, y, postZ(x, y))));
}

const unitOf = (a: Axis): Vec2 => unit(a.from, a.to);
const landX = (a: Axis): number => (a.kind === "costanera" ? WEST_QUAY.x1 : LAND.x1); // the quay is the costanera's east sidewalk
const QUAY_STAIRS = { y0: 194, y1: 200 } as const; // `westQuay`'s stairs to the water: a ramp, no post stands on it
const onQuayStairs = (p: Vec2, half: number): boolean => p.x + half > WEST_QUAY.x0 && p.y + half > QUAY_STAIRS.y0 && p.y - half < QUAY_STAIRS.y1;
/** A post point on the west bank's ground: in the domain and `LAND`, off the plaza, lots, craters (by the post's whole footprint), any axis band and the ordinary streets (padded by `pad`). */
const postFree = (a: Axis, p: Vec2, pad: number, half: number): boolean => inDomain(p) && p.y >= LAND.y0 && p.x <= landX(a) && ![[-1, -1], [1, -1], [1, 1], [-1, 1]].some(([i, j]) => blocked({ x: p.x + i! * half, y: p.y + j! * half })) && !onAxis(p.x, p.y) && !onOrdinaryStreet(p, pad) && !onQuayStairs(p, half);

const inWestDistrict = (p: Vec2): boolean => p.x < WEST_DISTRICT_X;

/**
 * Centers of the traffic light posts: at each crossing (axis x axis once, axis x street once) the corners
 * `at + s1 (half + 0.5) u + s2 (w/2 + 0.8) n`, stepping outward along u (`half + 0.5 + 0.5k`, k 0..12) to the first free post at least `LAMP_MIN_GAP` from the posts already placed; the diagonal pair (+,+)/(-,-) if both are free, else (+,-)/(-,+), else any two free ones.
 */
export function trafficLightPosts(): readonly Vec2[] {
  const seen = new Set<string>(), out: Vec2[] = [];
  for (const c of crossings()) {
    const key = c.other ? [c.a.id, c.other.id].sort().join("-") : `${c.a.id}:${c.otherId}`;
    if (seen.has(key)) continue;
    if (c.other === null && inWestDistrict(c.at)) continue; // west district: no signals at ordinary crossings (#479 budget moved, not raised)
    seen.add(key);
    const u = unitOf(c.a), n = { x: -u.y, y: u.x };
    // per corner, the along offset steps outward (half + 0.5 + 0.5k, k 0..12) to the first post that is free: on an oblique crossing the first try falls on the street
    const corner = (s1: number, s2: number): Vec2 | null => {
      for (let k = 0; k <= 12; k++) {
        const d = c.half + 0.5 + 0.5 * k, p = { x: c.at.x + s1 * d * u.x + s2 * (c.a.w / 2 + 0.8) * n.x, y: c.at.y + s1 * d * u.y + s2 * (c.a.w / 2 + 0.8) * n.y };
        if (postFree(c.a, p, 0.15, 0.15) && out.every((o) => Math.hypot(o.x - p.x, o.y - p.y) >= LAMP_MIN_GAP)) return p; // nor on a neighbour crossing's post
      }
      return null;
    };
    const free = new Map([[1, 1], [-1, -1], [1, -1], [-1, 1]].map(([s1, s2]) => [`${s1},${s2}`, corner(s1!, s2!)] as const));
    const at = (s1: number, s2: number): Vec2 | null => free.get(`${s1},${s2}`) ?? null;
    const pick = at(1, 1) && at(-1, -1) ? [[1, 1], [-1, -1]] : at(1, -1) && at(-1, 1) ? [[1, -1], [-1, 1]] : [[1, 1], [-1, -1], [1, -1], [-1, 1]].filter(([s1, s2]) => at(s1!, s2!)).slice(0, 2);
    for (const [s1, s2] of pick) out.push(at(s1!, s2!)!);
  }
  return out;
}

/** Sign of the normal n = (-u.y, u.x) that points to the lamp sidewalk: north for E-W axes and diagonals, west for the boulevard, south for the vias. */
export function lampSide(a: Axis): 1 | -1 {
  const u = unitOf(a), n = { x: -u.y, y: u.x };
  if (Math.abs(n.y) < 1e-9) return n.x < 0 ? 1 : -1;
  return (a.id === "vias" ? n.y > 0 : n.y < 0) ? 1 : -1;
}

/** Lamp posts of the axes (the costanera has its own row): every 12 on the `lampSide` sidewalk, 1 outside the band; displaced or dropped by the same rule as the avenue's.
 * A station on an ordinary street's roadway moves along the sidewalk to the nearest free point within `STREET_SHIFT` (as a bar front moves its lamp to the corner), dropped if that lands < `LAMP_MIN_GAP` from another lamp. */
export function axisLampPosts(): readonly { a: Axis; at: Vec2 }[] {
  const lights = trafficLightPosts(), out: { a: Axis; at: Vec2 }[] = [];
  for (const a of AXES) {
    const span = axisSpan(a);
    if (!span || a.kind === "costanera") continue;
    const [p, q] = span, u = unitOf(a), n = { x: -u.y, y: u.x }, k = lampSide(a) * (a.w / 2 + 1), ew = a.from.y === a.to.y;
    // an E-W axis's posts keep the phase they had when the city ended at x -54 (every 12 from -48): the span now goes on west, so its start is moved by whole pitches
    const x0 = Math.min(p.x, q.x), range = ew ? ([CITY_EDGE.west - 12 * Math.floor((CITY_EDGE.west - x0) / 12), Math.max(p.x, q.x)] as const) : ([0, Math.hypot(q.x - p.x, q.y - p.y)] as const);
    const place = (t: number): Vec2 => (ew ? { x: t, y: p.y + n.y * k } : { x: p.x + u.x * t + n.x * k, y: p.y + u.y * t + n.y * k });
    const ok = (at: Vec2): boolean => postFree(a, at, 0.3, LAMP_W / 2) && lights.every((l) => Math.hypot(l.x - at.x, l.y - at.y) >= LAMP_MIN_GAP);
    const mine: Vec2[] = [];
    for (const t of lampXs(range, a.id === "vias" ? BAR_FRONTS : [])) {
      let at = place(t);
      if (inWestDistrict(at) && Math.round((t - range[0] - 6) / 12) % 2 === 1) continue; // west district: a lamp every 24, not 12 (#479 budget moved, not raised)
      if (onOrdinaryStreet(at, 0.3)) {
        const shifts = Array.from({ length: 2 * STREET_SHIFT / 0.5 }, (_, i) => (i % 2 ? 1 : -1) * 0.5 * Math.ceil((i + 1) / 2)); // −0.5, 0.5, −1, 1, …
        const s = shifts.find((d) => ok(place(t + d)) && mine.every((m) => Math.hypot(m.x - place(t + d).x, m.y - place(t + d).y) >= LAMP_MIN_GAP));
        if (s === undefined) continue;
        at = place(t + s);
      } else if (!ok(at)) continue;
      mine.push(at);
      out.push({ a, at });
    }
  }
  return out;
}

/** Costanera lamps (x 190.5): every 12 from y 160 up to 312 less the quay terraces (y 174..195) and the bridge (y 206..291). */
export const COSTANERA_LAMP_Y: readonly number[] = Array.from({ length: 13 }, (_, k) => 160 + 12 * k).filter((y) => y <= 312 && !(y >= 206 && y <= 291) && !(y >= QUAY_TERRACES.y && y <= QUAY_TERRACES.y + QUAY_TERRACES.d));

export const CROSSING_TILE_SEED = 473; // each crossing plaza tiles with its own rng: the city's streams stay as they were
const CURB_W = 1.2;

/** Tiles of `TILE` (the Plaza Mayor's) over the octagon's box, each clipped to the octagon and fan-triangulated (z 0.05, plaza tone). */
export function crossingPlazaTiles(poly: Vec2[], rng: Rng): Solid {
  const c = polyCentroid(poly), halves = poly.map((p, i) => {
    const q = poly[(i + 1) % poly.length]!;
    let a = q.y - p.y, b = -(q.x - p.x), k = a * p.x + b * p.y;
    if (a * c.x + b * c.y > k) { a = -a; b = -b; k = -k; }
    return [a, b, k] as const;
  });
  const xs = poly.map((p) => p.x), ys = poly.map((p) => p.y), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const tris: Extract<Solid, { kind: "ground" }>["tris"] = [];
  for (let x = x0; x < x1; x += TILE) for (let y = y0; y < y1; y += TILE) {
    let cell: Vec2[] = [{ x, y }, { x: Math.min(x + TILE, x1), y }, { x: Math.min(x + TILE, x1), y: Math.min(y + TILE, y1) }, { x, y: Math.min(y + TILE, y1) }];
    for (const [a, b, k] of halves) { cell = clipHalf(cell, a, b, k); if (cell.length < 3) break; }
    for (let i = 1; i + 1 < cell.length; i++) tris.push({ pts: [v3(cell[0]!.x, cell[0]!.y, 0.05), v3(cell[i]!.x, cell[i]!.y, 0.05), v3(cell[i + 1]!.x, cell[i + 1]!.y, 0.05)], toneOffset: plazaTone(rng) });
  }
  return { kind: "ground", mat: "plaza", tris };
}

/** Crossing plazas of the city (centroid in the domain): tiles, a 1.2 curb band on each edge and a lit lamp at the center. Goes before the lanes. */
function crossingPlazaPieces(ground: Solid[], solids: Solid[], lights: FixedLight[]): void {
  crossingPlazas().forEach((poly, i) => {
    const c = polyCentroid(poly);
    if (!inDomain(c)) return;
    ground.push(crossingPlazaTiles(poly, createRng(CROSSING_TILE_SEED + i)));
    poly.forEach((p, j) => {
      const q = poly[(j + 1) % poly.length]!, len = Math.hypot(q.x - p.x, q.y - p.y);
      let nx = -(q.y - p.y) / len, ny = (q.x - p.x) / len;
      if (nx * (c.x - p.x) + ny * (c.y - p.y) < 0) { nx = -nx; ny = -ny; }
      const off = (r: Vec2): Vec2 => ({ x: r.x + nx * CURB_W, y: r.y + ny * CURB_W });
      solids.push({ kind: "poly", footprint: [p, q, off(q), off(p)], z: 0, h: PLINTH_H, mat: "paving" });
    });
    placeLit(solids, lights, lamp(v3(c.x - 0.3, c.y - 0.3, 0.05)));
  });
}

/** Traffic lights (off) and lamps of the axes, and the costanera's lamp row. A post whose box would cut into a solid already built (a recipe that overflows its lot's sidewalk) is not placed. */
function axisFurniture(solids: Solid[], lights: FixedLight[]): void {
  const built = solids.map(bounds);
  const clear = (s: Solid): boolean => { const b = bounds(s); return built.every((o) => !(b.min.x < o.max.x - 1e-6 && o.min.x < b.max.x - 1e-6 && b.min.y < o.max.y - 1e-6 && o.min.y < b.max.y - 1e-6 && b.min.z < o.max.z - 1e-6 && o.min.z < b.max.z - 1e-6)); };
  for (const y of COSTANERA_LAMP_Y) placeLit(solids, lights, lamp(v3(190.5, y, postZ(190.5, y))));
  for (const { x, y } of trafficLightPosts()) { const t = trafficLight(v3(x - 0.15, y - 0.15, postZ(x, y))); if (t.every(clear)) solids.push(...t); }
  for (const { at: { x, y } } of axisLampPosts()) { const l = lamp(v3(x - 0.3, y - 0.3, postZ(x, y))); if (l.solids.every(clear)) placeLit(solids, lights, l); }
}

/** Traffic lights (off) at the avenue's corners and street lamps on its north sidewalk. */
function streetFurniture(solids: Solid[], lights: FixedLight[]): void {
  for (const cx of EAST_LANE_X) for (const [x, y] of [[cx - 3.5, AVENUE.y0 - 1], [cx + 3, AVENUE.y1 + 0.5]] as const) solids.push(...trafficLight(v3(x, y, postZ(x, y))));
  lampRow(solids, lights, [EAST_RING.x1, PROMENADE.x0]);
  axisFurniture(solids, lights);
}

/** A strip clipped to x >= west (its lateral half-width included, so the box stays east of it); null if what is left is shorter than 1. Other solids: dropped when their plan bounds start west of it. */
function clipStrip(s: Solid & { kind: "strip" }, west: number): Solid | null {
  const [p, q] = s.path;
  if (s.path.length !== 2 || !p || !q) return bounds(s).min.x >= west - 1e-6 ? s : null;
  const len = Math.hypot(q.x - p.x, q.y - p.y), ux = (q.x - p.x) / len, uy = (q.y - p.y) / len, edge = west + s.width / 2 * Math.abs(uy);
  if (Math.min(p.x, q.x) >= edge) return s;
  if (Math.abs(ux) < 1e-9 || Math.max(p.x, q.x) < edge) return null; // a N-S strip across the cut, or wholly west of it
  const [w, e] = p.x < q.x ? [p, q] : [q, p], t = (edge - w.x) / (e.x - w.x);
  const cut = { x: edge, y: w.y + t * (e.y - w.y) };
  return Math.hypot(e.x - cut.x, e.y - cut.y) < 1 ? null : { ...s, path: [cut, e] };
}

/** Lanes, avenue and avenue furniture. Goes after the plaza: the ground is painted in insertion order. With a finite `west` nothing of it lies west of `west` (the lab, #479); the rail-lands strip (y < 164) keeps `CITY_EDGE.west`. */
export function streets(ground: Solid[], solids: Solid[], lights: FixedLight[], west = -Infinity): void {
  const g0 = ground.length, s0 = solids.length, l0 = lights.length; // axisFurniture's `clear` reads the solids already built: the streets write in place and the cut filters their tail
  crossingPlazaPieces(ground, solids, lights);
  lanes(ground);
  avenue(ground, solids);
  streetFurniture(solids, lights);
  boulevardMedian(solids);
  if (west === -Infinity) return;
  const g = ground.splice(g0), s = solids.splice(s0), l = lights.splice(l0);
  for (const x of g) { const c = x.kind === "strip" ? clipStrip(x, west) : bounds(x).min.x >= west - 1e-6 ? x : null; if (c) ground.push(c); }
  // `own` is an absolute [from, to) range into `solids`: the kept solids are renumbered and a light goes with its own solids
  const newAt: number[] = [];
  for (const [i, x] of s.entries()) { newAt[i] = solids.length; if (bounds(x).min.x >= west - 1e-6) solids.push(x); else newAt[i] = -1; }
  newAt[s.length] = solids.length;
  for (const x of l) {
    const [from, to] = [x.own[0] - s0, x.own[1] - s0];
    const own = Array.from({ length: Math.max(0, to - from) }, (_, k) => newAt[from + k]);
    if (x.at.x < west || own.some((i) => i === -1)) continue;
    lights.push({ ...x, own: own.length ? [own[0]!, own[0]! + own.length] : [newAt[from] ?? solids.length, newAt[from] ?? solids.length] });
  }
}
