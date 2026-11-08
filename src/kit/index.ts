import { MODERN } from "./forms/modern";
import { COURTYARD } from "./forms/courtyard";
import { LOWRISE } from "./forms/lowrise";
import { COMPOSITE } from "./forms/composite";
import { CURVED } from "./forms/curved";
import { LANDMARKS } from "./forms/landmarks";
import { INDUSTRIAL } from "./forms/industrial";
import type { Recipe, RecipeDef } from "./types";

/** All the kit's recipes. Each new family adds its line; the generic test (kit.test.ts) covers it once registered. */
export const RECIPES: readonly RecipeDef[] = [...MODERN, ...COURTYARD, ...LOWRISE, ...COMPOSITE, ...CURVED, ...LANDMARKS, ...INDUSTRIAL];

/** Own lot for the recipes that don't use the standard lot: the lab and the generic test use it. `z`: where it rests (the bridge, in the estuary water). */
export const LAB_LOTS: Readonly<Record<string, { w: number; d: number; z?: number }>> = {
  waterTower: { w: 6, d: 6 },
  footbridge: { w: 54, d: 5, z: -1 },
  storeroom: { w: 6, d: 5 },
};

export function recipe(name: string): Recipe {
  const def = RECIPES.find((r) => r.name === name);
  if (!def) throw new Error(`unknown recipe: ${name}`);
  return def.recipe;
}
