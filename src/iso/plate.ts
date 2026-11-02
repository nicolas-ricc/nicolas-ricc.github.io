import type { Material } from "../map/palette-iso";
import { v3, type Vec2, type Vec3 } from "./geometry";
import type { Face } from "./solids";

/**
 * Coplanar plate on a wall: `wall` is the index of the footprint edge (`footprint[wall] → footprint[wall + 1]`; in
 * `prism` and `ramp`, 0 north, 1 east, 2 south, 3 west), `u0..u1` are 0..1 fractions along that edge (on the south and
 * east walls, right to left on screen), `z0..z1` absolute. `rect` is the rectangle, `disc` the octagon inscribed in it, `tri` an isosceles with base at `z0` and apex at `z1`.
 * Emitted after its wall (and the facade), with the wall's normal and tone.
 */
export interface Plate { wall: number; shape: "rect" | "disc" | "tri"; u0: number; u1: number; z0: number; z1: number; mat: Material; toneOffset?: number }

/** Outline of the plate in (u, z) coordinates. */
export function plateOutline(p: Plate): Vec2[] {
  switch (p.shape) {
    case "rect": return [{ x: p.u0, y: p.z0 }, { x: p.u1, y: p.z0 }, { x: p.u1, y: p.z1 }, { x: p.u0, y: p.z1 }];
    case "tri": return [{ x: p.u0, y: p.z0 }, { x: p.u1, y: p.z0 }, { x: (p.u0 + p.u1) / 2, y: p.z1 }];
    case "disc": {
      const cu = (p.u0 + p.u1) / 2, cz = (p.z0 + p.z1) / 2, k = 1 / Math.cos(Math.PI / 8);
      const ru = ((p.u1 - p.u0) / 2) * k, rz = ((p.z1 - p.z0) / 2) * k; // semi-axes of the circumscribed ellipse: the sides touch the rectangle
      return Array.from({ length: 8 }, (_, i) => ({ x: cu + ru * Math.cos(Math.PI / 8 + (i * Math.PI) / 4), y: cz + rz * Math.sin(Math.PI / 8 + (i * Math.PI) / 4) }));
    }
  }
}

/** One face per plate, in order, on the edge a→b. `plates` arrives already filtered to those of that edge. */
export function plateFaces(wall: Face, a: Vec2, b: Vec2, plates: readonly Plate[]): Face[] {
  const at = (u: number, z: number): Vec3 => v3(a.x + (b.x - a.x) * u, a.y + (b.y - a.y) * u, z);
  return plates.map((p) => ({ pts: plateOutline(p).map((q) => at(q.x, q.y)), normal: wall.normal, mat: p.mat, tone: wall.tone, toneOffset: p.toneOffset ?? 0 }));
}
