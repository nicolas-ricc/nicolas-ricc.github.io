import type { Tone } from "../map/palette-iso";
import { convexHull, dot, normalize, type Vec2, type Vec3 } from "./geometry";
import { Z_SCALE } from "./project";
import { isFlat, tessellateAll, type Solid } from "./solids";

export const SUN_ELEVATION = (25 * Math.PI) / 180;

/** Unit vector toward the sun: west-southwest and low. So the south wall is lit and the east one in shadow. */
export const TO_SUN: Vec3 = normalize({
  x: -0.894 * Math.cos(SUN_ELEVATION),
  y: 0.447 * Math.cos(SUN_ELEVATION),
  z: Math.sin(SUN_ELEVATION),
});

/** Where the shadow falls in the plane (ENE). */
export const SHADOW_DIR: Vec2 = { x: 0.894, y: -0.447 };

/** Shadow units per unit of height (the exaggerated height also lengthens the shadow). */
export const SHADOW_PER_UNIT = Z_SCALE / Math.tan(SUN_ELEVATION);

const TOP_MIN_Z = 0.997;   // above this: flat roof
const SLOPE_MIN_Z = 0.3;   // between this and TOP_MIN_Z: slope

/** Five tones by normal: roof, slope facing/away from the sun, lit/shaded wall. */
export function shadeTone(n: Vec3): Tone {
  if (n.z > TOP_MIN_Z) return "top";
  if (n.z > SLOPE_MIN_Z) return dot(n, TO_SUN) > TO_SUN.z ? "up" : "down";
  return dot(n, TO_SUN) > 0 ? "lit" : "shade";
}

/** Maximum height that casts a shadow: a 30-tall tower shades like an 18 one and does not cross three blocks. */
export const SHADOW_MAX_H = 18;
/** Core cap: the lower half of the solid casts the dense band; the tip gets only the soft band. */
export const SHADOW_CORE_H = 9;

/** Where the ray through p hits the ground (z = 0), with the height clamped to `maxH`. */
export function shadowPoint(p: Vec3, maxH = SHADOW_MAX_H): Vec2 {
  const len = Math.min(Math.max(0, p.z), maxH) * SHADOW_PER_UNIT;
  return { x: p.x + SHADOW_DIR.x * len, y: p.y + SHADOW_DIR.y * len };
}

/**
 * Ground shadow: convex hull of all vertices projected by the sun.
 * Vertices below ground stay where they are (the sunken part blocks no light).
 * Flat or fully sunken solids cast nothing. A smaller `maxH` yields the core.
 */
export function shadowPolygon(s: Solid, maxH = SHADOW_MAX_H): Vec2[] | null {
  if (isFlat(s)) return null;
  const pts: Vec2[] = [];
  let above = false;
  for (const f of tessellateAll(s)) for (const p of f.pts) {
    if (p.z > 0) above = true;
    pts.push(shadowPoint(p, maxH));
  }
  if (!above) return null;
  return convexHull(pts);
}
