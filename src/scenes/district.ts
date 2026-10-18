import type { Accent } from "../iso/accent";
import type { Solid } from "../iso/solids";
import type { Rng } from "../map/seed";
import { campus, classic, constructionSite, glassTower } from "../kit/forms/modern";
import { STYLES } from "../kit/styles";
import type { Recipe } from "../kit/types";
import { PLINTH_H, prism } from "./city-pieces";
import { MAX_DISTRICT_H, maxDistrictHeight } from "../city/zoning";
import { SIDEWALK, type Block } from "./city-grid";

/**
 * Distrito moderno de Resume sobre el kit (familia `modern`): cada manzana
 * arma su lote, elige receta con los pesos de siempre y vuelca la pieza.
 * Spec: docs/superpowers/specs/2026-10-15-resume-nivel-2-kit-zonificacion-luces-design.md §5.
 */
export { MAX_DISTRICT_H, maxDistrictHeight };

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
  // el cartel consume el rng después de la receta, así las tiradas de la receta no dependen de cuántos slots haya
  for (const s of piece.slots) signs.push({ kind: "poly", pts: s.pts, color: rng.chance(0.5) ? "cyan" : "magenta", alpha: 1 });
}
