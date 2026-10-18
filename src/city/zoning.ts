import { isBehind, overlaps, screenBounds } from "../iso/depth";
import { v3 } from "../iso/geometry";
import type { Bounds } from "../iso/solids";
import { LANDMARK_MAX_H } from "../kit/piece";
import type { Lot, Side, StyleId } from "../kit/types";
import type { Rng } from "../map/seed";
import { PLINTH_H } from "../scenes/city-pieces";
import { AVENUE, BLOCK_D, BLOCK_W, EAST_COLS, LIT_FLOOR, PLAZA, SIDEWALK, SITE, STREET, TOWER, TOWER_FLOORS, TOWER_H, WEST_QUAY, blocks, estuaryEast, type Block, type Rect } from "../scenes/city-grid";

/**
 * Zonificación de Resume: a qué barrio pertenece cada manzana, qué recetas
 * y luces lleva, qué edificios son fijos y cómo se arma su lote. Módulo puro
 * (sin escena): city.ts asigna con `assign` y vuelca; fixed.ts dibuja lo fijo.
 * No importa district.ts ni city.ts (lo evitan los ciclos).
 */
export type Barrio = StyleId;

export const MAX_DISTRICT_H = 24;
export const FRONT_CAP_H = 10;

/** Caja del piso encendido de la torre (city.ts pone la torre; acá solo hace falta dónde queda). */
export const LIT: Bounds = { min: v3(TOWER.x, TOWER.y, LIT_FLOOR * (TOWER_H / TOWER_FLOORS)), max: v3(TOWER.x + TOWER.w, TOWER.y + TOWER.d, (LIT_FLOOR + 1) * (TOWER_H / TOWER_FLOORS)) };

/**
 * Regla del piso encendido: si un edificio de 24 en esta manzana se
 * superpondría en pantalla con el piso encendido quedando delante, la
 * manzana se limita a 10. Con la grilla actual ninguna manzana del distrito
 * queda delante (todas están al oeste o al sur de la torre); es una guarda
 * para si el distrito gana filas más cercanas en el futuro.
 */
export function maxDistrictHeight(b: Rect): number {
  const box: Bounds = { min: v3(b.x, b.y, 0), max: v3(b.x + b.w, b.y + b.d, MAX_DISTRICT_H + PLINTH_H + 1) };
  return overlaps(screenBounds(box), screenBounds(LIT)) && isBehind(LIT, box) ? FRONT_CAP_H : MAX_DISTRICT_H;
}

export const MAX_BUILDING_H = 18;

const BARES_X: readonly number[] = [102, 132, 162], BARES_Y: readonly number[] = [164, 188];
const CIVICO = [[72, 218], [162, 218], [42, 242]] as const;
const CENTRO = [[72, 164], [72, 188], [42, 218], [72, 242], [102, 242], [132, 242], [162, 242]] as const;
const isAt = (b: Block, cells: readonly (readonly [number, number])[]): boolean => cells.some(([x, y]) => b.x === x && b.y === y);

/** Barrio de una manzana: distrito y obra, plaza cívica, ribera este (derrumbe incluido: lo dibuja fixed.ts), muelle, cívico, centro y el resto residencial. */
export function barrioOf(b: Block): Barrio {
  if (b.kind === "district" || b.kind === "site") return "distrito";
  if (b.kind === "plaza") return "civico";
  if (b.bank === "east") return "ribera";
  if (BARES_X.includes(b.x) && BARES_Y.includes(b.y)) return "bares";
  if (isAt(b, CIVICO)) return "civico";
  if (isAt(b, CENTRO)) return "centro";
  return "residencial";
}

interface Catalogue { recipes: readonly { name: string; weight: number }[]; style: StyleId; lights: { on: number; warm: number } }

/** Recetas con peso, estilo y política de luces (fracción encendida y fracción cálida) por barrio. El cívico no sortea: solo lleva fijos. */
export const CATALOGUE = {
  centro: { recipes: [{ name: "podiumTower", weight: 30 }, { name: "decoStepped", weight: 20 }, { name: "chamfer", weight: 20 }, { name: "classic", weight: 15 }, { name: "cylinderTower", weight: 15 }], style: "centro", lights: { on: 0.45, warm: 0.3 } },
  bares: { recipes: [{ name: "shopRow", weight: 50 }, { name: "gallery", weight: 20 }, { name: "patioResidential", weight: 20 }, { name: "courtyardO", weight: 10 }], style: "bares", lights: { on: 0.7, warm: 0.9 } },
  residencial: { recipes: [{ name: "patioResidential", weight: 40 }, { name: "courtyardO", weight: 20 }, { name: "courtyardU", weight: 15 }, { name: "rowHouses", weight: 15 }, { name: "eatenRuin", weight: 10 }], style: "residencial", lights: { on: 0.55, warm: 0.95 } },
  civico: { recipes: [], style: "civico", lights: { on: 0.6, warm: 0.7 } },
  ribera: { recipes: [{ name: "classic", weight: 30 }, { name: "lTower", weight: 30 }, { name: "eatenRuin", weight: 40 }], style: "ribera", lights: { on: 0.25, warm: 0.5 } },
  distrito: { recipes: [{ name: "glassTower", weight: 30 }, { name: "twinTowers", weight: 20 }, { name: "classic", weight: 20 }, { name: "campus", weight: 20 }, { name: "cylinderTower", weight: 10 }], style: "distrito", lights: { on: 0.4, warm: 0.15 } },
} as const satisfies Record<Barrio, Catalogue>;

/** Manzana de la torre de agua: un patio residencial al que fixed.ts le suma la torre. */
export const WATER_TOWER_BLOCK = { x: 12, y: 164 } as const;
/** Manzanas con receta fija (mercado, estación, cívicos y la obra). */
export const FIXED: readonly { x: number; y: number; recipe: string }[] = [
  { x: -18, y: 188, recipe: "station" }, { x: 280, y: 188, recipe: "market" }, { x: 72, y: 218, recipe: "theatre" },
  { x: 162, y: 218, recipe: "civicPalace" }, { x: 42, y: 242, recipe: "library" }, { x: SITE.x, y: SITE.y, recipe: "constructionSite" },
  { ...WATER_TOWER_BLOCK, recipe: "patioResidential" },
];


/** Tope de la fila frente a la torre: ahí un edificio alto taparía el piso encendido. */
export const maxHeightFor = (b: Block, top = MAX_BUILDING_H): number => (b.row === 3 && b.x >= 96 && b.x + b.w <= 162 ? FRONT_CAP_H : top);

/** Lado de `b` que mira a `r` a través de una calle, si se solapan en el otro eje. */
function facing(b: Rect, r: Rect): Side | undefined {
  const overlapX = b.x < r.x + r.w && r.x < b.x + b.w, overlapY = b.y < r.y + r.d && r.y < b.y + b.d;
  if (overlapY && r.x - (b.x + b.w) === STREET) return "e";
  if (overlapY && b.x - (r.x + r.w) === STREET) return "w";
  if (overlapX && r.y - (b.y + b.d) === STREET) return "s";
  if (overlapX && b.y - (r.y + r.d) === STREET) return "n";
  return undefined;
}

/** Lados de la manzana que dan a un espacio abierto (avenida, muelle, ribera este o plaza): ahí la receta puede abrir patios y escaparates. */
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

/** Recetas que traen su propio zócalo: no apoyan sobre el de la manzana. */
export const NO_PLINTH: readonly string[] = ["eatenRuin", "campus"];

/** Receta por peso con una sola tirada de `rng`. */
function pick(rng: Rng, recipes: readonly { name: string; weight: number }[]): string {
  if (recipes.length === 0) throw new Error("catálogo vacío");
  const total = recipes.reduce((s, r) => s + r.weight, 0);
  let t = rng.next() * total;
  for (const r of recipes) { t -= r.weight; if (t < 0) return r.name; }
  return recipes[recipes.length - 1]!.name;
}
const adjacent = (a: Block, b: Block): boolean => Math.abs(a.x - b.x) <= BLOCK_W + STREET && Math.abs(a.y - b.y) <= BLOCK_D + STREET;

/** Una manzana con su barrio, receta, lote armado y tono. */
export interface Placed { block: Block; barrio: Barrio; recipe: string; lot: Lot; tone: number }

/**
 * Asigna receta a cada manzana en el orden de `blocks()`. Salta la plaza y el
 * derrumbe (los dibuja fixed.ts). Los fijos toman su receta sin tirar; el
 * distrito tira con `districtRng` (su secuencia no cambia si otro barrio sí) y el
 * resto con `rng`. El residencial reintenta hasta 5 veces si repite la receta
 * de una manzana adyacente ya asignada.
 */
export function assign(rng: Rng, districtRng: Rng): Placed[] {
  const out: Placed[] = [];
  for (const b of blocks()) {
    if (b.kind === "plaza" || b.kind === "collapsed") continue;
    const barrio = barrioOf(b), fixed = FIXED.find((f) => f.x === b.x && f.y === b.y);
    const r = barrio === "distrito" ? districtRng : rng;
    let recipe = fixed?.recipe ?? pick(r, CATALOGUE[barrio].recipes);
    if (!fixed && barrio === "residencial") {
      for (let i = 0; i < 5 && out.some((p) => p.barrio === "residencial" && adjacent(p.block, b) && p.recipe === recipe); i++) recipe = pick(r, CATALOGUE[barrio].recipes);
    }
    const top = fixed || barrio === "distrito" ? LANDMARK_MAX_H : MAX_BUILDING_H;
    const lot: Lot = {
      x: b.x + SIDEWALK, y: b.y + SIDEWALK, w: b.w - 2 * SIDEWALK, d: b.d - 2 * SIDEWALK,
      z: NO_PLINTH.includes(recipe) ? 0 : PLINTH_H, open: openSides(b),
      maxH: Math.min(maxHeightFor(b, top), maxDistrictHeight(b)),
    };
    out.push({ block: b, barrio, recipe, lot, tone: r.int(-1, 1) });
  }
  return out;
}

/** Lote cuadrado (mínimo 5) centrado en el patio; con patio menor que 5 la torre roza las paredes. */
export function waterTowerLot(court: Rect, z: number): Lot {
  const s = Math.max(5, Math.min(court.w, court.d));
  return { x: court.x + (court.w - s) / 2, y: court.y + (court.d - s) / 2, w: s, d: s, z, open: [], maxH: LANDMARK_MAX_H };
}
/** Puente peatonal: de la ribera oeste a un paso más allá de la ribera este, así apoya en tierra. */
export const FOOTBRIDGE_LOT: Lot = { x: WEST_QUAY.x1, y: 174, w: Math.ceil(estuaryEast(176)) + 1 - WEST_QUAY.x1, d: 4, z: -1, open: [], maxH: LANDMARK_MAX_H };
