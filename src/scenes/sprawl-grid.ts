import { CELL_BLEED, COVER_MARGIN, QUAY_X, RIVER_HALF, WORLD, ZONE_SPLIT_X, ZONE_SPLIT_Y, inCoverQuad, islandEastX, islandWestX, riverCenter } from "../map/geo";
import { CITY_EDGE, type Rect } from "./city-grid";
import { LAND, parcels, type Parcel } from "./city-plan";

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

/**
 * Built land at a point outside the content, or null if it is jungle, hill
 * or water. Industrial to the north and west of Portfolio (`y < ZONE_SPLIT_Y`, 90),
 * urban to the west and south of Resume (`y ≥ 90`, except the green belt). At the corners the reach of the side
 * that corresponds to each axis rules: the NW corner is industrial, the SW
 * one urban. Inside `FAIR`, east of the industrial and west of the bay, it is
 * the sand fair.
 */
export function builtAt(x: number, y: number): Built | null {
  if (bayWater(x, y) || estuaryWater(x, y) || x > WORLD.x1) return null;
  if (y > WORLD.y1 && x >= QUAY_X) return null; // to the south, from the quay eastward: estuary, the tongue of jungle between it and the sea, and the sea
  if (x < WORLD.x0 && y >= GREEN_BELT.y0 && y < GREEN_BELT.y1) return null; // the green belt between the factory and the city continues to the west
  const s = southDist(y), w = westDist(x), n = northDist(y);
  if (s > 0 && s > reachAt("s", x)) return null;
  if (w > 0 && w > reachAt("w", y)) return null;
  if (n > 0 && n > reachAt("n", x)) return null;
  if (s <= 0 && w <= 0 && n <= 0) return null; // inside the content
  if (inFairBox(x, y)) return "fair";
  return y < ZONE_SPLIT_Y ? "industrial" : "urban";
}

/** The fair: strip of sand in the north bleed, between the factory and the bay. */
export const fairAt = (x: number, y: number): boolean => builtAt(x, y) === "fair";

/** Green belt west of the content, y 116..158: jungle between the hinterland (rail yard, Portfolio) and the tech district; no built land and no urban ground. */
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
/**
 * Parcels of the city plan south of y 318 (centroid y > 318), on urban ground at the centroid and the four corners of
 * `rect` and inside the cover. The 318..324 strip is asphalt, not a hole: `urbanAt` is asked at `max(y, CITY_EDGE.south)`, so the
 * row right south of the avenue stays; the estuary and the bleed (they only exist for y > WORLD.y1) still decide. Memoized.
 */
export function southParcels(): Parcel[] {
  return south ??= parcels({ x0: -Infinity, y0: 318, x1: LAND.x1, y1: 650 }).filter((p) => {
    if (p.c.y <= 318 || !inCoverQuad(p.c.x, p.c.y, 16 / 9, COVER_MARGIN)) return false;
    const { x, y, w, d } = p.rect;
    return ([[p.c.x, p.c.y], [x, y], [x + w, y], [x + w, y + d], [x, y + d]] as const).every(([px, py]) => urbanAt(px, Math.max(py, CITY_EDGE.south)));
  });
}

/** The block of a south parcel. */
export const parcelBlock = (p: Parcel): SprawlBlock => ({ ...p.rect, dist: Math.max(0, p.c.y - WORLD.y1), parcel: p });

/** Every block of the tech district: one per south parcel. */
export const techBlocks = (): SprawlBlock[] => southParcels().map(parcelBlock);

/** Distance from the point to the edge of the built land toward the north or the west (the sides behind the camera), 0 on top of it. */
export function beyondBuilt(x: number, y: number): number {
  const w = westDist(x) - reachAt("w", y), n = northDist(y) - reachAt("n", x);
  return Math.max(0, w, n);
}
