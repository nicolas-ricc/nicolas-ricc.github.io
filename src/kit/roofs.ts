import { v3, type Vec2 } from "../iso/geometry";
import { GABLE_RATIO, STEP_INSET, type Solid } from "../iso/solids";
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

export const CORNICE_H = 0.4;
const HIP_EAVE = 1.5;
/** Alto total de `hipRoof`: el alero más la cumbrera, que sube `GABLE_RATIO` del alero. */
export const HIP_ROOF_H = HIP_EAVE * (1 + GABLE_RATIO);

export const cornice = (f: Footprint, mat: Material): Solid[] => [prism(f.x - 0.5, f.y - 0.5, f.z, f.w + 1, f.d + 1, CORNICE_H, mat)];

/** Huella corrida `m` hacia afuera (inglete en cada vértice): el vuelo de la cornisa de un `poly`. Conserva el orden de los vértices; supone un polígono simple sin vértices repetidos ni lados que vuelven sobre sí. */
export function offsetFootprint(fp: Vec2[], m: number): Vec2[] {
  let area = 0;
  for (let i = 0; i < fp.length; i++) { const p = fp[i]!, q = fp[(i + 1) % fp.length]!; area += p.x * q.y - q.x * p.y; }
  const s = area > 0 ? 1 : -1; // en el orden canónico la normal de a→b es (dy, −dx)
  const normal = (a: Vec2, b: Vec2): Vec2 => { const l = Math.hypot(b.x - a.x, b.y - a.y); return { x: (s * (b.y - a.y)) / l, y: (s * (a.x - b.x)) / l }; };
  return fp.map((p, i) => {
    const n1 = normal(fp[(i - 1 + fp.length) % fp.length]!, p), n2 = normal(p, fp[(i + 1) % fp.length]!);
    const k = m / (1 + n1.x * n2.x + n1.y * n2.y);
    return { x: p.x + (n1.x + n2.x) * k, y: p.y + (n1.y + n2.y) * k };
  });
}

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
export const hipRoof = (f: Footprint, mat: Material): Solid[] => [prism(f.x - 0.5, f.y - 0.5, f.z, f.w + 1, f.d + 1, HIP_EAVE, mat, { roof: "hip" })];

/** Terraza verde a 0.5 del borde. */
export const greenRoof = (f: Footprint, rng: Rng): Solid[] => rooftopGarden(v3(f.x + 0.5, f.y + 0.5, f.z), f.w - 1, f.d - 1, rng);

/** Pirámide de cuatro caras inscripta en la huella (el cono de 4 lados tiene sus caras planas al N/S/E/O). */
export const pyramid = (f: Footprint, h: number, mat: Material): Solid[] =>
  [{ kind: "cone", at: v3(f.x + f.w / 2, f.y + f.d / 2, f.z), r: (Math.min(f.w, f.d) / 2) * Math.SQRT2, h, mat, sides: 4 }];

export const domeRoof = (f: Footprint, h: number, mat: Material): Solid[] =>
  [{ kind: "dome", at: v3(f.x + f.w / 2, f.y + f.d / 2, f.z), r: Math.min(f.w, f.d) / 2, h, mat, sides: 12, rings: 3 }];
