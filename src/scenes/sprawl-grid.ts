import { BLEED, CELL_BLEED, QUAY_X, RIVER_HALF, WORLD, ZONE_SPLIT_X, ZONE_SPLIT_Y, inBuildRegion, inCore, inPanReach, islandEastX, islandWestX, riverCenter } from "../map/geo";
import { CITY_EDGE, type Rect } from "./city-grid";
import { AXES, COASTAL_CUT_Y, LAND, axisBand, parcels, type Parcel } from "./city-plan";

/**
 * Geography of the margins: which part of the bleed is built land and of
 * which zone. Pure module, no rng, like city-grid: the terrain
 * (`bleedTerrainAt`) and the scenes of the tech district and the hinterland
 * share it, so the asphalt and the blocks cannot drift out of alignment.
 * Spec: docs/superpowers/specs/2026-09-15-margenes-urbanos-design.md §3.
 */
export type Built = "industrial" | "urban" | "fair";

/** How far the built land reaches from the edge of the content, per side. Multiples of CELL_BLEED. */
export const REACH = { n: 16 * CELL_BLEED, w: 8 * CELL_BLEED, s: 16 * CELL_BLEED } as const;
const WOBBLE = 2 * CELL_BLEED;

/** The fair: strip of sand north of the factory up to the shore of the bay. Edges aligned to the bleed grid (anchored at (−402, −438)). */
export const FAIR = { x0: 84, y0: -312, y1: -168 } as const;
/** West shore of the bay for each y (≈ 213..270 in the fair strip). */
export const bayShoreX = (y: number): number => riverCenter(y) - RIVER_HALF;

/** The geometric rectangle of the fair, water included (unlike `fairAt`, which excludes the bay). `builtAt` and the vertex flattening of the bleed in terrain.ts share it. */
export const inFairBox = (x: number, y: number): boolean => y < WORLD.y0 && x >= FAIR.x0 && y >= FAIR.y0 && y < FAIR.y1;

/** The edge of the built land undulates along the side: it is never a straight line. */
export function reachAt(side: keyof typeof REACH, along: number): number {
  return REACH[side] + WOBBLE * (0.5 + 0.5 * Math.sin(along / 61 + (side === "s" ? 1.7 : 0.4)));
}

/** How far the point is from the content toward the south (positive outside the content). */
const southDist = (y: number): number => y - WORLD.y1;
const westDist = (x: number): number => WORLD.x0 - x;
const northDist = (y: number): number => WORLD.y0 - y;

/** The bay continues to the north, east of the west shore of the river. */
export const bayWater = (x: number, y: number): boolean => y < WORLD.y0 && x >= bayShoreX(y);
/** South of the content the estuary continues until it joins the sea, wrapping around the south tip of the island (it rounds off and ends at y ≈ 380; after that it is all water). */
export const estuaryWater = (x: number, y: number): boolean => y > WORLD.y1 && x >= QUAY_X && x < ZONE_SPLIT_X && (x <= islandWestX(y) || x >= islandEastX(y));

let corridor: [number, number][] | undefined;
/**
 * True when `x` lies in the closed x-range of the 18 u bleed cells (anchored at `WORLD.x0 - BLEED.x`) that the band of an axis running to the bleed edge
 * crosses (the boulevard: x −6..30; the waterfront promenade: 174..192, #493). Closed: the vertex columns on the outer cell edges are asphalt too, so the cells are flat.
 */
export function southAxisCorridor(x: number): boolean {
  const o = WORLD.x0 - BLEED.x;
  corridor ??= AXES.filter((a) => a.to.y >= WORLD.y1 + BLEED.y).map((a) => {
    const xs = axisBand(a).map((q) => q.x);
    return [o + CELL_BLEED * Math.floor((Math.min(...xs) - o) / CELL_BLEED), o + CELL_BLEED * Math.ceil((Math.max(...xs) - o) / CELL_BLEED)] as [number, number];
  });
  return corridor.some(([lo, hi]) => x >= lo && x <= hi);
}

/**
 * Built land at a point outside the content, or null if it is jungle, hill
 * or water. Industrial to the north and west of Portfolio (`y < ZONE_SPLIT_Y`, 90),
 * urban to the west and south of Resume (`y ≥ 90`, except the green belt). At the corners the reach of the side
 * that corresponds to each axis rules: the NW corner is industrial, the SW
 * one urban. Inside `FAIR`, east of the industrial and west of the bay, it is
 * the sand fair. Resume's bleed (`y ≥ GREEN_BELT.y1`) is urban as far as a pan reaches plus 3 bleed cells
 * (#496: COVER_MARGIN 30 + a block's half-diagonal 17 = 47 ≤ 54, so no parcel built in the build region stands on jungle), whatever `reachAt` says.
 */
export function builtAt(x: number, y: number): Built | null {
  if (bayWater(x, y) || estuaryWater(x, y) || x > WORLD.x1) return null;
  if (y > WORLD.y1 && x >= QUAY_X) return null; // to the south, from the quay eastward: estuary, the tongue of jungle between it and the sea, and the sea
  if (x < WORLD.x0 && y >= GREEN_BELT.y0 && y < GREEN_BELT.y1) return null; // the green belt between the factory and the city continues to the west
  const s = southDist(y), w = westDist(x), n = northDist(y);
  if (y >= GREEN_BELT.y1 && (s > 0 || w > 0) && inPanReach(x, y, 3 * CELL_BLEED)) return "urban";
  if (!withinReach(x, y)) return null;
  if (n > 0 && n > reachAt("n", x)) return null;
  if (s <= 0 && w <= 0 && n <= 0) return null; // inside the content
  if (inFairBox(x, y)) return "fair";
  return y < ZONE_SPLIT_Y ? "industrial" : "urban";
}

/** Inside the wobbly south and west edges of the built land (`reachAt`, plus the south axis corridors of #493), the bound the bleed had before the pan reach (#496). */
export const withinReach = (x: number, y: number): boolean => {
  const s = southDist(y), w = westDist(x);
  return !(s > 0 && s > reachAt("s", x) && !southAxisCorridor(x)) && !(w > 0 && w > reachAt("w", y)); // the Bulevar and the Costanera run on asphalt to the bleed edge (#493)
};

/** The fair: strip of sand in the north bleed, between the factory and the bay. */
export const fairAt = (x: number, y: number): boolean => builtAt(x, y) === "fair";

/** Green belt west of the content, y 116..158: jungle between the hinterland (rail yard, Portfolio) and the city's west district; no built land and no urban ground. */
export const GREEN_BELT = { y0: 116, y1: 158 } as const;

/** Urban ground at a point, inside or outside the content: the tech district builds blocks only where this holds at the four corners and the center. Inside the content only the south counts (the west is the city's, #479). */
export function urbanAt(x: number, y: number): boolean {
  if (x < WORLD.x0 || y > WORLD.y1) return builtAt(x, y) === "urban";
  return x < QUAY_X && y >= LAND.y0;
}

/** A tech block: a south parcel of the city plan (`rect` = the parcel's; `parcel` is set for every block `techBlocks` returns). */
export interface SprawlBlock extends Rect { dist: number; parcel?: Parcel }

export { COVER_MARGIN } from "../map/geo";

let south: Parcel[] | undefined;
/** The centroid and the four corners of a south parcel's rect, the corners' y clamped to the avenue's south kerb (`CITY_EDGE.south`). */
const samplePoints = (p: Parcel): (readonly [number, number])[] => {
  const { x, y, w, d } = p.rect;
  return ([[p.c.x, p.c.y], [x, y], [x + w, y], [x + w, y + d], [x, y + d]] as const).map(([px, py]) => [px, Math.max(py, CITY_EDGE.south)] as const);
};
let core: Set<Parcel> | undefined;
/** A south parcel built before #496: inside the cover's margin and on the ground the wobbly reach allowed then; the rest of `southParcels()` is the strip. */
export const isSouthCore = (p: Parcel): boolean => { southParcels(); return core!.has(p); };

/**
 * Parcels of the city plan south of the coastal cut (centroid y > `COASTAL_CUT_Y`, 378; #493), on urban ground at the centroid and the four corners of
 * `rect` and inside the build region (#496: the cover plus the strip a pan shows, down to the south edge). The core parcels (`isSouthCore`) come first, exactly as before; the strip ones after.
 * `urbanAt` is asked at `max(y, CITY_EDGE.south)` (the strip up to CITY_EDGE.south is asphalt, not a hole); the estuary and the bleed (they only exist for y > WORLD.y1) still decide. Memoized.
 */
export function southParcels(): Parcel[] {
  if (south) return south;
  const ok = parcels({ x0: -Infinity, y0: COASTAL_CUT_Y, x1: LAND.x1, y1: WORLD.y1 + BLEED.y }).filter((p) => {
    if (p.c.y <= COASTAL_CUT_Y || !inBuildRegion(p.c.x, p.c.y)) return false;
    return samplePoints(p).every(([px, py]) => urbanAt(px, py));
  });
  core = new Set(ok.filter((p) => inCore(p.c.x, p.c.y) && samplePoints(p).every(([px, py]) => withinReach(px, py))));
  return south = [...ok.filter((p) => core!.has(p)), ...ok.filter((p) => !core!.has(p))];
}

/** The block of a south parcel. */
export const parcelBlock = (p: Parcel): SprawlBlock => ({ ...p.rect, dist: Math.max(0, p.c.y - WORLD.y1), parcel: p });

export const techBlocks = (): SprawlBlock[] => southParcels().map(parcelBlock);

/** Distance from the point to the edge of the built land toward the north or the west (the sides behind the camera), 0 on top of it. */
export function beyondBuilt(x: number, y: number): number {
  const w = westDist(x) - reachAt("w", y), n = northDist(y) - reachAt("n", x);
  return Math.max(0, w, n);
}
