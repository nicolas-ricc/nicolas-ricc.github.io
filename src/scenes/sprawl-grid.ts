import { CELL_BLEED, QUAY_X, RIVER_HALF, WORLD, ZONE_SPLIT_X, ZONE_SPLIT_Y, inCoverQuad, islandEastX, islandWestX, riverCenter } from "../map/geo";
import { BLOCK_D, BLOCK_W, CITY_EDGE, ROWS, WEST_COLS, type Rect } from "./city-grid";

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

/** Urban ground at a point, inside or outside the content: the tech district builds blocks only where this holds at the four corners and the center. */
export function urbanAt(x: number, y: number): boolean {
  if (x < WORLD.x0 || y > WORLD.y1) return builtAt(x, y) === "urban";
  if (x >= QUAY_X || y < CITY_EDGE.north || (x < CITY_EDGE.west && y >= GREEN_BELT.y0 && y < GREEN_BELT.y1)) return false;
  return x < CITY_EDGE.west || y >= CITY_EDGE.south; // the city edges that turned to asphalt
}

export interface SprawlBlock extends Rect { dist: number }

/** Columns of the tech district west of the city (every 30 from −84, like `WEST_COLS`) and rows south of the city (every 24 from 328). */
export const SUBURB_COLS = [-84, -114, -144, -174, -204, -234, -264] as const;
export const SUBURB_ROWS = [328, 352, 376, 400, 424, 448, 472, 496, 520, 544, 568, 592, 616, 640] as const;

/** A block whose center lies farther than this from the 16:9 cover is not built: the site camera never shows it. */
export const COVER_MARGIN = 30;

const blockAt = (x: number, y: number): SprawlBlock | null => {
  const w = BLOCK_W, d = BLOCK_D;
  if (!inCoverQuad(x + w / 2, y + d / 2, 16 / 9, COVER_MARGIN)) return null;
  for (const [px, py] of [[x, y], [x + w, y], [x + w, y + d], [x, y + d], [x + w / 2, y + d / 2]] as const) if (!urbanAt(px, py)) return null;
  return { x, y, w, d, dist: Math.max(0, WORLD.x0 - (x + w), y - WORLD.y1) };
};

/** Blocks of the tech district: the western ones follow the rows of the city (and respect the avenue), the southern ones add the columns of the city. No rng. */
export function suburbBlocks(): SprawlBlock[] {
  const out: SprawlBlock[] = [];
  for (const y of ROWS.slice(1)) for (const x of SUBURB_COLS) { const b = blockAt(x, y); if (b) out.push(b); }
  for (const y of SUBURB_ROWS) for (const x of [...SUBURB_COLS, ...WEST_COLS]) { const b = blockAt(x, y); if (b) out.push(b); }
  return out;
}

/** Distance from the point to the edge of the built land toward the north or the west (the sides behind the camera), 0 on top of it. */
export function beyondBuilt(x: number, y: number): number {
  const w = westDist(x) - reachAt("w", y), n = northDist(y) - reachAt("n", x);
  return Math.max(0, w, n);
}
