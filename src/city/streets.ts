import { v3, type Vec2 } from "../iso/geometry";
import type { Solid } from "../iso/solids";
import type { Material } from "../map/palette-iso";
import { ESTUARY_Y0, QUAY_X, STATION_LAND, eastBank } from "../map/geo";
import { CROSSING_GAP } from "./rail-lands";
import { AVENUE, BLOCK_W, BOULEVARD, CITY_EDGE, DISTRICT_BANK_Y, DISTRICT_ROWS, EAST_COLS, EAST_RING, HARBOR, PROMENADE, PLAZA, RING_Y0, ROWS, SIDEWALK, STREET, WEST_COLS, WEST_QUAY, blocks, estuaryEast, estuaryReaches, inBlock, inCrater } from "../scenes/city-grid";
import { lamp, streetTree, trafficLight } from "../kit/props";
import { placeLit, type FixedLight } from "./lights";
import { PLINTH_H, prism } from "../scenes/city-pieces";
import { neighborhoodOf } from "./zoning";

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

/**
 * Continuous center line of 0.3 along a N-S or E-W street: a `strip`
 * of two points per piece without craters or plaza. The segment's endpoints are
 * kept; a piece shorter than 1 is not painted.
 */
function centerLine(out: Solid[], from: Vec2, to: Vec2): void {
  const len = Math.hypot(to.x - from.x, to.y - from.y), ux = (to.x - from.x) / len, uy = (to.y - from.y) / len;
  const at = (s: number): Vec2 => ({ x: from.x + ux * s, y: from.y + uy * s });
  let start: number | undefined, last = 0;
  const flush = (): void => {
    if (start !== undefined && last - start >= 1) out.push(strip([at(start), at(last)], 0.3, "paving"));
    start = undefined;
  };
  for (let i = 0; ; i++) {
    const s = Math.min(i * SAMPLE, len), p = at(s);
    if (inCrater(p.x, p.y) || inPlaza(p.x, p.y)) flush();
    else { start ??= s; last = s; }
    if (s === len) break;
  }
  flush();
}

export const inPlaza = (x: number, y: number): boolean => x >= PLAZA.x && x < PLAZA.x + PLAZA.w && y >= PLAZA.y && y < PLAZA.y + PLAZA.d;
const inQuayWall = (x: number): boolean => x >= WEST_QUAY.x0 && x <= WEST_QUAY.x1;
/** Rests each post on the real ground below: plaza tile, block plinth or asphalt. */
export const postZ = (x: number, y: number): number => (inPlaza(x, y) ? 0.05 : inBlock(x, y) ? PLINTH_H : 0);

const WEST_LANE_X = WEST_COLS.map((x) => x + BLOCK_W + STREET / 2);              // centers of the west N-S streets (-21..189)
const RING_X = EAST_RING.x0 + STREET / 2;                                        // 273
const EAST_LANE_X = [RING_X, EAST_COLS[0] + BLOCK_W + STREET / 2];               // 273, 307
const LANE_X = [...WEST_LANE_X, ...EAST_LANE_X];

/**
 * N-S and E-W streets: continuous center line of 0.3 on ordinary streets and a
 * dashed lane only on the east ring (without the avenue, which has its own line).
 */
function lanes(ground: Solid[]): void {
  for (const cx of LANE_X) {
    const line = cx === RING_X ? dashes : centerLine; // the east ring keeps the dashed lanes
    if (cx < STATION_LAND.x0) { // the level crossings of the railyard stay unstriped
      line(ground, { x: cx, y: CITY_EDGE.north }, { x: cx, y: CROSSING_GAP.y0 });
      line(ground, { x: cx, y: CROSSING_GAP.y1 }, { x: cx, y: AVENUE.y0 });
    } else line(ground, { x: cx, y: cx === RING_X ? RING_Y0 : ESTUARY_Y0 + 12 }, { x: cx, y: AVENUE.y0 }); // the city does not stripe the station
    // south of the avenue the east ring is cut where the estuary comes in, and goes no further than where the east bank turns to jungle: the ground is drawn on top of the water
    const yEnd = cx > QUAY_X ? Math.min(DISTRICT_BANK_Y, estuaryReaches(cx) - 1) : CITY_EDGE.south;
    if (yEnd > AVENUE.y1 + 3) line(ground, { x: cx, y: AVENUE.y1 }, { x: cx, y: yEnd });
  }
  const rowsY = [...ROWS.slice(2).map((y) => y - STREET / 2), CITY_EDGE.south - 2].filter((y) => y < AVENUE.y0 || y > AVENUE.y1); // 185, 239, 269, 299, 322 (the south street is 4 wide)
  for (const cy of rowsY) {
    centerLine(ground, { x: CITY_EDGE.west, y: cy }, { x: WEST_QUAY.x0, y: cy });
    if (cy < DISTRICT_ROWS[0] - STREET) centerLine(ground, { x: Math.max(EAST_RING.x0, Math.ceil(cy < ESTUARY_Y0 ? eastBank(cy) : estuaryEast(cy)) + 1), y: cy }, { x: PROMENADE.x0, y: cy }); // starts on land; south of the district the east bank is jungle; eastBank north of the estuary is defensive (every cy here is ≥ 185 today)
  }
  centerLine(ground, { x: CITY_EDGE.west, y: 113 }, { x: STATION_LAND.x0, y: 113 }); // north of the railyard, west of the station
  centerLine(ground, { x: Math.ceil(eastBank(137)) + 1, y: 137 }, { x: HARBOR.x1 - 2, y: 137 }); // between the east blocks
}

/** Avenue: dashed lanes on each carriageway (the boulevard has no line), 3-strip crosswalks at each crossing and the tree-lined boulevard per block stretch. */
function avenue(ground: Solid[], solids: Solid[]): void {
  for (const [x0, x1] of [[CITY_EDGE.west, WEST_QUAY.x0], [EAST_RING.x1, PROMENADE.x0]] as const) {
    for (const y of [(AVENUE.y0 + BOULEVARD.y0) / 2, (BOULEVARD.y1 + AVENUE.y1) / 2]) dashes(ground, { x: x0, y }, { x: x1, y });
  }
  for (const cx of LANE_X) {
    if (cx === RING_X) continue; // the crosswalk under the bridge deck is not painted
    for (const x of [cx - 1.6, cx, cx + 1.6]) ground.push(strip([{ x, y: AVENUE.y0 }, { x, y: AVENUE.y1 }], 0.8, "paving"));
  }
  for (const x of [...WEST_COLS, ...EAST_COLS]) {
    const x0 = x === EAST_COLS[0] ? x + 3 : x;                                  // the first east stretch grazes the bridge ramp (276..282)
    const x1 = x === EAST_COLS[1] ? PROMENADE.x0 - 0.5 : x + BLOCK_W;             // the last one ends at the foot of the promenade, without running into its wall
    solids.push(prism(x0, BOULEVARD.y0, 0, x1 - x0, BOULEVARD.y1 - BOULEVARD.y0, 0.3, "leafDark"));
    for (const dx of [4, 12, 20]) solids.push(...streetTree(v3(x + dx, BOULEVARD.y0 + 2, 0.3)));
  }
}

export const LAMP_MIN_GAP = 3; // a displaced post is dropped if it lands closer than this to another
const LAMP_W = 0.6;

/** Free stretch `[x0, x1]` of a bar block on the avenue, and the two x of its corner posts. */
export interface BarFront { x0: number; x1: number; corners: readonly [number, number] }

export const BAR_FRONTS: readonly BarFront[] = blocks()
  .filter((b) => neighborhoodOf(b) === "bars" && b.y + b.d === AVENUE.y0)
  .map((b) => ({ x0: b.x + SIDEWALK, x1: b.x + BLOCK_W - SIDEWALK, corners: [b.x, b.x + BLOCK_W - LAMP_W] as const }));

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
  for (const cx of LANE_X) for (const [x, y] of [[cx - 3.5, AVENUE.y0 - 1], [cx + 3, AVENUE.y1 + 0.5]] as const) {
    if (inQuayWall(x)) continue; // a post there would fall inside the dock wall
    const z = postZ(x, y);
    solids.push(...trafficLight(v3(x, y, z)));
  }
  for (const range of [[CITY_EDGE.west, WEST_QUAY.x0], [EAST_RING.x1, PROMENADE.x0]] as const) lampRow(solids, lights, range);
}

/** Lanes, avenue and avenue furniture. Goes after the plaza: the ground is painted in insertion order. */
export function streets(ground: Solid[], solids: Solid[], lights: FixedLight[]): void {
  lanes(ground);
  avenue(ground, solids);
  streetFurniture(solids, lights);
}
