import { isBehind, overlaps, screenBounds } from "../iso/depth";
import { v3 } from "../iso/geometry";
import type { Bounds } from "../iso/solids";
import { LANDMARK_MAX_H } from "../kit/piece";
import type { Lot, Side, StyleId } from "../kit/types";
import type { Rng } from "../map/seed";
import { PLINTH_H } from "../scenes/city-pieces";
import { AVENUE, BLOCK_D, BLOCK_W, EAST_COLS, LIT_FLOOR, PLAZA, SIDEWALK, SITE, STREET, TOWER, TOWER_FLOORS, TOWER_H, WEST_QUAY, blocks, estuaryEast, type Block, type Rect } from "../scenes/city-grid";

/**
 * Resume zoning: which neighborhood each block belongs to, which recipes
 * and lights it carries, which buildings are fixed and how its lot is built. Pure module
 * (no scene): city.ts assigns with `assign` and pours; fixed.ts draws the fixed pieces.
 * It does not import city.ts (avoids the cycle).
 */
export type Neighborhood = StyleId;

export const MAX_DISTRICT_H = 24;
export const FRONT_CAP_H = 10;

/** Box of the tower's lit floor (city.ts places the tower; here only where it ends up is needed). */
const LIT: Bounds = { min: v3(TOWER.x, TOWER.y, LIT_FLOOR * (TOWER_H / TOWER_FLOORS)), max: v3(TOWER.x + TOWER.w, TOWER.y + TOWER.d, (LIT_FLOOR + 1) * (TOWER_H / TOWER_FLOORS)) };

/**
 * Lit-floor rule: if a 24-high building on this block would
 * overlap the lit floor on screen while standing in front of it, the
 * block is limited to 10. With the current grid no block of the district
 * ends up in front (all are west or south of the tower); it is a guard
 * in case the district gains closer rows in the future.
 */
export function maxDistrictHeight(b: Rect): number {
  const box: Bounds = { min: v3(b.x, b.y, 0), max: v3(b.x + b.w, b.y + b.d, MAX_DISTRICT_H + PLINTH_H + 1) };
  return overlaps(screenBounds(box), screenBounds(LIT)) && isBehind(LIT, box) ? FRONT_CAP_H : MAX_DISTRICT_H;
}

export const MAX_BUILDING_H = 18;

const BARS_X: readonly number[] = [102, 132, 162], BARS_Y: readonly number[] = [164, 188];
const CIVIC = [[72, 218], [162, 218], [42, 242]] as const;
const DOWNTOWN = [[72, 164], [72, 188], [42, 218], [72, 242], [102, 242], [132, 242], [162, 242]] as const;
const isAt = (b: Block, cells: readonly (readonly [number, number])[]): boolean => cells.some(([x, y]) => b.x === x && b.y === y);

/** Neighborhood of a block: district and construction site, civic plaza, east bank (collapse included: fixed.ts draws it), dock, civic, downtown and the rest residential. */
export function neighborhoodOf(b: Block): Neighborhood {
  if (b.kind === "district" || b.kind === "site") return "district";
  if (b.kind === "plaza") return "civic";
  if (b.bank === "east") return "riverside";
  if (BARS_X.includes(b.x) && BARS_Y.includes(b.y)) return "bars";
  if (isAt(b, CIVIC)) return "civic";
  if (isAt(b, DOWNTOWN)) return "downtown";
  return "residential";
}

interface Catalogue { recipes: readonly { name: string; weight: number }[]; style: StyleId; lights: { on: number; warm: number } }

/** Recipes with weight, style and lights policy (lit fraction and warm fraction) per neighborhood. Civic does not draw: it only carries fixed pieces. */
export const CATALOGUE = {
  downtown: { recipes: [{ name: "podiumTower", weight: 30 }, { name: "decoStepped", weight: 20 }, { name: "chamfer", weight: 20 }, { name: "classic", weight: 15 }, { name: "cylinderTower", weight: 15 }], style: "downtown", lights: { on: 0.45, warm: 0.3 } },
  bars: { recipes: [{ name: "shopRow", weight: 50 }, { name: "gallery", weight: 20 }, { name: "patioResidential", weight: 20 }, { name: "courtyardO", weight: 10 }], style: "bars", lights: { on: 0.7, warm: 0.9 } },
  residential: { recipes: [{ name: "patioResidential", weight: 40 }, { name: "courtyardO", weight: 20 }, { name: "courtyardU", weight: 15 }, { name: "rowHouses", weight: 15 }, { name: "eatenRuin", weight: 10 }], style: "residential", lights: { on: 0.55, warm: 0.95 } },
  civic: { recipes: [], style: "civic", lights: { on: 0.6, warm: 0.7 } },
  riverside: { recipes: [{ name: "classic", weight: 30 }, { name: "lTower", weight: 30 }, { name: "eatenRuin", weight: 40 }], style: "riverside", lights: { on: 0.25, warm: 0.5 } },
  district: { recipes: [{ name: "glassTower", weight: 30 }, { name: "twinTowers", weight: 20 }, { name: "classic", weight: 20 }, { name: "campus", weight: 20 }, { name: "cylinderTower", weight: 10 }], style: "district", lights: { on: 0.4, warm: 0.15 } },
} as const satisfies Record<Neighborhood, Catalogue>;

/** Water-tower block: a residential courtyard to which fixed.ts adds the tower. */
export const WATER_TOWER_BLOCK = { x: 12, y: 164 } as const;
/** Blocks with a fixed recipe (market, station, civic buildings and the construction site). */
export const FIXED: readonly { x: number; y: number; recipe: string }[] = [
  { x: -18, y: 188, recipe: "station" }, { x: 280, y: 188, recipe: "market" }, { x: 72, y: 218, recipe: "theatre" },
  { x: 162, y: 218, recipe: "civicPalace" }, { x: 42, y: 242, recipe: "library" }, { x: SITE.x, y: SITE.y, recipe: "constructionSite" },
  { ...WATER_TOWER_BLOCK, recipe: "patioResidential" },
];

/** Cap of the row facing the plaza: a tall building there would hide the tower's lit floor or the fountain (fixed.ts). */
export const maxHeightFor = (b: Block, top = MAX_BUILDING_H): number => (b.row === 3 && b.x >= 96 && b.x + b.w <= 186 ? FRONT_CAP_H : top);

/** Side of `b` that faces `r` across a street, if they overlap on the other axis. */
function facing(b: Rect, r: Rect): Side | undefined {
  const overlapX = b.x < r.x + r.w && r.x < b.x + b.w, overlapY = b.y < r.y + r.d && r.y < b.y + b.d;
  if (overlapY && r.x - (b.x + b.w) === STREET) return "e";
  if (overlapY && b.x - (r.x + r.w) === STREET) return "w";
  if (overlapX && r.y - (b.y + b.d) === STREET) return "s";
  if (overlapX && b.y - (r.y + r.d) === STREET) return "n";
  return undefined;
}

/** Sides of the block that face an open space (avenue, dock, east bank or plaza): there the recipe may open courtyards and shop windows. */
export function openSides(b: Block): Side[] {
  const out: Side[] = [];
  if (b.y + b.d === AVENUE.y0) out.push("s");
  if (b.y === AVENUE.y1) out.push("n");
  if (b.x + b.w + STREET === WEST_QUAY.x0) out.push("e");
  if (b.bank === "east" && b.x === EAST_COLS[0]) out.push("w");
  const plaza = facing(b, PLAZA);
  if (plaza && !out.includes(plaza)) out.push(plaza);
  return out;
}

/** Recipes that bring their own plinth: they do not rest on the block's. */
export const NO_PLINTH: readonly string[] = ["eatenRuin", "campus"];

/** Weighted recipe with a single draw from `rng`. */
function pick(rng: Rng, recipes: readonly { name: string; weight: number }[]): string {
  if (recipes.length === 0) throw new Error("empty catalogue");
  const total = recipes.reduce((s, r) => s + r.weight, 0);
  let t = rng.next() * total;
  for (const r of recipes) { t -= r.weight; if (t < 0) return r.name; }
  return recipes[recipes.length - 1]!.name;
}
const adjacent = (a: Block, b: Block): boolean => Math.abs(a.x - b.x) <= BLOCK_W + STREET && Math.abs(a.y - b.y) <= BLOCK_D + STREET;

/** A block with its neighborhood, recipe, assembled lot and tone. */
export interface Placed { block: Block; neighborhood: Neighborhood; recipe: string; lot: Lot; tone: number }

/**
 * Assigns a recipe to each block in the order of `blocks()`. Skips the plaza and the
 * collapse (fixed.ts draws them). Fixed ones take their recipe without drawing; the
 * district draws with `districtRng` (its sequence doesn't change if another neighborhood's does) and the
 * rest with `rng`. Residential retries up to 5 times if it repeats the recipe
 * of an already assigned adjacent block.
 */
export function assign(rng: Rng, districtRng: Rng): Placed[] {
  const out: Placed[] = [];
  for (const b of blocks()) {
    if (b.kind === "plaza" || b.kind === "collapsed") continue;
    const neighborhood = neighborhoodOf(b), fixed = FIXED.find((f) => f.x === b.x && f.y === b.y);
    const r = neighborhood === "district" ? districtRng : rng;
    let recipe = fixed?.recipe ?? pick(r, CATALOGUE[neighborhood].recipes);
    if (!fixed && neighborhood === "residential") {
      for (let i = 0; i < 5 && out.some((p) => adjacent(p.block, b) && p.recipe === recipe); i++) recipe = pick(r, CATALOGUE[neighborhood].recipes);
    }
    const top = fixed || neighborhood === "district" ? LANDMARK_MAX_H : MAX_BUILDING_H;
    const lot: Lot = {
      x: b.x + SIDEWALK, y: b.y + SIDEWALK, w: b.w - 2 * SIDEWALK, d: b.d - 2 * SIDEWALK,
      z: NO_PLINTH.includes(recipe) ? 0 : PLINTH_H, open: openSides(b),
      maxH: Math.min(maxHeightFor(b, top), maxDistrictHeight(b)),
    };
    out.push({ block: b, neighborhood, recipe, lot, tone: rng.int(-1, 1) });
  }
  return out;
}

/** Square lot (minimum 5) centered in the courtyard; with a courtyard smaller than 5 the tower grazes the walls. */
export function waterTowerLot(court: Rect, z: number): Lot {
  const s = Math.max(5, Math.min(court.w, court.d));
  return { x: court.x + (court.w - s) / 2, y: court.y + (court.d - s) / 2, w: s, d: s, z, open: [], maxH: LANDMARK_MAX_H };
}
/** Footbridge: from the west bank to a step past the east bank, so it rests on land. */
export const FOOTBRIDGE_LOT: Lot = { x: WEST_QUAY.x1, y: 174, w: Math.ceil(estuaryEast(176)) + 1 - WEST_QUAY.x1, d: 4, z: -1, open: [], maxH: LANDMARK_MAX_H };
