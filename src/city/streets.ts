import { v3, type Vec2 } from "../iso/geometry";
import type { Solid } from "../iso/solids";
import type { Material } from "../map/palette-iso";
import { COVER_MARGIN, ESTUARY_Y0, STATION_LAND, eastBank, inCoverQuad } from "../map/geo";
import { CROSSING_GAP } from "./rail-lands";
import { AVENUE, BLOCK_W, BOULEVARD, CITY_EDGE, DISTRICT_BANK_Y, DISTRICT_ROW_Y, EAST_COLS, EAST_RING, HARBOR, PROMENADE, RING_Y0, ROWS, SIDEWALK, STREET, WEST_COLS, estuaryEast, estuaryReaches, inBlock, inCrater } from "../scenes/city-grid";
import { lamp, streetTree, trafficLight } from "../kit/props";
import { placeLit, type FixedLight } from "./lights";
import { PLINTH_H, prism } from "../scenes/city-pieces";
import { builtParcels, neighborhoodOfParcel } from "./zoning";
import { AXES, BLOCK, CITY_BOUNDS, GRID_ORIGIN, HOTEL_LOT, LAND, PITCH, axis, axisBand, clipSeg, inCrossingPlaza, inPlazaMayor, inRect, onAxis, pointInPoly } from "../scenes/city-plan";

/**
 * Resume streets: lanes, avenue with dashed lanes and crosswalks,
 * tree-lined boulevard and avenue furniture.
 * Spec: docs/superpowers/specs/2026-10-15-resume-nivel-2-kit-zonificacion-luces-design.md §6 "Calles".
 */

const strip = (path: Vec2[], width: number, mat: Material): Solid => ({ kind: "strip", path, width, z: 0.02, mat });

const DASH = 5, GAP = 5; // 4/4 went over 150 strips counting the district's

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
/** An ordinary street of the grid also stops at an axis and the hotel lot. */
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

/** One center line per axis: `from → to` clipped to the land (the quay-side axis, east of it, only to y 164), broken by the cover, the city's edges (x < CITY_EDGE.west, y > 318: tech's and the suburb's ground, #478 paints the south avenues there), the plazas, craters, the hotel lot and the other axes' bands. */
function axisLines(ground: Solid[]): void {
  for (const a of AXES) {
    // deliberate: the costanera runs at x 188, east of LAND.x1, so clipSeg drops it; it is clipped on y along LAND.x1 and drawn back at its own x
    const seg = clipSeg(a.from, a.to) ?? (a.kind === "costanera" ? clipSeg({ x: LAND.x1, y: a.from.y }, { x: LAND.x1, y: a.to.y }) : null);
    if (!seg) continue;
    const [p, q] = a.kind === "costanera" ? [{ x: a.from.x, y: seg[0].y }, { x: a.from.x, y: seg[1].y }] : seg;
    const foreign = AXES.filter((o) => o !== a).map(axisBand);
    centerLine(ground, p, q, (x, y) => x < CITY_EDGE.west || y > CITY_BOUNDS.y1 || !inCoverQuad(x, y, 16 / 9, COVER_MARGIN) || flatStop(x, y) || foreign.some((b) => pointInPoly(x, y, b)));
  }
}

/** Ordinary grid streets: x 40 + 30k from the land's north edge to y 318, y 48 + 30k from the city's west edge to the land's east edge; those that run along an axis are the axis. */
function gridLines(ground: Solid[]): void {
  const along = (horizontal: boolean, c: number): boolean => AXES.some((a) => (horizontal ? a.from.y === a.to.y : a.from.x === a.to.x) && Math.abs((horizontal ? a.from.y : a.from.x) - c) < a.w / 2);
  for (let k = -5; k < 10; k++) {
    const x = GRID_ORIGIN.x + BLOCK + STREET / 2 + PITCH * k, y = GRID_ORIGIN.y + BLOCK + STREET / 2 + PITCH * k;
    if (x > CITY_EDGE.west && x < LAND.x1 && !along(false, x)) centerLine(ground, { x, y: LAND.y0 }, { x, y: 318 }, streetStop);
    if (y > LAND.y0 && y < 318 && !along(true, y)) centerLine(ground, { x: CITY_EDGE.west, y }, { x: LAND.x1, y }, streetStop);
  }
}

/** Rests each post on the real ground below: plaza tile, block plinth or asphalt. */
export const postZ = (x: number, y: number): number => (inPlaza(x, y) ? 0.05 : inBlock(x, y) ? PLINTH_H : 0);

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
  axisLines(ground);
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

/** Traffic lights (off) at the avenue's corners and street lamps on its north sidewalk. */
function streetFurniture(solids: Solid[], lights: FixedLight[]): void {
  for (const cx of EAST_LANE_X) for (const [x, y] of [[cx - 3.5, AVENUE.y0 - 1], [cx + 3, AVENUE.y1 + 0.5]] as const) solids.push(...trafficLight(v3(x, y, postZ(x, y))));
  lampRow(solids, lights, [EAST_RING.x1, PROMENADE.x0]);
}

/** Lanes, avenue and avenue furniture. Goes after the plaza: the ground is painted in insertion order. */
export function streets(ground: Solid[], solids: Solid[], lights: FixedLight[]): void {
  lanes(ground);
  avenue(ground, solids);
  streetFurniture(solids, lights);
}
