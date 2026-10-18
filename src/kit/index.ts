import { MODERN } from "./forms/modern";
import { COURTYARD } from "./forms/courtyard";
import { LOWRISE } from "./forms/lowrise";
import { COMPOSITE } from "./forms/composite";
import { CURVED } from "./forms/curved";
import { LANDMARKS } from "./forms/landmarks";
import type { Recipe, RecipeDef } from "./types";

/** Todas las recetas del kit. Cada familia nueva agrega su línea; el test genérico (kit.test.ts) la cubre al registrarse. */
export const RECIPES: readonly RecipeDef[] = [...MODERN, ...COURTYARD, ...LOWRISE, ...COMPOSITE, ...CURVED, ...LANDMARKS];

/** Lote propio de las recetas que no van en el lote estándar: lo usan el lab y el test genérico. `z`: dónde apoya (el puente, en el agua del estuario). */
export const LAB_LOTS: Readonly<Record<string, { w: number; d: number; z?: number }>> = {
  waterTower: { w: 6, d: 6 },
  footbridge: { w: 54, d: 5, z: -1 },
};

export function recipe(name: string): Recipe {
  const def = RECIPES.find((r) => r.name === name);
  if (!def) throw new Error(`receta desconocida: ${name}`);
  return def.recipe;
}
