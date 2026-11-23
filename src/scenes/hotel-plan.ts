import { v3, type Vec2, type Vec3 } from "../iso/geometry";
import type { Solid } from "../iso/solids";

/**
 * Where the hotel's slab and the RESUME sign's panel stand: pure geometry, no kit, so `src/city/zoning.ts` can read the panel
 * without importing the hotel's building (`sign-hotel.ts` reaches `city/lights.ts`, which imports zoning).
 */

const R2 = Math.SQRT1_2;
export const U = v3(R2, -R2, 0), N = v3(R2, R2, 0); // along the slab, toward the camera

/** The hotel's office slab: center of its axis on the lot, half length along U, thickness along N, and its z span. */
export const HOTEL_SLAB = { center: { x: 100, y: 259.5 }, half: 32, thick: 8, z0: 10, z1: 51 };
/** Cap height of the marquee word and the tracking that opens its air; the sign's margin, panel gap, thickness, length and bottom z. */
export const HOTEL_CAP = 12, HOTEL_TRACKING = 0.07, SIGN_MARGIN = 2.4, PANEL_GAP = 0.06, PANEL_T = 0.6, PANEL_L = 64, SIGN_Z0 = 31.5;
/** Top of the panel: the cap plus a margin above and below. */
export const PANEL_Z1 = SIGN_Z0 + HOTEL_CAP + 2 * SIGN_MARGIN;

const C = HOTEL_SLAB.center, T2 = HOTEL_SLAB.thick / 2;

/** Point at `t` along U and `n` along N from the slab's axis center, displaced by `d`. */
export const on = (t: number, n: number, z: number, d: Vec3 = v3(0, 0, 0)): Vec3 => v3(C.x + U.x * t + N.x * n + d.x, C.y + U.y * t + N.y * n + d.y, z + d.z);

/** The slab's footprint: center ± half·U ± (thick/2)·N. */
export const slabFootprint = (): Vec2[] => [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => { const p = on(a! * HOTEL_SLAB.half, b! * T2, 0); return { x: p.x, y: p.y }; });

/** The dark glass panel behind the word, flush against the slab's southeast face, displaced by `d`. */
export function panelAt(d: Vec3): Solid & { kind: "poly" } {
  const P = (t: number, n: number) => { const p = on(t, n, 0, d); return { x: p.x, y: p.y }; };
  return { kind: "poly", footprint: [P(-PANEL_L / 2, T2), P(PANEL_L / 2, T2), P(PANEL_L / 2, T2 + PANEL_T), P(-PANEL_L / 2, T2 + PANEL_T)], z: SIGN_Z0 + d.z, h: PANEL_Z1 - SIGN_Z0, mat: "glass" };
}
export const SIGN_PANEL = panelAt(v3(0, 0, 0));
