import type { Accent } from "../iso/accent";
import type { Solid } from "../iso/solids";
import { createRng } from "../map/seed";
import { LAB_LOTS, RECIPES } from "../kit/index";
import { seat } from "../kit/piece";
import { STYLES } from "../kit/styles";
import type { Lot, Piece, StyleId } from "../kit/types";
import { PLINTH_H, prism } from "../scenes/city-pieces";

/** Lot of each recipe in the lab and the grid step. */
export const KIT_LOT = { w: 24, d: 18 } as const;
export const KIT_STEP = { x: 30, y: 24 } as const;

/**
 * Every recipe in the registry, one row per family in registry order.
 * As in the city: `seat` decides the plinth by ground presence. A recipe with no ground
 * sits on a paving prism plinth of PLINTH_H; one that brings `ground` (campus, eatenRuin, library, courtyardO with a paved patio) goes at z 0
 * with no plinth (a prism would cover its ground, which is painted before any solid).
 * The `LAB_LOTS` recipes go in their own lot, centered in the cell; the one that brings its own `z`
 * (the bridge, which in the city rests on the water) goes with no plinth.
 * Each lot has its own rng; each recipe is called once.
 */
export function kitScene(seed: number, style: StyleId): { solids: Solid[]; accents: Accent[]; lots: { x: number; y: number; name: string }[] } {
  const families = [...new Set(RECIPES.map((r) => r.family))];
  const ground: Solid[] = [], solids: Solid[] = [], accents: Accent[] = [], lots: { x: number; y: number; name: string }[] = [];
  RECIPES.forEach((def, i) => {
    const x = RECIPES.filter((r) => r.family === def.family).indexOf(def) * KIT_STEP.x, y = families.indexOf(def.family) * KIT_STEP.y;
    const own = LAB_LOTS[def.name], w = own?.w ?? KIT_LOT.w, d = own?.d ?? KIT_LOT.d;
    const lot: Lot = { x: x + Math.max(0, (KIT_LOT.w - w) / 2), y: y + (KIT_LOT.d - d) / 2, w, d, z: own?.z ?? 0, open: ["s", "e"], maxH: 24 };
    const rng = createRng(seed * 1000 + i);
    let p: Piece;
    if (own?.z !== undefined) p = def.recipe(lot, rng, STYLES[style]);
    else {
      const seated = seat(def.recipe, lot, rng, STYLES[style]);
      p = seated.piece;
      if (seated.plinth) solids.push(prism(lot.x, lot.y, 0, w, d, PLINTH_H, "paving"));
    }
    ground.push(...p.ground);
    solids.push(...p.solids);
    accents.push(...p.accents);
    lots.push({ x, y, name: def.name });
  });
  return { solids: [...ground, ...solids], accents, lots };
}
