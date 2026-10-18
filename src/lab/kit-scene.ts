import type { Accent } from "../iso/accent";
import type { Solid } from "../iso/solids";
import { createRng } from "../map/seed";
import { RECIPES } from "../kit/index";
import { STYLES } from "../kit/styles";
import type { StyleId } from "../kit/types";
import { PLINTH_H, prism } from "../scenes/city-pieces";

/** Lote de cada receta en el lab y paso de la grilla. */
export const KIT_LOT = { w: 24, d: 18 } as const;
export const KIT_STEP = { x: 30, y: 24 } as const;

/**
 * Todas las recetas del registro sobre lotes con zócalo, una fila por familia
 * en el orden del registro, con un solo rng para toda la escena.
 */
export function kitScene(seed: number, style: StyleId): { solids: Solid[]; accents: Accent[]; lots: { x: number; y: number; name: string }[] } {
  const rng = createRng(seed), families = [...new Set(RECIPES.map((r) => r.family))];
  const ground: Solid[] = [], solids: Solid[] = [], accents: Accent[] = [], lots: { x: number; y: number; name: string }[] = [];
  for (const def of RECIPES) {
    const x = RECIPES.filter((r) => r.family === def.family).indexOf(def) * KIT_STEP.x, y = families.indexOf(def.family) * KIT_STEP.y;
    solids.push(prism(x, y, 0, KIT_LOT.w, KIT_LOT.d, PLINTH_H, "paving"));
    const p = def.recipe({ x, y, w: KIT_LOT.w, d: KIT_LOT.d, z: PLINTH_H, open: ["s", "e"], maxH: 24 }, rng, STYLES[style]);
    ground.push(...p.ground);
    solids.push(...p.solids);
    accents.push(...p.accents);
    lots.push({ x, y, name: def.name });
  }
  return { solids: [...ground, ...solids], accents, lots };
}
