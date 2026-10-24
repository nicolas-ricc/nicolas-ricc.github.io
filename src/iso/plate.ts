import type { Material } from "../map/palette-iso";
import { v3, type Vec2, type Vec3 } from "./geometry";
import type { Face } from "./solids";

/**
 * Placa coplanar sobre una pared: `wall` es el índice de la arista de la huella, `u0..u1` fracciones 0..1 a lo largo de ella,
 * `z0..z1` absolutos. `rect` es el rectángulo, `disc` el octógono inscripto en él, `tri` un isósceles con base en `z0` y vértice en `z1`.
 * Sale después de su pared (y de la fachada), con la normal y el tono de la pared.
 */
export interface Plate { wall: number; shape: "rect" | "disc" | "tri"; u0: number; u1: number; z0: number; z1: number; mat: Material; toneOffset?: number }

/** Contorno de la placa en coordenadas (u, z). */
function outline(p: Plate): Vec2[] {
  if (p.shape === "tri") return [{ x: p.u0, y: p.z0 }, { x: p.u1, y: p.z0 }, { x: (p.u0 + p.u1) / 2, y: p.z1 }];
  if (p.shape === "rect") return [{ x: p.u0, y: p.z0 }, { x: p.u1, y: p.z0 }, { x: p.u1, y: p.z1 }, { x: p.u0, y: p.z1 }];
  const cu = (p.u0 + p.u1) / 2, cz = (p.z0 + p.z1) / 2, k = 1 / Math.cos(Math.PI / 8);
  const ru = ((p.u1 - p.u0) / 2) * k, rz = ((p.z1 - p.z0) / 2) * k; // semiejes del círculo circunscripto: los lados tocan el rectángulo
  return Array.from({ length: 8 }, (_, i) => ({ x: cu + ru * Math.cos(Math.PI / 8 + (i * Math.PI) / 4), y: cz + rz * Math.sin(Math.PI / 8 + (i * Math.PI) / 4) }));
}

/** Una cara por placa, en orden, sobre la arista a→b. `plates` ya viene filtrada a las de esa arista. */
export function plateFaces(wall: Face, a: Vec2, b: Vec2, plates: readonly Plate[]): Face[] {
  const at = (u: number, z: number): Vec3 => v3(a.x + (b.x - a.x) * u, a.y + (b.y - a.y) * u, z);
  return plates.map((p) => ({ pts: outline(p).map((q) => at(q.x, q.y)), normal: wall.normal, mat: p.mat, tone: wall.tone, toneOffset: p.toneOffset ?? 0 }));
}
