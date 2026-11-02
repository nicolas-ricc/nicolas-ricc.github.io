import { normalize, v3, type Vec2, type Vec3 } from "./geometry";

/** Exageración vertical: los edificios se estiran para que proyecten perfil. */
export const Z_SCALE = 1.4;

/**
 * Dirección hacia la cámara: la misma que `project()` colapsa al proyectar
 * (mismos coeficientes que la fórmula de abajo), normalizada. Para descartar
 * caras ocultas.
 */
export const VIEW_DIR: Vec3 = normalize(v3(Z_SCALE, Z_SCALE, 1));

/** Mundo (x este, y sur, z arriba) → pantalla. */
export function project(v: Vec3): Vec2 {
  return { x: v.x - v.y, y: (v.x + v.y) / 2 - v.z * Z_SCALE };
}

/** ¿El rayo de `p` hacia la cámara (dirección `(Z_SCALE, Z_SCALE, 1)`, la que `project()` colapsa) atraviesa la caja min..max? Tocarla no cuenta. */
export function occluded(p: Vec3, min: Vec3, max: Vec3): boolean {
  const d = [Z_SCALE, Z_SCALE, 1], o = [p.x, p.y, p.z], lo = [min.x, min.y, min.z], hi = [max.x, max.y, max.z];
  let t0 = -Infinity, t1 = Infinity;
  for (let i = 0; i < 3; i++) { const a = (lo[i]! - o[i]!) / d[i]!, c = (hi[i]! - o[i]!) / d[i]!; t0 = Math.max(t0, Math.min(a, c)); t1 = Math.min(t1, Math.max(a, c)); }
  return t1 > 1e-9 && t0 < t1 - 1e-9;
}
