import { v3, type Vec2 } from "../iso/geometry";
import { GABLE_RATIO, STEP_INSET, type Solid } from "../iso/solids";
import type { Material } from "../map/palette-iso";
import type { Rng } from "../map/seed";
import { prism } from "../scenes/city-pieces";
import { rooftopGarden } from "./props";

/**
 * Kit roofs. All take the supporting footprint (`z` = roof of the body) and
 * return solids. Rule: on a stepped roof whatever goes on top rests
 * on the setback footprint (`stepTop`), not on the body's, or it would float
 * above the setback.
 */
export interface Footprint { x: number; y: number; w: number; d: number; z: number }

export const CORNICE_H = 0.4;
const HIP_EAVE = 1.5;
/** Total height of `hipRoof`: the eave plus the ridge, which rises `GABLE_RATIO` of the eave. */
export const HIP_ROOF_H = HIP_EAVE * (1 + GABLE_RATIO);

export const cornice = (f: Footprint, mat: Material): Solid[] => [prism(f.x - 0.5, f.y - 0.5, f.z, f.w + 1, f.d + 1, CORNICE_H, mat)];

/** Footprint shifted `m` outward (mitered at each vertex): the overhang of a `poly`'s cornice. Keeps the vertex order; assumes a simple polygon with no repeated vertices or sides that fold back on themselves. */
export function offsetFootprint(fp: Vec2[], m: number): Vec2[] {
  let area = 0;
  for (let i = 0; i < fp.length; i++) { const p = fp[i]!, q = fp[(i + 1) % fp.length]!; area += p.x * q.y - q.x * p.y; }
  const s = area > 0 ? 1 : -1; // in the canonical order the normal of a→b is (dy, −dx)
  const normal = (a: Vec2, b: Vec2): Vec2 => { const l = Math.hypot(b.x - a.x, b.y - a.y); return { x: (s * (b.y - a.y)) / l, y: (s * (a.x - b.x)) / l }; };
  return fp.map((p, i) => {
    const n1 = normal(fp[(i - 1 + fp.length) % fp.length]!, p), n2 = normal(p, fp[(i + 1) % fp.length]!);
    const k = m / (1 + n1.x * n2.x + n1.y * n2.y);
    return { x: p.x + (n1.x + n2.x) * k, y: p.y + (n1.y + n2.y) * k };
  });
}

/** Footprint of the second level of a stepped roof of height `h` (the same setback as `roof: "step"`). */
export function stepTop(f: Footprint, h: number): Footprint {
  const ix = f.w * STEP_INSET, iy = f.d * STEP_INSET;
  return { x: f.x + ix, y: f.y + iy, w: f.w - 2 * ix, d: f.d - 2 * iy, z: f.z + h };
}

export function stepRoof(f: Footprint, h: number, mat: Material): Solid[] {
  const t = stepTop(f, h);
  return [prism(t.x, t.y, f.z, t.w, t.d, h, mat)];
}

export const gableRoof = (f: Footprint, h: number, mat: Material): Solid[] => [prism(f.x, f.y, f.z, f.w, f.d, h, mat, { roof: "gable" })];

/** Hip roof of 1.5 with 0.5 overhang. */
export const hipRoof = (f: Footprint, mat: Material): Solid[] => [prism(f.x - 0.5, f.y - 0.5, f.z, f.w + 1, f.d + 1, HIP_EAVE, mat, { roof: "hip" })];

/** Green terrace 0.5 from the edge. */
export const greenRoof = (f: Footprint, rng: Rng): Solid[] => rooftopGarden(v3(f.x + 0.5, f.y + 0.5, f.z), f.w - 1, f.d - 1, rng);

/** Four-sided pyramid inscribed in the footprint (the 4-sided cone has its flat faces toward N/S/E/W). */
export const pyramid = (f: Footprint, h: number, mat: Material): Solid[] =>
  [{ kind: "cone", at: v3(f.x + f.w / 2, f.y + f.d / 2, f.z), r: (Math.min(f.w, f.d) / 2) * Math.SQRT2, h, mat, sides: 4 }];

export const domeRoof = (f: Footprint, h: number, mat: Material): Solid[] =>
  [{ kind: "dome", at: v3(f.x + f.w / 2, f.y + f.d / 2, f.z), r: Math.min(f.w, f.d) / 2, h, mat, sides: 12, rings: 3 }];
