import { v3, type Vec3 } from "./geometry";
import type { MeshFace } from "./solids";

/**
 * Test-only fixture (#453): the six faces of the box `at`..`at + (w, d, h)`, each counter-clockwise seen from outside,
 * in the order top (+z), bottom (−z), east (+x), west (−x), south (+y), north (−y).
 */
export function meshBox(at: Vec3, w: number, d: number, h: number): MeshFace[] {
  const x0 = at.x, y0 = at.y, z0 = at.z, x1 = x0 + w, y1 = y0 + d, z1 = z0 + h;
  return [
    { pts: [v3(x0, y0, z1), v3(x1, y0, z1), v3(x1, y1, z1), v3(x0, y1, z1)] },
    { pts: [v3(x0, y0, z0), v3(x0, y1, z0), v3(x1, y1, z0), v3(x1, y0, z0)] },
    { pts: [v3(x1, y0, z0), v3(x1, y1, z0), v3(x1, y1, z1), v3(x1, y0, z1)] },
    { pts: [v3(x0, y0, z0), v3(x0, y0, z1), v3(x0, y1, z1), v3(x0, y1, z0)] },
    { pts: [v3(x0, y1, z0), v3(x0, y1, z1), v3(x1, y1, z1), v3(x1, y1, z0)] },
    { pts: [v3(x0, y0, z0), v3(x1, y0, z0), v3(x1, y0, z1), v3(x0, y0, z1)] },
  ];
}
