import { v3 } from "../iso/geometry";
import type { Solid, Tri } from "../iso/solids";
import { BLEED, CELL, CELL_BLEED, DOCK, TIP_BOX, WORLD, abyssX, worldZoneAt, type WorldZone } from "../map/geo";
import type { Material } from "../map/palette-iso";
import type { Rng } from "../map/seed";
import { depthAt } from "./depth-map";
import { bayShoreX, beyondBuilt, inFairBox } from "./sprawl-grid";
import { BLEED_WATER, WATER_TERRAIN, bleedTerrainAt, terrainAt, type BleedTerrain, type Terrain } from "./terrain-classify";

/**
 * Terreno de todo el mundo: una grilla facetada de CELL sobre WORLD (el
 * contenido) más una de CELL_BLEED alrededor (el sangrado). Cada zona aporta
 * su clasificador; `terrainAt` despacha por geografía. Una sola malla por
 * grilla garantiza que los vértices en las costuras compartan altura. El agua
 * (de contenido y de sangrado) se reparte por profundidad (distancia a
 * tierra) en `TerrainMesh.water`, un `Solid` por `WaterMat` (`shallow`,
 * `water`, `waterDeep`, `abyss`), más `TerrainMesh.foam` junto a la costa;
 * se reparte acá una sola vez. `water-animator.ts` reclama esos `Solid` y les
 * muta `toneOffset` in place a cada paso, igual que el astillero con sus otros
 * cuerpos animados; el terreno no sabe nada de eso. El agua del sangrado se subdivide en celdas de
 * `CELL_BLEED`, salvo en `TIP_BOX` (la punta sur de la isla), que va en celdas de
 * `CELL`. Se probó una subdivisión a 9 u dentro del cover; la decisión gateada
 * por medición la descartó, ver spec §"Desvíos de la implementación".
 */
// La clasificación vive en `terrain-classify.ts` (abajo de `depth-map.ts`, que la necesita): acá se
// reexporta tal cual, así quien ya la pedía a `terrain.ts` sigue igual.
export { bleedTerrainAt, cityTerrainAt, seaTerrainAt, shipyardTerrainAt, terrainAt, type BleedTerrain, type Terrain } from "./terrain-classify";

export { CELL };
const WATER_Z = -1;

export type WaterMat = "shallow" | "water" | "waterDeep" | "abyss";
export const WATER_MATS: readonly WaterMat[] = ["shallow", "water", "waterDeep", "abyss"];
// FOAM_W = 9 (no el 3 de la spec): la spec mide en unidades finas, pero depthAt cuantiza en la grilla
// de CELL = 6 (más la diagonal, 8.49), así que la primera cadena de celdas de agua junto a tierra ya
// está a 6 u; 9 la cubre sin llegar a la segunda cadena.
export const SHALLOW_D = 12, DEEP_D = 48, FOAM_W = 9;
const ABYSS_RAMP = 60;

export interface TerrainMesh { ground: Solid[]; bleed: Solid[]; water: Solid[]; foam: Solid }

/** Terrenos que sí van a la malla de tierra: sin el pozo del dique ni el agua. */
type GroundTerrain = Exclude<Terrain, "dock" | "water" | "sea" | "shore" | "abyss">;

const HILL_H = 12, HILL_REACH = 180, HILL_JITTER = 3, ROCK_FROM_Z = 9;
const HILL_TAPER = 72; // las lomas del norte bajan a 0 en las 4 celdas antes del corte selva/bahía, así la selva llega al agua a 0.6 y no hay acantilado sin cara
/** Altura base de la selva del sangrado: lomas que suben con la distancia más allá de la tierra construida, solo detrás de ella (norte y oeste). Al sur y al este queda chato. */
export function bleedZ(x: number, y: number): number {
  let hill = Math.min(1, beyondBuilt(x, y) / HILL_REACH);
  if (y < WORLD.y0) hill *= Math.min(1, Math.max(0, (bayShoreX(y) - x) / HILL_TAPER));
  return 0.6 + HILL_H * hill;
}

const HEADLAND_BASE_Z = 1, HEADLAND_TOP_Z = 7, HEADLAND_RISE_X0 = 330, HEADLAND_RISE_X1 = 355;
/** La punta sube desde su base hasta el faro: rampa en x, con el jitter de `headland` encima. */
export const headlandZ = (x: number): number => {
  const t = Math.min(1, Math.max(0, (x - HEADLAND_RISE_X0) / (HEADLAND_RISE_X1 - HEADLAND_RISE_X0)));
  return HEADLAND_BASE_Z + (HEADLAND_TOP_Z - HEADLAND_BASE_Z) * t;
};

const BASE_Z: Record<Terrain, number> = { slab: 0, water: WATER_Z, east: 0, jungle: 0.6, dock: -DOCK.depth, asphalt: 0, sea: WATER_Z, shore: WATER_Z, headland: HEADLAND_TOP_Z, reef: 0.5, abyss: WATER_Z };
const JITTER: Record<Terrain, number> = { slab: 0.4, water: 0, east: 0.5, jungle: 0.8, dock: 0, asphalt: 0.1, sea: 0, shore: 0, headland: 1.5, reef: 0.3, abyss: 0 };
// Solo los terrenos que llegan a `ground()`: el pozo del dique lo amuebla la escena y el agua se
// reparte por profundidad en `WATER_MATS`, así que ninguno de los dos tiene material acá.
const MAT: Record<GroundTerrain, Material> = { slab: "slab", east: "sand", jungle: "leafDark", asphalt: "asphalt", headland: "rock", reef: "rock" };
const BLEED_MAT: Record<Exclude<BleedTerrain, "sea" | "shore" | "abyss" | "river">, Material> = { jungle: "leafDark", industrial: "slab", urban: "asphalt", fair: "sand" };
const BLEED_BUILT = new Set<BleedTerrain>(["industrial", "urban", "fair"]);

const onSeam = (x: number, y: number): boolean => x === WORLD.x0 || x === WORLD.x1 || y === WORLD.y0 || y === WORLD.y1;
/** z base del contenido en un punto (sin jitter); en la costura las dos grillas usan esto. */
const contentBaseZ = (x: number, y: number): number => {
  const t = terrainAt(Math.min(x, WORLD.x1 - 1), Math.min(y, WORLD.y1 - 1));
  return t === "headland" ? headlandZ(x) : BASE_Z[t];
};

/** Material del agua en un punto por profundidad (distancia a tierra); la fosa manda por geografía. Null en tierra. */
export function waterBand(x: number, y: number): WaterMat | null {
  const inside = x >= WORLD.x0 && x < WORLD.x1 && y >= WORLD.y0 && y < WORLD.y1;
  const t = inside ? terrainAt(x, y) : bleedTerrainAt(x, y);
  if (inside ? !WATER_TERRAIN.has(t as Terrain) : !BLEED_WATER.has(t as BleedTerrain)) return null;
  if (t === "abyss") return "abyss";
  return depthBand(x, y);
}
const depthBand = (x: number, y: number): WaterMat => { const d = depthAt(x, y); return d < SHALLOW_D ? "shallow" : d <= DEEP_D ? "water" : "waterDeep"; };

/** Ruido fijo por celda en [−1, 1) (mixing de enteros, como `triMix` en water-anim.ts). */
const cellNoise = (x: number, y: number): number => {
  let h = (Math.floor(x) * 374761393 + Math.floor(y) * 668265263 + 7 * 1013904223) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (((h ^ (h >>> 16)) >>> 0) / 4294967296) * 2 - 1;
};
const ABYSS_DITHER = 15;
/**
 * Material de una celda de agua: `waterBand`, salvo a menos de ABYSS_DITHER de `abyssX`, donde el
 * borde de la fosa se decide con ruido por celda. Sin esto el cambio de material era una recta
 * limpia de pantalla (la ola no cruza materiales y no la rompe).
 */
export function waterCellMat(x: number, y: number): WaterMat | null {
  const m = waterBand(x, y);
  if (!m) return null;
  const off = x - abyssX(y);
  if (Math.abs(off) >= ABYSS_DITHER) return m;
  return off + ABYSS_DITHER * cellNoise(x, y) >= 0 ? "abyss" : depthBand(x, y);
}

/**
 * Posición dentro de la banda, +1 (borde somero, junto a tierra) … −1 (borde profundo), continua:
 * la redondea `water-anim.ts` junto con la ola, así el ruido por triángulo ditherea los contornos de
 * profundidad (redondeada acá daban rectas largas en el mar abierto, donde la ola es baja).
 */
export function baseToneAt(x: number, y: number, mat: WaterMat): number {
  const d = depthAt(x, y);
  // "shallow" nunca ve d = 0 (depthAt cuantiza en pasos de CELL): la primera celda de agua ya está a
  // CELL de tierra, así que la fracción arranca ahí, no en 0, o toda la banda redondearía a 0.
  const frac = mat === "shallow" ? Math.max(0, (d - CELL) / (SHALLOW_D - CELL)) : mat === "water" ? (d - SHALLOW_D) / (DEEP_D - SHALLOW_D) : mat === "waterDeep" ? Math.min(1, (d - DEEP_D) / DEEP_D) : Math.min(1, Math.max(0, (x - abyssX(y)) / ABYSS_RAMP));
  return Math.max(-1, Math.min(1, 1 - 2 * frac));
}

type WaterTris = Record<WaterMat, Tri[]>;
const newWaterTris = (): WaterTris => ({ shallow: [], water: [], waterDeep: [], abyss: [] });

/**
 * Dos triángulos de agua por celda, con `baseTone` por su centro, y copia en
 * `foam` si están a menos de FOAM_W de tierra.
 */
function waterCell(w: WaterTris, foam: Tri[], x0: number, y0: number, x1: number, y1: number, i: number, j: number): void {
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const mat = waterCellMat(cx, cy);
  if (!mat) return;
  const tmp: Tri[] = [];
  cellTris(tmp, x0, y0, x1, y1, WATER_Z, WATER_Z, WATER_Z, WATER_Z, WATER_Z, i, j);
  const base = baseToneAt(cx, cy, mat);
  for (const t of tmp) {
    t.baseTone = base;
    w[mat].push(t);
    if (depthAt(cx, cy) < FOAM_W) foam.push({ pts: t.pts });
  }
}

const waterSolids = (w: WaterTris): Solid[] => WATER_MATS.filter((m) => w[m].length > 0).map((m): Solid => ({ kind: "ground", mat: m, tris: w[m] }));

/** Dos triángulos por celda con diagonal alternada: el "papercraft" no se lee como una grilla de cuadrados. */
function cellTris(out: Tri[], x0: number, y0: number, x1: number, y1: number, za: number, zb: number, zc: number, zd: number, flat: number | null, i: number, j: number): void {
  const p = (x: number, y: number, z: number) => v3(x, y, flat ?? z);
  const a = p(x0, y0, za), b = p(x1, y0, zb), c = p(x1, y1, zc), d = p(x0, y1, zd);
  if ((i + j) % 2 === 0) out.push({ pts: [a, b, c] }, { pts: [a, c, d] });
  else out.push({ pts: [a, b, d] }, { pts: [b, c, d] });
}

/**
 * Grilla de CELL_BLEED alrededor de WORLD. Comparte vértices con la de CELL en la costura (lados múltiplos de 18) y ahí no lleva jitter. El agua del sangrado usa las mismas celdas, sin subdividir salvo `TIP_BOX` (decisión gateada por medición, ver spec §"Desvíos de la implementación"). En `TIP_BOX` (la punta sur de la isla) las celdas cuyo centro cae adentro se parten en 3×3 de 6 u, tierra y agua, clasificadas por su centro; sus vértices nuevos toman altura de `tipVertexZ` (por posición, sin rng: el stream de la grilla de 18 u no cambia).
 */
function buildBleed(rng: Rng, w: WaterTris, foam: Tri[]): Solid[] {
  const bx0 = WORLD.x0 - BLEED.x, by0 = WORLD.y0 - BLEED.y, bx1 = WORLD.x1 + BLEED.x, by1 = WORLD.y1 + BLEED.y;
  const cols = (bx1 - bx0) / CELL_BLEED, rows = (by1 - by0) / CELL_BLEED;
  const inside = (x: number, y: number) => x >= WORLD.x0 && x <= WORLD.x1 && y >= WORLD.y0 && y <= WORLD.y1;
  const z: number[][] = [];
  for (let j = 0; j <= rows; j++) {
    z.push([]);
    for (let i = 0; i <= cols; i++) {
      const x = bx0 + i * CELL_BLEED, y = by0 + j * CELL_BLEED;
      const r = rng.next() * 2 - 1;
      if (inside(x, y)) { z[j]!.push(onSeam(x, y) ? contentBaseZ(x, y) : 0); continue; } // interior: no se usa; costura: z del contenido
      // la orilla de la bahía es una curva más fina que la grilla: dentro del rectángulo de la
      // feria la tratamos siempre como tierra plana, aunque ese vértice puntual ya sea bahía,
      // para que la arena no se incline hacia el agua (la celda de agua vecina no lee este arreglo).
      // La fila de vértices del borde sur de la feria también: la celda de arena de arriba los lee, y
      // del lado de la bahía serían agua a −1 (la arena se hundiría hacia el sur).
      if (inFairBox(x, y) || inFairBox(x, y - CELL_BLEED)) { z[j]!.push(r * JITTER.asphalt); continue; }
      const t = bleedTerrainAt(x, y);
      if (BLEED_WATER.has(t)) { z[j]!.push(WATER_Z); continue; }
      if (BLEED_BUILT.has(t)) { z[j]!.push(r * JITTER.asphalt); continue; } // tierra construida: plana como el asfalto del contenido
      const base = bleedZ(x, y);
      z[j]!.push(base + r * (base > 0.6 ? HILL_JITTER : JITTER.jungle));
    }
  }
  const tris: Partial<Record<Material, Tri[]>> = { leafDark: [], rock: [], slab: [], asphalt: [], sand: [] };
  const landMat = (t: BleedTerrain, cx: number, cy: number): Material => t === "jungle" ? (bleedZ(cx, cy) > ROCK_FROM_Z ? "rock" : "leafDark") : BLEED_MAT[t as "industrial" | "urban" | "fair"];
  // altura de un vértice de la punta sur: costura = contenido; agua = WATER_Z; tierra = relieve + ruido por posición
  const tipVertexZ = (x: number, y: number): number => {
    if (inside(x, y)) return contentBaseZ(x, y);
    if (BLEED_WATER.has(bleedTerrainAt(x, y))) return WATER_Z;
    return bleedZ(x, y) + cellNoise(x, y) * JITTER.jungle;
  };
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const x0 = bx0 + i * CELL_BLEED, y0 = by0 + j * CELL_BLEED, x1 = x0 + CELL_BLEED, y1 = y0 + CELL_BLEED;
    const cx = x0 + CELL_BLEED / 2, cy = y0 + CELL_BLEED / 2;
    if (inside(cx, cy)) continue;
    if (cx >= TIP_BOX.x0 && cx <= TIP_BOX.x1 && cy >= TIP_BOX.y0 && cy <= TIP_BOX.y1) {
      const n = CELL_BLEED / CELL;
      for (let sj = 0; sj < n; sj++) for (let si = 0; si < n; si++) {
        const sx0 = x0 + si * CELL, sy0 = y0 + sj * CELL, sx1 = sx0 + CELL, sy1 = sy0 + CELL;
        const scx = sx0 + CELL / 2, scy = sy0 + CELL / 2;
        const st = bleedTerrainAt(scx, scy);
        if (BLEED_WATER.has(st)) { waterCell(w, foam, sx0, sy0, sx1, sy1, i * n + si, j * n + sj); continue; }
        cellTris(tris[landMat(st, scx, scy)]!, sx0, sy0, sx1, sy1, tipVertexZ(sx0, sy0), tipVertexZ(sx1, sy0), tipVertexZ(sx1, sy1), tipVertexZ(sx0, sy1), null, i * n + si, j * n + sj);
      }
      continue;
    }
    const t = bleedTerrainAt(cx, cy);
    if (BLEED_WATER.has(t)) { waterCell(w, foam, x0, y0, x1, y1, i, j); continue; }
    cellTris(tris[landMat(t, cx, cy)]!, x0, y0, x1, y1, z[j]![i]!, z[j]![i + 1]!, z[j + 1]![i + 1]!, z[j + 1]![i]!, null, i, j);
  }
  return (Object.keys(tris) as Material[]).filter((m) => tris[m]!.length > 0).map((m): Solid => ({ kind: "ground", mat: m, tris: tris[m]! }));
}

/**
 * Grilla de CELL sobre WORLD con alturas por vértice; cada celda son dos
 * triángulos clasificados por su centro. `zones` filtra celdas por zona
 * clickeable (y entonces no hay sangrado: las páginas de zona no lo usan).
 */
export function buildTerrain(rng: Rng, zones?: readonly WorldZone[]): TerrainMesh {
  const cols = (WORLD.x1 - WORLD.x0) / CELL, rows = (WORLD.y1 - WORLD.y0) / CELL;
  const z: number[][] = [];
  for (let j = 0; j <= rows; j++) {
    z.push([]);
    for (let i = 0; i <= cols; i++) {
      const x = WORLD.x0 + i * CELL, y = WORLD.y0 + j * CELL;
      const t = terrainAt(Math.min(x, WORLD.x1 - 1), Math.min(y, WORLD.y1 - 1));
      const jitter = onSeam(x, y) ? 0 : JITTER[t]; // la costura con el sangrado no lleva jitter: las dos grillas coinciden ahí
      z[j]!.push(contentBaseZ(x, y) + (rng.next() * 2 - 1) * jitter);
    }
  }
  const tris = {} as Record<Terrain, Tri[]>;
  for (const t of Object.keys(BASE_Z) as Terrain[]) tris[t] = [];
  const w = newWaterTris(), foam: Tri[] = [];
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const x0 = WORLD.x0 + i * CELL, y0 = WORLD.y0 + j * CELL, x1 = x0 + CELL, y1 = y0 + CELL;
    const cx = x0 + CELL / 2, cy = y0 + CELL / 2;
    if (zones && !zones.includes(worldZoneAt(cx, cy))) continue;
    const t = terrainAt(cx, cy);
    if (t === "dock") continue; // el pozo lo amuebla la escena del astillero
    if (WATER_TERRAIN.has(t)) { waterCell(w, foam, x0, y0, x1, y1, i, j); continue; }
    cellTris(tris[t], x0, y0, x1, y1, z[j]![i]!, z[j]![i + 1]!, z[j + 1]![i + 1]!, z[j + 1]![i]!, null, i, j); // ningún terreno que llegue acá es plano: el pozo del dique salió arriba
  }
  const ground = (t: GroundTerrain): Solid => ({ kind: "ground", mat: MAT[t], tris: tris[t] });
  return {
    ground: [ground("slab"), ground("east"), ground("jungle"), ground("asphalt"), ground("headland"), ground("reef")],
    bleed: zones ? [] : buildBleed(rng, w, foam),
    water: waterSolids(w),
    foam: { kind: "ground", mat: "foam", tris: foam },
  };
}
