import { MODERN } from "./forms/modern";
import { COURTYARD } from "./forms/courtyard";
import type { Recipe, RecipeDef } from "./types";

/** Todas las recetas del kit. Cada familia nueva agrega su línea; el test genérico (kit.test.ts) la cubre al registrarse. */
export const RECIPES: readonly RecipeDef[] = [...MODERN, ...COURTYARD];

export function recipe(name: string): Recipe {
  const def = RECIPES.find((r) => r.name === name);
  if (!def) throw new Error(`receta desconocida: ${name}`);
  return def.recipe;
}
