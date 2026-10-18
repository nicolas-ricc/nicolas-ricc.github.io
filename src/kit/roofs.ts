import { v3 } from "../iso/geometry";
import { STEP_INSET, type Solid } from "../iso/solids";
import type { Material } from "../map/palette-iso";
import type { Rng } from "../map/seed";
import { prism } from "../scenes/city-pieces";
import { rooftopGarden } from "./props";

/**
 * Techos del kit. Todos reciben la huella de apoyo (`z` = techo del cuerpo) y
 * devuelven sólidos. Regla: sobre un techo escalonado lo que va encima apoya
 * en la huella retranqueada (`stepTop`), no en la del cuerpo, o flotaría
 * sobre el retranqueo.
 */
export interface Footprint { x: number; y: number; w: number; d: number; z: number }

export const cornice = (f: Footprint, mat: Material): Solid[] => [prism(f.x - 0.5, f.y - 0.5, f.z, f.w + 1, f.d + 1, 0.4, mat)];

/** Huella del segundo nivel de un techo escalonado de alto `h` (el mismo retranqueo que `roof: "step"`). */
export function stepTop(f: Footprint, h: number): Footprint {
  const ix = f.w * STEP_INSET, iy = f.d * STEP_INSET;
  return { x: f.x + ix, y: f.y + iy, w: f.w - 2 * ix, d: f.d - 2 * iy, z: f.z + h };
}

export function stepRoof(f: Footprint, h: number, mat: Material): Solid[] {
  const t = stepTop(f, h);
  return [prism(t.x, t.y, f.z, t.w, t.d, h, mat)];
}

export const gableRoof = (f: Footprint, h: number, mat: Material): Solid[] => [prism(f.x, f.y, f.z, f.w, f.d, h, mat, { roof: "gable" })];

/** Cubierta a cuatro aguas de 1.5 con 0.5 de vuelo. */
export const hipRoof = (f: Footprint, mat: Material): Solid[] => [prism(f.x - 0.5, f.y - 0.5, f.z, f.w + 1, f.d + 1, 1.5, mat, { roof: "hip" })];

/** Terraza verde a 0.5 del borde. */
export const greenRoof = (f: Footprint, rng: Rng): Solid[] => rooftopGarden(v3(f.x + 0.5, f.y + 0.5, f.z), f.w - 1, f.d - 1, rng);

/** Pirámide de cuatro caras inscripta en la huella (el cono de 4 lados tiene sus caras planas al N/S/E/O). */
export const pyramid = (f: Footprint, h: number, mat: Material): Solid[] =>
  [{ kind: "cone", at: v3(f.x + f.w / 2, f.y + f.d / 2, f.z), r: (Math.min(f.w, f.d) / 2) * Math.SQRT2, h, mat, sides: 4 }];

export const domeRoof = (f: Footprint, h: number, mat: Material): Solid[] =>
  [{ kind: "dome", at: v3(f.x + f.w / 2, f.y + f.d / 2, f.z), r: Math.min(f.w, f.d) / 2, h, mat, sides: 12, rings: 3 }];
