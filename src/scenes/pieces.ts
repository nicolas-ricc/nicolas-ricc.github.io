import type { Accent } from "../iso/accent";
import { v3, type Vec2 } from "../iso/geometry";
import type { Solid } from "../iso/solids";
import type { AccentColor, Material } from "../map/palette-iso";

/** Pieces shared between zones. Only materials shared by rule (steel, rust). */

const prism = (x: number, y: number, z: number, w: number, d: number, h: number, mat: Material): Solid => ({ kind: "prism", at: v3(x, y, z), w, d, h, mat });

export interface TowerCrane { at: Vec2; z?: number; mastH: number; jibLen: number; dir: "e" | "w"; light: AccentColor }

/**
 * Steel tower crane: slender mast, jib with counter-jib and counterweight,
 * cab, cable with hook block at mid-jib and a light at the tip.
 * The factory and the district's construction site share it.
 */
export function towerCrane(out: Solid[], accents: Accent[], c: TowerCrane): void {
  const z = c.z ?? 0, s = c.dir === "e" ? 1 : -1;
  const { x, y } = c.at;
  const top = z + c.mastH;
  out.push(prism(x - 0.6, y - 0.6, z, 1.2, 1.2, c.mastH, "steel"));                          // mast
  out.push(prism(s > 0 ? x : x - c.jibLen, y - 0.5, top - 1, c.jibLen, 1, 0.8, "steel"));     // jib
  out.push(prism(s > 0 ? x - 8 : x, y - 0.5, top - 1, 8, 1, 0.8, "steel"));                   // counter-jib
  out.push(prism(s > 0 ? x - 8 : x + 6, y - 1, top - 1.5, 2, 2, 1.5, "steel"));               // counterweight
  out.push(prism(x + s * 1.2 - 0.8, y - 0.8, top - 2.6, 1.6, 1.6, 1.6, "steel"));             // cab
  const hx = x + s * (c.jibLen / 2), cable = c.mastH * 0.4;
  out.push(prism(hx - 0.3, y - 0.3, top - 1 - cable, 0.6, 0.6, cable, "steel"));              // cable
  out.push(prism(hx - 0.6, y - 0.6, top - 2 - cable, 1.2, 1.2, 1, "rust"));                   // hook block
  accents.push({ kind: "dot", at: v3(x + s * c.jibLen, y, top - 0.6), r: 1, color: c.light });
}
