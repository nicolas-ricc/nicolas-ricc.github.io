import { BOTTOM, CELL, DOCK, QUAY_X, SHORE_W, WORLD, ZONE_SPLIT_X, ZONE_SPLIT_Y, abyssX, distToHeadland, eastBank, inHeadland, inMouth, islandEastX, islandWestX, shoreWidth } from "../map/geo";
import { CITY_EDGE, DISTRICT_BANK_Y, EAST_RING, MALECON_STREET_X, inCrater } from "./city-grid";
import { bayWater, builtAt, estuaryWater } from "./sprawl-grid";

/**
 * Clasificación del terreno, sin malla ni materiales: qué hay en cada punto
 * del contenido (`terrainAt`) y del sangrado (`bleedTerrainAt`), y si ese
 * punto es agua (`isWaterAt`). Vive abajo de `terrain.ts` y de `depth-map.ts`
 * a propósito: el mapa de profundidad necesita la clasificación y el terreno
 * necesita el mapa de profundidad, así que la clasificación no puede importar
 * a ninguno de los dos. `terrain.ts` la reexporta para quien ya la pedía ahí.
 */
export type Terrain = "slab" | "water" | "east" | "jungle" | "dock" | "asphalt" | "sea" | "shore" | "headland" | "reef" | "abyss";
/** Sangrado: selva y lomas, agua (mar, orilla, fosa, estuario) y tierra construida (industrial de Portfolio, urbana de Resume). */
export type BleedTerrain = "jungle" | "sea" | "shore" | "abyss" | "river" | "industrial" | "urban" | "fair";

const REEF_W = 6;

export const WATER_TERRAIN = new Set<Terrain>(["water", "sea", "shore", "abyss"]);
export const BLEED_WATER = new Set<BleedTerrain>(["sea", "shore", "abyss", "river"]);

export function shipyardTerrainAt(x: number, y: number): Terrain {
  if (x < 0) return y < 110 ? "slab" : "jungle"; // columna oeste: playa de vías y acopios, selva al sur
  if (x >= DOCK.x && x < DOCK.x + DOCK.w && y >= DOCK.y && y < DOCK.y + DOCK.d) return "dock";
  if (x < QUAY_X) return x < 42 && y > 100 ? "jungle" : y >= BOTTOM ? "jungle" : "slab"; // la banda norte (y < 0) es losa de fábrica
  if (x <= eastBank(y) || inMouth(x, y)) return "water";
  return x > 330 || y > 124 ? "jungle" : "east";
}

export function cityTerrainAt(x: number, y: number): Terrain {
  if (x >= QUAY_X && x <= islandWestX(y)) return "water";
  if (y < CITY_EDGE.north) return "jungle"; // cinturón de costura con el astillero
  if (y >= DISTRICT_BANK_Y && x > QUAY_X) return x >= MALECON_STREET_X ? "asphalt" : "jungle"; // ribera este del distrito: selva, y la calle del malecón
  if (y >= CITY_EDGE.south || x < CITY_EDGE.west) return "asphalt"; // bordes oeste y sur: el distrito tecnológico del sangrado sigue derecho desde la ciudad
  if (x > QUAY_X && x < EAST_RING.x0) return "jungle";
  if (inCrater(x, y)) return "jungle";
  return "asphalt";
}

export function seaTerrainAt(x: number, y: number): Terrain {
  if (inHeadland(x, y)) return "headland";
  const d = distToHeadland(x, y);
  if (d < REEF_W) return "reef";
  if (d < SHORE_W) return "shore";
  if (x < ZONE_SPLIT_X + shoreWidth(y)) return "shore"; // bajío frente a la costa del astillero, la bahía y el malecón
  return x >= abyssX(y) ? "abyss" : "sea";
}

/** Despacha por geografía, no por zona clickeable: el mar y la punta son de seaTerrainAt aunque clickeen Portfolio o Resume. */
export function terrainAt(x: number, y: number): Terrain {
  if (inHeadland(x, y) || x >= islandEastX(y)) return seaTerrainAt(x, y);
  return y >= ZONE_SPLIT_Y ? cityTerrainAt(x, y) : shipyardTerrainAt(x, y);
}

/**
 * Sangrado: mar y fosa al este; al sur, el estuario y el mar siguen hasta
 * juntarse (`seaTerrainAt` clasifica orilla, mar y fosa al este de 344); al
 * norte, la bahía sigue al este del río. La tierra restante es construida
 * (industrial, urbana o la feria de arena, `builtAt`) hasta `REACH` y selva con lomas más allá.
 */
export function bleedTerrainAt(x: number, y: number): BleedTerrain {
  if (x > WORLD.x1) return x >= abyssX(y) ? "abyss" : "sea";
  if (y > WORLD.y1 && x >= ZONE_SPLIT_X) { const t = seaTerrainAt(x, y); return t === "abyss" || t === "shore" ? t : "sea"; }
  if (estuaryWater(x, y)) return "river";
  if (bayWater(x, y)) return x >= abyssX(y) ? "abyss" : "sea"; // la fosa sigue al norte: cortada en y = WORLD.y0 dibujaba una L con su borde oeste
  return builtAt(x, y) ?? "jungle";
}

/** Agua en un punto, con el clasificador que le toque: el del contenido adentro de WORLD, el del sangrado afuera. */
export function isWaterAt(x: number, y: number): boolean {
  if (x >= WORLD.x0 && x < WORLD.x1 && y >= WORLD.y0 && y < WORLD.y1) return WATER_TERRAIN.has(terrainAt(x, y));
  return BLEED_WATER.has(bleedTerrainAt(x, y));
}

/** `true` si ninguna celda de la grilla de `CELL` (anclada en WORLD.x0/y0) que corta el rectángulo agrandado `margin` tiene el centro en agua. */
export function clearOfWater(x0: number, y0: number, x1: number, y1: number, margin: number): boolean {
  const i0 = Math.floor((x0 - margin - WORLD.x0) / CELL), i1 = Math.floor((x1 + margin - WORLD.x0) / CELL);
  const j0 = Math.floor((y0 - margin - WORLD.y0) / CELL), j1 = Math.floor((y1 + margin - WORLD.y0) / CELL);
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) if (isWaterAt(WORLD.x0 + (i + 0.5) * CELL, WORLD.y0 + (j + 0.5) * CELL)) return false;
  return true;
}
