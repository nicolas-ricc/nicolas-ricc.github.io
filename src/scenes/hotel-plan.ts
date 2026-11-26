import { v3, type Vec2, type Vec3 } from "../iso/geometry";
import type { Solid } from "../iso/solids";
import { chamferedRect } from "../kit/forms/composite";

/**
 * Where the hotel's block stands, and (until #494's sign lands) where the RESUME sign's panel stood: pure geometry, no kit or scene (only the `chamferedRect` form), so `src/city/zoning.ts` can read the panel
 * without importing the hotel's building (`sign-hotel.ts` reaches `city/lights.ts`, which imports zoning).
 */

/** The hotel's block: the lot (73, 234, 54 × 81) minus the 1.5 sidewalk; its roof z; its center; the corner chamfer. */
export const HOTEL_BLOCK = { x0: 74.5, y0: 235.5, x1: 125.5, y1: 313.5 }, HOTEL_ROOF = 60, HOTEL_CENTER: Vec2 = { x: 100, y: 274.5 }, BLOCK_CHAMFER = 2.4;

/** The block's footprint (chamfered rect), displaced by `d`. */
export const blockFootprint = (d: Vec2 = { x: 0, y: 0 }): Vec2[] => chamferedRect(HOTEL_BLOCK.x0 + d.x, HOTEL_BLOCK.y0 + d.y, HOTEL_BLOCK.x1 - HOTEL_BLOCK.x0, HOTEL_BLOCK.y1 - HOTEL_BLOCK.y0, BLOCK_CHAMFER);

const R2 = Math.SQRT1_2;
const U = v3(R2, -R2, 0), N = v3(R2, R2, 0); // along the old 45° slab (gone with #494; Task 3 rewrites the sign)

/** Cap height of the marquee word and the tracking that opens its air; the sign's margin, panel gap, thickness, length and bottom z. */
export const HOTEL_CAP = 12, HOTEL_TRACKING = 0.07, SIGN_MARGIN = 2.4, PANEL_GAP = 0.06, PANEL_T = 0.6, PANEL_L = 64, SIGN_Z0 = 31.5;
/** Top of the panel: the cap plus a margin above and below. */
export const PANEL_Z1 = SIGN_Z0 + HOTEL_CAP + 2 * SIGN_MARGIN;

const C = { x: 100, y: 259.5 }, T2 = 4; // the old slab: center of its axis and half its thickness, literal numbers

/** Point at `t` along U and `n` along N from the old slab's axis center, displaced by `d`. */
export const signOn = (t: number, n: number, z: number, d: Vec3 = v3(0, 0, 0)): Vec3 => v3(C.x + U.x * t + N.x * n + d.x, C.y + U.y * t + N.y * n + d.y, z + d.z);

/** The dark glass panel behind the word, flush against the slab's southeast face, displaced by `d`. */
export function panelAt(d: Vec3): Solid & { kind: "poly" } {
  const P = (t: number, n: number) => { const p = signOn(t, n, 0, d); return { x: p.x, y: p.y }; };
  return { kind: "poly", footprint: [P(-PANEL_L / 2, T2), P(PANEL_L / 2, T2), P(PANEL_L / 2, T2 + PANEL_T), P(-PANEL_L / 2, T2 + PANEL_T)], z: SIGN_Z0 + d.z, h: PANEL_Z1 - SIGN_Z0, mat: "glass" };
}
export const SIGN_PANEL = panelAt(v3(0, 0, 0));
