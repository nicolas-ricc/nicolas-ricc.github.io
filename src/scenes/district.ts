import type { Accent } from "../iso/accent";
import { isBehind, overlaps, screenBounds } from "../iso/depth";
import { v3 } from "../iso/geometry";
import type { Bounds, Solid } from "../iso/solids";
import type { Rng } from "../map/seed";
import { campus, classic, constructionSite, glassTower } from "../kit/forms/modern";
import { STYLES } from "../kit/styles";
import type { Recipe } from "../kit/types";
import { PLINTH_H, prism } from "./city-pieces";
import { LIT_FLOOR, SIDEWALK, TOWER, TOWER_FLOORS, TOWER_H, type Block, type Rect } from "./city-grid";

/**
 * Distrito moderno de Resume sobre el kit (familia `modern`): cada manzana
 * arma su lote, elige receta con los pesos de siempre y vuelca la pieza.
 * Spec: docs/superpowers/specs/2026-10-15-resume-nivel-2-kit-zonificacion-luces-design.md §5.
 */
export const MAX_DISTRICT_H = 24;
const FRONT_CAP_H = 10;

/** Caja del piso encendido de la torre (city.ts pone la torre; acá solo hace falta dónde queda). */
const LIT: Bounds = { min: v3(TOWER.x, TOWER.y, LIT_FLOOR * (TOWER_H / TOWER_FLOORS)), max: v3(TOWER.x + TOWER.w, TOWER.y + TOWER.d, (LIT_FLOOR + 1) * (TOWER_H / TOWER_FLOORS)) };

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

type Type = "glass" | "classic" | "campus";
const pickType = (rng: Rng): Type => { const r = rng.next(); return r < 0.4 ? "glass" : r < 0.7 ? "classic" : "campus"; };
const RECIPE: Record<Type | "site", Recipe> = { glass: glassTower, classic, campus, site: constructionSite };

export function districtBlock(solids: Solid[], ground: Solid[], accents: Accent[], signs: Accent[], rng: Rng, b: Block, maxH: number): void {
  const type = b.kind === "site" ? "site" : pickType(rng);
  // el campus no lleva zócalo de manzana (sus edificios traen el suyo); el resto apoya sobre él
  const z = type === "campus" ? 0 : PLINTH_H;
  if (type !== "campus") solids.push(prism(b.x, b.y, 0, b.w, b.d, PLINTH_H, "paving"));
  const piece = RECIPE[type]({ x: b.x + SIDEWALK, y: b.y + SIDEWALK, w: b.w - 2 * SIDEWALK, d: b.d - 2 * SIDEWALK, z, open: [], maxH }, rng, STYLES.distrito);
  solids.push(...piece.solids);
  ground.push(...piece.ground);
  accents.push(...piece.accents);
  // el cartel consume el rng después de la receta, así la secuencia no depende de cuántos slots haya
  for (const s of piece.slots) signs.push({ kind: "poly", pts: s.pts, color: rng.chance(0.5) ? "cyan" : "magenta", alpha: 1 });
}
