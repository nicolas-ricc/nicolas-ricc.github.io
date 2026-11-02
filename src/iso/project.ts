import { normalize, v3, type Vec2, type Vec3 } from "./geometry";

/** Vertical exaggeration: buildings are stretched so they project a profile. */
export const Z_SCALE = 1.4;

/**
 * Direction toward the camera: the same one `project()` collapses when
 * projecting (same coefficients as the formula below), normalized. Used to
 * discard hidden faces.
 */
export const VIEW_DIR: Vec3 = normalize(v3(Z_SCALE, Z_SCALE, 1));

/** World (x east, y south, z up) → screen. */
export function project(v: Vec3): Vec2 {
  return { x: v.x - v.y, y: (v.x + v.y) / 2 - v.z * Z_SCALE };
}

/** Does the ray from `p` toward the camera (direction `(Z_SCALE, Z_SCALE, 1)`, the one `project()` collapses) cross the box min..max? Touching it does not count. */
export function occluded(p: Vec3, min: Vec3, max: Vec3): boolean {
  const d = [Z_SCALE, Z_SCALE, 1], o = [p.x, p.y, p.z], lo = [min.x, min.y, min.z], hi = [max.x, max.y, max.z];
  let t0 = -Infinity, t1 = Infinity;
  for (let i = 0; i < 3; i++) { const a = (lo[i]! - o[i]!) / d[i]!, c = (hi[i]! - o[i]!) / d[i]!; t0 = Math.max(t0, Math.min(a, c)); t1 = Math.min(t1, Math.max(a, c)); }
  return t1 > 1e-9 && t0 < t1 - 1e-9;
}
