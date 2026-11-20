import { ISO_COLORS, type AccentColor } from "../map/palette-iso";
import { v3, type Vec3 } from "./geometry";
import { project, Z_SCALE } from "./project";

/**
 * Artificial light: drawn on top of everything with "add" blend. A dot (lamp, with halo), a polygon (lit window, beam) or a spot (functional light, `spot()`: a haloless diamond poly).
 * A polygon with `bloom: false` gets no mirror in the stage's bloom (paint, not neon), like an `AnimLayer` with `bloom: false`.
 */
export type Accent =
  | { kind: "dot"; at: Vec3; r: number; color: AccentColor }
  | { kind: "poly"; pts: Vec3[]; color: AccentColor; alpha?: number; bloom?: false };

/** Haloless point light: a 4-point diamond poly of radius `r` around `at` (`drawAccents` halos only dots). Points: +x/−y, top, −x/+y, bottom. */
export function spot(at: Vec3, r: number, color: AccentColor, alpha = 1): Accent {
  const h = r / 2, dz = r / Z_SCALE;
  return { kind: "poly", pts: [v3(at.x + h, at.y - h, at.z), v3(at.x, at.y, at.z + dz), v3(at.x - h, at.y + h, at.z), v3(at.x, at.y, at.z - dz)], color, alpha };
}

export type AccentItem =
  | { kind: "dot"; x: number; y: number; r: number; color: number }
  | { kind: "poly"; pts: number[]; color: number; alpha: number };

export function accentItem(a: Accent): AccentItem {
  if (a.kind === "dot") {
    const p = project(a.at);
    return { kind: "dot", x: p.x, y: p.y, r: a.r, color: ISO_COLORS[a.color] };
  }
  return { kind: "poly", pts: a.pts.flatMap((v) => { const s = project(v); return [s.x, s.y]; }), color: ISO_COLORS[a.color], alpha: a.alpha ?? 1 };
}
