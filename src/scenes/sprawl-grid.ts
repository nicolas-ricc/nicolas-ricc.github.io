import { CELL_BLEED, QUAY_X, RIVER_HALF, WORLD, ZONE_SPLIT_X, ZONE_SPLIT_Y, inCoverQuad, islandEastX, islandWestX, riverCenter } from "../map/geo";
import { BLOCK_D, BLOCK_W, CITY_EDGE, ROWS, WEST_COLS, type Rect } from "./city-grid";

/**
 * Geografía de los márgenes: qué parte del sangrado es tierra construida y de
 * qué zona. Módulo puro y sin rng, como city-grid: lo comparten el terreno
 * (`bleedTerrainAt`) y las escenas del distrito tecnológico y del hinterland, así el
 * asfalto y las manzanas no pueden desalinearse.
 * Spec: docs/superpowers/specs/2026-09-15-margenes-urbanos-design.md §3.
 */
export type Built = "industrial" | "urban" | "fair";

/** Hasta dónde llega la tierra construida desde el borde del contenido, por lado. Múltiplos de CELL_BLEED. */
export const REACH = { n: 16 * CELL_BLEED, w: 8 * CELL_BLEED, s: 16 * CELL_BLEED } as const;
const WOBBLE = 2 * CELL_BLEED;

/** La feria: franja de arena al norte de la fábrica hasta la orilla de la bahía. Bordes alineados a la grilla del sangrado (anclada en (−402, −438)). */
export const FAIR = { x0: 84, y0: -312, y1: -168 } as const;
/** Orilla oeste de la bahía para cada y (≈ 213..270 en la franja de la feria). */
export const bayShoreX = (y: number): number => riverCenter(y) - RIVER_HALF;

/** El rectángulo geométrico de la feria, agua incluida (a diferencia de `fairAt`, que excluye la bahía). Lo comparten `builtAt` y el aplanado de vértices del sangrado en terrain.ts. */
export const inFairBox = (x: number, y: number): boolean => y < WORLD.y0 && x >= FAIR.x0 && y >= FAIR.y0 && y < FAIR.y1;

/** El borde de la tierra construida ondula a lo largo del lado: nunca es una línea recta. */
export function reachAt(side: keyof typeof REACH, along: number): number {
  return REACH[side] + WOBBLE * (0.5 + 0.5 * Math.sin(along / 61 + (side === "s" ? 1.7 : 0.4)));
}

/** Cuánto se aleja el punto del contenido hacia el sur (positivo fuera del contenido). */
const southDist = (y: number): number => y - WORLD.y1;
const westDist = (x: number): number => WORLD.x0 - x;
const northDist = (y: number): number => WORLD.y0 - y;

/** La bahía sigue hacia el norte al este de la orilla oeste del río. */
export const bayWater = (x: number, y: number): boolean => y < WORLD.y0 && x >= bayShoreX(y);
/** Al sur del contenido el estuario sigue hasta juntarse con el mar, rodeando la punta sur de la isla (se redondea y termina en y ≈ 380; después es toda agua). */
export const estuaryWater = (x: number, y: number): boolean => y > WORLD.y1 && x >= QUAY_X && x < ZONE_SPLIT_X && (x <= islandWestX(y) || x >= islandEastX(y));

/**
 * Tierra construida en un punto fuera del contenido, o null si es selva, loma
 * o agua. Industrial al norte y al oeste de Portfolio (`y < ZONE_SPLIT_Y`),
 * urbano al oeste y al sur de Resume. En las esquinas manda el alcance del
 * lado que corresponde a cada eje: la esquina NO es industrial, la SO urbana.
 * Dentro de `FAIR`, al este de la industrial y al oeste de la bahía, es la
 * feria de arena.
 */
export function builtAt(x: number, y: number): Built | null {
  if (bayWater(x, y) || estuaryWater(x, y) || x > WORLD.x1) return null;
  if (y > WORLD.y1 && x >= QUAY_X) return null; // al sur, desde el muelle hacia el este: estuario, la lengua de selva entre él y el mar, y el mar
  if (x < WORLD.x0 && y >= GREEN_BELT.y0 && y < GREEN_BELT.y1) return null; // el cinturón verde entre la fábrica y la ciudad sigue hacia el oeste
  const s = southDist(y), w = westDist(x), n = northDist(y);
  if (s > 0 && s > reachAt("s", x)) return null;
  if (w > 0 && w > reachAt("w", y)) return null;
  if (n > 0 && n > reachAt("n", x)) return null;
  if (s <= 0 && w <= 0 && n <= 0) return null; // adentro del contenido
  if (inFairBox(x, y)) return "fair";
  return y < ZONE_SPLIT_Y ? "industrial" : "urban";
}

/** La feria: franja de arena en el sangrado norte, entre la fábrica y la bahía. */
export const fairAt = (x: number, y: number): boolean => builtAt(x, y) === "fair";

/** Cinturón verde entre el hinterland y el distrito tecnológico: prolonga la selva del sur de la playa de vías (`y ≥ 110`) y el cinturón de costura de la ciudad (hasta `CITY_EDGE.north`). */
export const GREEN_BELT = { y0: 110, y1: CITY_EDGE.north } as const;

/** Suelo urbano en un punto, adentro o afuera del contenido: el distrito tecnológico arma manzanas solo donde esto es cierto en las cuatro esquinas y el centro. */
export function urbanAt(x: number, y: number): boolean {
  if (x < WORLD.x0 || y > WORLD.y1) return builtAt(x, y) === "urban";
  if (x >= QUAY_X || y < CITY_EDGE.north) return false;
  return x < CITY_EDGE.west || y >= CITY_EDGE.south; // los bordes de la ciudad que pasaron a asfalto
}

export interface SprawlBlock extends Rect { dist: number }

/** Columnas del distrito tecnológico al oeste de la ciudad (cada 30 desde −84, como `WEST_COLS`) y filas al sur de la ciudad (cada 24 desde 328). */
export const SUBURB_COLS = [-84, -114, -144, -174, -204, -234, -264] as const;
export const SUBURB_ROWS = [328, 352, 376, 400, 424, 448, 472, 496, 520, 544, 568, 592, 616, 640] as const;

/** Una manzana cuyo centro queda a más de esto del cover 16:9 no se arma: la cámara del sitio nunca la muestra. */
export const COVER_MARGIN = 30;

const blockAt = (x: number, y: number): SprawlBlock | null => {
  const w = BLOCK_W, d = BLOCK_D;
  if (!inCoverQuad(x + w / 2, y + d / 2, 16 / 9, COVER_MARGIN)) return null;
  for (const [px, py] of [[x, y], [x + w, y], [x + w, y + d], [x, y + d], [x + w / 2, y + d / 2]] as const) if (!urbanAt(px, py)) return null;
  return { x, y, w, d, dist: Math.max(0, WORLD.x0 - (x + w), y - WORLD.y1) };
};

/** Manzanas del distrito tecnológico: las del oeste siguen las filas de la ciudad (y respetan la avenida), las del sur suman las columnas de la ciudad. Sin rng. */
export function suburbBlocks(): SprawlBlock[] {
  const out: SprawlBlock[] = [];
  for (const y of ROWS) for (const x of SUBURB_COLS) { const b = blockAt(x, y); if (b) out.push(b); }
  for (const y of SUBURB_ROWS) for (const x of [...SUBURB_COLS, ...WEST_COLS]) { const b = blockAt(x, y); if (b) out.push(b); }
  return out;
}

/** Distancia del punto al borde de la tierra construida hacia el norte o el oeste (los lados que quedan detrás de la cámara), 0 sobre ella. */
export function beyondBuilt(x: number, y: number): number {
  const w = westDist(x) - reachAt("w", y), n = northDist(y) - reachAt("n", x);
  return Math.max(0, w, n);
}
