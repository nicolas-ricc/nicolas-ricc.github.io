import { v3 } from "../iso/geometry";
import { WORLD } from "../map/geo";
import type { BarrioCtx } from "./barrio";
import { CITY_EDGE, WEST_QUAY } from "./city-grid";
import { prism } from "./city-pieces";
import { REACH } from "./sprawl-grid";

export const ACCESSES = [400, 500, 600] as const;

/** Marcador de la costanera: el muro de la ribera oeste con bolardos (el `quay()` de hoy), sin rng. */
export function costanera(ctx: BarrioCtx): void {
  const { x0, x1 } = WEST_QUAY, y1 = WORLD.y1 + REACH.s;
  ctx.solids.push(prism(x0, CITY_EDGE.south, -1, x1 - x0, y1 - CITY_EDGE.south, 1.6, "plaza"));
  for (let y = CITY_EDGE.south + 8; y < y1; y += 24) ctx.solids.push({ kind: "cylinder", at: v3(x0 + 3, y, 0.6), r: 0.4, h: 0.8, mat: "rust", sides: 6 });
}
