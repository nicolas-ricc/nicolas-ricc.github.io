import { Z_SCALE } from "../iso/project";
import { isBehind, overlaps, screenBounds } from "../iso/depth";
import { v3, type Vec2 } from "../iso/geometry";
import { bounds, type Bounds } from "../iso/solids";
import { RECIPES } from "../kit/index";
import { LANDMARK_MAX_H } from "../kit/piece";
import { chamferPoly, insetPoly } from "../kit/polygon";
import { polygonDistance } from "../kit/lettering";
import type { Lot, Side, StyleId } from "../kit/types";
import { inCore } from "../map/geo";
import { fieldKind, mixes } from "./strip-mix";
import { createRng, type Rng } from "../map/seed";
import { PLINTH_H } from "../scenes/city-pieces";
import { AVENUE, BLOCK_W, EAST_COLS, FREIGHT_ROW, ROWS, SIDEWALK, STREET, WEST_QUAY, blocks, estuaryEast, type Block, type Rect } from "../scenes/city-grid";
import { isSouthCore, southParcels } from "../scenes/sprawl-grid";
import { SIGN_BACKING } from "../scenes/hotel-plan";
import { TRAIN_CLEAR } from "../scenes/station";
import { COASTAL_CUT_Y, HOTEL_LOT, PITCH, PLAN_BOUNDS, inCrossingPlaza, inPlazaMayor, onAxis, parcels, polyBox, type Parcel } from "../scenes/city-plan";

/**
 * Resume zoning: which neighborhood each block belongs to, which recipes
 * and lights it carries, which buildings are fixed and how its lot is built. Pure module
 * (no scene): city.ts assigns with `assign` and pours; fixed.ts draws the fixed pieces.
 * It does not import city.ts (avoids the cycle).
 */
export type Neighborhood = StyleId;

export const MAX_BUILDING_H = 18;

/** Neighborhood of a block: freight lots, row 92 warehouses, harbor (the two east blocks beside the dock inlet), east bank (collapse included: fixed.ts draws it) and the rest residential. The west bank is zoned by parcel (`neighborhoodOfParcel`). */
export function neighborhoodOf(b: Block): Neighborhood {
  if (b.kind === "freight") return "freight";
  if (b.y === ROWS[0]) return "warehouses";
  if (b.bank === "east" && b.row === -1) return "harbor";
  if (b.bank === "east") return "riverside";
  return "residential";
}

interface Catalogue { recipes: readonly { name: string; weight: number }[]; style: StyleId; lights: { on: number; warm: number } }

/** Recipes with weight, style and lights policy (lit fraction and warm fraction) per neighborhood. Civic does not draw: it only carries fixed pieces. */
export const CATALOGUE = {
  downtown: { recipes: [{ name: "podiumTower", weight: 30 }, { name: "decoStepped", weight: 20 }, { name: "chamfer", weight: 20 }, { name: "classic", weight: 15 }, { name: "cylinderTower", weight: 15 }], style: "downtown", lights: { on: 0.45, warm: 0.3 } },
  bars: { recipes: [{ name: "shopRow", weight: 50 }, { name: "gallery", weight: 20 }, { name: "patioResidential", weight: 20 }, { name: "courtyardO", weight: 10 }, { name: "portalBase", weight: 30 }], style: "bars", lights: { on: 0.7, warm: 0.9 } },
  residential: { recipes: [{ name: "patioResidential", weight: 40 }, { name: "courtyardO", weight: 20 }, { name: "courtyardU", weight: 15 }, { name: "rowHouses", weight: 15 }, { name: "eatenRuin", weight: 10 }], style: "residential", lights: { on: 0.55, warm: 0.95 } },
  civic: { recipes: [], style: "civic", lights: { on: 0.6, warm: 0.7 } },
  riverside: { recipes: [{ name: "classic", weight: 30 }, { name: "lTower", weight: 30 }, { name: "eatenRuin", weight: 40 }], style: "riverside", lights: { on: 0.25, warm: 0.5 } },
  district: { recipes: [{ name: "glassTower", weight: 30 }, { name: "twinTowers", weight: 20 }, { name: "classic", weight: 20 }, { name: "campus", weight: 20 }, { name: "cylinderTower", weight: 10 }], style: "district", lights: { on: 0.4, warm: 0.15 } },
  industrial: { recipes: [], style: "industrial", lights: { on: 0.3, warm: 0 } },
  warehouses: { recipes: [{ name: "loftHall", weight: 30 }, { name: "vaultLoft", weight: 20 }, { name: "brewery", weight: 25 }, { name: "sheetLoft", weight: 15 }, { name: "derelictHall", weight: 10 }], style: "warehouses", lights: { on: 0.6, warm: 0.8 } },
  freight: { recipes: [{ name: "freightShed", weight: 60 }, { name: "openDock", weight: 40 }], style: "freight", lights: { on: 0.3, warm: 0.2 } },
  harbor: { recipes: [], style: "harbor", lights: { on: 0.6, warm: 0.85 } },
  clasico: { recipes: [{ name: "cornerCupola", weight: 30 }, { name: "mansard", weight: 25 }, { name: "classic", weight: 20 }, { name: "portalBase", weight: 15 }, { name: "chamfer", weight: 10 }], style: "clasico", lights: { on: 0.5, warm: 0.95 } },
  transicion: { recipes: [{ name: "balconyBlock", weight: 35 }, { name: "decoStepped", weight: 25 }, { name: "chamfer", weight: 20 }, { name: "courtyardO", weight: 20 }], style: "transicion", lights: { on: 0.5, warm: 0.6 } },
  moderno: { recipes: [{ name: "podiumTower", weight: 45 }, { name: "glassTower", weight: 30 }, { name: "twinTowers", weight: 25 }], style: "moderno", lights: { on: 0.4, warm: 0.15 } },
  bajo: { recipes: [{ name: "rowHouses", weight: 40 }, { name: "patioResidential", weight: 35 }, { name: "courtyardU", weight: 25 }], style: "bajo", lights: { on: 0.55, warm: 0.95 } },
} as const satisfies Record<Neighborhood, Catalogue>;

/** Covered market block: fixed, its front toward the station street (east). */
export const COVERED_MARKET_BLOCK = { x: 72, y: ROWS[0] } as const;
/** Blocks with a fixed recipe: the east bank markets, the fish market, the food hall and the covered market. */
export const FIXED: readonly { x: number; y: number; recipe: string }[] = [
  { x: 280, y: 188, recipe: "market" }, { x: 280, y: 116, recipe: "fishMarket" }, { x: 280, y: 140, recipe: "foodHall" }, { ...COVERED_MARKET_BLOCK, recipe: "coveredMarket" },
];

/** Harbor block with no fixed recipe: it gets only the plinth (city.ts), no building. */
export const isBare = (b: Block): boolean => neighborhoodOf(b) === "harbor" && !FIXED.some((f) => f.x === b.x && f.y === b.y);

/** Cap of a parcel in front of the roof sign: a rect whose box `r × [0, top + PLINTH_H]` overlaps the plate's screen bounds while standing in front of it is cut so its screen top stays at the plate's bottom (floored at 0); anywhere else `top`. */
export function maxHeightFor(r: Rect, top = MAX_BUILDING_H): number {
  const box: Bounds = { min: v3(r.x, r.y, 0), max: v3(r.x + r.w, r.y + r.d, top + PLINTH_H) }, plate = bounds(SIGN_BACKING), plateScreen = screenBounds(plate);
  if (!overlaps(screenBounds(box), plateScreen) || !isBehind(plate, box)) return top;
  return Math.min(top, Math.max(0, ((r.x + r.y) / 2 - plateScreen.maxY) / Z_SCALE - PLINTH_H));
}

/** Sides of the block that face an open space (avenue, dock or east bank): there the recipe may open courtyards and shop windows. */
export function openSides(b: Block): Side[] {
  const out: Side[] = [];
  if (b.y + b.d === AVENUE.y0) out.push("s");
  if (b.y === AVENUE.y1) out.push("n");
  if (b.x === COVERED_MARKET_BLOCK.x && b.y === COVERED_MARKET_BLOCK.y) out.push("e"); // covered market: front toward the station street
  if (b.y === ROWS[0] && !out.includes("s")) out.push("s");                                  // row 92 faces the freight lots and the main line
  if (b.x === EAST_COLS[0] && b.y === FREIGHT_ROW.y && !out.includes("n")) out.push("n");   // east block at the north end of the strip
  if (b.kind === "freight" && !out.includes("s")) out.push("s");                             // freight lots face the main line
  if (b.x + b.w + STREET === WEST_QUAY.x0) out.push("e");
  if (b.bank === "east" && b.x === EAST_COLS[0]) out.push("w");
  return out;
}

/** Weighted recipe with a single draw from `rng`. */
export function pick(rng: Rng, recipes: readonly { name: string; weight: number }[]): string {
  if (recipes.length === 0) throw new Error("empty catalogue");
  const total = recipes.reduce((s, r) => s + r.weight, 0);
  let t = rng.next() * total;
  for (const r of recipes) { t -= r.weight; if (t < 0) return r.name; }
  return recipes[recipes.length - 1]!.name;
}
const BLOCK_D = 18; // depth of the strip and east blocks (city-grid keeps it private)
const adjacent = (a: Block, b: Block): boolean => Math.abs(a.x - b.x) <= BLOCK_W + STREET && Math.abs(a.y - b.y) <= BLOCK_D + STREET;
/** Two rects are adjacent when the gap between them is at most one street on both axes. */
const rectsAdjacent = (a: Rect, b: Rect): boolean => Math.max(a.x - (b.x + b.w), b.x - (a.x + a.w), 0) <= STREET && Math.max(a.y - (b.y + b.d), b.y - (a.y + a.d), 0) <= STREET;

/** Barrios of the west bank by height step: a neighbour may differ by one step at most. */
export type CityBarrio = "bajo" | "clasico" | "transicion" | "moderno";
export const BARRIO_STEP: Record<CityBarrio, number> = { bajo: 0, clasico: 1, transicion: 2, moderno: 3 };
const isCityBarrio = (n: Neighborhood): n is CityBarrio => n in BARRIO_STEP;
/** Height range per barrio, the issue's table: totals above the lot (plinth excluded); the top is the cap (#495). */
export const BARRIO_HEIGHTS: Record<CityBarrio, { lo: number; hi: number }> = { bajo: { lo: 6, hi: 8 }, clasico: { lo: 14, hi: 22 }, transicion: { lo: 24, hi: 34 }, moderno: { lo: 40, hi: 50 } };
/** Cap of a `moderno` tower outside the tower zone. */
export const TOWER_FREE_H = 21;
/** What a `moderno` parcel outside the tower zone draws: slabs, no towers. */
export const MODERNO_SLAB = [{ name: "campus", weight: 50 }, { name: "classic", weight: 50 }] as const;
/** The cell of the water tower host (`patioResidential`, the tower on its courtyard) and of the library (A4: `(103, 201)` is a 21 x 5 wedge, so the nearest parcel that fronts the plaza or the axis). */
export const WATER_TOWER_CELL = { col: 13, row: 291 } as const;
export const LIBRARY_CELL = { col: 73, row: 201 } as const;
/** The cell of the telecommunications tower: a `moderno` parcel of the west; `city()` builds it (`fixed.ts`, `telecom`), it is no kit recipe. */
export const TELECOM_CELL = { col: -107, row: 231 } as const;
/** Parcels with `c.x` below this are "the west" (#479): they come after the east in `assign` and `builtParcels`, and draw only from `districtRng`, so the east keeps the draws it had before. */
export const WEST_DISTRICT_X = -54;
/** Singular pieces by grid cell; `civic` ones take the `civic` neighborhood. */
export const FIXED_PARCELS: readonly { cell: { col: number; row: number }; recipe: string; civic?: true }[] = [
  { cell: { col: 163, row: 321 }, recipe: "civicPalace", civic: true },
  { cell: { col: 133, row: 321 }, recipe: "theatre", civic: true },
  { cell: LIBRARY_CELL, recipe: "library", civic: true },
  { cell: { col: 43, row: 261 }, recipe: "constructionSite" },
  { cell: WATER_TOWER_CELL, recipe: "patioResidential" },
  { cell: TELECOM_CELL, recipe: "telecom" },
];
const cellKey = (c: { col: number; row: number }): string => `${c.col},${c.row}`;
let largestArea: Map<string, number> | undefined; // area of the largest built parcel per cell, computed once (`builtParcels()` never changes)
/** The `FIXED_PARCELS` entry of a parcel (its cell). Of two parcels in one cell the largest by area gets it. */
export function fixedParcel(p: Parcel): (typeof FIXED_PARCELS)[number] | undefined {
  const f = FIXED_PARCELS.find((e) => e.cell.col === p.cell.col && e.cell.row === p.cell.row);
  if (!f) return undefined;
  if (!largestArea) { largestArea = new Map(); for (const q of builtParcels()) largestArea.set(cellKey(q.cell), Math.max(largestArea.get(cellKey(q.cell)) ?? 0, q.area)); }
  return p.area >= (largestArea.get(cellKey(p.cell)) ?? 0) ? f : undefined;
}
/** Towers rise only north of y 320 and from the Plaza Mayor's 150 u out (#495). */
export const towerZone = (p: Parcel): boolean => p.c.y < 320 && p.d >= 150;

/** Cap of a neighborhood's buildings on a parcel (the sign rule `maxHeightFor` still applies on top). Fixed pieces: `LANDMARK_MAX_H`, 21 outside the tower zone. */
export function maxHFor(n: Neighborhood, p: Parcel): number {
  return Math.min(neighborhoodCap(n, p), trainCap(p));
}
/** Train rule (station.ts): south of the track a solid needs `y_min - 1.4 z_max >= 134.5`, so a parcel there is capped at `(y - 134.5) / 1.4` minus the plinth and 1 u for the roof props that rise above the lot cap. */
const trainCap = (p: Parcel): number => p.rect.y > TRAIN_CLEAR.y1 ? (p.rect.y - 134.5) / 1.4 - PLINTH_H - 1 : Infinity;
function neighborhoodCap(n: Neighborhood, p: Parcel): number {
  if (fixedParcel(p)) return towerZone(p) ? LANDMARK_MAX_H : TOWER_FREE_H;
  return n === "clasico" || n === "transicion" || n === "bajo" ? BARRIO_HEIGHTS[n].hi : n === "moderno" ? (towerZone(p) ? BARRIO_HEIGHTS.moderno.hi : TOWER_FREE_H) : MAX_BUILDING_H;
}
/** Recipes of a neighborhood on a parcel: `moderno` off the tower zone draws slabs. */
export const catalogueFor = (n: Neighborhood, p: Parcel): readonly { name: string; weight: number }[] => n === "moderno" && !towerZone(p) ? MODERNO_SLAB : CATALOGUE[n].recipes;

/** Neighborhood of a parcel by its barrio (`residencial` = `bajo`); the two parcels north of the plaza are bars and the civic singular ones civic. */
export function neighborhoodOfParcel(p: Parcel): Neighborhood {
  if (p.c.y < 206 && p.rect.x + p.rect.w >= 157) return "bars";
  if (fixedParcel(p)?.civic) return "civic";
  return p.barrio === "residencial" ? "bajo" : p.barrio;
}

const polyBoxes = new WeakMap<Parcel, { x0: number; y0: number; x1: number; y1: number }>();
const boxOf = (p: Parcel): { x0: number; y0: number; x1: number; y1: number } => {
  let b = polyBoxes.get(p);
  if (!b) { b = { x0: Math.min(...p.poly.map((v) => v.x)), y0: Math.min(...p.poly.map((v) => v.y)), x1: Math.max(...p.poly.map((v) => v.x)), y1: Math.max(...p.poly.map((v) => v.y)) }; polyBoxes.set(p, b); }
  return b;
};
/** Parcels are neighbours when their cells are one pitch apart or their polygons ≤ STREET + 1 apart. The cell rule first, then the polygon bounding boxes (their gap on an axis is a lower bound of `polygonDistance`, so a pair further apart than that is rejected exactly), then the polygon distance. */
const nearParcels = (a: Parcel, b: Parcel): boolean => {
  if (Math.abs(a.cell.col - b.cell.col) <= PITCH && Math.abs(a.cell.row - b.cell.row) <= PITCH) return true;
  const p = boxOf(a), q = boxOf(b);
  return Math.max(p.x0 - q.x1, q.x0 - p.x1, p.y0 - q.y1, q.y0 - p.y1) <= STREET + 1 && polygonDistance(a.poly, b.poly) <= STREET + 1;
};
const stepOf = (n: Neighborhood): number => BARRIO_STEP[n as CityBarrio];
const joinsRule = (n: Neighborhood): boolean => n in BARRIO_STEP;
const neighborhoodOfStep = (k: number): CityBarrio => (Object.keys(BARRIO_STEP) as CityBarrio[]).find((b) => BARRIO_STEP[b] === k)!;

/** Neighborhoods of `ps` after the neighbour rule: a parcel more than one step above its lowest neighbour (`nearParcels`) drops to that step + 1; repeats in order until stable. Bars and civic take no part. */
export function parcelNeighborhoods(ps: readonly Parcel[]): Neighborhood[] {
  const out = ps.map(neighborhoodOfParcel);
  const near = ps.map((a, i) => joinsRule(out[i]!) ? ps.flatMap((b, j) => j !== i && joinsRule(out[j]!) && nearParcels(a, b) ? [j] : []) : []);
  for (let changed = true; changed;) {
    changed = false;
    for (let i = 0; i < ps.length; i++) {
      if (near[i]!.length === 0) continue;
      const low = Math.min(...near[i]!.map((j) => stepOf(out[j]!)));
      if (stepOf(out[i]!) > low + 1) { out[i] = neighborhoodOfStep(low + 1); changed = true; }
    }
  }
  return out;
}

/**
 * Neighborhoods of the strip (#496) after the one-step rule, with `base` as each parcel's own. Core parcels (`coreNs`, their neighborhoods) are fixed;
 * neighbours are `nearParcels`; bars and civic take no part. A strip parcel with core neighbours is first clamped into `[max(core) - 1, min(core) + 1]`
 * (empty: the upper bound wins). Then two phases settle strip-strip pairs differing by more than one:
 * 1. drops: the higher drops to the lower + 1, but never under its core lower bound `max(core) - 1` (it is pinned from below);
 * 2. rises: the lower of a pair still apart rises to the higher - 1 (this is the pinned case).
 * Termination: phase 1 only lowers steps and each step is bounded below by its parcel's lower bound (>= 0), so it ends in at most 3 * n lowerings; phase 2
 * only raises steps and no step exceeds the maximum present after phase 1 (a raise sets s_j = s_i - 1 < max), so it ends in at most 3 * n raisings. At the fixed point of
 * phase 2 every strip-strip pair is within one step (no pair has s_i > s_j + 1), and every strip parcel is within one step of its core neighbours; the one case
 * the rule cannot hold is the empty clamp (a parcel with both a bajo and a moderno core neighbour): geometry then decides, never the rule.
 */
export function stripNeighborhoods(strip: readonly Parcel[], core: readonly Parcel[], coreNs: readonly Neighborhood[], base: (p: Parcel) => Neighborhood): Neighborhood[] {
  const out = strip.map(base), s = out.map(stepOf);
  const coreNear = strip.map((a, i) => joinsRule(out[i]!) ? core.flatMap((b, j) => joinsRule(coreNs[j]!) && nearParcels(a, b) ? [stepOf(coreNs[j]!)] : []) : []);
  const near = strip.map((a, i) => joinsRule(out[i]!) ? strip.flatMap((b, j) => j !== i && joinsRule(out[j]!) && nearParcels(a, b) ? [j] : []) : []);
  const lower = coreNear.map((c) => c.length ? Math.max(...c) - 1 : 0);
  strip.forEach((_, i) => { if (coreNear[i]!.length) s[i] = Math.max(0, Math.min(Math.max(s[i]!, lower[i]!), Math.min(...coreNear[i]!) + 1)); });
  for (let changed = true; changed;) { // phase 1: drops
    changed = false;
    for (let i = 0; i < strip.length; i++) {
      if (near[i]!.length === 0) continue;
      const to = Math.min(...near[i]!.map((j) => s[j]!)) + 1;
      const down = Math.max(to, lower[i]!);
      if (s[i]! > down) { s[i] = down; changed = true; }
    }
  }
  for (let changed = true; changed;) { // phase 2: rises
    changed = false;
    for (let i = 0; i < strip.length; i++) {
      for (const j of near[i]!) if (s[j]! < s[i]! - 1) { s[j] = s[i]! - 1; changed = true; }
    }
  }
  return out.map((n, i) => joinsRule(n) ? neighborhoodOfStep(s[i]!) : n);
}
let stripMemo: Map<Parcel, Neighborhood> | undefined;
/** Neighborhood of every strip parcel of the city (north of `COASTAL_CUT_Y`) and of the coastal neighborhood (south), by the mixing field (`strip-mix.ts`; where it does not mix, by `neighborhoodOfParcel`) and the step rule against the core (the south core counts as `bajo`). Memoized. */
export function stripZoning(): Map<Parcel, Neighborhood> {
  if (stripMemo) return stripMemo;
  const cityCore = builtParcels().filter((p) => !isStrip(p)), south = southParcels(), strip = [...builtParcels().filter(isStrip), ...south.filter(isStrip)];
  const core = [...cityCore, ...south.filter((p) => !isStrip(p))], coreNs = [...parcelNeighborhoods(cityCore), ...south.filter((p) => !isStrip(p)).map((): Neighborhood => "bajo")];
  const ns = stripNeighborhoods(strip, core, coreNs, (p) => mixes(p.c) ? fieldKind(p.c.x, p.c.y) : neighborhoodOfParcel(p));
  return stripMemo = new Map(strip.map((p, i) => [p, ns[i]!]));
}

/** Smallest lot side the kit recipes are safe on (below it courtyards and chamfers spill past the lot or give NaN); on a smaller lot city.ts keeps the plinth and builds nothing. */
export const MIN_LOT_SIDE = 7;
export const tooSmall = (lot: Lot): boolean => Math.min(lot.w, lot.d) < MIN_LOT_SIDE;

/** The strip (#496): a parcel outside the core (the cover plus `COVER_MARGIN`), built because a pan shows it. Core parcels keep everything they had; strip parcels come after them and draw only from `parcelRng`. */
export const isStrip = (p: Parcel): boolean => p.c.y > COASTAL_CUT_Y ? !isSouthCore(p) : !inCore(p.c.x, p.c.y);
/** Recipe of a strip parcel: `bajo` builds houses (`scatterHouses`), any other neighborhood draws from its catalogue. */
export const stripRecipe = (n: Neighborhood, p: Parcel, rng: Rng): string => n === "bajo" ? "scatterHouses" : pick(rng, catalogueFor(n, p));
/** Rng of one parcel: a 32-bit mix of its cell, its rect origin and `salt` (0 recipe and tone, 1 seat). City and south parcels come from one grid, so cell + rect identify a parcel. */
export function parcelRng(p: Parcel, salt: number): Rng {
  let h = 2654435769 ^ salt;
  for (const v of [p.cell.col, p.cell.row, Math.round(8 * p.rect.x), Math.round(8 * p.rect.y), salt]) h = Math.imul(h ^ v, 2246822507) ^ (h >>> 15);
  return createRng(h >>> 0);
}

/** The parcels that get a building: those of `PLAN_BOUNDS` with `c.x > west` (default: all) north of `COASTAL_CUT_Y` (378), the hotel lot excluded (plinth only). The core east (`c.x >= WEST_DISTRICT_X`) comes first in `parcels()` order, then the core west, then the strip (#496) in the same order. Memoized per `west`. */
const builtCache = new Map<number, Parcel[]>();
export function builtParcels(west = -Infinity): Parcel[] {
  let out = builtCache.get(west);
  if (!out) {
    const ps = parcels(PLAN_BOUNDS).filter((p) => p.c.x > west && p.c.y < COASTAL_CUT_Y && !isHotelLot(p)), core = ps.filter((p) => !isStrip(p));
    out = [...core.filter((p) => p.c.x >= WEST_DISTRICT_X), ...core.filter((p) => p.c.x < WEST_DISTRICT_X), ...ps.filter(isStrip)];
    builtCache.set(west, out);
  }
  return out;
}
/** The parcel that holds the hotel (plinth only, no building). */
export const isHotelLot = (p: Parcel): boolean => p.rect.x === HOTEL_LOT.x && p.rect.y === HOTEL_LOT.y && p.rect.w === HOTEL_LOT.w && p.rect.d === HOTEL_LOT.d;

/** How far outside a parcel's edge `parcelOpenSides` looks: 0.5 for an axis band or a crossing plaza; 1.1 for the Plaza Mayor (#493: it ends at y 320 and the grid row of the palace and the theatre starts at 321, a 1 u gap). */
const OPEN_PROBE = 0.5, PLAZA_PROBE = 1.1;
/** Sides of a parcel's bounding box that face an open space (axis band, Plaza Mayor or crossing plaza): a point `OPEN_PROBE` (`PLAZA_PROBE` for the Plaza Mayor) outside the edge, at 1/4, 1/2 or 3/4, is in one. */
export function parcelOpenSides(p: Parcel): Side[] {
  const b = polyBox(p.poly), out: Side[] = [];
  // the edge point and its outward direction: open if the near probe meets a band or a crossing plaza, or the far one meets the Plaza Mayor
  const open = (x: number, y: number, dx: number, dy: number): boolean => {
    const nx = x + dx * OPEN_PROBE, ny = y + dy * OPEN_PROBE;
    return onAxis(nx, ny) || inCrossingPlaza(nx, ny) || inPlazaMayor(x + dx * PLAZA_PROBE, y + dy * PLAZA_PROBE);
  };
  for (const t of [0.25, 0.5, 0.75]) {
    const x = b.x + b.w * t, y = b.y + b.d * t;
    if (open(x, b.y, 0, -1) && !out.includes("n")) out.push("n");
    if (open(x, b.y + b.d, 0, 1) && !out.includes("s")) out.push("s");
    if (open(b.x, y, -1, 0) && !out.includes("w")) out.push("w");
    if (open(b.x + b.w, y, 1, 0) && !out.includes("e")) out.push("e");
  }
  return out;
}

/** Ochava of the casco (clasico) and the transition (transicion): the cut `k` of their corners, and a second pass at 2 for the corners whose edges are too short for `k`. */
export const OCHAVA: Partial<Record<Neighborhood, number>> = { clasico: 2.4, transicion: 2 };
export const ochava = (poly: Vec2[], k: number): Vec2[] => chamferPoly(chamferPoly(poly, k), 2);

/** A parcel with a side that is neither horizontal nor vertical (a wedge cut by a diagonal). */
export const isOblique = (p: Parcel): boolean => p.poly.some((a, i) => { const b = p.poly[(i + 1) % p.poly.length]!; return Math.abs(a.x - b.x) > 1e-6 && Math.abs(a.y - b.y) > 1e-6; });

/** Lot of a parcel (z 0): a poly-aware recipe on an oblique parcel takes the inset polygon (lot = its bounding box; if the inset degenerates, `rect` minus `SIDEWALK`); other recipes `rect` minus `SIDEWALK`. Non-fixed clasico and transicion lots with a poly-aware recipe then get the ochava. */
export function parcelLot(p: Parcel, n: Neighborhood, recipe: string, fixed: boolean, open: Side[], maxH: number): Lot {
  const aware = RECIPES.find((r) => r.name === recipe)?.poly === true;
  const inset = aware && isOblique(p) ? insetPoly(p.poly, SIDEWALK) : null;
  const box = inset ? polyBox(inset) : { x: p.rect.x + SIDEWALK, y: p.rect.y + SIDEWALK, w: p.rect.w - 2 * SIDEWALK, d: p.rect.d - 2 * SIDEWALK };
  const k = OCHAVA[n];
  const poly = aware && !fixed && k !== undefined ? ochava(inset ?? [{ x: box.x, y: box.y }, { x: box.x + box.w, y: box.y }, { x: box.x + box.w, y: box.y + box.d }, { x: box.x, y: box.y + box.d }], k) : inset ?? undefined;
  return { x: box.x, y: box.y, w: box.w, d: box.d, z: 0, open, maxH, ...(poly ? { poly } : {}) };
}

/** A block (or parcel: `parcel` set, `block` is its rect) with its neighborhood, recipe, assembled lot and tone. */
export interface Placed { parcel?: Parcel; block: Block; neighborhood: Neighborhood; recipe: string; lot: Lot; tone: number }

/**
 * Assigns a recipe to each block in the order of `blocks()`. Skips the
 * collapse (fixed.ts draws it) and the bare blocks (`isBare`: city.ts gives them only a plinth). Fixed ones take their recipe without drawing; the
 * district draws with `districtRng` (its sequence doesn't change if another neighborhood's does) and the
 * rest with `rng`. Residential retries up to 5 times if it repeats the recipe
 * of an already assigned adjacent block. Then the parcels of `builtParcels()`: neighborhood by
 * `parcelNeighborhoods`, a `FIXED_PARCELS` recipe or one drawn from `catalogueFor` (`moderno` with
 * `districtRng`; clasico, transicion and bajo retry like residential; every parcel west of `WEST_DISTRICT_X` draws pick, retries and tone from `districtRng` and comes after the east ones; `west` cuts the parcels by centroid, the lab's), cap `maxHFor` and lot `parcelLot`.
 * A parcel that is not fixed and draws from its barrio's `CATALOGUE` recipes (so not a `moderno` slab) gets `lot.band = { min(lo, maxH), maxH }` (#495): the barrio's recipes build within it; `band.hi` is the final cap.
 * The lot is at street level (`z: 0`):
 * `city()` seats it (`seat`), lifting it onto the plinth unless the piece brings `ground`.
 */
export function assign(rng: Rng, districtRng: Rng, west = -Infinity): Placed[] {
  const out: Placed[] = [];
  for (const b of blocks()) {
    if (b.kind === "collapsed" || isBare(b)) continue;
    const neighborhood = neighborhoodOf(b), fixed = FIXED.find((f) => f.x === b.x && f.y === b.y);
    const r = neighborhood === "district" ? districtRng : rng;
    let recipe = fixed?.recipe ?? pick(r, CATALOGUE[neighborhood].recipes);
    if (!fixed && neighborhood === "residential") {
      for (let i = 0; i < 5 && out.some((p) => adjacent(p.block, b) && p.recipe === recipe); i++) recipe = pick(r, CATALOGUE[neighborhood].recipes);
    }
    const top = fixed || neighborhood === "district" ? LANDMARK_MAX_H : MAX_BUILDING_H;
    const lot: Lot = {
      x: b.x + SIDEWALK, y: b.y + SIDEWALK, w: b.w - 2 * SIDEWALK, d: b.d - 2 * SIDEWALK,
      z: 0, open: openSides(b),
      maxH: top,
    };
    out.push({ block: b, neighborhood, recipe, lot, tone: rng.int(-1, 1) });
  }
  // the neighbour rule runs over every parcel, so a cut (`west`) does not change the neighborhood of those that remain
  const all = builtParcels().filter((p) => !isStrip(p)), ns = parcelNeighborhoods(all), allNs = new Map(all.map((p, i) => [p, ns[i]!])), built = builtParcels(west), zones = stripZoning();
  for (const f of FIXED_PARCELS) if (!all.some((p) => fixedParcel(p) === f)) throw new Error(`missing fixed parcel ${f.cell.col},${f.cell.row}`);
  built.forEach((p) => {
    const strip = isStrip(p), neighborhood = strip ? zones.get(p)! : allNs.get(p)!, isWest = p.c.x < WEST_DISTRICT_X, own = strip ? parcelRng(p, 0) : undefined;
    const r = own ?? (isWest || neighborhood === "moderno" ? districtRng : rng), fixed = fixedParcel(p), cat = catalogueFor(neighborhood, p), houses = strip && neighborhood === "bajo"; // a strip `bajo` parcel builds houses, not blocks
    let recipe = fixed?.recipe ?? (strip ? stripRecipe(neighborhood, p, r) : pick(r, cat));
    if (!fixed && !houses && (neighborhood === "clasico" || neighborhood === "transicion" || neighborhood === "bajo")) {
      // a strip parcel only retries against strip parcels, so its draws do not depend on the core's recipes
      for (let k = 0; k < 5 && out.some((q) => (!strip || (q.parcel && isStrip(q.parcel))) && rectsAdjacent(q.block, p.rect) && q.recipe === recipe); k++) recipe = pick(r, cat);
    }
    const top = maxHFor(neighborhood, p), maxH = Math.min(top, maxHeightFor(p.rect, top));
    const lot = parcelLot(p, neighborhood, recipe, fixed !== undefined, parcelOpenSides(p), maxH);
    if (!fixed && !houses && cat === CATALOGUE[neighborhood].recipes && isCityBarrio(neighborhood)) lot.band = { lo: Math.min(BARRIO_HEIGHTS[neighborhood].lo, maxH), hi: maxH };
    out.push({ parcel: p, block: { ...p.rect, bank: "west", row: -2, kind: "parcel" }, neighborhood, recipe, lot, tone: (own ?? (isWest ? districtRng : rng)).int(-1, 1) });
  });
  return out;
}

/** Square lot (minimum 5) centered in the courtyard; with a courtyard smaller than 5 the tower grazes the walls. */
export function waterTowerLot(court: Rect, z: number): Lot {
  const s = Math.max(5, Math.min(court.w, court.d));
  return { x: court.x + (court.w - s) / 2, y: court.y + (court.d - s) / 2, w: s, d: s, z, open: [], maxH: LANDMARK_MAX_H };
}
/** Footbridge: from the west bank to a step past the east bank, so it rests on land. */
export const FOOTBRIDGE_LOT: Lot = { x: WEST_QUAY.x1, y: 174, w: Math.ceil(estuaryEast(176)) + 1 - WEST_QUAY.x1, d: 4, z: -1, open: [], maxH: LANDMARK_MAX_H };
