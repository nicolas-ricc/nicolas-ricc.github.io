import type { Accent } from "../iso/accent";
import type { Solid } from "../iso/solids";
import { createRng } from "../map/seed";
import { LAB_LOTS, RECIPES } from "../kit/index";
import { STYLES } from "../kit/styles";
import type { Lot, StyleId } from "../kit/types";
import { PLINTH_H, prism } from "../scenes/city-pieces";

/** Lote de cada receta en el lab y paso de la grilla. */
export const KIT_LOT = { w: 24, d: 18 } as const;
export const KIT_STEP = { x: 30, y: 24 } as const;

/**
 * Todas las recetas del registro, una fila por familia en el orden del registro.
 * Como en la ciudad: la receta va sobre un zócalo prisma paving de PLINTH_H,
 * salvo la que trae `ground` propio (el campus), que va a z 0 sin zócalo
 * (un prisma taparía su suelo, que se pinta antes que todo sólido).
 * Las recetas de `LAB_LOTS` van en su lote, centrado en la celda; la que trae `z` propia
 * (el puente, que en la ciudad apoya en el agua) va sin zócalo.
 * Cada lote tiene su rng, así la receta puede llamarse dos veces igual.
 */
export function kitScene(seed: number, style: StyleId): { solids: Solid[]; accents: Accent[]; lots: { x: number; y: number; name: string }[] } {
  const families = [...new Set(RECIPES.map((r) => r.family))];
  const ground: Solid[] = [], solids: Solid[] = [], accents: Accent[] = [], lots: { x: number; y: number; name: string }[] = [];
  RECIPES.forEach((def, i) => {
    const x = RECIPES.filter((r) => r.family === def.family).indexOf(def) * KIT_STEP.x, y = families.indexOf(def.family) * KIT_STEP.y;
    const own = LAB_LOTS[def.name], w = own?.w ?? KIT_LOT.w, d = own?.d ?? KIT_LOT.d;
    const lot: Lot = { x: x + Math.max(0, (KIT_LOT.w - w) / 2), y: y + (KIT_LOT.d - d) / 2, w, d, z: own?.z ?? PLINTH_H, open: ["s", "e"], maxH: 24 };
    let p = def.recipe(lot, createRng(seed * 1000 + i), STYLES[style]);
    if (p.ground.length > 0) p = def.recipe({ ...lot, z: 0 }, createRng(seed * 1000 + i), STYLES[style]);
    else if (own?.z === undefined) solids.push(prism(lot.x, lot.y, 0, w, d, PLINTH_H, "paving"));
    ground.push(...p.ground);
    solids.push(...p.solids);
    accents.push(...p.accents);
    lots.push({ x, y, name: def.name });
  });
  return { solids: [...ground, ...solids], accents, lots };
}
