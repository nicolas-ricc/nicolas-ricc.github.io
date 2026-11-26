import { v3, type Vec2 } from "../iso/geometry";
import type { Solid } from "../iso/solids";
import { chamferedRect } from "../kit/forms/composite";

/**
 * Where the hotel's block stands and the RESUME sign's numbers and backing plate: pure geometry, no kit or scene (only the `chamferedRect` form), so `src/city/zoning.ts` can read the plate
 * without importing the hotel's building (`sign-hotel.ts` reaches `city/lights.ts`, which imports zoning).
 */

/** The hotel's block: the lot (73, 234, 54 × 81) minus the 1.5 sidewalk; its roof z; its center; the corner chamfer. */
export const HOTEL_BLOCK = { x0: 74.5, y0: 235.5, x1: 125.5, y1: 313.5 }, HOTEL_ROOF = 60, HOTEL_CENTER: Vec2 = { x: 100, y: 274.5 }, BLOCK_CHAMFER = 2.4;

/** The block's footprint (chamfered rect), displaced by `d`. */
export const blockFootprint = (d: Vec2 = { x: 0, y: 0 }): Vec2[] => chamferedRect(HOTEL_BLOCK.x0 + d.x, HOTEL_BLOCK.y0 + d.y, HOTEL_BLOCK.x1 - HOTEL_BLOCK.x0, HOTEL_BLOCK.y1 - HOTEL_BLOCK.y0, BLOCK_CHAMFER);

/** Cap height of the marquee word and the tracking that opens its air. */
export const HOTEL_CAP = 12, HOTEL_TRACKING = 0.07;
/** The word's stretch along its plane (the facade runs along −y, foreshortened: the stretch gives it back its aspect), baseline z, front face x, extrusion depth, and the y of the ink's south end. */
export const SIGN_STRETCH = 1.17, SIGN_Z0 = 61.6, SIGN_FRONT_X = 123, LETTER_DEPTH = 1.2, SIGN_INK_S = 312.86;
/** The navy plate behind the letters: gap to their backs, thickness, top of the lattice. */
export const PANEL_GAP = 0.06, PANEL_T = 0.3, SIGN_TOP = 75;

/** The plate behind the word: navy, from z 59 (sunk into the block's crown) to 74.1, 1.26 behind the letters' face. */
export const SIGN_BACKING: Solid & { kind: "prism" } = { kind: "prism", at: v3(SIGN_FRONT_X - LETTER_DEPTH - PANEL_GAP - PANEL_T, 239.1, 59), w: PANEL_T, d: 74.2, h: 15.1, mat: "navy", interlocks: true };
