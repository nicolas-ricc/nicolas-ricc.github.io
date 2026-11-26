import { Z_SCALE } from "../iso/project";
import { isBehind, overlaps, screenBounds } from "../iso/depth";
import { v3, type Vec2 } from "../iso/geometry";
import { bounds, type Bounds } from "../iso/solids";
import { RECIPES } from "../kit/index";
import { LANDMARK_MAX_H } from "../kit/piece";
import { chamferPoly, insetPoly } from "../kit/polygon";
import { polygonDistance } from "../kit/lettering";
import type { Lot, Side, StyleId } from "../kit/types";
import type { Rng } from "../map/seed";
import { PLINTH_H } from "../scenes/city-pieces";
import { AVENUE, BLOCK_W, EAST_COLS, FREIGHT_ROW, ROWS, SIDEWALK, STREET, WEST_QUAY, blocks, estuaryEast, type Block, type Rect } from "../scenes/city-grid";
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
  moderno: { recipes: [{ name: "podiumTower", weight: 40 }, { name: "glassTower", weight: 25 }, { name: "twinTowers", weight: 15 }, { name: "campus", weight: 20 }], style: "moderno", lights: { on: 0.4, warm: 0.15 } },
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
function pick(rng: Rng, recipes: readonly { name: string; weight: number }[]): string {
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

/** Neighborhoods of `ps` after the neighbour rule: a parcel more than one step above its lowest neighbour (polygons ≤ STREET + 1 apart, or cells one pitch apart) drops to that step + 1; repeats in order until stable. Bars and civic take no part. */
export function parcelNeighborhoods(ps: readonly Parcel[]): Neighborhood[] {
  const out = ps.map(neighborhoodOfParcel), step = (n: Neighborhood): number => BARRIO_STEP[n as CityBarrio];
  const joins = (i: number): boolean => out[i]! in BARRIO_STEP;
  const near = ps.map((a, i) => joins(i) ? ps.flatMap((b, j) => j !== i && joins(j) && (polygonDistance(a.poly, b.poly) <= STREET + 1 || (Math.abs(a.cell.col - b.cell.col) <= PITCH && Math.abs(a.cell.row - b.cell.row) <= PITCH)) ? [j] : []) : []);
  for (let changed = true; changed;) {
    changed = false;
    for (let i = 0; i < ps.length; i++) {
      if (near[i]!.length === 0) continue;
      const low = Math.min(...near[i]!.map((j) => step(out[j]!)));
      if (step(out[i]!) > low + 1) { out[i] = (Object.keys(BARRIO_STEP) as CityBarrio[]).find((b) => BARRIO_STEP[b] === low + 1)!; changed = true; }
    }
  }
  return out;
}

/** Smallest lot side the kit recipes are safe on (below it courtyards and chamfers spill past the lot or give NaN); on a smaller lot city.ts keeps the plinth and builds nothing. */
export const MIN_LOT_SIDE = 7;
export const tooSmall = (lot: Lot): boolean => Math.min(lot.w, lot.d) < MIN_LOT_SIDE;

/** The parcels that get a building: those of `PLAN_BOUNDS` with `c.x > west` (default: all) north of `COASTAL_CUT_Y` (378), the hotel lot excluded (plinth only). The east ones (`c.x >= WEST_DISTRICT_X`) come first in `parcels()` order, then the west ones in the same order. Memoized per `west`. */
const builtCache = new Map<number, Parcel[]>();
export function builtParcels(west = -Infinity): Parcel[] {
  let out = builtCache.get(west);
  if (!out) {
    const ps = parcels(PLAN_BOUNDS).filter((p) => p.c.x > west && p.c.y < COASTAL_CUT_Y && !isHotelLot(p));
    out = [...ps.filter((p) => p.c.x >= WEST_DISTRICT_X), ...ps.filter((p) => p.c.x < WEST_DISTRICT_X)];
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
  const all = builtParcels(), ns = parcelNeighborhoods(all), allNs = new Map(all.map((p, i) => [p, ns[i]!])), built = builtParcels(west);
  for (const f of FIXED_PARCELS) if (!all.some((p) => fixedParcel(p) === f)) throw new Error(`missing fixed parcel ${f.cell.col},${f.cell.row}`);
  built.forEach((p) => {
    const neighborhood = allNs.get(p)!, isWest = p.c.x < WEST_DISTRICT_X, r = isWest || neighborhood === "moderno" ? districtRng : rng, fixed = fixedParcel(p), cat = catalogueFor(neighborhood, p);
    let recipe = fixed?.recipe ?? pick(r, cat);
    if (!fixed && (neighborhood === "clasico" || neighborhood === "transicion" || neighborhood === "bajo")) {
      for (let k = 0; k < 5 && out.some((q) => rectsAdjacent(q.block, p.rect) && q.recipe === recipe); k++) recipe = pick(r, cat);
    }
    const top = maxHFor(neighborhood, p);
    const lot = parcelLot(p, neighborhood, recipe, fixed !== undefined, parcelOpenSides(p), Math.min(top, maxHeightFor(p.rect, top)));
    out.push({ parcel: p, block: { ...p.rect, bank: "west", row: -2, kind: "parcel" }, neighborhood, recipe, lot, tone: (isWest ? districtRng : rng).int(-1, 1) });
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
