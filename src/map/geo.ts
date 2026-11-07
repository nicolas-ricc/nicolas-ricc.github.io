/**
 * World geography: river, bay, headland, zone splits, bleed and cover.
 */
export const RIVER_HALF = 7;

/** River center x for each y: a smooth deterministic curve, running top to bottom. */
export function riverCenter(y: number): number {
  return Math.round(250 + 26 * Math.sin(y / 38) + 14 * Math.sin(y / 17 + 1.3));
}

// ---------------------------------------------------------------- isometric world

/**
 * Content of the iso world: the three zones. Negative origin because the factory
 * (north and west of the shipyard) and the district (west and south of the city)
 * grew outward without moving what was already built. Sides are multiples of 18 so
 * the bleed grid (CELL_BLEED) shares vertices with the content grid.
 */
export const WORLD = { x0: -60, y0: -60, x1: 570, y1: 336 } as const;
/**
 * Bleed: filler terrain around the content, so the site's cover camera shows no
 * sky. Multiples of CELL_BLEED. Content + bleed projects as a parallelogram
 * (a rhombus only if Wx = Wy), so the largest inscribed rectangle is bounded by
 * the short side (y): Wy = 396 + 2·378 = 1152, ≥ 1128, which the content box
 * needs with the tower, which is not centered (FRAME_H lifts only the NW corner).
 */
export const BLEED = { x: 342, y: 378 } as const;
export const CELL_BLEED = 18;
export const COVER_INSET = 3; // the terrain edge is at z −1 (water) or 0.6 ± 0.8 (jungle), ±1.4 px off the parallelogram at z 0

/**
 * Screen rectangle of aspect `aspect` inscribed in the projected terrain with
 * bleed (`sx = x − y`, `sy = (x + y)/2`), returned as its four corners in world
 * coordinates at z 0: what the site's cover camera can show without sky. A
 * Wx×Wy rectangle projects as a parallelogram with sides of slope ±1/2 (a
 * rhombus only if Wx = Wy); the largest inscribed rectangle satisfies
 * h + w/2 = min(Wx, Wy), is centered in x and rests on the lower edge of the
 * feasible range. It is pulled in by `inset` toward the center so it does not
 * expose sky where it is tangent to the edge.
 */
export function coverQuad(aspect: number, inset = COVER_INSET): [number, number][] {
  const x0 = WORLD.x0 - BLEED.x, y0 = WORLD.y0 - BLEED.y, x1 = WORLD.x1 + BLEED.x, y1 = WORLD.y1 + BLEED.y;
  const wx = x1 - x0, wy = y1 - y0;
  const h = (2 * Math.min(wx, wy)) / (aspect + 2), w = aspect * h;
  const topX = x0 - y0, topY = (x0 + y0) / 2;
  const u0 = topX + (wx - wy) / 2 - w / 2, v0 = topY + Math.abs(wx - wy) / 4 + w / 4;
  const h2 = h - 2 * inset, w2 = aspect * h2, u = u0 + (w - w2) / 2, v = v0 + inset;
  const world = (sx: number, sy: number): [number, number] => [sx / 2 + sy, sy - sx / 2];
  return [world(u, v), world(u + w2, v), world(u + w2, v + h2), world(u, v + h2)];
}

/** The point falls inside the cover quad (widened `margin` units outward on each screen axis). */
export function inCoverQuad(x: number, y: number, aspect = 16 / 9, margin = 0): boolean {
  return pointInPolygon(x, y, coverQuad(aspect, COVER_INSET - margin).flat());
}
/** Blog is everything east of ZONE_SPLIT_X (visually); Resume, what is south of ZONE_SPLIT_Y on the west side, except the station land, which stays Portfolio. */
export const ZONE_SPLIT_X = 344;
export const ZONE_SPLIT_Y = 90;
/** Clear water at this distance from land. */
export const SHORE_W = 12;
const SHORE_WOBBLE = 5;
/** Width of the shore off the coast of the x = 344 split, wavy and deterministic. Minimum 5. */
export const shoreWidth = (y: number): number => SHORE_W + SHORE_WOBBLE * Math.sin(y / 11) + 2 * Math.sin(y / 4.3);
/** x where the trench (deep water) begins: a diagonal NE-SW slope that opens toward the east. */
export const abyssX = (y: number): number => 392 + 0.25 * (y + 60) + 6 * Math.sin(y / 17);

export type WorldZone = "portfolio" | "cv" | "blog";

/**
 * Clickable zone (the site's hover and click), by geography and not by split:
 * the headland, the reef and its shore are Portfolio (the lighthouse caps the
 * shipyard), the seawall shore is Resume and Blog is only the open sea. West of
 * the split, land south of `ZONE_SPLIT_Y` is Resume except `STATION_LAND`, the
 * terminal station, which stays Portfolio.
 * The visual terrain (terrain.ts) does not use this to classify the sea.
 */
export function worldZoneAt(x: number, y: number): WorldZone {
  if (inHeadland(x, y) || distToHeadland(x, y) < SHORE_W) return "portfolio";
  if (x < ZONE_SPLIT_X + shoreWidth(y)) return y >= ZONE_SPLIT_Y && !inStationLand(x, y) ? "cv" : "portfolio";
  return "blog";
}

/**
 * Mouth: north of the island coast (northCoastY), everything east of the
 * river's west bank is a bay that opens to the sea. It is the only way out
 * for the ships.
 */
export function inMouth(x: number, y: number): boolean {
  return y < northCoastY(x) && x >= riverCenter(y) - RIVER_HALF;
}

/** Reference latitude of the mouth (used by the darsena exhibit and the tests); the real coast is northCoastY. */
export const MOUTH_Y = 24;

/** Lighthouse headland: starts at the fitting-out quay (x 330..344) and narrows to x = 400. Clockwise. */
export const HEADLAND: readonly [number, number][] = [
  [330, 100], [344, 97], [372, 104], [400, 114], [400, 122], [372, 132], [344, 134], [330, 130],
];
const HEADLAND_FLAT = HEADLAND.flat();

export function inHeadland(x: number, y: number): boolean {
  return pointInPolygon(x, y, HEADLAND_FLAT);
}

function distToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}

/** Distance to the edge of the headland; 0 inside. To classify reef and shore. */
export function distToHeadland(x: number, y: number): number {
  if (inHeadland(x, y)) return 0;
  let best = Infinity;
  for (let i = 0; i < HEADLAND.length; i++) {
    const [ax, ay] = HEADLAND[i]!, [bx, by] = HEADLAND[(i + 1) % HEADLAND.length]!;
    best = Math.min(best, distToSegment(x, y, ax, ay, bx, by));
  }
  return best;
}

export function pointInPolygon(x: number, y: number, polygon: number[]): boolean {
  let inside = false;
  const n = polygon.length / 2;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygon[i * 2]!, yi = polygon[i * 2 + 1]!;
    const xj = polygon[j * 2]!, yj = polygon[j * 2 + 1]!;
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

// ---------------------------------------------------------------- shipyard (shared by the terrain)

/** Side of the terrain grid. It lives here so city-grid.ts and terrain.ts share it without importing each other. */
export const CELL = 6;
// Controller ruling: 198 (not 200) because it is a multiple of CELL = 6; with 200
// the cell 198..204 has center 201 (water) but vertices at x=198, breaking
// the property "all water has x >= QUAY_X".
export const QUAY_X = 198, QUAY_W = 4;
export const BOTTOM = 142;
export const DOCK = { x: 120, y: 6, w: 72, d: 24, depth: 6 } as const; // aligned to CELL
export const eastBank = (y: number): number => riverCenter(y) + RIVER_HALF;

// ---------------------------------------------------------------- island coast (single source of truth)
// Goes last: it uses CELL and eastBank, declared above.

const bump = (v: number, c: number, s: number): number => Math.exp(-(((v - c) / s) ** 2));
const ramp = (v: number, a: number, b: number): number => Math.min(1, Math.max(0, (v - a) / (b - a)));

/**
 * North coast: the island is land where y ≥ northCoastY(x). Holds for every x;
 * point at the NE (x 344), cove at the NW (x 286) and, east of x 350, the coast turns south.
 */
export function northCoastY(x: number): number {
  return 17 - 10 * bump(x, 344, 11) + 13 * bump(x, 286, 8)
    + 2.2 * Math.sin(x / 2.3 + 0.7) + 1.4 * Math.sin(x / 5.1 + 2)
    + Math.max(0, x - 350) ** 2 / 6;
}

/**
 * Part 1 ruling: the estuary inherits the width of the shipyard channel in the
 * last row of cells before ESTUARY_Y0 (center y = 141) and opens toward the
 * south, instead of following the riverCenter meander.
 */
export const ESTUARY_Y0 = 146; // where the estuary starts to open; independent of the zone seam
export const SEAM_CY = Math.floor(ESTUARY_Y0 / CELL) * CELL - CELL / 2;
export const ESTUARY_FLARE = 0.35; // how much the east riverside opens per unit toward the south
export const estuaryEast = (y: number): number => eastBank(SEAM_CY) + Math.max(0, y - ESTUARY_Y0) * ESTUARY_FLARE;

/** Land of the station, Portfolio side of the seam. Half-open: x0 ≤ x < x1 && y0 ≤ y < y1. */
export const STATION_LAND = { x0: 96, y0: 90, x1: 198, y1: 146 } as const;
export function inStationLand(x: number, y: number): boolean {
  return x >= STATION_LAND.x0 && x < STATION_LAND.x1 && y >= STATION_LAND.y0 && y < STATION_LAND.y1;
}

/** How far the island's land reaches over the estuary water, in [0, 10]; 0 north of y 152 (just south of ESTUARY_Y0), at y 196..222 (bridge) and at y 238..262 (collapsed block). */
export function estuaryInset(y: number): number {
  const env = ramp(y, 152, 160) * (1 - ramp(y, 188, 196)) + ramp(y, 222, 226) * (1 - ramp(y, 234, 238)) + ramp(y, 262, 266);
  return env * (6 + 2.5 * Math.sin(y / 7.6 + 0.4) + 1.5 * Math.sin(y / 2.5 + 1.1));
}

/** West coast of the island in its southern half (y ≥ 146): the estuary water reaches this far. */
export const islandWestX = (y: number): number => estuaryEast(y) - estuaryInset(y);

/**
 * East coast: the island is land where x < islandEastX(y). Wavy north of
 * y 158, straight (seawall) between 158 and WORLD.y1 and a rounded south tip
 * beyond (-Infinity from y 380: all water).
 * - North of 146 it oscillates between `lo` and `hi`: `lo` = 331 leaves 3 u of
 *   footing to sheds (x ≤ 324) and scrap (x ≤ 329); between y 134 (base of the
 *   lighthouse headland) and 146 (zone seam) it rises to 344, and `hi` = 344 +
 *   shoreWidth − 1.5 leaves no land that clicks Blog (`worldZoneAt`).
 * - Between 146 and 158 (start of the seawall) it interpolates to 344.
 * - South tip: an ellipse 44 u long from WORLD.y1 over the width of the
 *   tongue at the seam, shrunk to 0.86 ± 0.12 by two sines (29 u and 13 u) and
 *   with a minor tip at y 356.
 */
export function islandEastX(y: number): number {
  if (y >= 158 && y <= WORLD.y1) return ZONE_SPLIT_X;
  if (y > WORLD.y1) {
    const s = (y - WORLD.y1) / 44;
    if (s >= 1) return -Infinity;
    const width = (ZONE_SPLIT_X - estuaryEast(WORLD.y1)) * Math.sqrt(1 - s * s)
      * (0.86 + 0.07 * Math.sin(y / 4.7) + 0.05 * Math.sin(y / 2.1 + 1)) + 4 * bump(y, 356, 4);
    return islandWestX(y) + width;
  }
  const lo = y < 134 ? 331 : Math.min(ZONE_SPLIT_X, 331 + ((y - 134) * (ZONE_SPLIT_X - 331)) / 12);
  const hi = ZONE_SPLIT_X + shoreWidth(y) - 1.5;
  const t = 0.5 + 0.3 * Math.sin(y / 8.3 + 0.9) + 0.17 * Math.sin(y / 2.4 + 0.3);
  const v = lo + (hi - lo) * t;
  return y < 146 ? v : v + ((ZONE_SPLIT_X - v) * (y - 146)) / 12;
}

/** Box of the south tip that the bleed draws in 6 u cells (multiples of the bleed grid, anchored at (−402, −438)). */
export const TIP_BOX = { x0: 264, y0: 336, x1: 372, y1: 408 } as const;
