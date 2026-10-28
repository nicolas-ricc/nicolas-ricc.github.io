import { v3 } from "../iso/geometry";
import { WORLD } from "../map/geo";
import type { BarrioCtx } from "./barrio";
import { CITY_EDGE, WEST_QUAY } from "./city-grid";
import { prism } from "./city-pieces";
import { REACH } from "./sprawl-grid";

export const ACCESSES = [400, 500, 600] as const;

const Y0 = CITY_EDGE.south, Y1 = WORLD.y1 + REACH.s;

/** Costanera oeste: muelle, paseo, bicisenda con línea blanca, cantero y doce tipas; sin rng. */
export function costanera(ctx: BarrioCtx): void {
  const { x0, x1 } = WEST_QUAY;
  ctx.solids.push(prism(x0, Y0, -1, x1 - x0, Y1 - Y0, 1.6, "plaza"));
  for (const [x, width, z, mat] of [[187.5, 3, 0.05, "paving"], [190.2, 1.6, 0.05, "asphalt"], [190.2, 0.15, 0.07, "whitewash"], [186.6, 1.2, 0.06, "leafDark"]] as const) ctx.ground.push({ kind: "strip", path: [{ x, y: Y0 }, { x, y: Y1 }], width, z, mat });
  for (let k = 0; k < 12; k++) ctx.solids.push({ kind: "cone", at: v3(186.6, 336 + 24 * k, 0.06), r: 2.2, h: 4.5, mat: "leaf", sides: 6 });
}
