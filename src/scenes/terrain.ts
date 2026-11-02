import { v3 } from "../iso/geometry";
import type { Solid, Tri } from "../iso/solids";
import { BLEED, CELL, CELL_BLEED, DOCK, TIP_BOX, WORLD, abyssX, worldZoneAt, type WorldZone } from "../map/geo";
import type { Material } from "../map/palette-iso";
import type { Rng } from "../map/seed";
import { depthAt } from "./depth-map";
import { bayShoreX, beyondBuilt, inFairBox } from "./sprawl-grid";
import { BLEED_WATER, WATER_TERRAIN, bleedTerrainAt, terrainAt, type BleedTerrain, type Terrain } from "./terrain-classify";

/**
 * Terrain of the whole world: a faceted CELL grid over WORLD (the
 * content) plus a CELL_BLEED one around it (the bleed). Each zone contributes
 * its classifier; `terrainAt` dispatches by geography. A single mesh per
 * grid guarantees that the vertices at the seams share height. The water
 * (content and bleed) is split by depth (distance to
 * land) in `TerrainMesh.water`, one `Solid` per `WaterMat` (`shallow`,
 * `water`, `waterDeep`, `abyss`), plus `TerrainMesh.foam` along the coast;
 * it is split here only once. `water-animator.ts` claims those `Solid`s and
 * mutates their `toneOffset` in place at each step, just like the shipyard with its other
 * animated bodies; the terrain knows nothing about that. The bleed water is subdivided into cells of
 * `CELL_BLEED`, except in `TIP_BOX` (the south tip of the island), which uses cells of
 * `CELL`. A 9 u subdivision inside the cover was tried; the measurement-gated
 * decision discarded it, see spec §"Desvíos de la implementación".
 */
// The classification lives in `terrain-classify.ts` (below `depth-map.ts`, which needs it): here it is
// re-exported as is, so whoever already asked `terrain.ts` for it keeps working the same.
export { bleedTerrainAt, cityTerrainAt, seaTerrainAt, shipyardTerrainAt, terrainAt, type BleedTerrain, type Terrain } from "./terrain-classify";

export { CELL };
const WATER_Z = -1;

export type WaterMat = "shallow" | "water" | "waterDeep" | "abyss";
export const WATER_MATS: readonly WaterMat[] = ["shallow", "water", "waterDeep", "abyss"];
// FOAM_W = 9 (not the spec's 3): the spec measures in fine units, but depthAt quantizes on the CELL = 6
// grid (plus the diagonal, 8.49), so the first chain of water cells next to land is already
// 6 u away; 9 covers it without reaching the second chain.
export const SHALLOW_D = 12, DEEP_D = 48, FOAM_W = 9;
const ABYSS_RAMP = 60;

export interface TerrainMesh { ground: Solid[]; bleed: Solid[]; water: Solid[]; foam: Solid }

/** Terrains that do go into the land mesh: without the dock pit or the water. */
type GroundTerrain = Exclude<Terrain, "dock" | "water" | "sea" | "shore" | "abyss">;

const HILL_H = 12, HILL_REACH = 180, HILL_JITTER = 3, ROCK_FROM_Z = 9;
const HILL_TAPER = 72; // the northern hills drop to 0 over the 4 cells before the jungle/bay cut, so the jungle meets the water at 0.6 and there is no cliff without a face
/** Base height of the bleed jungle: hills that rise with distance beyond the built land, only behind it (north and west). To the south and east it stays flat. */
export function bleedZ(x: number, y: number): number {
  let hill = Math.min(1, beyondBuilt(x, y) / HILL_REACH);
  if (y < WORLD.y0) hill *= Math.min(1, Math.max(0, (bayShoreX(y) - x) / HILL_TAPER));
  return 0.6 + HILL_H * hill;
}

const HEADLAND_BASE_Z = 1, HEADLAND_TOP_Z = 7, HEADLAND_RISE_X0 = 330, HEADLAND_RISE_X1 = 355;
/** The point rises from its base to the lighthouse: ramp in x, with the `headland` jitter on top. */
export const headlandZ = (x: number): number => {
  const t = Math.min(1, Math.max(0, (x - HEADLAND_RISE_X0) / (HEADLAND_RISE_X1 - HEADLAND_RISE_X0)));
  return HEADLAND_BASE_Z + (HEADLAND_TOP_Z - HEADLAND_BASE_Z) * t;
};

const BASE_Z: Record<Terrain, number> = { slab: 0, water: WATER_Z, east: 0, jungle: 0.6, dock: -DOCK.depth, asphalt: 0, sea: WATER_Z, shore: WATER_Z, headland: HEADLAND_TOP_Z, reef: 0.5, abyss: WATER_Z };
const JITTER: Record<Terrain, number> = { slab: 0.4, water: 0, east: 0.5, jungle: 0.8, dock: 0, asphalt: 0.1, sea: 0, shore: 0, headland: 1.5, reef: 0.3, abyss: 0 };
// Only the terrains that reach `ground()`: the scene furnishes the dock pit and the water is
// split by depth in `WATER_MATS`, so neither of the two has a material here.
const MAT: Record<GroundTerrain, Material> = { slab: "slab", east: "sand", jungle: "leafDark", asphalt: "asphalt", headland: "rock", reef: "rock" };
const BLEED_MAT: Record<Exclude<BleedTerrain, "sea" | "shore" | "abyss" | "river">, Material> = { jungle: "leafDark", industrial: "slab", urban: "asphalt", fair: "sand" };
const BLEED_BUILT = new Set<BleedTerrain>(["industrial", "urban", "fair"]);

const onSeam = (x: number, y: number): boolean => x === WORLD.x0 || x === WORLD.x1 || y === WORLD.y0 || y === WORLD.y1;
/** Base z of the content at a point (no jitter); at the seam both grids use this. */
const contentBaseZ = (x: number, y: number): number => {
  const t = terrainAt(Math.min(x, WORLD.x1 - 1), Math.min(y, WORLD.y1 - 1));
  return t === "headland" ? headlandZ(x) : BASE_Z[t];
};

/** Water material at a point by depth (distance to land); the trench rules by geography. Null on land. */
export function waterBand(x: number, y: number): WaterMat | null {
  const inside = x >= WORLD.x0 && x < WORLD.x1 && y >= WORLD.y0 && y < WORLD.y1;
  const t = inside ? terrainAt(x, y) : bleedTerrainAt(x, y);
  if (inside ? !WATER_TERRAIN.has(t as Terrain) : !BLEED_WATER.has(t as BleedTerrain)) return null;
  if (t === "abyss") return "abyss";
  return depthBand(x, y);
}
const depthBand = (x: number, y: number): WaterMat => { const d = depthAt(x, y); return d < SHALLOW_D ? "shallow" : d <= DEEP_D ? "water" : "waterDeep"; };

/** Fixed noise per cell in [−1, 1) (integer mixing, like `triMix` in water-anim.ts). */
const cellNoise = (x: number, y: number): number => {
  let h = (Math.floor(x) * 374761393 + Math.floor(y) * 668265263 + 7 * 1013904223) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (((h ^ (h >>> 16)) >>> 0) / 4294967296) * 2 - 1;
};
const ABYSS_DITHER = 15;
/**
 * Material of a water cell: `waterBand`, except within ABYSS_DITHER of `abyssX`, where the
 * trench edge is decided with per-cell noise. Without this the material change was a clean
 * straight screen line (the wave does not cross materials and does not break it).
 */
export function waterCellMat(x: number, y: number): WaterMat | null {
  const m = waterBand(x, y);
  if (!m) return null;
  const off = x - abyssX(y);
  if (Math.abs(off) >= ABYSS_DITHER) return m;
  return off + ABYSS_DITHER * cellNoise(x, y) >= 0 ? "abyss" : depthBand(x, y);
}

/**
 * Position within the band, +1 (shallow edge, next to land) … −1 (deep edge), continuous:
 * `water-anim.ts` rounds it together with the wave, so the per-triangle noise dithers the depth
 * contours (rounded here they gave long straight lines in the open sea, where the wave is low).
 */
export function baseToneAt(x: number, y: number, mat: WaterMat): number {
  const d = depthAt(x, y);
  // "shallow" never sees d = 0 (depthAt quantizes in CELL steps): the first water cell is already at
  // CELL from land, so the fraction starts there, not at 0, or the whole band would round to 0.
  const frac = mat === "shallow" ? Math.max(0, (d - CELL) / (SHALLOW_D - CELL)) : mat === "water" ? (d - SHALLOW_D) / (DEEP_D - SHALLOW_D) : mat === "waterDeep" ? Math.min(1, (d - DEEP_D) / DEEP_D) : Math.min(1, Math.max(0, (x - abyssX(y)) / ABYSS_RAMP));
  return Math.max(-1, Math.min(1, 1 - 2 * frac));
}

type WaterTris = Record<WaterMat, Tri[]>;
const newWaterTris = (): WaterTris => ({ shallow: [], water: [], waterDeep: [], abyss: [] });

/**
 * Two water triangles per cell, with `baseTone` from its center, and a copy in
 * `foam` if they are within FOAM_W of land.
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

/** Two triangles per cell with an alternating diagonal: the "papercraft" does not read as a grid of squares. */
function cellTris(out: Tri[], x0: number, y0: number, x1: number, y1: number, za: number, zb: number, zc: number, zd: number, flat: number | null, i: number, j: number): void {
  const p = (x: number, y: number, z: number) => v3(x, y, flat ?? z);
  const a = p(x0, y0, za), b = p(x1, y0, zb), c = p(x1, y1, zc), d = p(x0, y1, zd);
  if ((i + j) % 2 === 0) out.push({ pts: [a, b, c] }, { pts: [a, c, d] });
  else out.push({ pts: [a, b, d] }, { pts: [b, c, d] });
}

/**
 * CELL_BLEED grid around WORLD. It shares vertices with the CELL one at the seam (sides that are multiples of 18) and carries no jitter there. The bleed water uses the same cells, without subdividing except `TIP_BOX` (measurement-gated decision, see spec §"Desvíos de la implementación"). In `TIP_BOX` (the south tip of the island) the cells whose center falls inside are split into 3×3 of 6 u, land and water, classified by their center; their new vertices take their height from `tipVertexZ` (by position, no rng: the 18 u grid's stream does not change).
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
      if (inside(x, y)) { z[j]!.push(onSeam(x, y) ? contentBaseZ(x, y) : 0); continue; } // interior: unused; seam: content z
      // the bay shore is a curve finer than the grid: inside the fair's
      // rectangle we always treat it as flat land, even if that particular vertex is already bay,
      // so the sand does not slope toward the water (the neighboring water cell does not read this array).
      // The row of vertices on the fair's south edge too: the sand cell above reads them, and
      // on the bay side they would be water at −1 (the sand would sink toward the south).
      if (inFairBox(x, y) || inFairBox(x, y - CELL_BLEED)) { z[j]!.push(r * JITTER.asphalt); continue; }
      const t = bleedTerrainAt(x, y);
      if (BLEED_WATER.has(t)) { z[j]!.push(WATER_Z); continue; }
      if (BLEED_BUILT.has(t)) { z[j]!.push(r * JITTER.asphalt); continue; } // built land: flat like the content's asphalt
      const base = bleedZ(x, y);
      z[j]!.push(base + r * (base > 0.6 ? HILL_JITTER : JITTER.jungle));
    }
  }
  const tris: Partial<Record<Material, Tri[]>> = { leafDark: [], rock: [], slab: [], asphalt: [], sand: [] };
  const landMat = (t: BleedTerrain, cx: number, cy: number): Material => t === "jungle" ? (bleedZ(cx, cy) > ROCK_FROM_Z ? "rock" : "leafDark") : BLEED_MAT[t as "industrial" | "urban" | "fair"];
  // height of a south-tip vertex: seam = content; water = WATER_Z; land = relief + noise by position
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
 * CELL grid over WORLD with per-vertex heights; each cell is two
 * triangles classified by their center. `zones` filters cells by clickable
 * zone (and then there is no bleed: the zone pages do not use it).
 */
export function buildTerrain(rng: Rng, zones?: readonly WorldZone[]): TerrainMesh {
  const cols = (WORLD.x1 - WORLD.x0) / CELL, rows = (WORLD.y1 - WORLD.y0) / CELL;
  const z: number[][] = [];
  for (let j = 0; j <= rows; j++) {
    z.push([]);
    for (let i = 0; i <= cols; i++) {
      const x = WORLD.x0 + i * CELL, y = WORLD.y0 + j * CELL;
      const t = terrainAt(Math.min(x, WORLD.x1 - 1), Math.min(y, WORLD.y1 - 1));
      const jitter = onSeam(x, y) ? 0 : JITTER[t]; // the seam with the bleed carries no jitter: the two grids coincide there
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
    if (t === "dock") continue; // the shipyard scene furnishes the pit
    if (WATER_TERRAIN.has(t)) { waterCell(w, foam, x0, y0, x1, y1, i, j); continue; }
    cellTris(tris[t], x0, y0, x1, y1, z[j]![i]!, z[j]![i + 1]!, z[j + 1]![i + 1]!, z[j + 1]![i]!, null, i, j); // no terrain that reaches here is flat: the dock pit was skipped above
  }
  const ground = (t: GroundTerrain): Solid => ({ kind: "ground", mat: MAT[t], tris: tris[t] });
  return {
    ground: [ground("slab"), ground("east"), ground("jungle"), ground("asphalt"), ground("headland"), ground("reef")],
    bleed: zones ? [] : buildBleed(rng, w, foam),
    water: waterSolids(w),
    foam: { kind: "ground", mat: "foam", tris: foam },
  };
}
