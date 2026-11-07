import { BOTTOM, CELL, DOCK, QUAY_X, SHORE_W, WORLD, ZONE_SPLIT_X, ZONE_SPLIT_Y, ESTUARY_Y0, abyssX, distToHeadland, eastBank, inHeadland, inMouth, inStationLand, islandEastX, islandWestX, shoreWidth } from "../map/geo";
import { CITY_EDGE, DISTRICT_BANK_Y, EAST_RING, PROMENADE_STREET_X, inCrater } from "./city-grid";
import { bayWater, builtAt, estuaryWater } from "./sprawl-grid";

/**
 * Terrain classification, with no mesh or materials: what is at each point
 * of the content (`terrainAt`) and of the bleed (`bleedTerrainAt`), and whether that
 * point is water (`isWaterAt`). It lives below `terrain.ts` and `depth-map.ts`
 * on purpose: the depth map needs the classification and the terrain
 * needs the depth map, so the classification cannot import
 * either of them. `terrain.ts` re-exports it for whoever already asked for it there.
 */
export type Terrain = "slab" | "water" | "east" | "jungle" | "dock" | "asphalt" | "sea" | "shore" | "headland" | "reef" | "abyss";
/** Bleed: jungle and hills, water (sea, shore, trench, estuary) and built land (industrial for Portfolio, urban for Resume). */
export type BleedTerrain = "jungle" | "sea" | "shore" | "abyss" | "river" | "industrial" | "urban" | "fair";

const REEF_W = 6;

export const WATER_TERRAIN = new Set<Terrain>(["water", "sea", "shore", "abyss"]);
export const BLEED_WATER = new Set<BleedTerrain>(["sea", "shore", "abyss", "river"]);

export function shipyardTerrainAt(x: number, y: number): Terrain {
  if (inStationLand(x, y) && x < 100) return "asphalt"; // the strip west of the station track, level with the city street
  if (x < 0) return y < 110 ? "slab" : "jungle"; // west column: rail yard and piles, jungle to the south
  if (x >= DOCK.x && x < DOCK.x + DOCK.w && y >= DOCK.y && y < DOCK.y + DOCK.d) return "dock";
  if (x < QUAY_X) return x < 42 && y > 100 ? "jungle" : y >= BOTTOM ? "jungle" : "slab"; // the north band (y < 0) is factory slab
  if (x <= eastBank(y) || inMouth(x, y)) return "water";
  return x > 330 || y > 124 ? "jungle" : "east";
}

export function cityTerrainAt(x: number, y: number): Terrain {
  if (x >= QUAY_X && x <= (y < ESTUARY_Y0 ? eastBank(y) : islandWestX(y))) return "water"; // north of ESTUARY_Y0 the channel is the shipyard's
  if (y < ESTUARY_Y0 && x > QUAY_X) return x < EAST_RING.x0 ? "jungle" : x < 306 ? "asphalt" : "jungle"; // east bank of the channel
  if (y >= DISTRICT_BANK_Y && x > QUAY_X) return x >= PROMENADE_STREET_X ? "asphalt" : "jungle"; // east bank of the district: jungle, and the promenade street
  if (y >= CITY_EDGE.south || x < CITY_EDGE.west) return "asphalt"; // west and south edges: the bleed's tech district continues straight on from the city
  if (x > QUAY_X && x < EAST_RING.x0) return "jungle";
  if (inCrater(x, y)) return "jungle";
  return "asphalt";
}

export function seaTerrainAt(x: number, y: number): Terrain {
  if (inHeadland(x, y)) return "headland";
  const d = distToHeadland(x, y);
  if (d < REEF_W) return "reef";
  if (d < SHORE_W) return "shore";
  if (x < ZONE_SPLIT_X + shoreWidth(y)) return "shore"; // shoal off the coast of the shipyard, the bay and the promenade
  return x >= abyssX(y) ? "abyss" : "sea";
}

/** Dispatches by geography, not by clickable zone: the sea and the headland belong to seaTerrainAt even if they click through to Portfolio or Resume. */
export function terrainAt(x: number, y: number): Terrain {
  if (inHeadland(x, y) || x >= islandEastX(y)) return seaTerrainAt(x, y);
  return y >= ZONE_SPLIT_Y && !inStationLand(x, y) ? cityTerrainAt(x, y) : shipyardTerrainAt(x, y);
}

/**
 * Bleed: sea and trench to the east; to the south, the estuary and the sea continue until
 * they meet (`seaTerrainAt` classifies shore, sea and trench east of 344); to the
 * north, the bay continues east of the river. The remaining land is built
 * (industrial, urban or the sand fair, `builtAt`) up to `REACH` and jungle with hills beyond.
 */
export function bleedTerrainAt(x: number, y: number): BleedTerrain {
  if (x > WORLD.x1) return x >= abyssX(y) ? "abyss" : "sea";
  if (y > WORLD.y1 && x >= ZONE_SPLIT_X) { const t = seaTerrainAt(x, y); return t === "abyss" || t === "shore" ? t : "sea"; }
  if (estuaryWater(x, y)) return "river";
  if (bayWater(x, y)) return x >= abyssX(y) ? "abyss" : "sea"; // the trench continues north: cut at y = WORLD.y0 it drew an L with its west edge
  return builtAt(x, y) ?? "jungle";
}

/** Water at a point, with whichever classifier applies: the content's inside WORLD, the bleed's outside. */
export function isWaterAt(x: number, y: number): boolean {
  if (x >= WORLD.x0 && x < WORLD.x1 && y >= WORLD.y0 && y < WORLD.y1) return WATER_TERRAIN.has(terrainAt(x, y));
  return BLEED_WATER.has(bleedTerrainAt(x, y));
}

/** `true` if no cell of the `CELL` grid (anchored at WORLD.x0/y0) that cuts the rectangle grown by `margin` has its center in water. */
export function clearOfWater(x0: number, y0: number, x1: number, y1: number, margin: number): boolean {
  const i0 = Math.floor((x0 - margin - WORLD.x0) / CELL), i1 = Math.floor((x1 + margin - WORLD.x0) / CELL);
  const j0 = Math.floor((y0 - margin - WORLD.y0) / CELL), j1 = Math.floor((y1 + margin - WORLD.y0) / CELL);
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) if (isWaterAt(WORLD.x0 + (i + 0.5) * CELL, WORLD.y0 + (j + 0.5) * CELL)) return false;
  return true;
}
